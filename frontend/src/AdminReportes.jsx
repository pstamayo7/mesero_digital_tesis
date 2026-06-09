import React, { useState, useEffect } from 'react';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip as ChartTooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import ReactMarkdown from 'react-markdown';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, ChartTooltip, Legend, Filler);

export default function AdminReportes() {
    const [periodo, setPeriodo] = useState('mes');
    const [subPagina, setSubPagina] = useState('resumen');

    const [cargandoIA, setCargandoIA] = useState(false);
    const [analisisIA, setAnalisisIA] = useState(null);

    // ================= ESTADOS PARA DATOS REALES (BACKEND) =================
    const [kpis, setKpis] = useState({ ingresos: 0, ordenes: 0, ticket: 0 });
    const [datosPlatos, setDatosPlatos] = useState({ labels: [], ingresos: [], cantidades: [] });
    const [datosOperacion, setDatosOperacion] = useState({ labels: [], pedidos: [], tiempos: [] });

    const [datosEvolucion, setDatosEvolucion] = useState({ labels: [], data: [] });
    const [datosHeatmap, setDatosHeatmap] = useState([]);

    // ================= LLAMADA AL BACKEND =================
    useEffect(() => {
        const cargarDatos = async () => {
            try {
                // 1. Cargar KPIs
                const resKpis = await fetch(`http://localhost:8000/admin/reportes/kpis?periodo=${periodo}`);
                if (resKpis.ok) setKpis(await resKpis.json());

                // 2. Cargar Platos más vendidos
                const resPlatos = await fetch(`http://localhost:8000/admin/reportes/platos?periodo=${periodo}`);
                if (resPlatos.ok) setDatosPlatos(await resPlatos.json());

                // 3. Cargar Tiempos de Operación (Cocina)
                const resOperacion = await fetch(`http://localhost:8000/admin/reportes/operacion?periodo=${periodo}`);
                if (resOperacion.ok) setDatosOperacion(await resOperacion.json());

            } catch (error) {
                console.error("Error al cargar los reportes:", error);
            }
        };

        cargarDatos();
    }, [periodo]); // Se vuelve a ejecutar cada vez que cambia "periodo"


    // ================= LLAMADA AL BACKEND =================
    useEffect(() => {
        const cargarDatos = async () => {
            try {
                const resKpis = await fetch(`http://localhost:8000/admin/reportes/kpis?periodo=${periodo}`);
                if (resKpis.ok) setKpis(await resKpis.json());

                const resPlatos = await fetch(`http://localhost:8000/admin/reportes/platos?periodo=${periodo}`);
                if (resPlatos.ok) setDatosPlatos(await resPlatos.json());

                const resOperacion = await fetch(`http://localhost:8000/admin/reportes/operacion?periodo=${periodo}`);
                if (resOperacion.ok) setDatosOperacion(await resOperacion.json());

                // 👇 NUEVAS RUTAS AÑADIDAS 👇
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
        textoVerde: { color: '#10b981', fontWeight: 'bold', fontSize: '14px' },
        textoGris: { color: '#64748b', fontSize: '13px' },
        tituloCard: { margin: '0 0 15px 0', color: '#334155', fontSize: '16px', fontWeight: '600' }
    };

    // ================= UTILIDADES =================
    const formatearDinero = (valor) => `$${parseFloat(valor || 0).toFixed(2)}`;

    // ================= CONFIGURACIÓN DE GRÁFICOS (Ahora con datos reales) =================
    const miniLineOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, elements: { point: { radius: 0 } } };
    const getSparkline = (color, data) => ({ labels: ['1', '2', '3', '4', '5', '6', '7'], datasets: [{ data, borderColor: color, borderWidth: 2, tension: 0.4 }] });

    // Gráficos de Platos (Real)
    const topIngresosData = {
        labels: datosPlatos.labels.length > 0 ? datosPlatos.labels : ['Sin datos'],
        datasets: [{ data: datosPlatos.ingresos.length > 0 ? datosPlatos.ingresos : [0], backgroundColor: '#10b981', borderRadius: 4, barThickness: 20 }]
    };

    const topCantidadData = {
        labels: datosPlatos.labels.length > 0 ? datosPlatos.labels : ['Sin datos'],
        datasets: [{ data: datosPlatos.cantidades.length > 0 ? datosPlatos.cantidades : [0], backgroundColor: '#3b82f6', borderRadius: 4, barThickness: 20 }]
    };

    const barHorizontalOptions = { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { display: false } }, y: { grid: { display: false } } } };

    // Gráfico de Operación (Real)
    const operacionData = {
        labels: datosOperacion.labels.length > 0 ? datosOperacion.labels : ['Sin datos'],
        datasets: [
            { label: 'Tiempo Promedio (min)', data: datosOperacion.tiempos.length > 0 ? datosOperacion.tiempos : [0], borderColor: '#8b5cf6', backgroundColor: '#8b5cf6', tension: 0.4, borderWidth: 2 },
            { label: 'Meta 20 min', data: datosOperacion.labels.map(() => 20), borderColor: '#ef4444', borderDash: [5, 5], borderWidth: 1, pointRadius: 0 }
        ]
    };

    // Gráficos Estáticos (Simulados por ahora, ya que requieren consultas más específicas de fechas y combos)
    const evolucionData = {
        labels: datosEvolucion.labels.length > 0 ? datosEvolucion.labels : ['Sin datos'],
        datasets: [{
            label: 'Ingresos',
            data: datosEvolucion.data.length > 0 ? datosEvolucion.data : [0],
            borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 3
        }]
    };
    const pagosData = { labels: ['Efectivo', 'Tarjeta', 'Transferencia'], datasets: [{ data: [45, 35, 20], backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'], borderWidth: 0, cutout: '70%' }] };

    // Generador de Mapa de Calor Estático (Visual)
    const generarHeatmap = () => {
        const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        const horas = [11, 12, 13, 14, 15, 16, 19, 20];
        const maxPedidos = datosHeatmap.length > 0 ? Math.max(...datosHeatmap.map(d => d.cantidad_pedidos)) : 1;

        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(8, 1fr)', gap: '4px', fontSize: '12px', color: '#64748b' }}>
                <div></div>{horas.map(h => <div key={h} style={{ textAlign: 'center' }}>{h}h</div>)}
                {dias.map((dia_nombre, indice_dia) => {
                    const dia_db = indice_dia + 1; // En SQL, Lunes = 1, Domingo = 7

                    return (
                        <React.Fragment key={dia_nombre}>
                            <div style={{ alignSelf: 'center', fontWeight: '500' }}>{dia_nombre}</div>
                            {horas.map(hora => {
                                // Buscamos si en la base de datos hay pedidos para este día y hora
                                const registro = datosHeatmap.find(d => d.dia_semana === dia_db && d.hora === hora);
                                const pedidos = registro ? registro.cantidad_pedidos : 0;

                                // Calculamos qué tan rojo se pone (0 a 1)
                                const intensidad = pedidos / maxPedidos;
                                const bgColor = pedidos > 0 ? `rgba(239, 68, 68, ${Math.max(intensidad, 0.15)})` : '#f8fafc'; // Gris si no hay pedidos

                                return (
                                    <div key={`${dia_nombre}-${hora}`}
                                        title={`${dia_nombre} a las ${hora}h: ${pedidos} pedidos`}
                                        style={{ backgroundColor: bgColor, height: '25px', borderRadius: '4px', transition: '0.3s' }}>
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
    setAnalisisIA(null); // Limpiamos el análisis anterior

    try {
      const response = await fetch('http://localhost:8000/admin/reportes/generar-analisis-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kpis: kpis,
          platos: datosPlatos,
          operacion: datosOperacion,
          periodo: periodo // Enviamos si es 'hoy', 'semana' o 'mes'
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
    const getEstiloIconoHallazgo = (tipo) => {
        const estilos = {
            verde: { bg: '#dcfce7', color: '#16a34a' },
            naranja: { bg: '#ffedd5', color: '#ea580c' },
            rojo: { bg: '#fee2e2', color: '#dc2626' },
            azul: { bg: '#dbeafe', color: '#2563eb' }
        };
        return estilos[tipo] || estilos.azul;
    };

    // Función auxiliar para los colores de las recomendaciones
    const getEstiloTarjetaRecomendacion = (tipo) => {
        const estilos = {
            verde: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' },
            morado: { bg: '#faf5ff', border: '#e9d5ff', color: '#6b21a8' },
            naranja: { bg: '#fff7ed', border: '#fed7aa', color: '#9a3412' }
        };
        return estilos[tipo] || estilos.verde;
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
            </div>

            {/* TARJETAS DE KPIs (DATOS REALES) */}
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={theme.kpiCard}>
                    <span style={theme.textoGris}>INGRESOS TOTALES ({periodo.toUpperCase()})</span>
                    <h2 style={{ margin: '5px 0', fontSize: '28px', color: '#10b981' }}>{formatearDinero(kpis.ingresos)}</h2>
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
                        <h3 style={theme.tituloCard}>¿Estamos ganando más o menos dinero?</h3>
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
                            onClick={llamarIAReal} // 👈 CORRECCIÓN 1: Tu función se llama llamarIAReal, no generarAnalisisReal
                            disabled={cargandoIA}
                        >
                            {cargandoIA ? 'Analizando datos reales...' : 'Generar Análisis Real'}
                        </button>

                        {/* 👈 CORRECCIÓN 2: Tu estado se llama analisisIA, no consejoIA */}
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

            {/* ================= PÁGINA 2: VENTAS Y MENÚ (REAL) ================= */}
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

                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ ...theme.card, flex: 1, minWidth: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <h3 style={{ ...theme.tituloCard, alignSelf: 'flex-start' }}>Métodos de Pago (Simulado)</h3>
                            <div style={{ height: '180px', width: '100%', maxWidth: '200px' }}><Doughnut data={pagosData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } } } }} /></div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= PÁGINA 3: OPERACIÓN E INVENTARIO (REAL) ================= */}
            {subPagina === 'operacion' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ ...theme.card, flex: 1, minWidth: '350px' }}>
                            <h3 style={theme.tituloCard}>¿Cuándo se llena más? </h3>
                            {generarHeatmap()}
                        </div>
                        <div style={{ ...theme.card, flex: 1, minWidth: '350px' }}>
                            <h3 style={theme.tituloCard}>Tiempos Promedio de Preparación por Hora (Real)</h3>
                            <div style={{ height: '230px' }}><Line data={operacionData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }} /></div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}