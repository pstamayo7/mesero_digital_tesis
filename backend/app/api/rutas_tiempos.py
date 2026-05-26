from fastapi import APIRouter, Body
from app.core.database import get_db_connection

router = APIRouter()

@router.post("/estimar-tiempo", tags=["Gestión Operativa"])
def estimar_tiempo(carrito: list = Body(...)):
    """Calcula el tiempo de espera realista para el cliente en el Kiosko"""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        tiempo_este_pedido = 0
        if carrito:
            nombres_platos = [item['plato'] for item in carrito]
            if nombres_platos:
                # Usamos ANY(%s) que es el estándar más seguro en PostgreSQL para arrays
                query_platos = "SELECT MAX(tiempo_prep_min) FROM Plato WHERE nombre = ANY(%s);"
                cursor.execute(query_platos, (nombres_platos,))
                resultado = cursor.fetchone()
                if resultado and resultado[0]:
                    tiempo_este_pedido = resultado[0]

        # Calculamos la carga de la cola (restando el tiempo que ya pasó cociéndose)
        query_cola = """
            SELECT 
                SUM(
                    CASE 
                        WHEN dp.estado_item = 'SOLICITADO' THEN p.tiempo_prep_min
                        WHEN dp.estado_item = 'PREPARANDO' THEN 
                            GREATEST(0, p.tiempo_prep_min - EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - dp.fecha_inicio_preparacion))/60)
                        ELSE 0
                    END
                ) as carga_trabajo_pendiente
            FROM Detalle_Pedido dp
            JOIN Plato p ON dp.id_plato = p.id_plato
            WHERE dp.estado_item IN ('SOLICITADO', 'PREPARANDO');
        """
        cursor.execute(query_cola)
        resultado_cola = cursor.fetchone()
        carga_pendiente = float(resultado_cola[0]) if resultado_cola and resultado_cola[0] else 0.0

        # Matemática de colas: Dividimos para 2 cocineros y sumamos el pedido actual
        tiempo_espera_base = int((carga_pendiente / 2) + tiempo_este_pedido)

        # Devolvemos el tiempo base. El frontend se encargará de crear el rango.
        return {"tiempo_estimado_minutos": tiempo_espera_base}

    except Exception as e:
        print(f"❌ Error calculando tiempos: {e}")
        return {"tiempo_estimado_minutos": 15}
    finally:
        if cursor: cursor.close()
        if conn: conn.close()