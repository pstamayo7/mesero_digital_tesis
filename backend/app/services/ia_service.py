# backend/app/services/ia_service.py
from faster_whisper import WhisperModel
import ollama
import json
import pyttsx3
import os
from app.schemas.pedido_schema import OrdenEstructurada
from app.core.database import get_db_connection

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
    print("🧠 1/3 Transcribiendo audio...")
    segmentos, info = modelo_whisper.transcribe(ruta_temporal_audio, beam_size=5, language="es")
    texto_completo = " ".join([segmento.text for segmento in segmentos]).strip()
    print(f"🗣️ CLIENTE: '{texto_completo}'")
    
    # FASE B: RAZONAR Y MEMORIA
    print("🤖 2/3 Analizando intención e inyectando estado (Memoria)...")
    menu_real = obtener_menu_disponible()
    menu_formateado = "\n".join([f'- "{plato}"' for plato in menu_real])
    
    # 🌟 OBTENEMOS EL LÍMITE DINÁMICO DE LA BDD
    limite_maximo = obtener_limite_platos()
    
    # PROMPT ACTUALIZADO CON LÍMITE DINÁMICO
    prompt_sistema = f"""
    Eres el mesero digital amable del restaurante 'Fritadas Doña Zita'.
    Tu objetivo es actualizar el carrito de compras basándote en lo que dice el cliente y responder amigablemente.
    
    📋 MENÚ DISPONIBLE:
    {menu_formateado}
    
    🛒 CARRITO ACTUAL DEL CLIENTE (Memoria):
    {carrito_actual}
    
    REGLAS LÓGICAS Y DE COMPORTAMIENTO:
    1. Analiza el 'Carrito Actual' y el 'Texto del Cliente'. Suma, resta o elimina productos según lo pida.
    2. Mapea siempre al nombre EXACTO del menú. Ignora lo que no esté en el menú.
    3. Redacta una 'respuesta_mesero' corta, cálida y directa confirmando la acción.
    4. Si el 'numero_mesa' en el carrito actual es 0, incluye en tu 'respuesta_mesero' una frase pidiendo amablemente al cliente que tome un número de la canasta y te lo dicte.
    5. Si el cliente menciona el número que tomó, guárdalo numéricamente en 'numero_mesa'.
    6. REGLA DE LÍMITE COMERCIAL: El restaurante permite un máximo de {limite_maximo} ítems en total por pedido. Si la suma de los platos solicitados supera los {limite_maximo}, NO los agregues al carrito. Responde amablemente explicando: "¡Me encanta ese apetito! Pero por políticas de calidad, en este kiosko solo puedo procesar hasta {limite_maximo} ítems por orden. Para pedidos grandes, por favor acércate a nuestra caja principal."
    
    Tu respuesta debe ser EXCLUSIVAMENTE este JSON válido:
    {{
        "respuesta_mesero": "tu respuesta hablada aquí",
        "numero_mesa": 0,
        "pedidos": [
            {{ "plato": "nombre exacto", "cantidad": 1, "modificaciones": "notas extras" }}
        ]
    }}
    
    Texto del cliente: "{texto_completo}"
    """
    
    respuesta_llm = ollama.chat(
        model='llama3',
        messages=[{'role': 'user', 'content': prompt_sistema}],
        format='json'
    )
    
    json_crudo = respuesta_llm['message']['content']
    
    # FASE C: VALIDAR Y HABLAR (TTS)
    try:
        print("🗣️ 3/3 Generando voz del mesero...")
        orden_validada = OrdenEstructurada.model_validate_json(json_crudo)
        
        # Generamos el audio de la respuesta de forma local
        ruta_audio_respuesta = "respuesta_temp.wav"
        generar_voz_offline(orden_validada.respuesta_mesero, ruta_audio_respuesta)
        
        print(f"✅ Respuesta IA: {orden_validada.respuesta_mesero}")
        return {
            "exito": True, 
            "transcripcion": texto_completo, 
            "orden": orden_validada.model_dump(),
            "ruta_audio": ruta_audio_respuesta
        }
    except Exception as e:
        print("⚠️ Error JSON:", e)
        return {"exito": False, "error": "Fallo lógico en IA"}