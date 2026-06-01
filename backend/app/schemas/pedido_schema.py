from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

# 1. Definimos los tipos de modificaciones para el inventario
class TipoMod(str, Enum):
    EXTRA = "EXTRA"
    SIN = "SIN"



class AccionLLM(BaseModel):
    accion: str = Field(description="'AGREGAR' o 'QUITAR'")
    plato: str = Field(description="Nombre exacto del platillo")
    cantidad: int = Field(description="Cantidad a agregar o quitar")
    # Lo hacemos Optional por si la IA devuelve 'null'
    modificaciones: Optional[List[ModificacionStruct]] = Field(default=[], description="Lista de extras o sin ingredientes")

class SalidaLLM(BaseModel):
    razonamiento: str = "" # 🌟 AÑADIMOS ESTO PARA QUE LA IA PIENSE
    respuesta_mesero: str
    numero_mesa: int
    acciones: List[AccionLLM]

# 4. Lo que le enviaremos de regreso a React (El carrito final calculado por Python)
class ModificacionStruct(BaseModel):
    tipo: str = Field(description="Debe ser 'EXTRA', 'SIN', o 'POCO'")
    ingrediente: str = Field(description="Nombre del ingrediente")
    recargo: float = 0.0 # 🌟 NUEVO: Para enviar cuánto costó este extra



class ItemPedido(BaseModel):
    plato: str
    cantidad: int
    modificaciones: str = ""
    mods_estructuradas: List[ModificacionStruct] = []
    precio_unitario: float = 0.0 # 🌟 NUEVO: El precio base de PostgreSQL
    subtotal: float = 0.0 # 🌟 NUEVO: (precio base + recargos) * cantidad

class OrdenEstructurada(BaseModel):
    respuesta_mesero: str
    numero_mesa: int = 0
    pedidos: List[ItemPedido]
    total_pedido: float = 0.0 
    error_stock: str = "" # 🌟

# ... (OrdenEntrante e InteraccionBienvenida se quedan igual)

class OrdenEntrante(BaseModel):
    id_mesa: int
    cliente_nombre: Optional[str] = "Local"
    pedidos: list

class InteraccionBienvenida(BaseModel):
    respuesta_mesero: str
    nombre_cliente: Optional[str] = ""
    nombre_confirmado: bool = False