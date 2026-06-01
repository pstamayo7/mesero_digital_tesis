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
       - Si el plato es normal, usa EXACTAMENTE []. ¡NUNCA uses un string como ""!
       - Tipos permitidos: "SIN", "EXTRA", "POCO".
       - 🚫 ESTRICTAMENTE PROHIBIDO usar "CON". Si el cliente pide algo "con [ingrediente base]" o "normal", significa que no hay alteraciones. ¡Usa []!

    2. MATEMÁTICA DE SUBDIVISIÓN (Pedidos Nuevos):
       - Si pide "N" platos en total, pero "M" tienen cambios, RESTA (N - M).
       - Ejemplo: "3 fritadas, 1 sin mote" -> AGREGAR 2 normales ([]), AGREGAR 1 modificada ([SIN Mote]).

    3. INTERCAMBIO (Modificar carrito):
       - Si el cliente modifica algo que YA ESTÁ en el carrito, debes QUITAR el plato original y AGREGAR el nuevo.

    💡 EJEMPLOS DE RAZONAMIENTO Y JSON:

    EJEMPLO 1 (Subdivisión matemática):
    Cliente: "Necesito tres Fritadas especiales dobles, pero dos de ellas sin mote"
    JSON:
    {{
        "razonamiento": "Pide 3 Especiales Dobles en total. 2 son SIN Mote. Matemática: 3 - 2 = 1 normal. Acciones: AGREGAR 1 normal, AGREGAR 2 sin mote.",
        "respuesta_mesero": "¡Entendido! Dos sin mote y una normal.",
        "numero_mesa": 0,
        "acciones": [
            {{ "accion": "AGREGAR", "plato": "Fritada Especial Doble", "cantidad": 1, "modificaciones": [] }},
            {{ "accion": "AGREGAR", "plato": "Fritada Especial Doble", "cantidad": 2, "modificaciones": [{{"tipo": "SIN", "ingrediente": "Mote"}}] }}
        ]
    }}

    EJEMPLO 2 (Modificar carrito existente):
    Carrito: [{{ "plato": "Fritada Tradicional", "cantidad": 2, "modificaciones": "" }}]
    Cliente: "Puedes hacer que una de las fritadas tradicionales sea sin mote"
    JSON:
    {{
        "razonamiento": "El carrito tiene Tradicionales normales. El cliente quiere cambiar 1 a SIN Mote. Debo QUITAR 1 Tradicional normal ([]), y AGREGAR 1 Tradicional SIN Mote.",
        "respuesta_mesero": "Claro, modifiqué una para que sea sin mote.",
        "numero_mesa": 0,
        "acciones": [
            {{ "accion": "QUITAR", "plato": "Fritada Tradicional", "cantidad": 1, "modificaciones": [] }},
            {{ "accion": "AGREGAR", "plato": "Fritada Tradicional", "cantidad": 1, "modificaciones": [{{"tipo": "SIN", "ingrediente": "Mote"}}] }}
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
        for accion in intenciones.acciones:
            # Aseguramos que modificaciones sea una lista y normalizamos a MAYÚSCULAS
            mods_lista = accion.modificaciones if accion.modificaciones else []
            for m in mods_lista:
                m.tipo = m.tipo.upper() # Transformamos "sin" a "SIN"
                
            # Creamos el string visual (ej. "SIN Mote, EXTRA Cebolla")
            mods_str = ", ".join([f"{m.tipo} {m.ingrediente}" for m in mods_lista])
            
            plato_encontrado = False
            for item in carrito_list:
                item_mods = item.get("modificaciones", "")
                
                # Comparamos ignorando mayúsculas/minúsculas
                if item.get("plato", "").lower() == accion.plato.lower() and item_mods == mods_str:
                    if accion.accion.upper() == "AGREGAR":
                        item["cantidad"] = item.get("cantidad", 0) + accion.cantidad
                    elif accion.accion.upper() == "QUITAR":
                        item["cantidad"] = item.get("cantidad", 0) - accion.cantidad
                    plato_encontrado = True
                    break
            
            # Si no estaba y es AGREGAR, lo creamos
            if not plato_encontrado and accion.accion.upper() == "AGREGAR":
                carrito_list.append({
                    "plato": accion.plato,
                    "cantidad": accion.cantidad,
                    "modificaciones": mods_str,
                    "mods_estructuradas": [m.model_dump() for m in mods_lista]
                })
        
        # Filtramos los platos que el cliente canceló (cantidad <= 0)
        carrito_list = [item for item in carrito_list if item["cantidad"] > 0]
        
        # Validamos el límite operativo
        total_platos = sum([item.get("cantidad", 0) for item in carrito_list])
        if total_platos > limite_maximo:
            return {
                "exito": True,
                "transcripcion": texto_completo,
                "orden": {"pedidos": estado_previo.get("pedidos", []), "numero_mesa": numero_mesa_final},
                "ruta_audio": "limite_excedido.wav" # Cambia esto por tu audio de límite
            }

        # Estructuramos la salida para React
       # Estructuramos la salida para React
        orden_final = OrdenEstructurada(
            respuesta_mesero=intenciones.respuesta_mesero,
            numero_mesa=numero_mesa_final,
            pedidos=carrito_list
        )
        
        # 🌟 EL BLINDAJE CONTRA TEXTOS VACÍOS 🌟
        texto_a_hablar = orden_final.respuesta_mesero.strip()
        if not texto_a_hablar: # Si la IA mandó "" (vacío)
            texto_a_hablar = "¡Claro! He actualizado tu pedido en la pantalla."
            orden_final.respuesta_mesero = texto_a_hablar # Lo actualizamos para que el Frontend también lo lea
            
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