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
    
    # PROMPT ACTUALIZADO CON MEMORIA Y DIÁLOGO
    prompt_sistema = f"""
    Eres el mesero digital amable del restaurante 'Fritadas Doña Zita'.
    Tu objetivo es actualizar el carrito de compras basándote en lo que dice el cliente y responder amigablemente.
    
    📋 MENÚ DISPONIBLE:
    {menu_formateado}
    
    🛒 CARRITO ACTUAL DEL CLIENTE (Memoria):
    {carrito_actual}
    
    REGLAS ESTRICTAS:
    1. Analiza el 'Carrito Actual' y el 'Texto del Cliente'. Suma, resta o elimina productos según lo pida.
    2. Mapea siempre al nombre EXACTO del menú. Ignora lo que no esté en el menú.
    3. Redacta una 'respuesta_mesero' corta, cálida y directa (Ej: "¡Claro! Te he quitado la cebolla de la fritada. ¿Deseas agregar algo de beber?").
    
    Tu respuesta debe ser EXCLUSIVAMENTE este JSON:
    {{
        "respuesta_mesero": "tu respuesta hablada aquí",
        "pedidos": [
            {{ "plato": "nombre exacto", "cantidad": 1, "modificaciones": "" }}
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