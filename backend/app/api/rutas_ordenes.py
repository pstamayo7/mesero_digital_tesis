from fastapi import APIRouter
import requests
from app.services.ia_service import validar_stock_carrito # 🌟 Importamos al Guardia de Seguridad

router = APIRouter()

@router.post("/confirmar-orden")
def confirmar_orden(orden: dict):
    print("🚀 Recibiendo orden final y validando stock antes de n8n...")
    
    # 1. 🛡️ ÚLTIMA VALIDACIÓN ANTES DE ENVIAR A COCINA
    carrito_list = orden.get("pedidos", [])
    validacion = validar_stock_carrito(carrito_list)
    
    if not validacion["valido"]:
        # Si alguien compró el último ingrediente justo antes de darle a confirmar
        return {"exito": False, "error": f"Stock insuficiente de {validacion['ingrediente']}"}
        
    # 2. 📝 PREPARAMOS EL PAQUETE PARA N8N
    # Le inyectamos el total en dólares y el reporte de consumo a la orden original
    total_dolares = sum(item.get("subtotal", 0.0) for item in carrito_list)
    orden["total_pedido"] = total_dolares
    orden["consumo_ingredientes"] = validacion.get("consumo", {})

    # 3. 🚀 ENVIAMOS A N8N
    webhook_url = "http://localhost:5678/webhook/orden-zita"
    
    try:
        # Mandamos el JSON ya enriquecido con precios y consumo
        respuesta = requests.post(webhook_url, json=orden)
        
        if respuesta.status_code == 200:
            print("✅ ¡Orden entregada a n8n con éxito!")
            return {"exito": True, "mensaje": "Orden orquestada correctamente"}
        else:
            print(f"⚠️ n8n respondió con error: {respuesta.status_code}")
            return {"exito": False, "error": "n8n rechazó la orden", "status": respuesta.status_code}
            
    except Exception as e:
        print(f"❌ Error al conectar con n8n: {e}")
        return {"exito": False, "error": "Fallo de conexión con el orquestador"}