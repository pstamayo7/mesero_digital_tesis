# backend/app/services/ia_service.py
import ollama
import json
import pyttsx3
import os
from app.core.database import get_db_connection
from faster_whisper import WhisperModel
from app.schemas.pedido_schema import SalidaLLM, OrdenEstructurada, ItemPedido, ModificacionStruct,InteraccionBienvenida
print("⏳ Cargando modelo acústico (Faster-Whisper)...")
modelo_whisper = WhisperModel("small", device="cpu", compute_type="int8")
print("✅ Oído de IA listo.")

def obtener_menu_disponible():
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        cursor.execute("SELECT nombre FROM Plato;")
        platos = cursor.fetchall()
        cursor.close()
        conexion.close()
        return [plato[0] for plato in platos]
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
        return [ingrediente[0] for ingrediente in ingredientes]
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
        platos = {row[0].lower(): float(row[1]) for row in cursor.fetchall()}

        # Extraemos { "mote": 0.50, "aguacate": 1.00 }
        cursor.execute("SELECT nombre, precio_extra FROM Ingrediente;")
        extras = {row[0].lower(): float(row[1]) for row in cursor.fetchall()}

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
            nombre_ing = row[0].strip().lower()
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
            plato = row[0].strip().lower()
            ingrediente = row[1].strip().lower()
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
            plato_nombre = item["plato"].strip().lower()
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
                ing_mod = mod.get("ingrediente", "").strip().lower()

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
    
    glosario_zita = "Fritada, llapingachos, mote, tostado, maduro, chicharrón, empanadas, yahuarlocro, menú, porción, pedido, colas."
    segmentos, info = modelo_whisper.transcribe(
        ruta_temporal_audio, beam_size=5, language="es", initial_prompt=glosario_zita
    )
    texto_completo = " ".join([segmento.text for segmento in segmentos]).strip()
    print(f"🗣️ CLIENTE: '{texto_completo}'")
    
    # FASE B: RAZONAR INTENCIONES
    print("🤖 2/3 Analizando intención...")
    menu_real = obtener_menu_disponible()
    menu_formateado = "\n".join([f'- "{plato}"' for plato in menu_real])
    
    ingredientes_reales = obtener_ingredientes_disponibles()
    ingredientes_formateados = ", ".join(ingredientes_reales)
    
    limite_maximo = obtener_limite_platos()
    
    prompt_sistema = f"""
    Eres el mesero digital del restaurante 'Fritadas Doña Zita'.
    
    📋 MENÚ DISPONIBLE:
    {menu_formateado}
    
    🍅 INGREDIENTES:
    {ingredientes_formateados}
    
    🛒 ESTADO ACTUAL DEL CARRITO:
    {carrito_actual}

    🚨 REGLAS CRÍTICAS DE LÓGICA Y FORMATO (¡LEER CON ATENCIÓN!):

    1. FORMATO DE MODIFICACIONES (ANTI-CRASH):
       - El campo "modificaciones" SIEMPRE, SIEMPRE debe ser una lista.
       - Si el plato es normal, usa EXACTAMENTE [].
       - Si hay modificaciones, usa OBLIGATORIAMENTE objetos: [{{"tipo": "EXTRA", "ingrediente": "Mote"}}].
       - 🚫 ESTRICTAMENTE PROHIBIDO usar listas de strings como ["EXTRA Mote"]. ¡Solo objetos JSON!
       - Tipos permitidos: "SIN", "EXTRA", "POCO". NUNCA "CON".

    2. MATEMÁTICA DE SUBDIVISIÓN (Pedidos Nuevos):
       - Si pide "N" platos en total, pero "M" tienen cambios, RESTA (N - M).
       - Ejemplo: "3 fritadas, 1 sin mote" -> AGREGAR 2 normales ([]), AGREGAR 1 modificada ([{{"tipo": "SIN", "ingrediente": "Mote"}}]).

   3. ⚠️ INTERCAMBIO vs REPETICIÓN (¡DIFERENCIA VITAL!):
       - REPETICIÓN (CLONAR): Si el cliente quiere OTRO plato IGUAL (ej. "agrega otra igual", "otra con los mismos extras"), NO QUITES NADA. Solo usa AGREGAR y copia las modificaciones del carrito.
       - INTERCAMBIO (MODIFICAR): SOLO si el cliente quiere ALTERAR un plato que ya pidió (ej. "a la fritada que ya tengo, quítale el mote"), debes QUITAR el plato viejo y AGREGAR el nuevo modificado.

    4. ⚠️ PORCIONES SUELTAS (EXTRAS COMO PLATO INDIVIDUAL):
       - Si el cliente pide un ingrediente de forma independiente (ej. "dame un maduro", "una porción de tostado", "y un mote aparte"), NO lo pongas como modificación de un plato.
       - Debes AGREGARLO como un plato nuevo, y su nombre debe empezar SIEMPRE con la frase "Porción de " seguido del ingrediente. (Ej. "plato": "Porción de Plátano Maduro").

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
        intenciones = SalidaLLM.model_validate(datos_diccionario)
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

        numero_mesa_final = intenciones.numero_mesa if intenciones.numero_mesa != 0 else estado_previo.get("numero_mesa", 0)
        
        # 2. MATEMÁTICAS INDESTRUCTIBLES
      # 🌟 TRAEMOS LOS PRECIOS AQUÍ ARRIBA PARA NORMALIZAR LOS NOMBRES ANTES DE AGRUPAR
        precios_platos, precios_extras = obtener_diccionario_precios()

        # 2. MATEMÁTICAS INDESTRUCTIBLES
        for accion in intenciones.acciones:
            mods_lista = accion.modificaciones if accion.modificaciones else []
            
            # 🌟 NORMALIZAMOS LOS NOMBRES DE LOS INGREDIENTES
            for m in mods_lista:
                m.tipo = m.tipo.upper() 
                nombre_ing_low = m.ingrediente.strip().lower()
                
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
            
            plato_encontrado = False
            for item in carrito_list:
                item_mods = item.get("modificaciones", "")
                
                if item.get("plato", "").lower() == accion.plato.lower() and item_mods == mods_str:
                    if accion.accion.upper() == "AGREGAR":
                        item["cantidad"] = item.get("cantidad", 0) + accion.cantidad
                    elif accion.accion.upper() == "QUITAR":
                        item["cantidad"] = item.get("cantidad", 0) - accion.cantidad
                    plato_encontrado = True
                    break
            
            if not plato_encontrado and accion.accion.upper() == "AGREGAR":
                carrito_list.append({
                    "plato": accion.plato,
                    "cantidad": accion.cantidad,
                    "modificaciones": mods_str,
                    "mods_estructuradas": [m.model_dump() for m in mods_lista]
                })
        
        # Filtramos los platos que el cliente canceló
        carrito_list = [item for item in carrito_list if item["cantidad"] > 0]
        
        
        
        total_final = 0.0

        for item in carrito_list:
            nombre_plato_low = item["plato"].lower()
            
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
                    nombre_ing_low = mod.get("ingrediente", "").strip().lower()
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
            return {
                "exito": True,
                "transcripcion": texto_completo,
                "orden": {"pedidos": estado_previo.get("pedidos", []), "numero_mesa": numero_mesa_final, "total_pedido": estado_previo.get("total_pedido", 0.0)},
                "ruta_audio": "limite_excedido.wav" 
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