import math
from fastapi import APIRouter, Body
from psycopg2.extras import RealDictCursor
from app.core.database import get_db_connection


router = APIRouter()

@router.post("/estimar-tiempo", tags=["Gestión Operativa"])
def estimar_tiempo(carrito: list = Body(...)):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("SELECT capacidad_paila_cocina, cantidad_cocineros, porcentaje_tiempo_extra FROM Configuracion_Operativa LIMIT 1;")
        config = cursor.fetchone()
        capacidad_paila = config['capacidad_paila_cocina'] if config else 8
        cocineros = config['cantidad_cocineros'] if config else 2
        porc_extra = float(config['porcentaje_tiempo_extra']) if config else 0.10

        platos_nuevo_pedido = 0
        nombres_platos = [item['plato'] for item in carrito] if carrito else []
        
        if nombres_platos:
            cursor.execute("SELECT nombre FROM Plato WHERE nombre = ANY(%s) AND requiere_coccion = TRUE;", (nombres_platos,))
            platos_coccion_db = [r['nombre'] for r in cursor.fetchall()]
            for item in carrito:
                if item['plato'] in platos_coccion_db:
                    platos_nuevo_pedido += int(item.get('cantidad', 1))

        if platos_nuevo_pedido == 0 and carrito:
            return {"tiempo_estimado_minutos": 3}

        cursor.execute("""
            SELECT COALESCE(SUM(dp.cantidad), 0) as carga_actual
            FROM Detalle_Pedido dp
            JOIN Plato p ON dp.id_plato = p.id_plato
            WHERE dp.estado_item IN ('SOLICITADO', 'PREPARANDO') AND p.requiere_coccion = TRUE;
        """)
        platos_en_cola = cursor.fetchone()['carga_actual']
        
        total_platos = platos_en_cola + platos_nuevo_pedido
        tandas = math.ceil(total_platos / capacidad_paila)
        
        query_max_time = """
            SELECT COALESCE(MAX(tiempo_prep_min), 15) as max_time
            FROM Plato WHERE requiere_coccion = TRUE AND (nombre = ANY(%s) OR id_plato IN (SELECT id_plato FROM Detalle_Pedido WHERE estado_item IN ('SOLICITADO', 'PREPARANDO')));
        """
        cursor.execute(query_max_time, (nombres_platos if nombres_platos else [''],))
        tiempo_base = float(cursor.fetchone()['max_time'])
        
        # Corrección: El factor extra se calcula en base al tamaño de la tanda física (máximo la paila)
        platos_tanda_base = min(total_platos, capacidad_paila)
        if platos_tanda_base > 0:
            tiempo_por_tanda = tiempo_base + (tiempo_base * porc_extra * (platos_tanda_base - 1))
        else:
            tiempo_por_tanda = tiempo_base
        
        # Aplicamos la fórmula paralela de tu tesis
        tiempo_espera_base = int((tandas * tiempo_por_tanda) / cocineros)

        return {"tiempo_estimado_minutos": tiempo_espera_base}

    except Exception as e:
        return {"tiempo_estimado_minutos": 15}
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
@router.get("/configuracion-kiosko", tags=["Configuración"])
def obtener_config_kiosko():
    """Devuelve los parámetros operativos para limitar el Kiosko"""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT max_platos_kiosko FROM Configuracion_Operativa LIMIT 1;")
        config = cursor.fetchone()
        return {"max_platos": config['max_platos_kiosko'] if config else 15}
    except Exception as e:
        return {"max_platos": 15} # Valor seguro por defecto
    finally:
        if cursor: cursor.close()
        if conn: conn.close()