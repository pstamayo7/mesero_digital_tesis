from fastapi import APIRouter, Depends
from psycopg2.extras import RealDictCursor
from app.core.database import get_db
from pydantic import BaseModel
from app.services.ia_service import generar_analisis_negocio

router = APIRouter()

class DatosAnalisis(BaseModel):
    kpis: dict
    platos: dict
    operacion: dict

@router.get("/reportes/kpis")
def obtener_kpis(periodo: str = 'mes', db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    
    # 1. Definir el filtro de fecha según lo que pida el frontend
    if periodo == 'hoy':
        filtro_fecha = "DATE(fecha_apertura) = CURRENT_DATE"
    elif periodo == 'ayer':
        filtro_fecha = "DATE(fecha_apertura) = CURRENT_DATE - INTERVAL '1 day'"
    elif periodo == 'semana':
        filtro_fecha = "fecha_apertura >= date_trunc('week', CURRENT_DATE)"
    elif periodo == 'mes':
        filtro_fecha = "fecha_apertura >= date_trunc('month', CURRENT_DATE)"
    elif periodo == 'año' or periodo == 'ano':
        filtro_fecha = "fecha_apertura >= date_trunc('year', CURRENT_DATE)"
    else:
        filtro_fecha = "fecha_apertura >= date_trunc('month', CURRENT_DATE)" # Por defecto

    # 2. Armar la consulta SQL (Usamos COALESCE por si no hay ventas, que devuelva 0)
    query = f"""
        SELECT 
            COALESCE(SUM(total_final), 0) AS ingresos,
            COUNT(id_pedido) AS ordenes
        FROM pedido
        WHERE {filtro_fecha} AND estado_pago = 'PAGADO'
    """
    
    try:
        cursor.execute(query)
        datos = cursor.fetchone()
        
        # 3. Procesar los resultados
        ingresos = float(datos['ingresos'])
        ordenes = int(datos['ordenes'])
        ticket_promedio = round(ingresos / ordenes, 2) if ordenes > 0 else 0.00
        
        return {
            "ingresos": ingresos,
            "ordenes": ordenes,
            "ticket": ticket_promedio
        }
    except Exception as e:
        return {"error": str(e)}
@router.get("/reportes/platos")
def obtener_rendimiento_platos(periodo: str = 'mes', db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    
    # 1. El mismo filtro de tiempo
    if periodo == 'hoy':
        filtro_fecha = "DATE(ped.fecha_apertura) = CURRENT_DATE"
    elif periodo == 'ayer':
        filtro_fecha = "DATE(ped.fecha_apertura) = CURRENT_DATE - INTERVAL '1 day'"
    elif periodo == 'semana':
        filtro_fecha = "ped.fecha_apertura >= date_trunc('week', CURRENT_DATE)"
    elif periodo == 'año' or periodo == 'ano':
        filtro_fecha = "ped.fecha_apertura >= date_trunc('year', CURRENT_DATE)"
    else:
        filtro_fecha = "ped.fecha_apertura >= date_trunc('month', CURRENT_DATE)"

    # 2. SQL Mágico para sacar el Top de Platos (Ingresos y Cantidad)
    query = f"""
        SELECT 
            p.nombre,
            SUM(dp.cantidad) AS cantidad_vendida,
            COALESCE(SUM(dp.subtotal_calculado), SUM(dp.cantidad * p.precio_base)) AS ingresos_generados
        FROM detalle_pedido dp
        JOIN plato p ON dp.id_plato = p.id_plato
        JOIN pedido ped ON dp.id_pedido = ped.id_pedido
        WHERE {filtro_fecha} AND ped.estado_pago = 'PAGADO'
        GROUP BY p.id_plato, p.nombre
        ORDER BY ingresos_generados DESC
        LIMIT 10
    """
    
    try:
        cursor.execute(query)
        resultados = cursor.fetchall()
        
        # Separar los datos para enviarlos listos a los gráficos de React
        labels = [r['nombre'] for r in resultados]
        data_ingresos = [float(r['ingresos_generados']) for r in resultados]
        data_cantidad = [int(r['cantidad_vendida']) for r in resultados]
        
        return {
            "labels": labels,
            "ingresos": data_ingresos,
            "cantidades": data_cantidad
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/reportes/operacion")
def obtener_metricas_operacion(periodo: str = 'mes', db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    
    # Filtro de tiempo
    if periodo == 'hoy':
        filtro_fecha = "DATE(ped.fecha_apertura) = CURRENT_DATE"
    elif periodo == 'semana':
        filtro_fecha = "ped.fecha_apertura >= date_trunc('week', CURRENT_DATE)"
    else:
        filtro_fecha = "ped.fecha_apertura >= date_trunc('month', CURRENT_DATE)"

    # SQL para sacar Pedidos por Hora y Tiempo Promedio de Espera
    # Usamos EXTRACT(EPOCH) para convertir la diferencia de fechas a segundos y lo dividimos para 60 (minutos)
    query = f"""
        SELECT 
            EXTRACT(HOUR FROM ped.fecha_apertura) AS hora,
            COUNT(DISTINCT ped.id_pedido) AS total_pedidos,
            COALESCE(AVG(EXTRACT(EPOCH FROM (dp.fecha_entrega - dp.fecha_solicitud))/60), 0) AS tiempo_espera_min
        FROM pedido ped
        JOIN detalle_pedido dp ON ped.id_pedido = dp.id_pedido
        WHERE {filtro_fecha} AND ped.estado_pago = 'PAGADO'
        GROUP BY hora
        ORDER BY hora
    """
    
    try:
        cursor.execute(query)
        resultados = cursor.fetchall()
        
        labels = [f"{int(r['hora'])}h" for r in resultados]
        pedidos = [int(r['total_pedidos']) for r in resultados]
        tiempos = [round(float(r['tiempo_espera_min']), 1) for r in resultados]
        
        return {
            "labels": labels,
            "pedidos": pedidos,
            "tiempos": tiempos
        }
    except Exception as e:
        return {"error": str(e)}
@router.post("/reportes/generar-analisis-ia")
def generar_analisis_ia(datos: DatosAnalisis):
    analisis = generar_analisis_negocio(datos.kpis, datos.platos, datos.operacion)
    return {"analisis": analisis}