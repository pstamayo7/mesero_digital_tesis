# backend/app/api/rutas_menu.py
from fastapi import APIRouter
from psycopg2.extras import RealDictCursor

# AÑADE 'app.' AL PRINCIPIO:
from app.core.database import get_db_connection

router = APIRouter()


def _nombre_limpio(nombre: str) -> str:
    """Misma transformación que ia_service.py aplica a los ingredientes (quita el sufijo
    de unidad "(lb)"/"(u)" y normaliza el casing) para que el Kiosko táctil escriba
    EXACTAMENTE los mismos strings de 'ingrediente' que ya genera el flujo de voz."""
    return nombre.split("(")[0].strip().title()

@router.get("/menu")
def obtener_menu():
    print("🗄️ Consultando menú dinámico en PostgreSQL...")
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # 🌟 CORRECCIÓN 1: Agregamos p.ruta_imagen al SELECT
        cursor.execute("""
            SELECT c.id_categoria, c.nombre AS categoria_nombre,
                   p.id_plato, p.nombre AS plato_nombre, p.precio_base, p.tiempo_prep_min, p.ruta_imagen
            FROM Categoria c
            JOIN Plato p ON c.id_categoria = p.id_categoria
        """)
        filas = cursor.fetchall()

        # 🌟 DISPONIBILIDAD: un plato queda "agotado" si algún ingrediente de su receta
        # no alcanza el stock mínimo para preparar una porción base.
        cursor.execute("""
            SELECT r.id_plato, i.stock_actual, r.cantidad_base
            FROM Receta r
            JOIN Ingrediente i ON r.id_ingrediente = i.id_ingrediente
        """)
        platos_agotados = {
            fila["id_plato"]
            for fila in cursor.fetchall()
            if float(fila["stock_actual"]) < float(fila["cantidad_base"])
        }

        categorias_dict = {}
        for fila in filas:
            id_cat = fila['id_categoria']
            if id_cat not in categorias_dict:
                categorias_dict[id_cat] = {
                    "id_categoria": id_cat,
                    "nombre": fila['categoria_nombre'],
                    "platos": []
                }

            # 🌟 CORRECCIÓN 2: Agregamos ruta_imagen al diccionario que se envía a React
            categorias_dict[id_cat]["platos"].append({
                "id_plato": fila['id_plato'],
                "nombre": fila['plato_nombre'],
                "descripcion": f"Tiempo estimado: {fila['tiempo_prep_min']} min",
                "precio": float(fila['precio_base']),
                "ruta_imagen": fila['ruta_imagen'],
                "disponible": fila['id_plato'] not in platos_agotados
            })

        return {"categorias": list(categorias_dict.values())}
        
    except Exception as e:
        print(f"❌ Error de base de datos: {e}")
        return {"error": "No se pudo conectar a la base de datos"}
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


@router.get("/menu/{id_plato}/ingredientes")
def obtener_ingredientes_base(id_plato: int):
    """Receta base de un plato, para armar los botones de 'QUITAR' (SIN) en el modal
    de edición táctil. Nombres ya canonizados (sin sufijo de unidad)."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT i.nombre
            FROM Receta r
            JOIN Ingrediente i ON r.id_ingrediente = i.id_ingrediente
            WHERE r.id_plato = %s
            ORDER BY i.nombre ASC;
        """, (id_plato,))
        filas = cursor.fetchall()
        return {"ingredientes_base": [_nombre_limpio(fila["nombre"]) for fila in filas]}
    except Exception as e:
        print(f"❌ Error obteniendo receta base del plato {id_plato}: {e}")
        return {"ingredientes_base": []}
    finally:
        if cursor: cursor.close()
        if conn: conn.close()


@router.get("/extras-disponibles")
def obtener_extras_disponibles():
    """Catálogo completo de ingredientes con su precio de extra, para armar los botones
    de 'AGREGAR EXTRA' en el modal de edición táctil. Nombres ya canonizados."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT nombre, precio_extra FROM Ingrediente ORDER BY nombre ASC;")
        filas = cursor.fetchall()
        return {
            "extras": [
                {"ingrediente": _nombre_limpio(fila["nombre"]), "precio_extra": float(fila["precio_extra"])}
                for fila in filas
            ]
        }
    except Exception as e:
        print(f"❌ Error obteniendo extras disponibles: {e}")
        return {"extras": []}
    finally:
        if cursor: cursor.close()
        if conn: conn.close()