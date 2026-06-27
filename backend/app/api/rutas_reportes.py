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
    periodo: str = "este periodo"

@router.get("/reportes/kpis")
def obtener_kpis(fecha_inicio: str, fecha_fin: str, db=Depends(get_db)):
    """
    🌟 CONTROLADOR UNIVERSAL DE FECHAS: ya no recibe 'periodo' (hoy/semana/mes), recibe el
    rango exacto que decide el front (botones rápidos o fechas personalizadas), igual que
    /reportes/platos, /reportes/operacion, /reportes/evolucion, /reportes/heatmap y
    /reportes/ventas-periodo. Mismo patrón anti-UTC: comparamos contra strings "YYYY-MM-DD".
    """
    cursor = db.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT
            COALESCE(SUM(total_final), 0) AS ingresos,
            COUNT(id_pedido) AS ordenes
        FROM pedido
        WHERE DATE(fecha_apertura) BETWEEN %s AND %s AND estado_pago = 'PAGADO'
    """

    try:
        cursor.execute(query, (fecha_inicio, fecha_fin))
        datos = cursor.fetchone()

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
def obtener_rendimiento_platos(fecha_inicio: str, fecha_fin: str, db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)

    # 🌟 Mismo rango de fechas que el resto del dashboard (ver nota en /reportes/kpis)
    query = """
        SELECT
            p.nombre,
            SUM(dp.cantidad) AS cantidad_vendida,
            COALESCE(SUM(dp.subtotal_calculado), SUM(dp.cantidad * p.precio_base)) AS ingresos_generados
        FROM detalle_pedido dp
        JOIN plato p ON dp.id_plato = p.id_plato
        JOIN pedido ped ON dp.id_pedido = ped.id_pedido
        WHERE DATE(ped.fecha_apertura) BETWEEN %s AND %s AND ped.estado_pago = 'PAGADO'
        GROUP BY p.id_plato, p.nombre
        ORDER BY ingresos_generados DESC
        LIMIT 10
    """

    try:
        cursor.execute(query, (fecha_inicio, fecha_fin))
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
def obtener_metricas_operacion(fecha_inicio: str, fecha_fin: str, db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)

    # SQL para sacar Pedidos por Hora y Tiempo Promedio de Espera
    # Usamos EXTRACT(EPOCH) para convertir la diferencia de fechas a segundos y lo dividimos para 60 (minutos)
    query = """
        SELECT
            EXTRACT(HOUR FROM ped.fecha_apertura) AS hora,
            COUNT(DISTINCT ped.id_pedido) AS total_pedidos,
            COALESCE(AVG(EXTRACT(EPOCH FROM (dp.fecha_entrega - dp.fecha_solicitud))/60), 0) AS tiempo_espera_min
        FROM pedido ped
        JOIN detalle_pedido dp ON ped.id_pedido = dp.id_pedido
        WHERE DATE(ped.fecha_apertura) BETWEEN %s AND %s AND ped.estado_pago = 'PAGADO'
        GROUP BY hora
        ORDER BY hora
    """

    try:
        cursor.execute(query, (fecha_inicio, fecha_fin))
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
    # Asegúrate de importar generar_analisis_negocio arriba: 
    # from app.services.ia_service import generar_analisis_negocio
    
    analisis = generar_analisis_negocio(
        kpis=datos.kpis, 
        platos=datos.platos, 
        operacion=datos.operacion,
        periodo=datos.periodo
    )
    return {"analisis": analisis}

@router.get("/reportes/evolucion")
def obtener_evolucion_ventas(fecha_inicio: str, fecha_fin: str, db=Depends(get_db)):
    """
    🌟 Simplificado para el controlador universal: en vez de cambiar la granularidad
    (hora/día de semana/día de mes) según un 'periodo' predefinido, siempre agrupamos por
    día calendario. Funciona igual de bien para "Hoy" (1 punto), "Esta Semana" (~7 puntos)
    o un rango personalizado de varios meses (un punto por día con ventas).
    """
    cursor = db.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT
            DATE(fecha_apertura) AS dia,
            COALESCE(SUM(total_final), 0) AS ingresos
        FROM pedido
        WHERE DATE(fecha_apertura) BETWEEN %s AND %s AND estado_pago = 'PAGADO'
        GROUP BY DATE(fecha_apertura)
        ORDER BY DATE(fecha_apertura) ASC
    """

    try:
        cursor.execute(query, (fecha_inicio, fecha_fin))
        resultados = cursor.fetchall()

        labels = [r['dia'].strftime('%d/%m') for r in resultados]
        data = [float(r['ingresos']) for r in resultados]

        return {"labels": labels, "data": data}
    except Exception as e:
        return {"error": str(e)}

def _parsear_modificaciones(especificaciones_ia):
    """
    🛡️ La tabla relacional 'modificacion_item' existe en el esquema pero está vacía:
    n8n nunca la pobló. Lo que SÍ se persiste por cada ítem confirmado es el string plano
    en Detalle_Pedido.especificaciones_ia (ej. "EXTRA Mote, SIN Cebolla"), con el mismo
    formato "TIPO Ingrediente" que ya genera ia_service.py. Lo parseamos de vuelta a
    objetos estructurados para cumplir el contrato JSON pedido por el frontend.
    """
    if not especificaciones_ia or especificaciones_ia.strip() in ("", "empty", "[]"):
        return []
    modificaciones = []
    for parte in especificaciones_ia.split(","):
        parte = parte.strip()
        if not parte:
            continue
        trozos = parte.split(" ", 1)
        if len(trozos) == 2:
            tipo, ingrediente = trozos
            modificaciones.append({"tipo": tipo.strip().upper(), "ingrediente": ingrediente.strip()})
    return modificaciones

@router.get("/reportes/ventas-periodo")
def obtener_ventas_periodo(fecha_inicio: str, fecha_fin: str, db=Depends(get_db)):
    """
    Historial de ventas con drill-down de 3 niveles: Día -> Órdenes -> Detalles del pedido.

    🌟 ANTI-UTC: 'fecha_inicio'/'fecha_fin' llegan como strings "YYYY-MM-DD" tal cual
    los entrega un <input type="date">. NUNCA se construye un objeto Date ni se convierte
    con .toISOString() (eso desplaza el día según la zona horaria del navegador); se
    comparan como strings directamente contra DATE(fecha_apertura) en PostgreSQL, que es
    una columna 'timestamp without time zone' (hora local de Doña Zita, sin conversión).

    Nota: 'ENTREGADO' es un estado de ÍTEM (Detalle_Pedido), no existe a nivel de Pedido.
    El cierre de caja real se marca con Pedido.estado_pago = 'PAGADO' (ver /caja/cobrar).

    🌟 Igual que /caja/pendientes (ver rutas_caja.py), excluimos ítems 'SUSPENDIDO' y
    'CANCELADO' del total: un incidente de cocina reportado DESPUÉS del pago no debe
    seguir contando como ingreso en el histórico.
    """
    cursor = db.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT
            pe.id_pedido,
            pe.fecha_apertura,
            dp.cantidad,
            dp.especificaciones_ia,
            p.nombre AS plato_nombre,
            COALESCE(dp.subtotal_calculado, 0) AS subtotal_calculado,
            p.precio_base
        FROM Pedido pe
        JOIN Detalle_Pedido dp ON dp.id_pedido = pe.id_pedido
        JOIN Plato p ON dp.id_plato = p.id_plato
        WHERE pe.estado_pago = 'PAGADO'
          AND DATE(pe.fecha_apertura) BETWEEN %s AND %s
          AND dp.estado_item NOT IN ('CANCELADO', 'SUSPENDIDO')
        ORDER BY pe.fecha_apertura DESC;
    """

    try:
        cursor.execute(query, (fecha_inicio, fecha_fin))
        filas = cursor.fetchall()

        dias = {}
        for fila in filas:
            fecha_str = fila["fecha_apertura"].date().isoformat()
            hora_str = fila["fecha_apertura"].time().isoformat(timespec="seconds")

            subtotal_calculado = float(fila["subtotal_calculado"])
            subtotal_item = subtotal_calculado if subtotal_calculado > 0 else float(fila["precio_base"]) * fila["cantidad"]

            dia = dias.setdefault(fecha_str, {
                "fecha": fecha_str, "total_dia": 0.0, "pedidos_dia": 0,
                "_pedidos_vistos": set(), "ordenes": {}
            })

            orden = dia["ordenes"].setdefault(fila["id_pedido"], {
                "pedido_id": fila["id_pedido"], "hora": hora_str, "total_orden": 0.0, "detalles": []
            })

            orden["detalles"].append({
                "plato": fila["plato_nombre"],
                "cantidad": fila["cantidad"],
                "modificaciones": _parsear_modificaciones(fila["especificaciones_ia"])
            })
            orden["total_orden"] += subtotal_item

            if fila["id_pedido"] not in dia["_pedidos_vistos"]:
                dia["_pedidos_vistos"].add(fila["id_pedido"])
                dia["pedidos_dia"] += 1
            dia["total_dia"] += subtotal_item

        # El ORDER BY ya entrega las filas más recientes primero; al insertar en los dicts
        # en ese mismo orden, días y órdenes quedan naturalmente ordenados de forma DESC.
        desglose_diario = []
        for dia in dias.values():
            dia["ordenes"] = list(dia["ordenes"].values())
            dia.pop("_pedidos_vistos")
            dia["total_dia"] = round(dia["total_dia"], 2)
            for orden in dia["ordenes"]:
                orden["total_orden"] = round(orden["total_orden"], 2)
            desglose_diario.append(dia)

        total_recaudado = round(sum(d["total_dia"] for d in desglose_diario), 2)
        cantidad_pedidos = sum(d["pedidos_dia"] for d in desglose_diario)
        ticket_promedio = round(total_recaudado / cantidad_pedidos, 2) if cantidad_pedidos > 0 else 0.0

        return {
            "total_recaudado": total_recaudado,
            "cantidad_pedidos": cantidad_pedidos,
            "ticket_promedio": ticket_promedio,
            "desglose_diario": desglose_diario
        }
    except Exception as e:
        return {"error": str(e)}

@router.get("/reportes/heatmap")
def obtener_heatmap_operacion(fecha_inicio: str, fecha_fin: str, db=Depends(get_db)):
    """🌟 Antes analizaba un rango fijo de 30 días (hardcodeado, ignoraba cualquier filtro
    del dashboard). Ahora respeta el mismo rango que el resto de /reportes/*."""
    cursor = db.cursor(cursor_factory=RealDictCursor)

    query = """
        SELECT
            EXTRACT(ISODOW FROM fecha_apertura) AS dia_semana,
            EXTRACT(HOUR FROM fecha_apertura) AS hora,
            COUNT(id_pedido) AS cantidad_pedidos
        FROM pedido
        WHERE DATE(fecha_apertura) BETWEEN %s AND %s
        GROUP BY dia_semana, hora
    """

    try:
        cursor.execute(query, (fecha_inicio, fecha_fin))
        resultados = cursor.fetchall()

        # Devolveremos los datos crudos, el frontend se encargará de pintarlos
        return resultados
    except Exception as e:
        return {"error": str(e)}