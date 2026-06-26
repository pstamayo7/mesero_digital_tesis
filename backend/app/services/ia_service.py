# backend/app/services/ia_service.py
import ollama
import json
import pyttsx3
import os
import uuid
import copy
from app.core.database import get_db_connection
from faster_whisper import WhisperModel
from app.schemas.pedido_schema import SalidaLLM, OrdenEstructurada, ItemPedido, ModificacionStruct,InteraccionBienvenida
print("⏳ Cargando modelo acústico (Faster-Whisper)...")
modelo_whisper = WhisperModel("small", device="cpu", compute_type="int8")
print("✅ Oído de IA listo.")

def _normalizar(texto: str) -> str:
    """Punto único de normalización para cruzar nombres LLM <-> BD: sin espacios fantasma ni distinción de mayúsculas."""
    return (texto or "").strip().lower()

# 🚫 TAREA 1: Subcadenas de alucinaciones típicas de Whisper en silencios/ruido de fondo
# (subtítulos de YouTube, anuncios de Amara.org, etc.). Case-insensitive.
FRASES_ALUCINACION_WHISPER = ["amara", "suscribe", "suscríbete", "subtítulo", "gracias por ver"]

def _respuesta_audio_invalido():
    """JSON exacto que se devuelve cuando el audio es ruido/silencio o Whisper colapsó.
    No llamamos a Ollama en este caso: no hay texto válido que razonar."""
    return {
        "audio_invalido": True,
        "razonamiento": "Audio inválido o ruido.",
        "respuesta_mesero": "¿Me puedes repetir? No te escuché bien.",
        "numero_mesa": 0,
        "acciones": []
    }

def _corregir_confusion_de_entidades(acciones, carrito_list):
    """
    🛡️ GUARDRAIL ANTI-CONFUSIÓN DE ENTIDADES: pedido_schema.py ya marcó con
    es_ingrediente_disfrazado=True cualquier acción donde el LLM puso un ingrediente/extra
    conocido (ej. "Fritada", "Mote") en el campo 'plato'. Aquí esas acciones se reconvierten
    en una modificación EXTRA del plato al que en realidad pertenecen, en vez de dejarlas
    crear un "plato" fantasma que termina cobrando $0.00.

    Prioridad para encontrar el plato dueño del extra:
    1. El último plato real agregado en esta misma respuesta del LLM.
    2. El último plato ya existente en el carrito (caso "ponle mote" sin mencionar plato).
    3. Si no hay ningún plato al que anclarlo, se trata como porción suelta para que
       al menos cobre el precio correcto del ingrediente.
    """
    acciones_corregidas = []
    ultimo_plato_real = None

    for accion in acciones:
        if not accion.es_ingrediente_disfrazado:
            if accion.accion.upper() == "AGREGAR" and accion.plato:
                ultimo_plato_real = accion
            acciones_corregidas.append(accion)
            continue

        extra = ModificacionStruct(tipo="EXTRA", ingrediente=accion.plato)

        if ultimo_plato_real is not None:
            if ultimo_plato_real.modificaciones is None:
                ultimo_plato_real.modificaciones = []
            ultimo_plato_real.modificaciones.append(extra)
        elif carrito_list:
            item_carrito = carrito_list[-1]
            mods_existentes = item_carrito.setdefault("mods_estructuradas", [])
            mods_existentes.append(extra.model_dump())
            # Mantenemos el string visual ("modificaciones") en sincronía con
            # mods_estructuradas para que el frontend no muestre un texto desactualizado.
            item_carrito["modificaciones"] = ", ".join(
                f"{m['tipo'].upper()} {m['ingrediente']}" for m in sorted(mods_existentes, key=lambda x: f"{x['tipo']} {x['ingrediente']}")
            )
        else:
            accion.plato = f"Porción de {accion.plato}"
            acciones_corregidas.append(accion)

    return acciones_corregidas

def obtener_menu_disponible():
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        cursor.execute("SELECT nombre FROM Plato;")
        platos = cursor.fetchall()
        cursor.close()
        conexion.close()
        return [plato[0].strip() for plato in platos]
    except Exception as e:
        print(f"⚠️ Error BD: {e}")
        return ["Fritada Tradicional", "Fritada Especial Doble", "Llapingachos", "Cola Grande"]
def obtener_ingredientes_disponibles():
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        cursor.execute("SELECT nombre FROM Ingrediente;")
        ingredientes = cursor.fetchall()
        cursor.close()
        conexion.close()
        return [ingrediente[0].strip() for ingrediente in ingredientes]
    except Exception as e:
        print(f"⚠️ Error BD Ingredientes: {e}")
        return ["Mote", "Tostado", "Maduro", "Cebolla", "Chicharrón", "Aguacate", "Tomate"]
def obtener_diccionario_precios():
    """Obtiene los precios base de platos y extras de una sola vez."""
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()

        # Extraemos { "fritada tradicional": 5.00, "llapingachos": 3.50 }
        cursor.execute("SELECT nombre, precio_base FROM Plato;")
        platos = {_normalizar(row[0]): float(row[1]) for row in cursor.fetchall()}

        # Extraemos { "mote": 0.50, "aguacate": 1.00 }
        cursor.execute("SELECT nombre, precio_extra FROM Ingrediente;")
        extras = {_normalizar(row[0]): float(row[1]) for row in cursor.fetchall()}

        cursor.close()
        conexion.close()
        return platos, extras
    except Exception as e:
        print(f"⚠️ Error BD Precios: {e}")
        return {}, {}
def validar_stock_carrito(carrito_list):
    """
    Calcula el consumo total de ingredientes del carrito (Recetas + Extras - SIN) 
    y verifica si hay suficiente stock en la base de datos.
    """
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()

        # 1. Traer stock y tamaño de porciones
        cursor.execute("SELECT nombre, stock_actual, cantidad_porcion FROM Ingrediente;")
        ingredientes_db = {}
        for row in cursor.fetchall():
            nombre_ing = _normalizar(row[0])
            ingredientes_db[nombre_ing] = {
                "stock": float(row[1]),
                "porcion": float(row[2])
            }

        # 2. Traer las recetas
        cursor.execute("""
            SELECT p.nombre, i.nombre, r.cantidad_base
            FROM Receta r
            JOIN Plato p ON r.id_plato = p.id_plato
            JOIN Ingrediente i ON r.id_ingrediente = i.id_ingrediente;
        """)
        recetas_db = {}
        for row in cursor.fetchall():
            plato = _normalizar(row[0])
            ingrediente = _normalizar(row[1])
            cantidad = float(row[2])
            if plato not in recetas_db:
                recetas_db[plato] = {}
            recetas_db[plato][ingrediente] = cantidad

        cursor.close()
        conexion.close()

        # 3. Calcular consumo requerido por este carrito
        consumo_requerido = {}

        def agregar_consumo(nombre_buscado, cantidad_a_sumar):
            for db_nombre, datos in ingredientes_db.items():
                if nombre_buscado in db_nombre or db_nombre in nombre_buscado:
                    consumo_requerido[db_nombre] = consumo_requerido.get(db_nombre, 0.0) + cantidad_a_sumar
                    return db_nombre
            return None

        for item in carrito_list:
            plato_nombre = _normalizar(item["plato"])
            cantidad_plato = item["cantidad"]

            # A. Consumo del Plato Base (o Porción Suelta)
            if plato_nombre.startswith("porción de"):
                ing_solo = plato_nombre.replace("porción de", "").strip()
                for db_nombre, datos in ingredientes_db.items():
                    if ing_solo in db_nombre or db_nombre in ing_solo:
                        agregar_consumo(db_nombre, datos["porcion"] * cantidad_plato)
                        break
            else:
                if plato_nombre in recetas_db:
                    for ing_receta, cant_base in recetas_db[plato_nombre].items():
                        agregar_consumo(ing_receta, cant_base * cantidad_plato)

            # B. Consumo de las Modificaciones (EXTRAS suman, SIN restan)
            for mod in item.get("mods_estructuradas", []):
                tipo_mod = mod.get("tipo", "").upper()
                ing_mod = _normalizar(mod.get("ingrediente", ""))

                for db_nombre, datos in ingredientes_db.items():
                    if ing_mod in db_nombre or db_nombre in ing_mod:
                        if tipo_mod == "EXTRA":
                            agregar_consumo(db_nombre, datos["porcion"] * cantidad_plato)
                        elif tipo_mod == "SIN":
                            agregar_consumo(db_nombre, -datos["porcion"] * cantidad_plato)
                        break

        # 4. Verificar contra el stock real
        for ing, cant_req in consumo_requerido.items():
            if cant_req > 0: # Si quedó negativo por muchos "SIN", no hay problema
                stock_disponible = ingredientes_db[ing]["stock"]
                if cant_req > stock_disponible:
                    nombre_bonito = ing.split("(")[0].strip().title()
                    return {
                        "valido": False, 
                        "ingrediente": nombre_bonito, 
                        "stock": stock_disponible
                    }

        return {"valido": True, "consumo": consumo_requerido}

    except Exception as e:
        print(f"⚠️ Error validando stock: {e}")
        return {"valido": True} # Si falla la DB, dejamos pasar para no bloquear la venta

def generar_voz_offline(texto: str, ruta_salida: str):
    """Genera un archivo de audio usando el motor local de la computadora (Edge AI)"""
    engine = pyttsx3.init()
    # Ajustamos la velocidad para que suene más natural
    engine.setProperty('rate', 150) 
    engine.save_to_file(texto, ruta_salida)
    engine.runAndWait()

def obtener_limite_platos():
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        cursor.execute("SELECT max_platos_kiosko FROM Configuracion_Operativa LIMIT 1;")
        resultado = cursor.fetchone()
        cursor.close()
        conexion.close()
        return resultado[0] if resultado else 15
    except Exception as e:
        print(f"⚠️ Error BD al obtener límite: {e}")
        return 15

def procesar_audio_con_ia(ruta_temporal_audio: str, carrito_actual: str):
    # FASE A: ESCUCHAR
    print("🧠 1/3 Transcribiendo audio de pedido...")
    
    glosario_zita = "Fritada, llapingachos, mote, tostado, maduro, chicharrón, chorizo, combo, bandeja, chicha, menú, porción, pedido, colas."

    # 🛡️ TAREA 1: Whisper puede colapsar (EOFError/RuntimeError) con audios vacíos o
    # corruptos. Si eso pasa, abortamos ANTES de llamar a Ollama: no hay texto que razonar.
    try:
        segmentos, info = modelo_whisper.transcribe(
            ruta_temporal_audio, beam_size=5, language="es", initial_prompt=glosario_zita
        )
        texto_completo = " ".join([segmento.text for segmento in segmentos]).strip()
    except Exception as e:
        print(f"⚠️ Whisper colapsó transcribiendo el audio: {e}")
        return _respuesta_audio_invalido()

    print(f"🗣️ CLIENTE: '{texto_completo}'")

    # 🚫 Filtro anti-alucinaciones: Whisper a veces "escucha" subtítulos de YouTube o
    # publicidad en el silencio/ruido de fondo. Si detectamos esas frases típicas,
    # tampoco llamamos a Ollama con basura.
    texto_low = texto_completo.lower()
    if any(frase in texto_low for frase in FRASES_ALUCINACION_WHISPER):
        print(f"🚫 Alucinación de Whisper detectada en: '{texto_completo}'")
        return _respuesta_audio_invalido()

    # FASE B: RAZONAR INTENCIONES
    print("🤖 2/3 Analizando intención...")
    menu_real = obtener_menu_disponible()
    menu_formateado = "\n".join([f'- "{plato}"' for plato in menu_real])

    ingredientes_reales = obtener_ingredientes_disponibles()
    ingredientes_formateados = ", ".join(ingredientes_reales)

    limite_maximo = obtener_limite_platos()

    prompt_sistema = f"""
    Eres el mesero digital del restaurante 'Fritadas Doña Zita'.

    Existen DOS catálogos de entidades, TOTALMENTE SEPARADOS. No los mezcles nunca.

    📋 [LISTA DE PLATOS PRINCIPALES] (esto es lo ÚNICO que puede ir en el campo "plato"):
    {menu_formateado}

    🍅 [LISTA DE INGREDIENTES/EXTRAS] (esto NUNCA va en el campo "plato", solo dentro de "modificaciones"):
    {ingredientes_formateados}

    🛒 ESTADO ACTUAL DEL CARRITO:
    {carrito_actual}

    🚨 REGLAS DE ENTIDADES (PRIORIDAD MÁXIMA, NUNCA LAS ROMPAS):

    A. REGLA DE ENTIDADES: NUNCA, bajo ninguna circunstancia, coloques un ítem de la [LISTA DE INGREDIENTES/EXTRAS]
       en el campo "plato". El campo "plato" es EXCLUSIVO para nombres de la [LISTA DE PLATOS PRINCIPALES].

    B. REGLA DE EXTRAS: Los ingredientes o extras SIEMPRE deben ir dentro del array "modificaciones" del plato
       al que pertenecen, como objetos {{"tipo": "EXTRA", "ingrediente": "..."}}. Jamás como un "plato" aparte.

    C. REGLA DE CONTEXTO AISLADO: Si el cliente SOLO pide un extra (ej. "ponle extra mote", "agrégale aguacate")
       y NO menciona ningún plato nuevo, debes generar una acción de modificación sobre el ÚLTIMO plato
       mencionado en esta misma frase o el que ya está en el carrito (🛒 ESTADO ACTUAL DEL CARRITO). NO inventes
       platos nuevos ni uses el nombre del ingrediente como "plato".

    🚨 REGLAS CRÍTICAS DE LÓGICA Y FORMATO (¡LEER CON ATENCIÓN!):

    1. FORMATO DE MODIFICACIONES (ANTI-CRASH):
       - El campo "modificaciones" SIEMPRE, SIEMPRE debe ser una lista.
       - Si el plato es normal, usa EXACTAMENTE [].
       - Si hay modificaciones, usa OBLIGATORIAMENTE objetos: [{{"tipo": "EXTRA", "ingrediente": "Mote"}}].
       - 🚫 ESTRICTAMENTE PROHIBIDO usar listas de strings como ["EXTRA Mote"]. ¡Solo objetos JSON!
       - Tipos permitidos: "SIN", "EXTRA", "POCO". NUNCA "CON".

    2. MATEMÁTICA DE SUBDIVISIÓN (Pedidos Nuevos):
       - Si pide "N" platos en total, pero "M" tienen cambios, RESTA (N - M).
       - Ejemplo: "3 combos 1, 1 sin mote" -> AGREGAR 2 normales ([]), AGREGAR 1 modificada ([{{"tipo": "SIN", "ingrediente": "Mote"}}]).

   3. ⚠️ INTERCAMBIO vs REPETICIÓN (¡DIFERENCIA VITAL!):
       - REPETICIÓN (CLONAR): Si el cliente quiere OTRO plato IGUAL (ej. "agrega otra igual", "otra con los mismos extras"), NO QUITES NADA. Solo usa AGREGAR y copia las modificaciones del carrito.
       - INTERCAMBIO (MODIFICAR UN PLATO EXISTENTE): Si el cliente quiere ALTERAR un plato que YA ESTÁ en el carrito
         (ej. "al plato típico que tengo ponle mote", "a la fritada que ya tengo, quítale el mote"), usa UNA SOLA
         acción con "accion": "MODIFICAR". NUNCA generes QUITAR+AGREGAR para este caso.
         - El campo "cantidad" de la acción MODIFICAR es CUÁNTAS unidades de ese plato reciben el cambio:
           * Si el cambio aplica a TODAS las unidades de ese plato en el carrito, usa la cantidad total.
           * Si el cambio aplica solo a ALGUNAS (ej. "de los 3 platos típicos, a 1 ponle mote"), usa solo esa cantidad.
         - El campo "modificaciones" de la acción MODIFICAR debe llevar el estado FINAL completo de modificaciones
           que ese plato debe tener (no solo lo nuevo que se agrega).

    3.1 USO DE "QUITAR": "QUITAR" es SOLO para cancelar/eliminar unidades de un plato del carrito porque el
        cliente ya no las quiere (ej. "mejor quita uno", "cancela la fritada"). NUNCA lo combines con AGREGAR
        para simular una modificación: para eso existe "MODIFICAR".

    4. ⚠️ PORCIONES SUELTAS (EXTRAS COMO PLATO INDIVIDUAL):
       - Esta regla es la ÚNICA excepción a la Regla A, y SOLO aplica si el ingrediente es VERDADERAMENTE
         lo único que el cliente pidió, sin ningún plato principal en la misma frase
         (ej. "dame un maduro", "una porción de tostado", "y un mote aparte").
       - En ese caso (y solo en ese caso) AGRÉGALO como plato nuevo, con nombre que empiece SIEMPRE con
         "Porción de " seguido del ingrediente (Ej. "plato": "Porción de Plátano Maduro").
       - Si el ingrediente se pidió JUNTO a un plato principal (ej. "un plato típico con extra de fritada"),
         NO es una porción suelta: va como "modificaciones" del plato principal (ver Reglas A, B y EJEMPLO 2).

    💡 EJEMPLOS DE RAZONAMIENTO Y JSON:

    EJEMPLO 1 (Subdivisión matemática):
    Cliente: "Necesito tres Fritadas, pero dos sin mote"
    JSON:
    {{
        "razonamiento": "Pide 3 en total. 2 son SIN Mote. 3 - 2 = 1 normal. Acciones: AGREGAR 1 normal, AGREGAR 2 sin mote.",
        "respuesta_mesero": "¡Entendido! Dos sin mote y una normal.",
        "numero_mesa": 0,
        "acciones": [
            {{ "accion": "AGREGAR", "plato": "Fritada Tradicional", "cantidad": 1, "modificaciones": [] }},
            {{ "accion": "AGREGAR", "plato": "Fritada Tradicional", "cantidad": 2, "modificaciones": [{{"tipo": "SIN", "ingrediente": "Mote"}}] }}
        ]
    }}

    EJEMPLO 2 (Extra junto a un plato: NO crear un plato nuevo con el nombre del ingrediente):
    Cliente: "Dame un plato típico con extra de fritada"
    JSON:
    {{
        "razonamiento": "El cliente pide 1 'Plato Típico'. 'Fritada' es un ingrediente de la [LISTA DE INGREDIENTES/EXTRAS], no un plato, así que va como EXTRA dentro de las modificaciones del Plato Típico.",
        "respuesta_mesero": "¡Listo! Un plato típico con extra de fritada.",
        "numero_mesa": 0,
        "acciones": [
            {{ "accion": "AGREGAR", "plato": "Plato Típico", "cantidad": 1, "modificaciones": [{{"tipo": "EXTRA", "ingrediente": "Fritada"}}] }}
        ]
    }}

    EJEMPLO 3 (Intercambio: alterar TODAS las unidades de un plato ya existente en el carrito, con "MODIFICAR"):
    Carrito actual: 1 "Plato Típico" sin modificaciones.
    Cliente: "El plato típico que tengo, agrégale extra mote"
    JSON:
    {{
        "razonamiento": "El cliente quiere alterar el único Plato Típico que ya tiene en el carrito. Es un INTERCAMBIO, así que uso una sola acción MODIFICAR con la cantidad total (1) y el estado final de modificaciones.",
        "respuesta_mesero": "¡Listo! Le agregué extra de mote a tu plato típico.",
        "numero_mesa": 0,
        "acciones": [
            {{ "accion": "MODIFICAR", "plato": "Plato Típico", "cantidad": 1, "modificaciones": [{{"tipo": "EXTRA", "ingrediente": "Mote"}}] }}
        ]
    }}

    EJEMPLO 4 (Intercambio: alterar SOLO ALGUNAS unidades -> MODIFICAR divide el plato):
    Carrito actual: 3 "Plato Típico" sin modificaciones.
    Cliente: "De los 3 platos típicos, a 1 ponle mote"
    JSON:
    {{
        "razonamiento": "Hay 3 Platos Típicos en el carrito y el cliente solo quiere modificar 1 de ellos. Uso MODIFICAR con cantidad=1: el backend se encarga de separar esa unidad del resto.",
        "respuesta_mesero": "¡Listo! Uno de tus platos típicos ahora lleva extra mote.",
        "numero_mesa": 0,
        "acciones": [
            {{ "accion": "MODIFICAR", "plato": "Plato Típico", "cantidad": 1, "modificaciones": [{{"tipo": "EXTRA", "ingrediente": "Mote"}}] }}
        ]
    }}

    Tu respuesta debe ser EXCLUSIVAMENTE este formato JSON:
    {{
        "razonamiento": "Tus cálculos paso a paso aquí...",
        "respuesta_mesero": "Frase amable.",
        "numero_mesa": 0,
        "acciones": []
    }}

    Texto del cliente: "{texto_completo}"
    """
    
    respuesta_llm = ollama.chat(
        model='llama3',
        messages=[{'role': 'user', 'content': prompt_sistema}],
        format='json',
        options={
            'temperature': 0.0 # 🔴 Cero creatividad, 100% obediencia a las reglas
        }
    )
    
    json_crudo = respuesta_llm['message']['content']
    # 🌟 AÑADE ESTA LÍNEA AQUÍ PARA VER EL JSON SIEMPRE 🌟
    print("\n🤖 JSON CRUDO ENVIADO POR LA IA:\n", json_crudo, "\n")
    
   # FASE C: MATEMÁTICAS EN PYTHON Y CONSTRUCCIÓN DE CARRITO
    # FASE C: MATEMÁTICAS EN PYTHON Y CONSTRUCCIÓN DE CARRITO
    try:
        print("⚙️ 3/3 Python procesando matemáticas...")
        
        # 🛡️ INICIO DEL BLINDAJE ANTI-CRASH 🛡️
        # 1. Convertimos el texto de la IA a un diccionario nativo de Python primero
        datos_diccionario = json.loads(json_crudo)
        
        # 2. Revisamos cada acción y limpiamos las "alucinaciones" de la IA
        for accion in datos_diccionario.get("acciones", []):
            # Si la IA mandó un string "" en vez de una lista [], lo forzamos a lista
            if accion.get("modificaciones") == "":
                accion["modificaciones"] = []
                
            # Si la IA usó una lista, nos aseguramos de borrar cualquier tipo "CON"
            elif isinstance(accion.get("modificaciones"), list):
                accion["modificaciones"] = [
                    mod for mod in accion["modificaciones"] 
                    if isinstance(mod, dict) and mod.get("tipo", "").upper() != "CON"
                ]
                
        # 3. AHORA SÍ, validamos con Pydantic (usamos model_validate en vez de model_validate_json)
        # 🛡️ Le pasamos los catálogos reales por contexto para que el validador de
        # AccionLLM pueda detectar si el LLM confundió un ingrediente con un plato.
        contexto_entidades = {
            "ingredientes_conocidos": {_normalizar(i) for i in ingredientes_reales},
            "platos_conocidos": {_normalizar(p) for p in menu_real},
        }
        intenciones = SalidaLLM.model_validate(datos_diccionario, context=contexto_entidades)
        # 🛡️ FIN DEL BLINDAJE 🛡️

        # Lectura segura del carrito (Anti-crash React)
        try:
            estado_previo = json.loads(carrito_actual)
            if isinstance(estado_previo, list): # Si React mandó un []
                carrito_list = estado_previo
                estado_previo = {}
            else:
                carrito_list = estado_previo.get("pedidos", [])
        except:
            carrito_list = []
            estado_previo = {}

        # 🛡️ Reconvertimos cualquier ingrediente disfrazado de plato en una modificación
        # real del plato al que pertenece (ver _corregir_confusion_de_entidades).
        intenciones.acciones = _corregir_confusion_de_entidades(intenciones.acciones, carrito_list)

        numero_mesa_final = intenciones.numero_mesa if intenciones.numero_mesa != 0 else estado_previo.get("numero_mesa", 0)

        # 2. MATEMÁTICAS INDESTRUCTIBLES
      # 🌟 TRAEMOS LOS PRECIOS AQUÍ ARRIBA PARA NORMALIZAR LOS NOMBRES ANTES DE AGRUPAR
        precios_platos, precios_extras = obtener_diccionario_precios()

        # 2. MATEMÁTICAS INDESTRUCTIBLES
        for accion in intenciones.acciones:
            # 🛡️ TAREA 2: ModificacionStruct ya marcó como "INVALIDO" cualquier ingrediente
            # que el LLM inventó (no existe en el catálogo real). Lo descartamos aquí sin
            # afectar al resto de las modificaciones ni de la acción.
            mods_lista = [m for m in (accion.modificaciones or []) if m.ingrediente != "INVALIDO"]

            # 🌟 NORMALIZAMOS LOS NOMBRES DE LOS INGREDIENTES
            for m in mods_lista:
                m.tipo = m.tipo.upper()
                nombre_ing_low = _normalizar(m.ingrediente)

                # Buscamos su nombre oficial en la base de datos
                for db_nombre in precios_extras.keys():
                    if nombre_ing_low in db_nombre or db_nombre in nombre_ing_low:
                        # Lo renombramos a su versión limpia (ej. "Mote Cocinado")
                        m.ingrediente = db_nombre.split("(")[0].strip().title()
                        break

            # 🌟 ORDENAMOS ALFABÉTICAMENTE PARA QUE EL ORDEN NO IMPORTE 🌟
            mods_lista = sorted(mods_lista, key=lambda x: f"{x.tipo} {x.ingrediente}")

            # Ahora sí creamos el string visual uniforme (siempre estará en el mismo orden y con el mismo nombre)
            mods_str = ", ".join([f"{m.tipo} {m.ingrediente}" for m in mods_lista])
            mods_dump = [m.model_dump() for m in mods_lista]

            # 🌟 TAREA 3: ALGORITMO DE "MODIFICAR" (Split / Full-Update) 🌟
            # El LLM ya no manda QUITAR+AGREGAR para alterar un plato existente: manda
            # una sola acción "MODIFICAR". Buscamos el plato desde el final del carrito
            # hacia atrás (el más reciente que coincide con accion.plato).
            if accion.accion == "MODIFICAR":
                item_encontrado = None
                for item in reversed(carrito_list):
                    if _normalizar(item.get("plato", "")) == _normalizar(accion.plato):
                        item_encontrado = item
                        break

                if item_encontrado is not None:
                    cantidad_actual = item_encontrado.get("cantidad", 0)

                    if accion.cantidad < cantidad_actual:
                        # CASO A (Split): solo una parte de las unidades cambia.
                        # Le restamos la cantidad al ítem original...
                        item_encontrado["cantidad"] = cantidad_actual - accion.cantidad

                        # ...y clonamos un ítem nuevo con su propio cart_item_id, la
                        # cantidad modificada y las nuevas modificaciones inyectadas.
                        nuevo_item = copy.deepcopy(item_encontrado)
                        nuevo_item["cart_item_id"] = str(uuid.uuid4())
                        nuevo_item["cantidad"] = accion.cantidad
                        nuevo_item["modificaciones"] = mods_str
                        nuevo_item["mods_estructuradas"] = mods_dump
                        carrito_list.append(nuevo_item)

                    elif accion.cantidad == cantidad_actual:
                        # CASO B (Full Update): TODAS las unidades del ítem cambian.
                        # No se crea nada nuevo, se inyectan las modificaciones directo.
                        item_encontrado["modificaciones"] = mods_str
                        item_encontrado["mods_estructuradas"] = mods_dump

                    else:
                        # No contemplado por el algoritmo (el LLM pidió modificar más
                        # unidades de las que existen). Para no corromper el carrito,
                        # lo tratamos como Full Update sobre lo que sí existe.
                        item_encontrado["modificaciones"] = mods_str
                        item_encontrado["mods_estructuradas"] = mods_dump
                # Si no se encontró el plato en el carrito, no hay nada que modificar.
                continue  # El precio se recalcula más abajo para TODO carrito_list.

            # 🌟 Patrón de estado inmutable (Eliminar y Reemplazar): un QUITAR busca el ítem
            # desde el FINAL del carrito hacia atrás, ya que en un intercambio (QUITAR + AGREGAR)
            # el ítem que se debe eliminar es el más reciente que coincide, no el más antiguo.
            plato_encontrado = False
            if accion.accion == "QUITAR":
                for item in reversed(carrito_list):
                    item_mods = item.get("modificaciones", "")
                    if _normalizar(item.get("plato", "")) == _normalizar(accion.plato) and item_mods == mods_str:
                        item["cantidad"] = item.get("cantidad", 0) - accion.cantidad
                        plato_encontrado = True
                        break
            else:  # AGREGAR
                for item in carrito_list:
                    item_mods = item.get("modificaciones", "")
                    if _normalizar(item.get("plato", "")) == _normalizar(accion.plato) and item_mods == mods_str:
                        item["cantidad"] = item.get("cantidad", 0) + accion.cantidad
                        plato_encontrado = True
                        break

            if not plato_encontrado and accion.accion == "AGREGAR":
                carrito_list.append({
                    "cart_item_id": str(uuid.uuid4()),
                    "plato": accion.plato,
                    "cantidad": accion.cantidad,
                    "modificaciones": mods_str,
                    "mods_estructuradas": mods_dump
                })
        
        # Filtramos los platos que el cliente canceló
        carrito_list = [item for item in carrito_list if item["cantidad"] > 0]
        
        
        
        total_final = 0.0

        for item in carrito_list:
            nombre_plato_low = _normalizar(item["plato"])
            
            # 1. Buscamos el precio base en la tabla PLATOS
            precio_base = precios_platos.get(nombre_plato_low, 0.0) 
            
            # 🌟 2. NUEVO: SI ES UNA PORCIÓN, SACAMOS EL PRECIO DE LA TABLA INGREDIENTES 🌟
            if precio_base == 0.0 and nombre_plato_low.startswith("porción de"):
                ingrediente_solo = nombre_plato_low.replace("porción de", "").strip()
                
                for db_nombre, db_precio in precios_extras.items():
                    if ingrediente_solo in db_nombre or db_nombre in ingrediente_solo:
                        precio_base = db_precio
                        nombre_limpio = db_nombre.split("(")[0].strip().title()
                        item["plato"] = f"Porción de {nombre_limpio}"
                        print(f"🍟 Porción detectada: '{nombre_limpio}' a ${precio_base}")
                        break
            
            recargo_total_mods = 0.0
            
           # Costear las modificaciones
            for mod in item.get("mods_estructuradas", []):
                if mod.get("tipo", "").strip().upper() == "EXTRA":
                    nombre_ing_low = _normalizar(mod.get("ingrediente", ""))
                    costo_extra = 0.0
                    nombre_oficial = nombre_ing_low
                    
                    # 🌟 BÚSQUEDA FLEXIBLE (El parche para el "kg" y "u") 🌟
                    for db_nombre, db_precio in precios_extras.items():
                        # Si "mote" está dentro de "mote cocinado (kg)" (o viceversa)
                        if nombre_ing_low in db_nombre or db_nombre in nombre_ing_low:
                            costo_extra = db_precio
                            # De paso, limpiamos el "(kg)" para que en React se vea bonito
                            nombre_oficial = db_nombre.split("(")[0].strip().title()
                            break
                            
                    print(f"🔎 Buscando EXTRA: '{nombre_ing_low}' -> Encontrado como '{nombre_oficial}' con Costo: ${costo_extra}")
                    
                    mod["ingrediente"] = nombre_oficial # Actualizamos el nombre para el Frontend
                    mod["recargo"] = costo_extra
                    recargo_total_mods += costo_extra
                else:
                    # Si es "SIN" o "POCO", no cuesta extra
                    mod["recargo"] = 0.0

            # Guardamos la matemática en el item
            item["precio_unitario"] = precio_base
            item["subtotal"] = (precio_base + recargo_total_mods) * item["cantidad"]
            total_final += item["subtotal"]

        # Validamos el límite operativo
        total_platos = sum([item.get("cantidad", 0) for item in carrito_list])
        if total_platos > limite_maximo:
            print(f"🚫 LÍMITE EXCEDIDO: {total_platos}/{limite_maximo} platos")

            # 🛡️ El audio del límite ya NO es un archivo estático precargado (causaba
            # FileNotFoundError si no existía en disco). Lo generamos al vuelo con el
            # mismo motor TTS (pyttsx3) que usamos para las respuestas normales.
            mensaje_limite = (
                f"Lo siento, el límite máximo es de {limite_maximo} platos por pedido. "
                "Por favor reduce la cantidad o realiza un segundo pedido aparte."
            )
            ruta_audio_limite = "limite_excedido_temp.wav"
            generar_voz_offline(mensaje_limite, ruta_audio_limite)

            return {
                "exito": True,
                "transcripcion": texto_completo,
                "orden": {
                    "pedidos": estado_previo.get("pedidos", []),
                    "numero_mesa": numero_mesa_final,
                    "total_pedido": estado_previo.get("total_pedido", 0.0),
                    "error_stock": mensaje_limite,
                },
                "ruta_audio": ruta_audio_limite
            }

        # ... (aquí termina tu validación del límite de los 15 platos) ...

       # 🌟 NUEVO: VALIDACIÓN ESTRICTA DE INVENTARIO 🌟
        validacion_stock = validar_stock_carrito(carrito_list)
        
        texto_a_hablar = ""
        error_stock_texto = "" 
        
        if not validacion_stock["valido"]:
            ingrediente_agotado = validacion_stock["ingrediente"]
            stock_restante_kg = validacion_stock["stock"]
            print(f"🚫 STOCK INSUFICIENTE: Falta {ingrediente_agotado}")
            
            # 🌟 REVERSIÓN SEGURA: Volvemos a leer el texto original para matar la referencia en memoria
            estado_seguro = json.loads(carrito_actual)
            if isinstance(estado_seguro, list): 
                carrito_list = estado_seguro
                total_final = 0.0
            else:
                carrito_list = estado_seguro.get("pedidos", [])
                total_final = estado_seguro.get("total_pedido", 0.0)
            
            texto_a_hablar = f"Uy, lo siento muchísimo. Acabo de revisar la bodega y solo nos quedan {stock_restante_kg} porciones de {ingrediente_agotado}. ¿Te gustaría pedir otra cosa o menos cantidad?"
            
            # Preparamos el error para React
            error_stock_texto = f"Stock insuficiente de {ingrediente_agotado}. Quedan {stock_restante_kg} en bodega."

        else:
            texto_a_hablar = intenciones.respuesta_mesero.strip()
            if not texto_a_hablar:
                texto_a_hablar = "¡Claro! He actualizado tu pedido en la pantalla."

        # Estructuramos la salida y metemos el error adentro para que FastAPI no lo borre
        orden_final = OrdenEstructurada(
            respuesta_mesero=texto_a_hablar,
            numero_mesa=numero_mesa_final,
            pedidos=carrito_list,
            total_pedido=total_final,
            error_stock=error_stock_texto # 🌟 Aquí viaja el error seguro
        )
            
        ruta_audio_respuesta = "respuesta_temp.wav"
        generar_voz_offline(texto_a_hablar, ruta_audio_respuesta)
        
        return {
            "exito": True, 
            "transcripcion": texto_completo, 
            "orden": orden_final.model_dump(),
            "ruta_audio": ruta_audio_respuesta
        }
        
       
    except Exception as e:
        import traceback
        print("⚠️ Error en procesamiento matemático/JSON:")
        traceback.print_exc() # Esto imprimirá la línea exacta del error
        print("🤖 JSON CRUDO ENVIADO POR LA IA:\n", json_crudo) # Esto nos mostrará la locura que escribió la IA
        return {"exito": False, "error": "Fallo en procesamiento de la IA"}
    


def procesar_audio_bienvenida(ruta_temporal_audio: str, estado_actual_nombre: str):
    print("🧠 [BIENVENIDA] 1/3 Transcribiendo audio...")
    
    glosario_nombres = (
        "Juan, María, Carlos, Steve, Steven, Kevin, Brayan, Evelyn, Anthony, Christopher, "
        "Alexander, Mateo, Sofía, hacer un pedido, sí, correcto, exacto, no, me equivoqué."
    )
    
    segmentos, info = modelo_whisper.transcribe(
        ruta_temporal_audio, 
        beam_size=5, 
        language="es",
        initial_prompt=glosario_nombres
    )
    
    texto_completo = " ".join([segmento.text for segmento in segmentos]).strip()
    
    # 🌟 FILTRO ANTI-FANTASMAS DE WHISPER
    alucinaciones = ["amara.org", "subtítulos", "subtitulos", "traducido"]
    if any(fantasma in texto_completo.lower() for fantasma in alucinaciones):
        texto_completo = "" # Si alucina silencio, lo borramos para que actúe como Opción D
        
    print(f"🗣️ CLIENTE: '{texto_completo}'")
    
    print("🤖 [BIENVENIDA] 2/3 Analizando interacción...")
    
    # PROMPT DE PLANTILLAS ESTRICTAS (ANTI-LORO)
    prompt_sistema = f"""
    Eres la anfitriona digital del restaurante 'Fritadas Doña Zita'.
    NUNCA repitas la frase exacta del cliente en tu respuesta. Tu única tarea es devolver un JSON siguiendo estrictamente las opciones de abajo.

    MEMORIA DE LA CONVERSACIÓN:
    Nombre guardado en sistema: "{estado_actual_nombre}"
    Lo que acaba de decir el cliente: "{texto_completo}"

    INSTRUCCIONES DE ESTADO (Elige SOLO UNA de las siguientes opciones):

    OPCIÓN A (Confirma el nombre):
    Si el cliente dice "sí", "correcto", "está bien" (Y NO menciona ningún nombre):
    - respuesta_mesero: "¡Excelente {estado_actual_nombre}! Te paso con nuestro mesero digital para que tomes tu pedido."
    - nombre_cliente: "{estado_actual_nombre}"
    - nombre_confirmado: true

    OPCIÓN B (Rechaza el nombre SIN dar uno nuevo):
    Si el cliente SOLO dice "no", "está mal", "ese no es" (Y DEFINITIVAMENTE NO te dice su nombre real):
    - respuesta_mesero: "Uy, discúlpame. ¿Cómo te llamas entonces?"
    - nombre_cliente: ""
    - nombre_confirmado: false

    OPCIÓN C (Da su nombre real o LO CORRIGE):
    Si el cliente menciona un nombre en su frase, AUNQUE empiece con "No" (ej. "Me llamo Steve", "Soy María", "Steve", "No, me llamo Paul", "No, es Carlos"):
    - respuesta_mesero: "Entendido, te llamas [NOMBRE]. ¿Es correcto?" (Reemplaza [NOMBRE] con el nombre que dedujiste).
    - nombre_cliente: "[NOMBRE]" (Reemplaza [NOMBRE] con el nombre extraído).
    - nombre_confirmado: false

    OPCIÓN D (El cliente no dice nada, no se le entiende o solo saluda):
    Si el texto del cliente está vacío o solo dice "Hola":
    - respuesta_mesero: "¡Hola! Bienvenido a Doña Zita. Para iniciar tu pedido, ¿me podrías decir tu nombre?"
    - nombre_cliente: ""
    - nombre_confirmado: false

    Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido con las claves: respuesta_mesero, nombre_cliente, nombre_confirmado.
    """
    
    respuesta_llm = ollama.chat(
        model='llama3',
        messages=[{'role': 'user', 'content': prompt_sistema}],
        format='json'
    )
    
    json_crudo = respuesta_llm['message']['content']
    
    try:
        print("🗣️ [BIENVENIDA] 3/3 Generando voz...")
        interaccion = InteraccionBienvenida.model_validate_json(json_crudo)
        
        ruta_audio_respuesta = "respuesta_bienvenida_temp.wav"
        generar_voz_offline(interaccion.respuesta_mesero, ruta_audio_respuesta)
        
        print(f"✅ Respuesta IA: {interaccion.respuesta_mesero} | Confirmado: {interaccion.nombre_confirmado}")
        
        return {
            "exito": True, 
            "transcripcion": texto_completo, 
            "estado_conversacion": interaccion.model_dump(),
            "ruta_audio": ruta_audio_respuesta
        }
    except Exception as e:
        print("⚠️ Error JSON en Bienvenida:", e)
        return {"exito": False, "error": "Fallo lógico en IA de bienvenida"}

def generar_analisis_negocio(kpis: dict, platos: dict, operacion: dict, periodo: str = "este periodo"):
    # 1. Extracción de KPIs financieros
    ingresos = kpis.get('ingresos', 0)
    ticket_promedio = kpis.get('ticket', 0)
    ordenes = kpis.get('ordenes', 0)

    # 2. Extracción de Platos (Top 3 con sus cantidades reales)
    platos_str = "Sin datos de platos"
    if platos and platos.get('labels') and platos.get('cantidades'):
        top_3 = []
        for i in range(min(3, len(platos['labels']))):
            top_3.append(f"- {platos['labels'][i]}: {platos['cantidades'][i]} uds.")
        platos_str = "\n".join(top_3)

    # 3. Extracción de Datos Críticos Operativos (¡Aquí está la magia para la tesis!)
    hora_pico = "Desconocida"
    max_espera = 0
    if operacion and operacion.get('pedidos') and operacion.get('labels'):
        # Encontramos la hora con más pedidos
        max_pedidos = max(operacion['pedidos'])
        if max_pedidos > 0:
            idx_pico = operacion['pedidos'].index(max_pedidos)
            hora_pico = f"{operacion['labels'][idx_pico]} (con {max_pedidos} pedidos simultáneos)"
            
        # Encontramos el tiempo de espera máximo
        if operacion.get('tiempos'):
            max_espera = max(operacion['tiempos'])

    # 4. Prompt Engineering Avanzado
    prompt = f"""
    Eres un Consultor Gastronómico Senior y Analista de Datos analizando el restaurante "Doña Zita".
    Analiza este reporte del periodo: {periodo}.

    DATOS REALES EXTRAÍDOS DE POSTGRESQL:
    - Ingresos Brutos: ${ingresos}
    - Volumen de Órdenes: {ordenes}
    - Ticket Promedio: ${ticket_promedio}
    
    - Top Platos Más Vendidos:
    {platos_str}
    
    - Datos de Operación en Cocina:
    Hora Pico de Demanda: {hora_pico}
    Tiempo Máximo de Espera Promedio: {max_espera} minutos.

    REGLAS ESTRICTAS PARA TU RESPUESTA:
    1. Cero saludos o introducciones genéricas. Ve directo al grano.
    2. Escribe exclusivamente en formato Markdown (usa **negritas** para resaltar métricas clave).
    3. Tu respuesta debe tener EXACTAMENTE estas tres secciones con sus respectivos emojis:

    ### 📈 Rendimiento Financiero
    (Analiza si el ticket promedio y volumen son saludables).

    ### 🍽️ Análisis del Menú
    (Qué decisión de inventario o promoción tomar respecto a los platos top).

    ### ⚠️ Cuello de Botella Operativo
    (Critica la relación entre la hora pico y el tiempo de espera máximo. Si la espera supera los 20 minutos, da una alerta crítica y sugiere una acción operativa inmediata en cocina).
    """

    try:
        respuesta_llm = ollama.chat(
            model='llama3',
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.4} # Bajamos un poco la temperatura para que sea más analítico y menos "creativo"
        )
        return respuesta_llm['message']['content']
    except Exception as e:
        print(f"Error generando análisis de BI: {e}")
        return "⚠️ *Error de conexión con el motor de IA local.* Revisa que Ollama esté ejecutándose."