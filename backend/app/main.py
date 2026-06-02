# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import rutas_menu, rutas_voz, rutas_ordenes
from app.api import rutas_menu, rutas_voz, rutas_ordenes, rutas_tiempos, rutas_cocina
from fastapi import Request # Asegúrate de tener Request importado
from app.services.ia_service import validar_stock_carrito
from app.api import rutas_caja
from app.api import rutas_admin


app = FastAPI(title="API Mesero Digital - Doña Zita")

# --- CONFIGURACIÓN CORS ACTUALIZADA ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],




    # LÍNEA CLAVE: Le da permiso a React de leer las cabeceras personalizadas
    expose_headers=["X-Transcripcion", "X-Orden-JSON"], 
)
@app.post("/validar-carrito")
async def validar_carrito_endpoint(request: Request):
    """Recibe el carrito desde React cada vez que el usuario presiona '+' o '-' y valida el stock"""
    try:
        carrito_list = await request.json()
        # Llamamos a nuestro Guardia de Seguridad
        resultado = validar_stock_carrito(carrito_list)
        return resultado # Devuelve {"valido": True} o {"valido": False, "ingrediente": "...", "stock": 3.0}
    except Exception as e:
        print(f"Error en endpoint validar-carrito: {e}")
        return {"valido": True} # En caso de error, dejamos pasar

# --- INCLUSIÓN DE RUTAS ---
app.include_router(rutas_menu.router, tags=["Menú"])
app.include_router(rutas_voz.router, tags=["Inteligencia Artificial"])
app.include_router(rutas_ordenes.router, tags=["Orquestación"])
app.include_router(rutas_tiempos.router, tags=["Gestión Operativa"])
app.include_router(rutas_cocina.router, tags=["Monitor de Cocina"])
app.include_router(rutas_caja.router)
app.include_router(rutas_admin.router)

@app.get("/", tags=["Estado"])
def ruta_raiz():
    return {"mensaje": "¡El servidor de Fritadas Doña Zita está en línea!"}