# backend/app/api/rutas_tiempos.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from app.services.tiempos_service import calcular_demora_estimada

router = APIRouter()

# Molde de entrada para lo que enviará React
class ItemCarrito(BaseModel):
    plato: str
    cantidad: int
    modificaciones: str = ""

@router.post("/estimar-tiempo")
def estimar_tiempo_espera(carrito: List[ItemCarrito]):
    # Convertimos los objetos Pydantic a diccionarios normales para el servicio
    carrito_dict = [{"plato": c.plato, "cantidad": c.cantidad} for c in carrito]
    resultado = calcular_demora_estimada(carrito_dict)
    return resultado