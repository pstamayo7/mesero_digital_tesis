# backend/app/schemas/pedido_schema.py
from pydantic import BaseModel, Field
from typing import List, Optional

class ItemPedido(BaseModel):
    plato: str = Field(description="Nombre del platillo o bebida (ej. Fritada, Cola)")
    cantidad: int = Field(description="Cantidad solicitada en números")
    modificaciones: Optional[str] = Field(default="", description="Notas o excepciones (ej. sin cebolla, sin hielo, extra tostado)")

class OrdenEstructurada(BaseModel):
    respuesta_mesero: str = Field(description="Frase corta, amigable y natural confirmando la acción realizada.")
    pedidos: List[ItemPedido]