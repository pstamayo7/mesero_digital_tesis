from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

# Roles que se pueden asignar desde la UI de Gestión de Personal. Un solo rol
# 'empleado' con acceso tanto a Caja como a Cocina (decisión de negocio: no
# se necesita separar por puesto).
ROLES_ASIGNABLES = ("empleado", "administrador")


class UsuarioOut(BaseModel):
    """Lo que el backend expone del usuario logueado: nunca el hash."""
    username: str
    rol: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut


class UsuarioListado(BaseModel):
    """Fila de la tabla de Gestión de Personal."""
    id_usuario: int
    username: str
    nombre_completo: Optional[str] = None
    rol: str
    activo: bool
    fecha_creacion: datetime


class UsuarioCrear(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6)
    nombre_completo: Optional[str] = None
    rol: str

    @field_validator("username")
    @classmethod
    def sin_espacios_fantasma(cls, v: str) -> str:
        return v.strip()

    @field_validator("rol")
    @classmethod
    def rol_valido(cls, v: str) -> str:
        if v not in ROLES_ASIGNABLES:
            raise ValueError(f"Rol inválido. Debe ser uno de: {ROLES_ASIGNABLES}")
        return v


class UsuarioActualizar(BaseModel):
    """PUT parcial: todos los campos son opcionales. Si `password` viene
    vacío/None, la contraseña actual no se toca."""
    nombre_completo: Optional[str] = None
    rol: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=6)
    activo: Optional[bool] = None

    @field_validator("rol")
    @classmethod
    def rol_valido(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ROLES_ASIGNABLES:
            raise ValueError(f"Rol inválido. Debe ser uno de: {ROLES_ASIGNABLES}")
        return v
