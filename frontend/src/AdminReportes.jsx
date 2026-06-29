import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip as ChartTooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import ReactMarkdown from 'react-markdown';
import { apiFetch } from './utils/apiFetch';
import './OpsTheme.css';
import {
  BarChart3, Brain, Calendar, ChefHat, Clock, CreditCard,
  Receipt, Sparkles, Ticket, UtensilsCrossed, Wallet
} from 'lucide-react';

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

// Lunes de la semana que contiene `fecha` (si `fecha` es domingo, retrocede 6 días).
const calcularLunesDeEstaSemana = (fecha) => {
  const diaSemana = fecha.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
  const diferencia = diaSemana === 0 ? 6 : diaSemana - 1;
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() - diferencia);
  return lunes;
};

export default function AdminReportes() {
  const [subPagina, setSubPagina] = useState('resumen');

  const [cargandoIA, setCargandoIA] = useState(false);
  const [analisisIA, setAnalisisIA] = useState(null);

  // ================= 🌟 CONTROLADOR UNIVERSAL DE FECHAS =================
  // Una sola fuente de verdad (fechaInicio/fechaFin) que alimenta TODOS los endpoints:
  // KPIs, gráficos de platos/operación/evolución, mapa de calor y la tabla de acordeón.
  const hoy = new Date();
  const primerDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [filtroActivo, setFiltroActivo] = useState('MES'); // 'HOY' | 'SEMANA' | 'MES' | 'PERSONALIZADO'
  const [fechaInicio, setFechaInicio] = useState(formatearFechaLocal(primerDiaDelMes));
  const [fechaFin, setFechaFin] = useState(formatearFechaLocal(hoy));

  const aplicarFiltroRapido = (tipo) => {
    setFiltroActivo(tipo);
    if (tipo === 'PERSONALIZADO') return; // conserva las fechas actuales; el usuario las edita a mano
    const ahora = new Date();
    if (tipo === 'HOY') {
      const hoyStr = formatearFechaLocal(ahora);
      setFechaInicio(hoyStr);
      setFechaFin(hoyStr);
    } else if (tipo === 'SEMANA') {
      setFechaInicio(formatearFechaLocal(calcularLunesDeEstaSemana(ahora)));
      setFechaFin(formatearFechaLocal(ahora));
    } else if (tipo === 'MES') {
      setFechaInicio(formatearFechaLocal(new Date(ahora.getFullYear(), ahora.getMonth(), 1)));
      setFechaFin(formatearFechaLocal(ahora));
    }
  };

  // ================= HISTORIAL DE VENTAS (Tarjetas KPI únicas + Acordeón) =================
  const [historial, setHistorial] = useState({ total_recaudado: 0, cantidad_pedidos: 0, ticket_promedio: 0, desglose_diario: [] });

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

  // ================= ESTADOS PARA DATOS REALES (BACKEND) =================
  const [datosPlatos, setDatosPlatos] = useState({ labels: [], ingresos: [], cantidades: [] });
  const [datosOperacion, setDatosOperacion] = useState({ labels: [], pedidos: [], tiempos: [] });
  const [datosEvolucion, setDatosEvolucion] = useState({ labels: [], data: [] });
  const [datosHeatmap, setDatosHeatmap] = useState([]);

  // ================= CARGA ÚNICA: TODOS los endpoints reaccionan al mismo rango =================
  useEffect(() => {
    const qs = `fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;

    const cargarDatos = async () => {
      try {
        const resVentas = await apiFetch(`/admin/reportes/ventas-periodo?${qs}`);
        if (resVentas.ok) {
          setHistorial(await resVentas.json());
          // Cerramos cualquier acordeón abierto de una consulta anterior
          setDiasExpandidos({});
          setOrdenesExpandidas({});
        }

        const resPlatos = await apiFetch(`/admin/reportes/platos?${qs}`);
        if (resPlatos.ok) setDatosPlatos(await resPlatos.json());

        const resOperacion = await apiFetch(`/admin/reportes/operacion?${qs}`);
        if (resOperacion.ok) setDatosOperacion(await resOperacion.json());

        const resEvolucion = await apiFetch(`/admin/reportes/evolucion?${qs}`);
        if (resEvolucion.ok) setDatosEvolucion(await resEvolucion.json());

        const resHeatmap = await apiFetch(`/admin/reportes/heatmap?${qs}`);
        if (resHeatmap.ok) setDatosHeatmap(await resHeatmap.json());

      } catch (error) {
        console.error("Error al cargar los reportes:", error);
      }
    };
    cargarDatos();
  }, [fechaInicio, fechaFin]);

  // ================= ESTILOS (sistema "Operaciones") =================
  const theme = {
    card: { backgroundColor: 'var(--ops-surface)', borderRadius: 'var(--ops-radius)', padding: '24px', boxShadow: 'var(--ops-shadow-sm)', border: '1px solid var(--ops-border)' },
    kpiCard: { flex: 1, minWidth: '200px', backgroundColor: 'var(--ops-surface)', borderRadius: 'var(--ops-radius)', padding: '20px', boxShadow: 'var(--ops-shadow-sm)', border: '1px solid var(--ops-border)', display: 'flex', flexDirection: 'column' },
    subNavItem: (activo) => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderBottom: activo ? '3px solid var(--ops-accent)' : '3px solid transparent', color: activo ? 'var(--ops-ink)' : 'var(--ops-ink-soft)', fontWeight: activo ? 600 : 500, cursor: 'pointer', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', fontSize: '14.5px', fontFamily: 'var(--ops-font-body)' }),
    textoGris: { color: 'var(--ops-ink-soft)', fontSize: '13px' },
    tituloCard: { margin: '0 0 15px 0', color: 'var(--ops-ink)', fontSize: '16px', fontWeight: '600', fontFamily: 'var(--ops-font-display)' }
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
      <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${horas.length}, 1fr)`, gap: '4px', fontSize: '12px', color: 'var(--ops-ink-soft)' }}>
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
                const bgColor = pedidos > 0 ? `rgba(161, 61, 52, ${Math.max(intensidad, 0.2)})` : 'var(--ops-surface-alt)';

                return (
                  <div key={`${dia_nombre}-${hora}`}
                    title={`${dia_nombre} a las ${hora}h: ${pedidos} pedidos reales`}
                    style={{ backgroundColor: bgColor, height: '28px', borderRadius: '4px', transition: '0.3s', border: pedidos > 0 ? '1px solid rgba(161, 61, 52, 0.4)' : '1px solid var(--ops-border)' }}>
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
      const response = await apiFetch('/admin/reportes/generar-analisis-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kpis: { ingresos: historial.total_recaudado, ordenes: historial.cantidad_pedidos, ticket: historial.ticket_promedio },
          platos: datosPlatos,
          operacion: datosOperacion,
          periodo: `${formatearFechaDisplay(fechaInicio)} - ${formatearFechaDisplay(fechaFin)}`,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAnalisisIA(data.analisis);
      } else {
        setAnalisisIA("Hubo un error al comunicarse con el oráculo de IA.");
      }
    } catch (error) {
      console.error("Error al llamar a la IA:", error);
      setAnalisisIA("El servidor de Inteligencia Artificial (Ollama) no responde. Asegúrate de que esté encendido.");
    } finally {
      setCargandoIA(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s', display: 'flex', flexDirection: 'column', gap: '20px', color: 'var(--ops-ink)', fontFamily: 'var(--ops-font-body)' }}>

      {/* 🌟 CONTROLADOR UNIVERSAL DE FECHAS: rige TODO el dashboard de abajo */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px',
        backgroundColor: 'var(--ops-surface)', padding: '15px 25px', borderRadius: 'var(--ops-radius)', border: '1px solid var(--ops-border)'
      }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', fontFamily: 'var(--ops-font-display)', fontSize: '22px', color: 'var(--ops-ink)' }}>Análisis de Datos</h2>
          <span style={theme.textoGris}>
            Periodo: {formatearFechaDisplay(fechaInicio)} → {formatearFechaDisplay(fechaFin)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--ops-surface-alt)', borderRadius: 'var(--ops-radius-sm)', border: '1px solid var(--ops-border)', overflow: 'hidden' }}>
            {[['HOY', 'Hoy'], ['SEMANA', 'Esta Semana'], ['MES', 'Este Mes'], ['PERSONALIZADO', 'Personalizado']].map(([clave, etiqueta]) => (
              <button
                key={clave}
                onClick={() => aplicarFiltroRapido(clave)}
                style={{
                  padding: '8px 16px', border: 'none',
                  background: filtroActivo === clave ? 'var(--ops-accent)' : 'transparent',
                  color: filtroActivo === clave ? 'var(--ops-accent-contrast)' : 'var(--ops-ink-soft)',
                  fontWeight: '600', cursor: 'pointer', fontSize: '14px'
                }}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {filtroActivo === 'PERSONALIZADO' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 'var(--ops-radius-sm)', border: '1px solid var(--ops-border)', fontSize: '13px' }}
              />
              <span style={{ color: 'var(--ops-ink-soft)' }}>→</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 'var(--ops-radius-sm)', border: '1px solid var(--ops-border)', fontSize: '13px' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* SUB-NAVEGACIÓN POR PÁGINAS */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--ops-border)', paddingBottom: '0' }}>
        <button style={theme.subNavItem(subPagina === 'resumen')} onClick={() => setSubPagina('resumen')}><BarChart3 size={15} /> Resumen Ejecutivo</button>
        <button style={theme.subNavItem(subPagina === 'menu')} onClick={() => setSubPagina('menu')}><UtensilsCrossed size={15} /> Ventas y Menú</button>
        <button style={theme.subNavItem(subPagina === 'operacion')} onClick={() => setSubPagina('operacion')}><ChefHat size={15} /> Operación y Cocina</button>
        <button style={theme.subNavItem(subPagina === 'historial')} onClick={() => setSubPagina('historial')}><Calendar size={15} /> Historial de Ventas</button>
      </div>

      {/* 🌟 ÚNICO set de Tarjetas KPI (antes había dos: una fija a "MES" y otra del
          filtro de la tabla). Ambas leían/escribían cosas distintas; ahora las dos
          se alimentan del mismo /reportes/ventas-periodo y del mismo rango maestro. */}
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        <div style={theme.kpiCard}>
          <span style={{...theme.textoGris, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.3px'}}><Wallet size={14} /> Total facturado</span>
          <h2 style={{ margin: '5px 0', fontSize: '28px', color: 'var(--ops-success)' }}>{formatearDinero(historial.total_recaudado)}</h2>
          <div style={{ height: '40px', marginTop: '10px' }}><Line data={getSparkline('#3c6e52', [10, 25, 20, 45, 30, 50, 60])} options={miniLineOptions} /></div>
        </div>
        <div style={theme.kpiCard}>
          <span style={{...theme.textoGris, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.3px'}}><Receipt size={14} /> Órdenes totales</span>
          <h2 style={{ margin: '5px 0', fontSize: '28px', color: '#3b6ea5' }}>{historial.cantidad_pedidos} pedidos</h2>
          <div style={{ height: '40px', marginTop: '10px' }}><Line data={getSparkline('#3b6ea5', [5, 10, 15, 12, 25, 20, 35])} options={miniLineOptions} /></div>
        </div>
        <div style={theme.kpiCard}>
          <span style={{...theme.textoGris, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.3px'}}><Ticket size={14} /> Ticket promedio</span>
          <h2 style={{ margin: '5px 0', fontSize: '28px', color: 'var(--ops-accent-dark)' }}>{formatearDinero(historial.ticket_promedio)}</h2>
          <div style={{ height: '40px', marginTop: '10px' }}><Line data={getSparkline('#9c7a3c', [10, 10.2, 10.5, 10.1, 10.6, 10.8, 10.7])} options={miniLineOptions} /></div>
        </div>
      </div>

      {/* ================= PÁGINA 1: RESUMEN EJECUTIVO ================= */}
      {subPagina === 'resumen' && (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ ...theme.card, flex: 2, minWidth: '400px' }}>
            <h3 style={theme.tituloCard}>¿Estamos ganando más o menos dinero? (Evolución de Ingresos)</h3>
            <div style={{ height: '300px' }}><Line data={evolucionData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'var(--ops-border)' } }, x: { grid: { display: false } } } }} /></div>
          </div>

          <div style={{ ...theme.card, flex: 1, minWidth: '300px', backgroundColor: 'var(--ops-surface-alt)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Sparkles size={19} color="var(--ops-accent)" />
              <h3 style={{ margin: 0, fontFamily: 'var(--ops-font-display)', color: 'var(--ops-ink)', fontSize: '16px' }}>Asesor Operativo IA</h3>
            </div>

            <button
              style={{
                width: '100%',
                background: cargandoIA ? 'var(--ops-accent-soft)' : 'var(--ops-accent)',
                color: cargandoIA ? 'var(--ops-accent-dark)' : 'var(--ops-accent-contrast)',
                border: 'none',
                padding: '10px',
                borderRadius: 'var(--ops-radius-sm)',
                cursor: cargandoIA ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                marginBottom: '20px'
              }}
              onClick={llamarIAReal}
              disabled={cargandoIA}
            >
              {cargandoIA ? 'Analizando datos reales...' : 'Generar análisis real'}
            </button>

            {analisisIA && (
              <div style={{ background: 'var(--ops-surface)', border: '1px solid var(--ops-border)', padding: '15px', borderRadius: 'var(--ops-radius-sm)', marginTop: '10px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 10px 0', fontFamily: 'var(--ops-font-display)', color: 'var(--ops-ink)' }}><Brain size={15} /> Oráculo IA</h4>
                <div style={{ margin: 0, color: 'var(--ops-ink-soft)', lineHeight: '1.6', fontSize: '14px' }}>
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
          backgroundColor: 'var(--ops-surface-alt)', borderRadius: 'var(--ops-radius)', border: '1px solid var(--ops-border)',
          boxShadow: 'var(--ops-shadow-sm)',
          padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px'
        }}>

          {/* 🌟 Las fechas y las tarjetas KPI ya viven en el controlador maestro de arriba
              (rigen todo el dashboard, no solo esta pestaña). Aquí solo queda el acordeón. */}

          {/* ACORDEÓN: NIVEL 1 (Día) -> NIVEL 2 (Órdenes) -> NIVEL 3 (Detalles) */}
          <div style={theme.card}>
            <h3 style={theme.tituloCard}>Desglose por día (clic para ver las órdenes)</h3>

            {historial.desglose_diario.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--ops-ink-soft)', padding: '20px 0' }}>
                No hay ventas registradas en este rango de fechas.
              </p>
            ) : (
              historial.desglose_diario.map((dia) => {
                const diaAbierto = !!diasExpandidos[dia.fecha];
                return (
                  <div key={dia.fecha} style={{ border: '1px solid var(--ops-border)', borderRadius: 'var(--ops-radius-sm)', marginBottom: '10px', overflow: 'hidden' }}>

                    {/* NIVEL 1: DÍA */}
                    <div
                      onClick={() => alternarDia(dia.fecha)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 16px', backgroundColor: 'var(--ops-surface-alt)', cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: diaAbierto ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--ops-ink-soft)' }}>▶</span>
                        <strong style={{ fontSize: '15px' }}>{formatearFechaDisplay(dia.fecha)}</strong>
                        <span style={{ color: 'var(--ops-ink-soft)', fontSize: '13px' }}>({dia.pedidos_dia} pedidos)</span>
                      </div>
                      <strong style={{ color: 'var(--ops-success)', fontSize: '16px' }}>{formatearDinero(dia.total_dia)}</strong>
                    </div>

                    {/* NIVEL 2: ÓRDENES DEL DÍA */}
                    {diaAbierto && (
                      <div style={{ backgroundColor: 'var(--ops-surface)', padding: '8px 16px' }}>
                        {dia.ordenes.map((orden) => {
                          const ordenAbierta = !!ordenesExpandidas[orden.pedido_id];
                          return (
                            <div key={orden.pedido_id} style={{ borderBottom: '1px solid var(--ops-border)' }}>
                              <div
                                onClick={() => alternarOrden(orden.pedido_id)}
                                style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  padding: '10px 8px', cursor: 'pointer'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ display: 'inline-block', fontSize: '11px', transition: 'transform 0.2s', transform: ordenAbierta ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--ops-ink-soft)' }}>▶</span>
                                  <span style={{ fontWeight: '600' }}>Pedido #{orden.pedido_id}</span>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ops-ink-soft)', fontSize: '13px' }}><Clock size={12} /> {orden.hora}</span>
                                </div>
                                <span style={{ fontWeight: 'bold', color: 'var(--ops-accent-dark)' }}>{formatearDinero(orden.total_orden)}</span>
                              </div>

                              {/* NIVEL 3: DETALLES DEL PEDIDO */}
                              {ordenAbierta && (
                                <div style={{ padding: '4px 8px 14px 32px', backgroundColor: 'var(--ops-surface-alt)', borderRadius: 'var(--ops-radius-sm)', marginBottom: '8px' }}>
                                  {orden.detalles.map((detalle, indice) => (
                                    <div key={indice} style={{ padding: '8px 0', borderBottom: indice < orden.detalles.length - 1 ? '1px dashed var(--ops-border)' : 'none' }}>
                                      <span style={{ fontSize: '14px' }}><strong>{detalle.cantidad}x</strong> {detalle.plato}</span>
                                      {detalle.modificaciones.length > 0 && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                          {detalle.modificaciones.map((mod, i) => (
                                            <span
                                              key={i}
                                              style={{
                                                fontSize: '11px', fontStyle: 'italic', padding: '3px 9px', borderRadius: '10px',
                                                backgroundColor: mod.tipo === 'EXTRA' ? 'var(--ops-success-soft)' : 'var(--ops-danger-soft)',
                                                color: mod.tipo === 'EXTRA' ? 'var(--ops-success)' : 'var(--ops-danger)'
                                              }}
                                            >
                                              {mod.tipo === 'EXTRA' ? '+' : '−'} {mod.ingrediente}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: '10px', fontSize: '12px', color: 'var(--ops-ink-soft)' }}>
                                    <CreditCard size={12} /> Cobrado por: <strong>{orden.cajero || 'Sin registrar'}</strong>
                                  </div>
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