# backend/app/api/rutas_ordenes.py
from fastapi import APIRouter
import requests

router = APIRouter()

@router.post("/confirmar-orden")
def confirmar_orden(orden: dict):
    print("🚀 Recibiendo orden final y enviando a n8n...")
    webhook_url = "http://localhost:5678/webhook-test/orden-zita"
    
    try:
        respuesta = requests.post(webhook_url, json=orden)
        if respuesta.status_code == 200:
            print("✅ ¡Orden entregada a n8n con éxito!")
            return {"mensaje": "Orden orquestada correctamente"}
        else:
            return {"error": "n8n rechazó la orden", "status": respuesta.status_code}
    except Exception as e:
        print(f"❌ Error al conectar con n8n: {e}")
        return {"error": "Fallo de conexión con el orquestador"}