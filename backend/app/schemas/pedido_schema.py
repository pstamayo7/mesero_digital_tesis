from pydantic import BaseModel, Field
from typing import List, Optional

class ItemPedido(BaseModel):
    plato: str = Field(description="Nombre del platillo")
    cantidad: int = Field(description="Cantidad solicitada en números")
    modificaciones: Optional[str] = Field(default="", description="Notas extras")

class OrdenEstructurada(BaseModel):
    respuesta_mesero: str = Field(description="Respuesta hablada.")
    numero_mesa: int = Field(default=0, description="Número de mesa/paleta. 0 si aún no lo dice.") # <-- NUEVO
    pedidos: List[ItemPedido]
class OrdenEntrante(BaseModel):
    id_mesa: int
    cliente_nombre: Optional[str] = "Local" # 🌟 NUEVO: Agregamos esto para que lo acepte
    pedidos: list # o List[TuModeloDePlato] dependiendo de cómo lo tengas