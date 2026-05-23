# backend/app/api/rutas_menu.py
from fastapi import APIRouter
from psycopg2.extras import RealDictCursor

# AÑADE 'app.' AL PRINCIPIO:
from app.core.database import get_db_connection

router = APIRouter()

@router.get("/menu")
def obtener_menu():
    print("🗄️ Consultando menú dinámico en PostgreSQL...")
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT c.id_categoria, c.nombre AS categoria_nombre, 
                   p.id_plato, p.nombre AS plato_nombre, p.precio_base, p.tiempo_prep_min 
            FROM Categoria c
            JOIN Plato p ON c.id_categoria = p.id_categoria
        """)
        filas = cursor.fetchall()
        
        categorias_dict = {}
        for fila in filas:
            id_cat = fila['id_categoria']
            if id_cat not in categorias_dict:
                categorias_dict[id_cat] = {
                    "id_categoria": id_cat,
                    "nombre": fila['categoria_nombre'],
                    "platos": []
                }
            
            categorias_dict[id_cat]["platos"].append({
                "id_plato": fila['id_plato'],
                "nombre": fila['plato_nombre'],
                "descripcion": f"Tiempo estimado: {fila['tiempo_prep_min']} min",
                "precio": float(fila['precio_base'])
            })
            
        return {"categorias": list(categorias_dict.values())}
        
    except Exception as e:
        print(f"❌ Error de base de datos: {e}")
        return {"error": "No se pudo conectar a la base de datos"}
    finally:
        if cursor: cursor.close()
        if conn: conn.close()