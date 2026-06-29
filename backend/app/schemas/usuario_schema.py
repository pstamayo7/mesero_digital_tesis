from pydantic import BaseModel


class UsuarioOut(BaseModel):
    """Lo que el backend expone del usuario logueado: nunca el hash."""
    username: str
    rol: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut
