# backend/app/services/tiempos_service.py
from app.core.database import get_db_connection

def calcular_demora_estimada(carrito):
    """
    Algoritmo de estimación dinámico basado en Teoría de Colas.
    Calcula el tiempo restante exacto descontando los minutos ya trabajados en cocina.
    """
    tiempo_pedido_actual = 0
    carga_pendiente_minutos = 0
    capacidad_cocina = 2 # Simulamos que Doña Zita tiene 2 cocineros (procesamiento paralelo)
    
    conexion = None
    try:
        conexion = get_db_connection()
        cursor = conexion.cursor()

        # 1. Calcular tiempo base del pedido que está armando el cliente
        if carrito:
            nombres_platos = [item['plato'] for item in carrito]
            placeholders = ','.join(['%s'] * len(nombres_platos))
            cursor.execute(f"SELECT nombre, tiempo_prep_min FROM Plato WHERE nombre IN ({placeholders})", tuple(nombres_platos))
            tiempos_db = dict(cursor.fetchall())
            
            for item in carrito:
                tiempo_base = tiempos_db.get(item['plato'], 5)
                tiempo_pedido_actual += tiempo_base * item['cantidad']

        # 2. Calcular la carga PENDIENTE total restando el tiempo ya transcurrido
        consulta_cola_dinamica = """
            SELECT COALESCE(SUM(
                CASE 
                    -- Si apenas fue solicitado, suma el tiempo completo
                    WHEN dp.estado_item = 'SOLICITADO' THEN (p.tiempo_prep_min * dp.cantidad)
                    
                    -- Si se está preparando, restamos los minutos que ya pasaron
                    WHEN dp.estado_item = 'PREPARANDO' AND dp.fecha_inicio_preparacion IS NOT NULL THEN
                        GREATEST(0, (p.tiempo_prep_min * dp.cantidad) - (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - dp.fecha_inicio_preparacion)) / 60))
                    
                    -- Por si acaso falta la fecha, cobramos el tiempo completo
                    ELSE (p.tiempo_prep_min * dp.cantidad)
                END
            ), 0)
            FROM Detalle_Pedido dp
            JOIN Plato p ON dp.id_plato = p.id_plato
            WHERE dp.estado_item IN ('SOLICITADO', 'PREPARANDO')
        """
        cursor.execute(consulta_cola_dinamica)
        carga_pendiente_minutos = float(cursor.fetchone()[0])

    except Exception as e:
        print(f"❌ Error calculando tiempos dinámicos: {e}")
    finally:
        if conexion:
            cursor.close()
            conexion.close()

    # 3. Aplicación de la fórmula de colas
    tiempo_cola_espera = carga_pendiente_minutos / capacidad_cocina
    tiempo_propio = tiempo_pedido_actual / capacidad_cocina
    
    tiempo_total_estimado = round(tiempo_cola_espera + tiempo_propio)

    # Establecemos un umbral mínimo de cortesía (ej. 5 minutos) si la cocina está vacía
    if tiempo_total_estimado < 5 and carrito:
        tiempo_total_estimado = 5

    return {
        "carga_cocina_minutos": round(carga_pendiente_minutos, 2),
        "tiempo_estimado_minutos": tiempo_total_estimado
    }