# backend/app/api/rutas_cocina.py
from fastapi import APIRouter, HTTPException
from psycopg2.extras import RealDictCursor
from app.core.database import get_db_connection

router = APIRouter()

@router.get("/cocina/ordenes", tags=["Monitor de Cocina"])
def obtener_ordenes_cocina():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. AUTOMATIZACIÓN: Contar cuántos pedidos únicos están actualmente en 'PREPARANDO'
        cursor.execute("""
            SELECT COUNT(DISTINCT id_pedido) 
            FROM Detalle_Pedido 
            WHERE estado_item = 'PREPARANDO';
        """)
        pedidos_en_preparacion = cursor.fetchone()['count']
        
        # 2. LÍMITE WIP (Máximo 2): Si hay menos de 2 en preparación, liberamos los siguientes
        if pedidos_en_preparacion < 2:
            espacios_libres = 2 - pedidos_en_preparacion
            
            # Buscamos los IDs de los pedidos más antiguos que estén esperando en 'SOLICITADO'
            cursor.execute("""
                SELECT id_pedido, MIN(fecha_solicitud) as fecha
                FROM Detalle_Pedido
                WHERE estado_item = 'SOLICITADO'
                GROUP BY id_pedido
                ORDER BY fecha ASC
                LIMIT %s;
            """, (espacios_libres,))
            pedidos_a_auto_aceptar = cursor.fetchall()
            
            # Pasamos esos pedidos al estado 'PREPARANDO' e iniciamos su cronómetro
            for p in pedidos_a_auto_aceptar:
                cursor.execute("""
                    UPDATE Detalle_Pedido
                    SET estado_item = 'PREPARANDO',
                        fecha_inicio_preparacion = CURRENT_TIMESTAMP
                    WHERE id_pedido = %s AND estado_item = 'SOLICITADO';
                """, (p['id_pedido'],))
            
            if pedidos_a_auto_aceptar:
                conn.commit()
        
        # 3. CONSULTA NORMAL: Traemos todos los platos activos (en cola o preparándose)
        query = """
            SELECT 
                dp.id_detalle,
                dp.id_pedido,
                p.nombre AS plato_nombre,
                p.tiempo_prep_min,
                dp.cantidad,
                dp.estado_item,
                dp.especificaciones_ia,
                dp.fecha_solicitud,
                dp.fecha_inicio_preparacion,
                pe.id_mesa
            FROM Detalle_Pedido dp
            JOIN Plato p ON dp.id_plato = p.id_plato
            JOIN Pedido pe ON dp.id_pedido = pe.id_pedido
            WHERE dp.estado_item IN ('SOLICITADO', 'PREPARANDO')
            ORDER BY dp.fecha_solicitud ASC;
        """
        cursor.execute(query)
        ordenes = cursor.fetchall()
        return {"ordenes": ordenes}
        
    except Exception as e:
        print(f"❌ Error en máquina de estados de cocina: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

@router.post("/cocina/rechazar/{id_detalle}", tags=["Monitor de Cocina"])
def rechazar_plato(id_detalle: int):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = "UPDATE Detalle_Pedido SET estado_item = 'CANCELADO' WHERE id_detalle = %s;"
        cursor.execute(query, (id_detalle,))
        conn.commit()
        return {"mensaje": f"Plato {id_detalle} anulado por excepción."}
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

@router.post("/cocina/entregar/{id_detalle}", tags=["Monitor de Cocina"])
def entregar_plato(id_detalle: int):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = "UPDATE Detalle_Pedido SET estado_item = 'ENTREGADO' WHERE id_detalle = %s;"
        cursor.execute(query, (id_detalle,))
        conn.commit()
        return {"mensaje": f"Plato {id_detalle} completado."}
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor: cursor.close()
        if conn: conn.close()