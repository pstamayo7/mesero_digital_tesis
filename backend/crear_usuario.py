"""
Utilidad de línea de comandos para crear/actualizar usuarios (empleado o
administrador) con su contraseña ya hasheada. Los clientes NO usan este
script: su acceso al Kiosko/Pantalla de Turnos es público, sin fila en
`usuario`.

Uso:
    python crear_usuario.py <username> <password> <rol>

Ejemplo:
    python crear_usuario.py admin "ClaveSegura123!" administrador
"""
import sys

from app.core.database import get_db_connection
from app.core.seguridad import hashear_password

ROLES_VALIDOS = ("empleado", "administrador")


def crear_usuario(username: str, password: str, rol: str) -> None:
    if rol not in ROLES_VALIDOS:
        raise ValueError(f"Rol inválido '{rol}'. Debe ser uno de: {ROLES_VALIDOS}")

    password_hash = hashear_password(password)

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO usuario (username, password_hash, rol)
            VALUES (%s, %s, %s)
            ON CONFLICT (username)
            DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = EXCLUDED.rol
            """,
            (username, password_hash, rol),
        )
        conn.commit()
        print(f"OK: usuario '{username}' ({rol}) creado/actualizado correctamente.")
    finally:
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Uso: python crear_usuario.py <username> <password> <rol>")
        sys.exit(1)

    _, username_arg, password_arg, rol_arg = sys.argv
    crear_usuario(username_arg, password_arg, rol_arg)
