from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from pydantic import BaseModel, Field
from typing import List, Optional
from psycopg2.extras import RealDictCursor
import requests
import ollama
import json
import tempfile
import os
import psycopg2



app = FastAPI(title="API Mesero Digital - Doña Zita")
def obtener_menu_disponible():
    try:
        # Nos conectamos a tu PostgreSQL local
        conexion = psycopg2.connect(
            host="localhost",
            port="5433",  # El puerto externo que configuramos en Docker
            database="zita_db",
            user="admin",
            password="adminpassword"
        )
        cursor = conexion.cursor()
        
        # Traemos solo los platos que estén disponibles (puedes ajustar el WHERE según tus columnas)
        cursor.execute("SELECT nombre FROM Plato WHERE estado_item = 'DISPONIBLE';")
        platos = cursor.fetchall()
        
        cursor.close()
        conexion.close()
        
        # Convertimos la lista de tuplas [('Fritada',), ('Cola',)] en una lista limpia de texto
        lista_platos = [plato[0] for plato in platos]
        return lista_platos
        
    except Exception as e:
        print(f"⚠️ Error al consultar la base de datos: {e}")
        # Si la base de datos falla por alguna razón, devolvemos un menú de respaldo para que el sistema no se caiga
        return ["Fritada Tradicional", "Fritada Especial Doble", "Llapingachos", "Cola Grande"]
    

# --- 1. CONFIGURACIÓN CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. INICIALIZAR LA IA (FASTER-WHISPER) ---
print("⏳ Cargando modelo acústico (Faster-Whisper)...")
modelo_whisper = WhisperModel("small", device="cpu", compute_type="int8")
print("✅ Oído de IA listo.")

# --- 3. ESQUEMAS DE PYDANTIC (EL "MOLDE" ESTRICTO PARA OLLAMA) ---
# Aquí le decimos a Python exactamente cómo queremos que se vea la orden
class ItemPedido(BaseModel):
    plato: str = Field(description="Nombre del platillo o bebida (ej. Fritada, Cola)")
    cantidad: int = Field(description="Cantidad solicitada en números")
    modificaciones: Optional[str] = Field(default="", description="Notas o excepciones (ej. sin cebolla, sin hielo, extra tostado)")

class OrdenEstructurada(BaseModel):
    pedidos: List[ItemPedido]

# --- 4. RUTAS BÁSICAS ---
# --- RUTAS BÁSICAS ---
@app.get("/")
def ruta_raiz():
    return {"mensaje": "¡El servidor de Fritadas Doña Zita está en línea!"}

@app.get("/menu")
def obtener_menu():
    print("🗄️ Consultando menú dinámico en PostgreSQL...")
    try:
        # Nos conectamos al contenedor de Docker (Recuerda que usamos el puerto 5433)
        conn = psycopg2.connect(
            dbname="zita_db",
            user="admin",
            password="adminpassword",
            host="localhost",
            port="5433"
        )
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Hacemos la consulta SQL uniendo Categorías y Platos
        cursor.execute("""
            SELECT c.id_categoria, c.nombre AS categoria_nombre, 
                   p.id_plato, p.nombre AS plato_nombre, p.precio_base, p.tiempo_prep_min 
            FROM Categoria c
            JOIN Plato p ON c.id_categoria = p.id_categoria
        """)
        filas = cursor.fetchall()
        
        # Transformamos las filas planas de SQL al formato anidado que React espera
        categorias_dict = {}
        for fila in filas:
            id_cat = fila['id_categoria']
            if id_cat not in categorias_dict:
                categorias_dict[id_cat] = {
                    "id_categoria": id_cat,
                    "nombre": fila['categoria_nombre'],
                    "platos": []
                }
            
            categorias_dict[id_cat]["platos"].append({
                "id_plato": fila['id_plato'],
                "nombre": fila['plato_nombre'],
                "descripcion": f"Tiempo estimado: {fila['tiempo_prep_min']} min", # Usamos el tiempo como descripción
                "precio": float(fila['precio_base'])
            })
            
        return {"categorias": list(categorias_dict.values())}
        
    except Exception as e:
        print(f"❌ Error de base de datos: {e}")
        return {"error": "No se pudo conectar a la base de datos"}
    finally:
        # Cerramos la conexión para no saturar la memoria
        if 'conn' in locals() and conn:
            cursor.close()
            conn.close()

# --- 5. RUTA DE INTELIGENCIA ARTIFICIAL (VOZ -> TEXTO -> JSON) ---
@app.post("/pedido-voz")
async def procesar_audio(audio: UploadFile = File(...)):
    print(f"\n🎙️ Recibiendo audio del Kiosko...")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
        contenido = await audio.read()
        temp_audio.write(contenido)
        ruta_temporal = temp_audio.name
        
    try:
        # FASE A: ESCUCHAR (Faster-Whisper) - ¡INTACTO!
        print("🧠 1/2 Transcribiendo audio a texto...")
        glosario_zita = "Fritada, llapingachos, mote, tostado, maduro, chicharrón, empanadas, yahuarlocro, menú, porción, pedido."
        segmentos, info = modelo_whisper.transcribe(ruta_temporal, beam_size=5, language="es", initial_prompt=glosario_zita)
        
        texto_completo = " ".join([segmento.text for segmento in segmentos]).strip()
        print(f"🗣️ EL CLIENTE DIJO: '{texto_completo}'")
        
        # 🌟 AQUÍ ENTRA LA MAGIA: Traemos el menú fresco de la BDD
        print("🔍 Buscando el menú disponible en PostgreSQL...")
        menu_real = obtener_menu_disponible()
        menu_formateado = "\n".join([f'- "{plato}"' for plato in menu_real])
        
        # FASE B: RAZONAR (Ollama Llama 3)
        print("🤖 2/2 Analizando intención con Llama 3...")
        
        # Le damos instrucciones militares y el MENÚ EXACTO al modelo
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
        
        # Le pedimos a Ollama que obligatoriamente responda usando el formato JSON
        respuesta_llm = ollama.chat(
            model='llama3',
            messages=[{'role': 'user', 'content': prompt_sistema}],
            format='json' # ¡Esto le pone el bozal para que no hable, solo de código!
        )
        
        json_crudo = respuesta_llm['message']['content']
        
        # FASE C: VALIDAR (Pydantic)
        # Pydantic revisa que el JSON tenga todos los campos correctos (plato, cantidad, modificaciones)
        # Si a Llama3 se le olvida un campo, esto evita que el backend explote.
        try:
            orden_validada = OrdenEstructurada.model_validate_json(json_crudo)
            print("✅ JSON Validado Exitosamente por Pydantic")
            print("\n📦 LA ORDEN FINAL PERFECTA ES:")
            print(json.dumps(orden_validada.model_dump(), indent=4, ensure_ascii=False))
            print("-" * 40)
        except Exception as e:
            print("⚠️ Error en la validación del JSON:", e)
            return {"error": "El modelo no generó un JSON válido", "texto_crudo": json_crudo}

        # Devolvemos la orden perfectamente masticada al frontend de React
        return {
            "mensaje": "Audio procesado y analizado con éxito",
            "transcripcion": texto_completo,
            "orden": orden_validada.model_dump()
        }
        
    finally:
        os.remove(ruta_temporal)

    # --- RUTA PARA ENVIAR LA ORDEN AL ORQUESTADOR (n8n) ---
@app.post("/confirmar-orden")
def confirmar_orden(orden: dict):
    print("🚀 Recibiendo orden final y enviando a n8n...")
    
    # Esta es la Test URL que copiaste de n8n
    webhook_url = "http://localhost:5678/webhook-test/orden-zita"
    
    try:
        # Hacemos una petición POST enviando el JSON del carrito
        respuesta = requests.post(webhook_url, json=orden)
        
        if respuesta.status_code == 200:
            print("✅ ¡Orden entregada a n8n con éxito!")
            return {"mensaje": "Orden orquestada correctamente"}
        else:
            return {"error": "n8n rechazó la orden", "status": respuesta.status_code}
            
    except Exception as e:
        print(f"❌ Error al conectar con n8n: {e}")
        return {"error": "Fallo de conexión con el orquestador"}