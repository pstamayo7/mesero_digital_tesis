# backend/app/services/ia_service.py
from faster_whisper import WhisperModel
import ollama
import json

# AÑADE 'app.' AL PRINCIPIO:
from app.schemas.pedido_schema import OrdenEstructurada
from app.core.database import get_db_connection

print("⏳ Cargando modelo acústico (Faster-Whisper)...")
# Mantenemos tu configuración exacta
modelo_whisper = WhisperModel("small", device="cpu", compute_type="int8")
print("✅ Oído de IA listo.")

def obtener_menu_disponible():
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()
        
        # Traemos solo los platos que estén disponibles
        # Luego lo corregimos   ---->   cursor.execute("SELECT nombre FROM Plato WHERE estado_item = 'DISPONIBLE';")
        platos = cursor.fetchall()
        
        cursor.close()
        conexion.close()
        
        # Convertimos la lista de tuplas en una lista limpia de texto
        return [plato[0] for plato in platos]
        
    except Exception as e:
        print(f"⚠️ Error al consultar la base de datos: {e}")
        return ["Fritada Tradicional", "Fritada Especial Doble", "Llapingachos", "Cola Grande"]

def procesar_audio_con_ia(ruta_temporal: str):
    # FASE A: ESCUCHAR (Faster-Whisper)
    print("🧠 1/2 Transcribiendo audio a texto...")
    glosario_zita = "Fritada, llapingachos, mote, tostado, maduro, chicharrón, empanadas, yahuarlocro, menú, porción, pedido."
    segmentos, info = modelo_whisper.transcribe(ruta_temporal, beam_size=5, language="es", initial_prompt=glosario_zita)
    
    texto_completo = " ".join([segmento.text for segmento in segmentos]).strip()
    print(f"🗣️ EL CLIENTE DIJO: '{texto_completo}'")
    
    # Buscando el menú disponible en PostgreSQL
    print("🔍 Buscando el menú disponible en PostgreSQL...")
    menu_real = obtener_menu_disponible()
    menu_formateado = "\n".join([f'- "{plato}"' for plato in menu_real])
    
    # FASE B: RAZONAR (Ollama Llama 3)
    print("🤖 2/2 Analizando intención con Llama 3...")
    
    # TU PROMPT EXACTO INTACTO
    prompt_sistema = f"""
    Eres el sistema de caja de un restaurante llamado 'Fritadas Doña Zita'.
    Extrae los platos, cantidades y modificaciones del texto.
    
    📋 MENÚ OFICIAL Y DISPONIBLE (Solo puedes usar estos nombres exactos):
    {menu_formateado}
    
    REGLAS LÓGICAS ESTRICTAS:
    1. Mapea los plurales al nombre EXACTO del menú (Ej: si dice "colas grandes", escribe "Cola Grande").
    2. Si el cliente pide algo que NO está en el menú de arriba, ignóralo (está agotado).
    
    REGLA DE FORMATO ESTRICTA: Tu respuesta debe ser ÚNICA Y EXCLUSIVAMENTE un objeto JSON válido. 
    Obligatoriamente debes usar esta estructura exacta:
    {{
        "pedidos": [
            {{
                "plato": "nombre EXACTO según el menú",
                "cantidad": 0,
                "modificaciones": "notas extras, dejar en blanco si no hay"
            }}
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
    
    # FASE C: VALIDAR (Pydantic)
    try:
        orden_validada = OrdenEstructurada.model_validate_json(json_crudo)
        print("✅ JSON Validado Exitosamente por Pydantic")
        print("\n📦 LA ORDEN FINAL PERFECTA ES:")
        print(json.dumps(orden_validada.model_dump(), indent=4, ensure_ascii=False))
        print("-" * 40)
        return {"exito": True, "transcripcion": texto_completo, "orden": orden_validada.model_dump()}
    except Exception as e:
        print("⚠️ Error en la validación del JSON:", e)
        return {"exito": False, "error": "El modelo no generó un JSON válido", "texto_crudo": json_crudo}