"""
Seguridad: hashing de contraseñas (passlib/bcrypt) + JWT (python-jose) +
dependencias de FastAPI para autenticación y RBAC.

Roles del sistema:
    - cliente:        público, sin login (Kiosko, Pantalla de Turnos).
    - empleado:        login requerido. Acceso a Cocina y Caja.
    - administrador:   login requerido. Acceso a todo, incluida Administración.
"""
import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

# 🌟 En producción, SECRET_KEY debe venir de una variable de entorno real
# (nunca hardcodeada en el repo). Mantenemos un valor de respaldo solo para
# que el entorno de desarrollo funcione "out of the box".
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "doña-zita-clave-de-desarrollo-cambiar-en-produccion")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", str(8 * 60)))  # 8 horas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# tokenUrl apunta al endpoint de login: así Swagger UI también puede
# autenticarse con el botón "Authorize".
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login", auto_error=False)


# ---------------------------------------------------------------------------
# Contraseñas
# ---------------------------------------------------------------------------
def hashear_password(password: str) -> str:
    return pwd_context.hash(password)


def verificar_password(password_plano: str, password_hash: str) -> bool:
    return pwd_context.verify(password_plano, password_hash)


# ---------------------------------------------------------------------------
# Tokens JWT
# ---------------------------------------------------------------------------
def crear_access_token(datos: dict, expires_delta: timedelta | None = None) -> str:
    """`datos` debe incluir al menos {"sub": username, "rol": rol, "id_usuario": id}.
    `id_usuario` viaja en el token para que endpoints como /caja/cobrar puedan
    registrar quién hizo la transacción sin una consulta extra a la BD."""
    a_codificar = datos.copy()
    expira = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    a_codificar.update({"exp": expira})
    return jwt.encode(a_codificar, SECRET_KEY, algorithm=ALGORITHM)


def _credenciales_invalidas() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar la sesión. Vuelve a iniciar sesión.",
        headers={"WWW-Authenticate": "Bearer"},
    )


# ---------------------------------------------------------------------------
# Dependencias de FastAPI
# ---------------------------------------------------------------------------
def obtener_usuario_actual(token: str | None = Depends(oauth2_scheme)) -> dict:
    """Decodifica el JWT del header Authorization y devuelve
    {id_usuario, username, rol}. Lanza 401 si no hay token, es inválido/
    expirado, o fue emitido antes de que el token incluyera id_usuario
    (en ese caso basta con volver a iniciar sesión)."""
    if token is None:
        raise _credenciales_invalidas()

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise _credenciales_invalidas()

    username = payload.get("sub")
    rol = payload.get("rol")
    id_usuario = payload.get("id_usuario")
    if username is None or rol is None or id_usuario is None:
        raise _credenciales_invalidas()

    return {"id_usuario": id_usuario, "username": username, "rol": rol}


def verificar_rol_requerido(roles_permitidos: list[str]):
    """Fábrica de dependencias: úsala como
    `Depends(verificar_rol_requerido(["empleado", "administrador"]))`.
    Devuelve 403 si el rol del usuario autenticado no está en la lista."""

    def dependencia(usuario_actual: dict = Depends(obtener_usuario_actual)) -> dict:
        if usuario_actual["rol"] not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para acceder a este recurso.",
            )
        return usuario_actual

    return dependencia
