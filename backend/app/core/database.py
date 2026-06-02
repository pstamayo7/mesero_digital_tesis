# backend/app/core/database.py
import psycopg2

def get_db_connection():
    """Crea y retorna una conexión a la base de datos PostgreSQL de Doña Zita."""
    return psycopg2.connect(
        host="localhost",
        port="5433",
        database="zita_db",
        user="admin",
        password="adminpassword"
    )

def get_db():
    """Dependencia de FastAPI para manejar la conexión de forma segura."""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()