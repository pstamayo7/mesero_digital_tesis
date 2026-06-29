from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from psycopg2.extras import RealDictCursor

from app.core.database import get_db_connection
from app.core.seguridad import crear_access_token, verificar_password
from app.schemas.usuario_schema import Token, UsuarioOut

router = APIRouter(tags=["Autenticación"])


@router.post("/login", response_model=Token)
def login(credenciales: OAuth2PasswordRequestForm = Depends()):
    """Login de empleados/administradores. Los clientes no usan este endpoint
    (su acceso al Kiosko y Pantalla de Turnos es público)."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            "SELECT username, password_hash, rol FROM usuario WHERE username = %s AND activo = TRUE",
            (credenciales.username,),
        )
        usuario = cursor.fetchone()
    finally:
        conn.close()

    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Usuario o contraseña incorrectos.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not usuario or not verificar_password(credenciales.password, usuario["password_hash"]):
        raise credenciales_invalidas

    access_token = crear_access_token({"sub": usuario["username"], "rol": usuario["rol"]})

    return Token(
        access_token=access_token,
        usuario=UsuarioOut(username=usuario["username"], rol=usuario["rol"]),
    )
