# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import rutas_menu, rutas_voz, rutas_ordenes
from app.api import rutas_menu, rutas_voz, rutas_ordenes, rutas_tiempos, rutas_cocina

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

# --- INCLUSIÓN DE RUTAS ---
app.include_router(rutas_menu.router, tags=["Menú"])
app.include_router(rutas_voz.router, tags=["Inteligencia Artificial"])
app.include_router(rutas_ordenes.router, tags=["Orquestación"])
app.include_router(rutas_tiempos.router, tags=["Gestión Operativa"])
app.include_router(rutas_cocina.router, tags=["Monitor de Cocina"])

@app.get("/", tags=["Estado"])
def ruta_raiz():
    return {"mensaje": "¡El servidor de Fritadas Doña Zita está en línea!"}