# backend/app/services/tiempos_service.py
from app.core.database import get_db_connection

def calcular_demora_estimada(carrito):
    """
    Algoritmo de estimación basado en Teoría de Colas.
    Calcula la carga transaccional pendiente en la BD y le suma el carrito actual.
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
            # Creamos los placeholders (%s) dinámicamente para la consulta IN
            placeholders = ','.join(['%s'] * len(nombres_platos))
            cursor.execute(f"SELECT nombre, tiempo_prep_min FROM Plato WHERE nombre IN ({placeholders})", tuple(nombres_platos))
            tiempos_db = dict(cursor.fetchall())
            
            for item in carrito:
                tiempo_base = tiempos_db.get(item['plato'], 5) # 5 min por defecto
                tiempo_pedido_actual += tiempo_base * item['cantidad']

        # 2. Calcular la carga PENDIENTE total en la cocina
        consulta_cola = """
            SELECT COALESCE(SUM(p.tiempo_prep_min * dp.cantidad), 0)
            FROM Detalle_Pedido dp
            JOIN Plato p ON dp.id_plato = p.id_plato
            WHERE dp.estado_item IN ('SOLICITADO', 'PREPARANDO')
        """
        cursor.execute(consulta_cola)
        carga_pendiente_minutos = int(cursor.fetchone()[0])

    except Exception as e:
        print(f"❌ Error calculando tiempos: {e}")
    finally:
        if conexion:
            cursor.close()
            conexion.close()

    # 3. Aplicación de la fórmula de colas
    # El tiempo en cola se divide para el número de cocineros que sacan platos en paralelo
    tiempo_cola_espera = carga_pendiente_minutos / capacidad_cocina
    tiempo_propio = tiempo_pedido_actual / capacidad_cocina
    
    tiempo_total_estimado = round(tiempo_cola_espera + tiempo_propio)

    # Si la cocina está vacía, igual hay un tiempo mínimo razonable
    if tiempo_total_estimado < 5 and carrito:
        tiempo_total_estimado = 5

    return {
        "carga_cocina_minutos": carga_pendiente_minutos,
        "tiempo_estimado_minutos": tiempo_total_estimado
    }