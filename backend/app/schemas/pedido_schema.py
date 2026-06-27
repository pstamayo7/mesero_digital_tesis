from pydantic import BaseModel, Field, field_validator, model_validator, ValidationInfo
from typing import List, Literal, Optional
from enum import Enum
import uuid

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

    @model_validator(mode="after")
    def validar_ingrediente_conocido(self, info: ValidationInfo):
        """
        🛡️ GUARDRAIL: si el LLM inventó un ingrediente que no existe en la BD, no lanzamos
        ValueError (eso tiraría TODA la acción/pedido con un 422 en cascada). Lo marcamos
        como "INVALIDO" para que ia_service.py lo descarte en la fase de matemáticas sin
        afectar al resto del pedido.

        ⚠️ Comparación NO exacta a propósito: los nombres reales en la BD llevan sufijo de
        unidad (ej. "Mote (lb)", "Aguacate (u)") mientras el LLM dice solo "Mote", "Aguacate".
        Usamos la misma coincidencia flexible (substring en cualquier sentido) que ya usa
        ia_service.py al buscar precios, para no marcar como inválidos ingredientes reales.
        """
        contexto = info.context or {}
        ingredientes_conocidos = contexto.get("ingredientes_conocidos")
        if not ingredientes_conocidos:
            return self  # Sin catálogo en el contexto no hay nada que validar.

        nombre_normalizado = self.ingrediente.strip().lower()
        coincide = any(
            nombre_normalizado in db_nombre or db_nombre in nombre_normalizado
            for db_nombre in ingredientes_conocidos
        )
        if not coincide:
            self.ingrediente = "INVALIDO"
        return self

class AccionLLM(BaseModel):
    # 🛡️ El backend ahora soporta "MODIFICAR" como acción de primera clase: el algoritmo
    # de Split / Full-Update vive en ia_service.py. Pydantic solo garantiza que el LLM no
    # pueda inventar una cuarta acción inexistente.
    accion: Literal["AGREGAR", "QUITAR", "MODIFICAR"] = Field(description="'AGREGAR', 'QUITAR' o 'MODIFICAR'")
    plato: str = Field(description="Nombre exacto del platillo")
    cantidad: int = Field(description="Cantidad a agregar o quitar")
    # Lo hacemos Optional por si la IA devuelve 'null'
    modificaciones: Optional[List[ModificacionStruct]] = Field(default=[], description="Lista de extras o sin ingredientes")

    # 🛡️ GUARDRAIL DE ENTIDADES: lo llena detectar_confusion_de_entidades() si el LLM
    # confundió un ingrediente/extra con un plato principal. ia_service.py usa esta
    # bandera para reconvertir la acción en una modificación en vez de un plato fantasma.
    es_ingrediente_disfrazado: bool = Field(default=False, exclude=True)

    @field_validator("plato")
    @classmethod
    def sin_espacios_fantasma(cls, v: str) -> str:
        # El LLM y la BD pueden devolver nombres con espacios al inicio/final
        # ("Combo Especial " vs "Combo Especial"): normalizamos en el borde de entrada.
        return v.strip()

    @model_validator(mode="after")
    def detectar_confusion_de_entidades(self, info: ValidationInfo):
        """
        Marca cuando el LLM puso un ingrediente/extra conocido (ej. "Mote", "Fritada")
        en el campo 'plato' en vez de un plato principal real. No rechazamos la acción
        aquí porque tirar todo el pedido por una sola acción mal formada es peor que
        corregirla; la fusión real (como EXTRA del plato correspondiente) se hace en
        ia_service.py, que tiene contexto del carrito y de las acciones previas.
        """
        contexto = info.context or {}
        ingredientes_conocidos = contexto.get("ingredientes_conocidos", set())
        platos_conocidos = contexto.get("platos_conocidos", set())

        # ⚠️ Igual que en ModificacionStruct: los nombres de ingredientes en la BD llevan
        # sufijo de unidad ("Mote (lb)") y el LLM dice solo "Mote". Coincidencia flexible
        # (substring en cualquier sentido) en vez de igualdad exacta.
        nombre_normalizado = self.plato.strip().lower()
        es_ingrediente = any(
            nombre_normalizado in db_nombre or db_nombre in nombre_normalizado
            for db_nombre in ingredientes_conocidos
        )
        es_plato_real = any(
            nombre_normalizado in db_nombre or db_nombre in nombre_normalizado
            for db_nombre in platos_conocidos
        )
        if es_ingrediente and not es_plato_real:
            self.es_ingrediente_disfrazado = True
        return self

class SalidaLLM(BaseModel):
    razonamiento: str = "" # 🌟 AÑADIMOS ESTO PARA QUE LA IA PIENSE
    respuesta_mesero: str
    numero_mesa: int
    acciones: List[AccionLLM]

class ItemPedido(BaseModel):
    # 🌟 Identificador único por línea del carrito. Lo necesita el algoritmo de "MODIFICAR"
    # (CASO A: Split) en ia_service.py para distinguir el ítem clonado del original aunque
    # tengan el mismo nombre de plato. Si un item llega sin id (carritos viejos), se le
    # asigna uno nuevo automáticamente.
    cart_item_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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

class ReporteProblemaCocina(BaseModel):
    """Lo que manda el Monitor de Cocina cuando un cocinero suspende un ítem por error
    humano o por falta de stock (ver rutas_cocina.py: POST /cocina/problema-item)."""
    item_pedido_id: int
    tipo_problema: Literal["ERROR_HUMANO", "FALTA_STOCK", "CLIENTE_CANCELO"]
    ingrediente_agotado: Optional[str] = None

    @field_validator("ingrediente_agotado")
    @classmethod
    def sin_espacios_fantasma(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v else v