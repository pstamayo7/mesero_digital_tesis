# backend/app/api/rutas_caja.py
from fastapi import APIRouter, HTTPException, Depends
from psycopg2.extras import RealDictCursor
from app.core.database import get_db_connection
from app.core.seguridad import obtener_usuario_actual, verificar_rol_requerido

# 🌟 RBAC: Caja es exclusiva de empleados y administradores.
router = APIRouter(dependencies=[Depends(verificar_rol_requerido(["empleado", "administrador"]))])

@router.get("/caja/pendientes", tags=["Caja y Facturación"])
def obtener_cuentas_pendientes():
    """Obtiene todas las mesas que tienen cuentas por pagar con su desglose"""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # 🌟 FACTURACIÓN AUTOMÁTICA: 'total_final' ya NO se lee de la columna estática
        # pe.total_final (sellada al confirmar la orden, antes de cualquier incidente de
        # cocina). Se recalcula en vivo con un SUM que excluye CANCELADO y SUSPENDIDO, así
        # que un plato caído por error humano o falta de stock se resta de la cuenta sin
        # que nadie tenga que tocarla a mano.
        query = """
            SELECT
                pe.id_pedido,
                pe.id_mesa,
                pe.cliente_nombre,
                pe.fecha_apertura,
                COALESCE(
                    (
                        SELECT SUM(
                            CASE
                                -- Si n8n guardó el subtotal, usamos ese (precio inmutable)
                                WHEN dp.subtotal_calculado > 0 THEN dp.subtotal_calculado
                                -- Si es un pedido viejo de prueba, calculamos precio base * cant
                                ELSE p.precio_base * dp.cantidad
                            END
                        )
                        FROM Detalle_Pedido dp
                        JOIN Plato p ON dp.id_plato = p.id_plato
                        WHERE dp.id_pedido = pe.id_pedido AND dp.estado_item NOT IN ('CANCELADO', 'SUSPENDIDO')
                    ), 0
                ) as total_final,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'cantidad', dp.cantidad,
                                'plato', p.nombre,
                                'notas', dp.especificaciones_ia,
                                'subtotal', CASE
                                    WHEN dp.subtotal_calculado > 0 THEN dp.subtotal_calculado
                                    ELSE p.precio_base * dp.cantidad
                                END
                            )
                        )
                        FROM Detalle_Pedido dp
                        JOIN Plato p ON dp.id_plato = p.id_plato
                        WHERE dp.id_pedido = pe.id_pedido AND dp.estado_item NOT IN ('CANCELADO', 'SUSPENDIDO')
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
def cobrar_cuenta(id_pedido: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    """Marca el pedido como PAGADO, libera la Mesa para un nuevo cliente y
    registra qué usuario hizo el cobro (id_cajero) para auditoría/reportes."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Marcar pedido como PAGADO, registrar hora de cierre y el cajero
        # que lo procesó. usuario_actual["id_usuario"] viene directo del JWT,
        # sin necesidad de una consulta extra a la tabla usuario.
        cursor.execute("""
            UPDATE Pedido
            SET estado_pago = 'PAGADO', fecha_cierre = CURRENT_TIMESTAMP, id_cajero = %s
            WHERE id_pedido = %s
            RETURNING id_mesa;
        """, (usuario_actual["id_usuario"], id_pedido))
        
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