from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from enum import Enum

# 1. Definimos los tipos de modificaciones para el inventario
class TipoMod(str, Enum):
    EXTRA = "EXTRA"
    SIN = "SIN"

# Lo que le enviaremos de regreso a React (El carrito final calculado por Python)
class ModificacionStruct(BaseModel):
    tipo: str = Field(description="Debe ser 'EXTRA', 'SIN', o 'POCO'")
    ingrediente: str = Field(description="Nombre del ingrediente")
    recargo: float = 0.0 # 🌟 NUEVO: Para enviar cuánto costó este extra

    @field_validator("ingrediente")
    @classmethod
    def sin_espacios_fantasma(cls, v: str) -> str:
        return v.strip()

class AccionLLM(BaseModel):
    accion: str = Field(description="'AGREGAR' o 'QUITAR'")
    plato: str = Field(description="Nombre exacto del platillo")
    cantidad: int = Field(description="Cantidad a agregar o quitar")
    # Lo hacemos Optional por si la IA devuelve 'null'
    modificaciones: Optional[List[ModificacionStruct]] = Field(default=[], description="Lista de extras o sin ingredientes")

    @field_validator("plato")
    @classmethod
    def sin_espacios_fantasma(cls, v: str) -> str:
        # El LLM y la BD pueden devolver nombres con espacios al inicio/final
        # ("Combo Especial " vs "Combo Especial"): normalizamos en el borde de entrada.
        return v.strip()
65
class SalidaLLM(BaseModel):
    razonamiento: str = "" # 🌟 AÑADIMOS ESTO PARA QUE LA IA PIENSE
    respuesta_mesero: str
    numero_mesa: int
    acciones: List[AccionLLM]

class ItemPedido(BaseModel):
    plato: str
    cantidad: int
    modificaciones: str = ""
    mods_estructuradas: List[ModificacionStruct] = []
    precio_unitario: float = 0.0 # 🌟 NUEVO: El precio base de PostgreSQL
    subtotal: float = 0.0 # 🌟 NUEVO: (precio base + recargos) * cantidad

    @field_validator("plato")
    @classmethod
    def sin_espacios_fantasma(cls, v: str) -> str:
        return v.strip()

class OrdenEstructurada(BaseModel):
    respuesta_mesero: str
    numero_mesa: int = 0
    pedidos: List[ItemPedido]
    total_pedido: float = 0.0 
    error_stock: str = "" 

class OrdenEntrante(BaseModel):
    id_mesa: int
    cliente_nombre: Optional[str] = "Local"
    pedidos: list

class InteraccionBienvenida(BaseModel):
    respuesta_mesero: str
    nombre_cliente: Optional[str] = ""
    nombre_confirmado: bool = False