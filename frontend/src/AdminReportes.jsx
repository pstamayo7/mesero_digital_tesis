import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip as ChartTooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import ReactMarkdown from 'react-markdown';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, ChartTooltip, Legend, Filler);

// 🌟 ANTI-UTC: formateamos fechas a "YYYY-MM-DD" leyendo año/mes/día LOCALES del objeto
// Date (getFullYear/getMonth/getDate), nunca con .toISOString() (esa convierte a UTC y
// puede mostrar el día anterior/siguiente según la zona horaria del navegador).
const formatearFechaLocal = (fecha) => {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
};

// El backend ya devuelve "YYYY-MM-DD" (DATE de PostgreSQL, sin hora). Lo mostramos
// recortando el string directamente, sin pasar por `new Date(...)` para no arriesgar
// el mismo desfase de zona horaria al renderizar.
const formatearFechaDisplay = (fechaISO) => {
  const [año, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}/${año}`;
};

export default function AdminReportes() {
  const [periodo, setPeriodo] = useState('mes');
  const [subPagina, setSubPagina] = useState('resumen');

  const [cargandoIA, setCargandoIA] = useState(false);
  const [analisisIA, setAnalisisIA] = useState(null);

  // ================= HISTORIAL DE VENTAS POR RANGO DE FECHAS =================
  const hoy = new Date();
  const primerDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [fechaInicio, setFechaInicio] = useState(formatearFechaLocal(primerDiaDelMes));
  const [fechaFin, setFechaFin] = useState(formatearFechaLocal(hoy));
  const [historial, setHistorial] = useState({ total_recaudado: 0, cantidad_pedidos: 0, ticket_promedio: 0, desglose_diario: [] });
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  // 🌟 ACORDEÓN DE 3 NIVELES: Día -> Órdenes -> Detalles.
  // Llaves: diasExpandidos[fecha] = bool, ordenesExpandidas[pedido_id] = bool.
  const [diasExpandidos, setDiasExpandidos] = useState({});
  const [ordenesExpandidas, setOrdenesExpandidas] = useState({});

  const alternarDia = (fecha) => {
    setDiasExpandidos(prev => ({ ...prev, [fecha]: !prev[fecha] }));
  };

  const alternarOrden = (pedidoId) => {
    setOrdenesExpandidas(prev => ({ ...prev, [pedidoId]: !prev[pedidoId] }));
  };

  const consultarHistorial = async () => {
    setCargandoHistorial(true);
    try {
      const res = await fetch(`http://localhost:8000/admin/reportes/ventas-periodo?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`);
      if (res.ok) {
        const datos = await res.json();
        setHistorial(datos);
        // Cerramos cualquier acordeón abierto de una consulta anterior
        setDiasExpandidos({});
        setOrdenesExpandidas({});
      }
    } catch (error) {
      console.error("Error cargando historial de ventas:", error);
    } finally {
      setCargandoHistorial(false);
    }
  };

  // Carga inicial con el rango por defecto (1er día del mes -> hoy)
  useEffect(() => { consultarHistorial(); }, []);

  // ================= ESTADOS PARA DATOS REALES (BACKEND) =================
  const [kpis, setKpis] = useState({ ingresos: 0, ordenes: 0, ticket: 0 });
  const [datosPlatos, setDatosPlatos] = useState({ labels: [], ingresos: [], cantidades: [] });
  const [datosOperacion, setDatosOperacion] = useState({ labels: [], pedidos: [], tiempos: [] });
  const [datosEvolucion, setDatosEvolucion] = useState({ labels: [], data: [] });
  const [datosHeatmap, setDatosHeatmap] = useState([]);

  // ================= UNIFICACIÓN Y CARGA DE DATOS DESDE LA DB =================
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const resKpis = await fetch(`http://localhost:8000/admin/reportes/kpis?periodo=${periodo}`);
        if (resKpis.ok) setKpis(await resKpis.json());

        const resPlatos = await fetch(`http://localhost:8000/admin/reportes/platos?periodo=${periodo}`);
        if (resPlatos.ok) setDatosPlatos(await resPlatos.json());

        const resOperacion = await fetch(`http://localhost:8000/admin/reportes/operacion?periodo=${periodo}`);
        if (resOperacion.ok) setDatosOperacion(await resOperacion.json());

        const resEvolucion = await fetch(`http://localhost:8000/admin/reportes/evolucion?periodo=${periodo}`);
        if (resEvolucion.ok) setDatosEvolucion(await resEvolucion.json());

        const resHeatmap = await fetch(`http://localhost:8000/admin/reportes/heatmap`);
        if (resHeatmap.ok) setDatosHeatmap(await resHeatmap.json());

      } catch (error) {
        console.error("Error al cargar los reportes:", error);
      }
    };
    cargarDatos();
  }, [periodo]);

  // ================= ESTILOS =================
  const theme = {
    card: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.02), 0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' },
    kpiCard: { flex: 1, minWidth: '200px', backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' },
    subNavItem: (activo) => ({ padding: '10px 20px', borderBottom: activo ? '3px solid #f59e0b' : '3px solid transparent', color: activo ? '#1e293b' : '#64748b', fontWeight: activo ? 'bold' : 'normal', cursor: 'pointer', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', fontSize: '15px' }),
    textoGris: { color: '#64748b', fontSize: '13px' },
    tituloCard: { margin: '0 0 15px 0', color: '#334155', fontSize: '16px', fontWeight: '600' }
  };

  // ================= UTILIDADES =================
  const formatearDinero = (valor) => `$${parseFloat(valor || 0).toFixed(2)}`;

  // ================= CONFIGURACIÓN DE GRÁFICOS REALES =================
  const miniLineOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, elements: { point: { radius: 0 } } };
  const getSparkline = (color, data) => ({ labels: ['1', '2', '3', '4', '5', '6', '7'], datasets: [{ data, borderColor: color, borderWidth: 2, tension: 0.4 }] });

  const topIngresosData = {
    labels: datosPlatos.labels.length > 0 ? datosPlatos.labels : ['Sin datos'],
    datasets: [{ data: datosPlatos.ingresos.length > 0 ? datosPlatos.ingresos : [0], backgroundColor: '#10b981', borderRadius: 4, barThickness: 20 }]
  };

  const topCantidadData = {
    labels: datosPlatos.labels.length > 0 ? datosPlatos.labels : ['Sin datos'],
    datasets: [{ data: datosPlatos.cantidades.length > 0 ? datosPlatos.cantidades : [0], backgroundColor: '#3b82f6', borderRadius: 4, barThickness: 20 }]
  };

  const barHorizontalOptions = { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { display: false } }, y: { grid: { display: false } } } };

  const operacionData = {
    labels: datosOperacion.labels.length > 0 ? datosOperacion.labels : ['Sin datos'],
    datasets: [
      { label: 'Tiempo Promedio (min)', data: datosOperacion.tiempos.length > 0 ? datosOperacion.tiempos : [0], borderColor: '#8b5cf6', backgroundColor: '#8b5cf6', tension: 0.4, borderWidth: 2 },
      { label: 'Meta 20 min', data: datosOperacion.labels.map(() => 20), borderColor: '#ef4444', borderDash: [5, 5], borderWidth: 1, pointRadius: 0 }
    ]
  };

  const evolucionData = {
    labels: datosEvolucion.labels.length > 0 ? datosEvolucion.labels : ['Sin datos'],
    datasets: [{
      label: 'Ingresos',
      data: datosEvolucion.data.length > 0 ? datosEvolucion.data : [0],
      borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 3
    }]
  };

  // ================= MAPA DE CALOR 100% DINÁMICO Y COMPLETO =================
  const generarHeatmap = () => {
    const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    // Rango operacional completo de un restaurante real (9 AM a 10 PM)
    const horas = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    const maxPedidos = datosHeatmap.length > 0 ? Math.max(...datosHeatmap.map(d => d.cantidad_pedidos)) : 1;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${horas.length}, 1fr)`, gap: '4px', fontSize: '12px', color: '#64748b' }}>
        <div></div>
        {horas.map(h => <div key={h} style={{ textAlign: 'center', fontWeight: '600' }}>{h}h</div>)}
        {dias.map((dia_nombre, indice_dia) => {
          const dia_db = indice_dia + 1; // En SQL, Lunes = 1, Domingo = 7

          return (
            <React.Fragment key={dia_nombre}>
              <div style={{ alignSelf: 'center', fontWeight: '500' }}>{dia_nombre}</div>
              {horas.map(hora => {
                // Math.floor soluciona el problema de los decimales devueltos por EXTRACT de PostgreSQL
                const registro = datosHeatmap.find(d => Math.floor(d.dia_semana) === dia_db && Math.floor(d.hora) === hora);
                const pedidos = registro ? registro.cantidad_pedidos : 0;

                const intensidad = pedidos / maxPedidos;
                const bgColor = pedidos > 0 ? `rgba(239, 68, 68, ${Math.max(intensidad, 0.2)})` : '#f8fafc';

                return (
                  <div key={`${dia_nombre}-${hora}`}
                    title={`${dia_nombre} a las ${hora}h: ${pedidos} pedidos reales`}
                    style={{ backgroundColor: bgColor, height: '28px', borderRadius: '4px', transition: '0.3s', border: pedidos > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #f1f5f9' }}>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const llamarIAReal = async () => {
    setCargandoIA(true);
    setAnalisisIA(null);
    try {
      const response = await fetch('http://localhost:8000/admin/reportes/generar-analisis-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kpis: kpis,
          platos: datosPlatos,
          operacion: datosOperacion,
          periodo: periodo
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAnalisisIA(data.analisis);
      } else {
        setAnalisisIA("⚠️ Hubo un error al comunicarse con el oráculo de IA.");
      }
    } catch (error) {
      console.error("Error al llamar a la IA:", error);
      setAnalisisIA("⚠️ El servidor de Inteligencia Artificial (Ollama) no responde. Asegúrate de que esté encendido.");
    } finally {
      setCargandoIA(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s', display: 'flex', flexDirection: 'column', gap: '20px', color: '#1e293b' }}>

      {/* HEADER Y FILTROS TEMPORALES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '15px 25px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '22px' }}>Análisis de Datos</h2>
          <span style={theme.textoGris}>Resumen del rendimiento (Conectado a la DB)</span>
        </div>
        <div style={{ display: 'flex', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {['Hoy', 'Ayer', 'Semana', 'Mes'].map(p => (
            <button key={p} onClick={() => setPeriodo(p.toLowerCase())} style={{ padding: '8px 16px', border: 'none', background: periodo === p.toLowerCase() ? '#f59e0b' : 'transparent', color: periodo === p.toLowerCase() ? 'white' : '#64748b', fontWeight: '600', cursor: 'pointer' }}>{p}</button>
          ))}
        </div>
      </div>

      {/* SUB-NAVEGACIÓN POR PÁGINAS */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0' }}>
        <button style={theme.subNavItem(subPagina === 'resumen')} onClick={() => setSubPagina('resumen')}>📊 Resumen Ejecutivo</button>
        <button style={theme.subNavItem(subPagina === 'menu')} onClick={() => setSubPagina('menu')}>🍔 Ventas y Menú</button>
        <button style={theme.subNavItem(subPagina === 'operacion')} onClick={() => setSubPagina('operacion')}>👨‍🍳 Operación y Cocina</button>
        <button style={theme.subNavItem(subPagina === 'historial')} onClick={() => setSubPagina('historial')}>📅 Historial de Ventas</button>
      </div>

      {/* TARJETAS DE KPIs (DATOS REALES) */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        <div style={theme.kpiCard}>
          <span style={theme.textoGris}>INGRESOS TOTALES ({periodo.toUpperCase()})</span>
          <h2 style={{ margin: '5px 0', fontSize: '28px', color: '#10b981' }}>{formatearDinero(kpis. ingresos)}</h2>
          <div style={{ height: '40px', marginTop: '10px' }}><Line data={getSparkline('#10b981', [10, 25, 20, 45, 30, 50, 60])} options={miniLineOptions} /></div>
        </div>
        <div style={theme.kpiCard}>
          <span style={theme.textoGris}>ÓRDENES TOTALES ({periodo.toUpperCase()})</span>
          <h2 style={{ margin: '5px 0', fontSize: '28px', color: '#3b82f6' }}>{kpis.ordenes}</h2>
          <div style={{ height: '40px', marginTop: '10px' }}><Line data={getSparkline('#3b82f6', [5, 10, 15, 12, 25, 20, 35])} options={miniLineOptions} /></div>
        </div>
        <div style={theme.kpiCard}>
          <span style={theme.textoGris}>TICKET PROMEDIO ({periodo.toUpperCase()})</span>
          <h2 style={{ margin: '5px 0', fontSize: '28px', color: '#8b5cf6' }}>{formatearDinero(kpis.ticket)}</h2>
          <div style={{ height: '40px', marginTop: '10px' }}><Line data={getSparkline('#8b5cf6', [10, 10.2, 10.5, 10.1, 10.6, 10.8, 10.7])} options={miniLineOptions} /></div>
        </div>
      </div>

      {/* ================= PÁGINA 1: RESUMEN EJECUTIVO ================= */}
      {subPagina === 'resumen' && (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ ...theme.card, flex: 2, minWidth: '400px' }}>
            <h3 style={theme.tituloCard}>¿Estamos ganando más o menos dinero? (Evolución de Ingresos)</h3>
            <div style={{ height: '300px' }}><Line data={evolucionData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } }} /></div>
          </div>

          <div style={{ ...theme.card, flex: 1, minWidth: '300px', backgroundColor: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <span style={{ fontSize: '24px' }}>🤖</span>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '16px' }}>ASESOR OPERATIVO IA</h3>
            </div>

            <button
              style={{
                width: '100%',
                background: cargandoIA ? '#6ee7b7' : '#10b981',
                color: 'white',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                cursor: cargandoIA ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                marginBottom: '20px'
              }}
              onClick={llamarIAReal}
              disabled={cargandoIA}
            >
              {cargandoIA ? 'Analizando datos reales...' : 'Generar Análisis Real'}
            </button>

            {analisisIA && (
              <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>🧠 Oráculo IA:</h4>
                <div style={{ margin: 0, color: '#4b5563', lineHeight: '1.6', fontSize: '14px' }}>
                  <ReactMarkdown>{analisisIA}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= PÁGINA 2: VENTAS Y MENÚ (REAL - LIMPIO) ================= */}
      {subPagina === 'menu' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ ...theme.card, flex: 1, minWidth: '300px' }}>
              <h3 style={theme.tituloCard}>¿Qué platos me dejan más dinero? (Ingresos Reales)</h3>
              <div style={{ height: '250px' }}><Bar data={topIngresosData} options={barHorizontalOptions} /></div>
            </div>
            <div style={{ ...theme.card, flex: 1, minWidth: '300px' }}>
              <h3 style={theme.tituloCard}>¿Qué platos se venden más? (Cantidad Real)</h3>
              <div style={{ height: '250px' }}><Bar data={topCantidadData} options={barHorizontalOptions} /></div>
            </div>
          </div>
        </div>
      )}

      {/* ================= PÁGINA 3: OPERACIÓN E INVENTARIO (REAL) ================= */}
      {subPagina === 'operacion' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ ...theme.card, flex: 1, minWidth: '350px' }}>
              <h3 style={theme.tituloCard}>Distribución de Carga y Horas Pico (Mapa de Calor Real)</h3>
              {generarHeatmap()}
            </div>
            <div style={{ ...theme.card, flex: 1, minWidth: '350px' }}>
              <h3 style={theme.tituloCard}>Tiempos Promedio de Preparación por Hora (Real)</h3>
              <div style={{ height: '230px' }}><Line data={operacionData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }} /></div>
            </div>
          </div>
        </div>
      )}

      {/* ================= PÁGINA 4: HISTORIAL DE VENTAS (DRILL-DOWN DE 3 NIVELES) ================= */}
      {subPagina === 'historial' && (
        <section style={{
          backgroundColor: '#f3f4f6', borderRadius: '12px', border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
          padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px'
        }}>

          {/* ENCABEZADO DE FILTROS, separado visualmente de los resultados */}
          <div style={{
            backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0',
            padding: '15px 20px', display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={theme.textoGris}>Fecha de Inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={theme.textoGris}>Fecha de Fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px' }}
              />
            </div>
            <button
              onClick={consultarHistorial}
              disabled={cargandoHistorial}
              style={{
                padding: '10px 24px', borderRadius: '6px', border: 'none',
                backgroundColor: cargandoHistorial ? '#fcd34d' : '#f59e0b', color: 'white',
                fontWeight: 'bold', cursor: cargandoHistorial ? 'not-allowed' : 'pointer', fontSize: '14px'
              }}
            >
              {cargandoHistorial ? 'Consultando...' : '🔎 Filtrar Historial'}
            </button>
          </div>

          {/* TARJETAS KPI DEL PERIODO FILTRADO */}
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div style={theme.kpiCard}>
              <span style={theme.textoGris}>💰 TOTAL FACTURADO</span>
              <h2 style={{ margin: '5px 0', fontSize: '28px', color: '#10b981' }}>{formatearDinero(historial.total_recaudado)}</h2>
            </div>
            <div style={theme.kpiCard}>
              <span style={theme.textoGris}>🧾 ÓRDENES TOTALES</span>
              <h2 style={{ margin: '5px 0', fontSize: '28px', color: '#3b82f6' }}>{historial.cantidad_pedidos} pedidos</h2>
            </div>
            <div style={theme.kpiCard}>
              <span style={theme.textoGris}>🎟️ TICKET PROMEDIO</span>
              <h2 style={{ margin: '5px 0', fontSize: '28px', color: '#8b5cf6' }}>{formatearDinero(historial.ticket_promedio)}</h2>
            </div>
          </div>

          {/* ACORDEÓN: NIVEL 1 (Día) -> NIVEL 2 (Órdenes) -> NIVEL 3 (Detalles) */}
          <div style={theme.card}>
            <h3 style={theme.tituloCard}>Desglose por Día (clic para ver las órdenes)</h3>

            {historial.desglose_diario.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0' }}>
                No hay ventas registradas en este rango de fechas.
              </p>
            ) : (
              historial.desglose_diario.map((dia) => {
                const diaAbierto = !!diasExpandidos[dia.fecha];
                return (
                  <div key={dia.fecha} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '10px', overflow: 'hidden' }}>

                    {/* NIVEL 1: DÍA */}
                    <div
                      onClick={() => alternarDia(dia.fecha)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 16px', backgroundColor: '#f8fafc', cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: diaAbierto ? 'rotate(90deg)' : 'rotate(0deg)', color: '#64748b' }}>▶</span>
                        <strong style={{ fontSize: '15px' }}>{formatearFechaDisplay(dia.fecha)}</strong>
                        <span style={{ color: '#64748b', fontSize: '13px' }}>({dia.pedidos_dia} pedidos)</span>
                      </div>
                      <strong style={{ color: '#10b981', fontSize: '16px' }}>{formatearDinero(dia.total_dia)}</strong>
                    </div>

                    {/* NIVEL 2: ÓRDENES DEL DÍA */}
                    {diaAbierto && (
                      <div style={{ backgroundColor: 'white', padding: '8px 16px' }}>
                        {dia.ordenes.map((orden) => {
                          const ordenAbierta = !!ordenesExpandidas[orden.pedido_id];
                          return (
                            <div key={orden.pedido_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <div
                                onClick={() => alternarOrden(orden.pedido_id)}
                                style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  padding: '10px 8px', cursor: 'pointer'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ display: 'inline-block', fontSize: '11px', transition: 'transform 0.2s', transform: ordenAbierta ? 'rotate(90deg)' : 'rotate(0deg)', color: '#94a3b8' }}>▶</span>
                                  <span style={{ fontWeight: '600' }}>Pedido #{orden.pedido_id}</span>
                                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>🕐 {orden.hora}</span>
                                </div>
                                <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>{formatearDinero(orden.total_orden)}</span>
                              </div>

                              {/* NIVEL 3: DETALLES DEL PEDIDO */}
                              {ordenAbierta && (
                                <div style={{ padding: '4px 8px 14px 32px', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '8px' }}>
                                  {orden.detalles.map((detalle, indice) => (
                                    <div key={indice} style={{ padding: '8px 0', borderBottom: indice < orden.detalles.length - 1 ? '1px dashed #e2e8f0' : 'none' }}>
                                      <span style={{ fontSize: '14px' }}><strong>{detalle.cantidad}x</strong> {detalle.plato}</span>
                                      {detalle.modificaciones.length > 0 && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                          {detalle.modificaciones.map((mod, i) => (
                                            <span
                                              key={i}
                                              style={{
                                                fontSize: '11px', fontStyle: 'italic', padding: '3px 9px', borderRadius: '10px',
                                                backgroundColor: mod.tipo === 'EXTRA' ? '#dcfce7' : '#fee2e2',
                                                color: mod.tipo === 'EXTRA' ? '#166534' : '#991b1b'
                                              }}
                                            >
                                              {mod.tipo === 'EXTRA' ? '+' : '−'} {mod.ingrediente}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </section>
      )}

    </div>
  );
}