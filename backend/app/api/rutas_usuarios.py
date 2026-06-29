from fastapi import APIRouter, Depends, HTTPException, status
from psycopg2.extras import RealDictCursor

from app.core.database import get_db_connection
from app.core.seguridad import hashear_password, obtener_usuario_actual, verificar_rol_requerido
from app.schemas.usuario_schema import UsuarioActualizar, UsuarioCrear, UsuarioListado

# 🌟 RBAC: Gestión de Personal (crear/editar/desactivar cuentas) es
# exclusiva del rol 'administrador'.
router = APIRouter(
    prefix="/admin/usuarios",
    tags=["Gestión de Personal"],
    dependencies=[Depends(verificar_rol_requerido(["administrador"]))],
)

_CAMPOS_USUARIO = "id_usuario, username, nombre_completo, rol, activo, fecha_creacion"


@router.get("", response_model=list[UsuarioListado])
def listar_usuarios():
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(f"SELECT {_CAMPOS_USUARIO} FROM usuario ORDER BY fecha_creacion DESC")
        return cursor.fetchall()
    finally:
        conn.close()


@router.post("", response_model=UsuarioListado, status_code=status.HTTP_201_CREATED)
def crear_usuario(datos: UsuarioCrear):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("SELECT 1 FROM usuario WHERE username = %s", (datos.username,))
        if cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese nombre de usuario ya existe.")

        cursor.execute(
            f"""
            INSERT INTO usuario (username, password_hash, nombre_completo, rol)
            VALUES (%s, %s, %s, %s)
            RETURNING {_CAMPOS_USUARIO}
            """,
            (datos.username, hashear_password(datos.password), datos.nombre_completo, datos.rol),
        )
        nuevo = cursor.fetchone()
        conn.commit()
        return nuevo
    finally:
        conn.close()


@router.put("/{id_usuario}", response_model=UsuarioListado)
def actualizar_usuario(id_usuario: int, datos: UsuarioActualizar):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT id_usuario FROM usuario WHERE id_usuario = %s", (id_usuario,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

        campos, valores = [], []
        if datos.nombre_completo is not None:
            campos.append("nombre_completo = %s")
            valores.append(datos.nombre_completo)
        if datos.rol is not None:
            campos.append("rol = %s")
            valores.append(datos.rol)
        if datos.activo is not None:
            campos.append("activo = %s")
            valores.append(datos.activo)
        if datos.password:
            campos.append("password_hash = %s")
            valores.append(hashear_password(datos.password))

        if campos:
            valores.append(id_usuario)
            cursor.execute(f"UPDATE usuario SET {', '.join(campos)} WHERE id_usuario = %s", valores)
            conn.commit()

        cursor.execute(f"SELECT {_CAMPOS_USUARIO} FROM usuario WHERE id_usuario = %s", (id_usuario,))
        return cursor.fetchone()
    finally:
        conn.close()


@router.delete("/{id_usuario}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_usuario(id_usuario: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    """Borrado lógico (activo = FALSE): nunca se elimina la fila, para no
    perder el historial de auditoría asociado a ese usuario."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT username FROM usuario WHERE id_usuario = %s", (id_usuario,))
        fila = cursor.fetchone()
        if not fila:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

        # 🌟 Salvaguarda: un administrador no puede desactivar su propia cuenta
        # (evita quedar bloqueado fuera del sistema sin otro admin activo).
        if fila["username"] == usuario_actual["username"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes desactivar tu propia cuenta.")

        cursor.execute("UPDATE usuario SET activo = FALSE WHERE id_usuario = %s", (id_usuario,))
        conn.commit()
    finally:
        conn.close()
