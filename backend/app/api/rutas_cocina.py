import math
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
        
        # 1. PARÁMETROS OPERATIVOS
        cursor.execute("SELECT capacidad_paila_cocina, cantidad_cocineros, porcentaje_tiempo_extra FROM Configuracion_Operativa LIMIT 1;")
        config = cursor.fetchone()
        capacidad_paila = config['capacidad_paila_cocina'] if config else 8
        cocineros = config['cantidad_cocineros'] if config else 2
        porc_extra = float(config['porcentaje_tiempo_extra']) if config else 0.10
        
        # 2. ESTADO ACTUAL (Cuántos platos calientes hay en la paila)
        cursor.execute("""
            SELECT COALESCE(SUM(dp.cantidad), 0) as total_preparando
            FROM Detalle_Pedido dp
            JOIN Plato p ON dp.id_plato = p.id_plato
            WHERE dp.estado_item = 'PREPARANDO' AND p.requiere_coccion = TRUE;
        """)
        preparando = cursor.fetchone()['total_preparando']
        espacios_libres = capacidad_paila - preparando
        
        # 3. MÁQUINA DE ESTADOS (Asignación de tiempos fijos)
        cursor.execute("""
            SELECT dp.id_detalle, dp.cantidad, p.requiere_coccion, p.tiempo_prep_min
            FROM Detalle_Pedido dp
            JOIN Plato p ON dp.id_plato = p.id_plato
            WHERE dp.estado_item = 'SOLICITADO'
            ORDER BY dp.fecha_solicitud ASC;
        """)
        pendientes = cursor.fetchall()
        
        for item in pendientes:
            # SI ES BEBIDA: Pasa directo, tiempo asignado 0, no ocupa espacio.
            if not item['requiere_coccion']:
                cursor.execute("""
                    UPDATE Detalle_Pedido 
                    SET estado_item = 'PREPARANDO', fecha_inicio_preparacion = CURRENT_TIMESTAMP, tiempo_asignado_cocina = 0 
                    WHERE id_detalle = %s;
                """, (item['id_detalle'],))
                continue
                
            if espacios_libres <= 0:
                break
                
            cantidad = item['cantidad']
            tiempo_base = float(item['tiempo_prep_min']) if item['tiempo_prep_min'] else 15.0
            
            if cantidad <= espacios_libres:
                # 🌟 CÁLCULO SEGURO: Calculamos el tiempo basado en lo que hay AHORA + lo de este pedido
                carga_para_este_plato = (capacidad_paila - espacios_libres) + cantidad
                platos_tanda = min(carga_para_este_plato, capacidad_paila)
                tiempo_calc = tiempo_base + (tiempo_base * porc_extra * (platos_tanda - 1))
                tiempo_final = math.ceil(tiempo_calc / cocineros)
                
                cursor.execute("""
                    UPDATE Detalle_Pedido 
                    SET estado_item = 'PREPARANDO', fecha_inicio_preparacion = CURRENT_TIMESTAMP, tiempo_asignado_cocina = %s 
                    WHERE id_detalle = %s;
                """, (tiempo_final, item['id_detalle']))
                espacios_libres -= cantidad
            else:
                # LÓGICA DE SPLIT (Si se divide, llenamos la paila al 100%)
                rondas_si_espera = math.ceil(cantidad / capacidad_paila)
                rondas_si_divide = 1 + math.ceil((cantidad - espacios_libres) / capacidad_paila)
                
                if rondas_si_divide <= rondas_si_espera:
                    cant_preparar = espacios_libres
                    cant_esperar = cantidad - espacios_libres
                    
                    tiempo_calc = tiempo_base + (tiempo_base * porc_extra * (capacidad_paila - 1))
                    tiempo_final = math.ceil(tiempo_calc / cocineros)
                    
                    cursor.execute("""
                        UPDATE Detalle_Pedido 
                        SET cantidad = %s, estado_item = 'PREPARANDO', fecha_inicio_preparacion = CURRENT_TIMESTAMP, tiempo_asignado_cocina = %s 
                        WHERE id_detalle = %s;
                    """, (cant_preparar, tiempo_final, item['id_detalle']))
                    
                    cursor.execute("""
                        INSERT INTO Detalle_Pedido (id_pedido, id_plato, cantidad, especificaciones_ia, estado_item, fecha_solicitud)
                        SELECT id_pedido, id_plato, %s, especificaciones_ia, 'SOLICITADO', fecha_solicitud
                        FROM Detalle_Pedido WHERE id_detalle = %s;
                    """, (cant_esperar, item['id_detalle']))
                    
                    espacios_libres = 0
                    break
                else:
                    break
                    
        conn.commit()
        
        # 4. CONSULTA FINAL: Ahora devolvemos requiere_coccion y el tiempo_asignado al frontend
        query = """
            SELECT 
                dp.id_detalle, dp.id_pedido, p.nombre AS plato_nombre, 
                p.requiere_coccion, dp.tiempo_asignado_cocina,
                dp.cantidad, dp.estado_item, dp.especificaciones_ia, 
                dp.fecha_solicitud, dp.fecha_inicio_preparacion, pe.id_mesa
            FROM Detalle_Pedido dp
            JOIN Plato p ON dp.id_plato = p.id_plato
            JOIN Pedido pe ON dp.id_pedido = pe.id_pedido
            WHERE dp.estado_item IN ('SOLICITADO', 'PREPARANDO')
            ORDER BY dp.fecha_solicitud ASC;
        """
        cursor.execute(query)
        return {"ordenes": cursor.fetchall()}
        
    except Exception as e:
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail="Error interno")
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# Rutas rechazar y entregar permanecen intactas...
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