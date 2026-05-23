# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# AÑADE 'app.' AL PRINCIPIO:
from app.api import rutas_menu, rutas_voz, rutas_ordenes

app = FastAPI(title="API Mesero Digital - Doña Zita")

# --- CONFIGURACIÓN CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- INCLUSIÓN DE RUTAS ---
app.include_router(rutas_menu.router, tags=["Menú"])
app.include_router(rutas_voz.router, tags=["Inteligencia Artificial"])
app.include_router(rutas_ordenes.router, tags=["Orquestación"])

@app.get("/", tags=["Estado"])
def ruta_raiz():
    return {"mensaje": "¡El servidor de Fritadas Doña Zita está en línea!"}