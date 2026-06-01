# backend/app/api/rutas_caja.py
from fastapi import APIRouter, HTTPException
from psycopg2.extras import RealDictCursor
from app.core.database import get_db_connection

router = APIRouter()

@router.get("/caja/pendientes", tags=["Caja y Facturación"])
def obtener_cuentas_pendientes():
    """Obtiene todas las mesas que tienen cuentas por pagar con su desglose"""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                pe.id_pedido, 
                pe.id_mesa, 
                pe.cliente_nombre, 
                pe.total_final, 
                pe.fecha_apertura,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'cantidad', dp.cantidad,
                                'plato', p.nombre,
                                'notas', dp.especificaciones_ia,
                                'subtotal', CASE 
                                    -- Si n8n guardó el subtotal, usamos ese (precio inmutable)
                                    WHEN dp.subtotal_calculado > 0 THEN dp.subtotal_calculado 
                                    -- Si es un pedido viejo de prueba, calculamos precio base * cant
                                    ELSE p.precio_base * dp.cantidad 
                                END
                            )
                        )
                        FROM Detalle_Pedido dp
                        JOIN Plato p ON dp.id_plato = p.id_plato
                        WHERE dp.id_pedido = pe.id_pedido AND dp.estado_item != 'CANCELADO'
                    ), '[]'::json
                ) as detalles
            FROM Pedido pe 
            WHERE pe.estado_pago = 'PENDIENTE'
            ORDER BY pe.fecha_apertura ASC;
        """
        cursor.execute(query)
        cuentas = cursor.fetchall()
        
        return {"cuentas": cuentas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener cuentas: {e}")
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

@router.post("/caja/cobrar/{id_pedido}", tags=["Caja y Facturación"])
def cobrar_cuenta(id_pedido: int):
    """Marca el pedido como PAGADO y libera la Mesa para un nuevo cliente"""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 1. Marcar pedido como PAGADO y registrar hora de cierre
        cursor.execute("""
            UPDATE Pedido 
            SET estado_pago = 'PAGADO', fecha_cierre = CURRENT_TIMESTAMP 
            WHERE id_pedido = %s 
            RETURNING id_mesa;
        """, (id_pedido,))
        
        resultado = cursor.fetchone()
        if not resultado:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
            
        id_mesa = resultado[0]
        
        # 2. Liberar la mesa (Solo si no es pedido para llevar, osea id_mesa > 0)
        if id_mesa and id_mesa > 0:
            cursor.execute("UPDATE Mesa SET estado_mesa = 'LIBRE' WHERE id_mesa = %s;", (id_mesa,))
            
        conn.commit()
        return {"exito": True, "mensaje": f"💰 Pedido {id_pedido} cobrado con éxito. Mesa {id_mesa} liberada."}
        
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error al cobrar: {e}")
    finally:
        if cursor: cursor.close()
        if conn: conn.close()