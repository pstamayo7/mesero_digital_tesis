import { useState, useEffect, useRef } from 'react';

// Sub-componente: La Barra de Progreso con el tiempo restante
function BarraProgreso({ fechaInicio, tiempoTotalMin }) {
    const [porcentaje, setPorcentaje] = useState(0);
    const [textoTiempo, setTextoTiempo] = useState('--:--');
    const [atrasado, setAtrasado] = useState(false);

    useEffect(() => {
        if (!fechaInicio || !tiempoTotalMin) return;

        const actualizarBarra = () => {
            const ahora = new Date();
            // Parche de zona horaria seguro
            const fechaLimpia = fechaInicio.replace('T', ' ').replace('Z', '').split('.')[0];
            const inicio = new Date(fechaLimpia.replace(/-/g, '/'));

            const tiempoMaximoMs = tiempoTotalMin * 60 * 1000;
            const transcurridoMs = ahora - inicio;
            let restanteMs = tiempoMaximoMs - transcurridoMs;

            // Calcular Porcentaje (Tópalo en 100%)
            let porc = (transcurridoMs / tiempoMaximoMs) * 100;
            if (porc > 100) porc = 100;
            setPorcentaje(porc);

            // Calcular Texto
            if (restanteMs <= 0) {
                setAtrasado(true);
                const exceso = Math.abs(restanteMs);
                const min = Math.floor(exceso / 60000);
                const seg = Math.floor((exceso % 60000) / 1000).toString().padStart(2, '0');
                setTextoTiempo(`+${min}:${seg} (Demorado)`);
            } else {
                setAtrasado(false);
                const min = Math.floor(restanteMs / 60000);
                const seg = Math.floor((restanteMs % 60000) / 1000).toString().padStart(2, '0');
                setTextoTiempo(`${min}:${seg} min`);
            }
        };

        actualizarBarra();
        const intv = setInterval(actualizarBarra, 1000);
        return () => clearInterval(intv);
    }, [fechaInicio, tiempoTotalMin]);

    const colorBarra = atrasado ? '#ef4444' : (porcentaje > 80 ? '#f59e0b' : '#3b82f6');

    return (
        <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '8px', height: '28px', position: 'relative', overflow: 'hidden', marginTop: '10px' }}>
            {/* El relleno de color que avanza */}
            <div style={{ height: '100%', width: `${porcentaje}%`, backgroundColor: colorBarra, transition: 'width 1s linear' }} />
            {/* El texto centrado siempre visible encima de la barra */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: porcentaje > 50 ? 'white' : '#1f2937', fontWeight: 'bold', fontSize: '0.9rem', textShadow: porcentaje > 50 ? '1px 1px 2px rgba(0,0,0,0.5)' : 'none' }}>
                ⏳ {textoTiempo}
            </div>
        </div>
    );
}

// 🌟 TAREA 3: mismo parche de zona horaria que ya usan TemporizadorPedido/BarraProgreso,
// para poder comparar fecha_actualizacion_estado contra la hora local del navegador.
function parsearFechaLocal(fechaStr) {
    const fechaLimpia = fechaStr.replace('T', ' ').replace('Z', '').split('.')[0];
    return new Date(fechaLimpia.replace(/-/g, '/'));
}

const VENTANA_INCIDENTE_MS = 60 * 1000; // El aviso de incidente dura 60s en pantalla

// COMPONENTE PRINCIPAL DE LA PANTALLA
function PantallaTurnos() {
    const [turnos, setTurnos] = useState([]);
    const [itemsProblema, setItemsProblema] = useState([]);
    const [ahora, setAhora] = useState(Date.now());
    const pedidosListosAnteriores = useRef(new Set());

    const cargarTurnos = () => {
        fetch('http://127.0.0.1:8000/cliente/turnos')
            .then(res => res.json())
            .then(data => {
                const nuevosTurnos = data.turnos || [];

                // LÓGICA DE LA CAMPANITA 🔔
                const listosActuales = new Set(nuevosTurnos.filter(t => t.estado === 'LISTO').map(t => t.id_pedido));

                listosActuales.forEach(id => {
                    if (!pedidosListosAnteriores.current.has(id)) {
                        // ¡Nuevo pedido listo! Sonamos la campana
                        const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
                        audio.play().catch(e => console.log("Bloqueo de audio del navegador", e));
                    }
                });

                pedidosListosAnteriores.current = listosActuales;
                setTurnos(nuevosTurnos);
                setItemsProblema(data.items_problema || []);
            })
            .catch(err => console.error("Error obteniendo turnos", err));
    };

    useEffect(() => {
        cargarTurnos();
        const intv = setInterval(cargarTurnos, 3000); // Se actualiza cada 3 segundos
        return () => clearInterval(intv);
    }, []);

    // 🌟 TAREA 3: tick independiente del polling para que el incidente desaparezca de la
    // pantalla a los 60s exactos, sin necesidad de esperar a la siguiente respuesta del backend.
    useEffect(() => {
        const intv = setInterval(() => setAhora(Date.now()), 5000);
        return () => clearInterval(intv);
    }, []);

    const enCola = turnos.filter(t => t.estado === 'EN_COLA');
    const preparando = turnos.filter(t => t.estado === 'PREPARANDO');
    const listos = turnos.filter(t => t.estado === 'LISTO');

    // Solo los incidentes marcados hace menos de 60s; los demás se filtran y desaparecen.
    const itemsProblemaVigentes = itemsProblema.filter(item => {
        if (!item.fecha_actualizacion_estado) return false;
        const marcadoEn = parsearFechaLocal(item.fecha_actualizacion_estado).getTime();
        return (ahora - marcadoEn) <= VENTANA_INCIDENTE_MS;
    });

    // Estilos en línea para hacerlo ultra portátil
    const colStyle = { flex: 1, padding: '20px', borderRadius: '12px', minHeight: '80vh' };
    const cardStyle = { backgroundColor: 'white', padding: '15px', borderRadius: '8px', marginBottom: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center' };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f3f4f6', minHeight: '100vh' }}>
            <header style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h1 style={{ fontSize: '2.5rem', color: '#1f2937', margin: 0 }}>🥟 Estado de tu Pedido</h1>
            </header>

            <div style={{ display: 'flex', gap: '20px' }}>

                {/* COLUMNA 1: EN COLA */}
                <div style={{ ...colStyle, backgroundColor: '#e5e7eb' }}>
                    <h2 style={{ textAlign: 'center', color: '#4b5563' }}>⏳ En Cola</h2>
                    {enCola.map(t => (
                        <div key={t.id_pedido} style={{ ...cardStyle, borderLeft: '5px solid #9ca3af' }}>
                            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#374151' }}>Pedido #{t.id_pedido}</h3>
                            <p style={{ margin: '5px 0 0 0', color: '#6b7280', fontWeight: 'bold' }}>
                                {t.id_mesa === 0 ? `🛍️ Llevar: ${t.cliente_nombre}` : `🪑 Paleta: ${t.id_mesa}`}
                            </p>
                        </div>
                    ))}
                    {enCola.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af' }}>No hay pedidos en cola</p>}
                </div>

                {/* COLUMNA 2: PREPARANDO (Con Barra de Progreso) */}
                <div style={{ ...colStyle, backgroundColor: '#dbeafe' }}>
                    <h2 style={{ textAlign: 'center', color: '#1d4ed8' }}>👨‍🍳 Preparando</h2>
                    {preparando.map(t => (
                        <div key={t.id_pedido} style={{ ...cardStyle, borderLeft: '5px solid #3b82f6' }}>
                            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#1e3a8a' }}>Pedido #{t.id_pedido}</h3>
                            {/* Para la columna "En Cola" y "Preparando" */}
                            <p style={{ margin: '5px 0 0 0', color: '#6b7280', fontWeight: 'bold' }}>
                                {t.id_mesa === 0 ? `🛍️ Llevar: ${t.cliente_nombre}` : `🪑 Paleta: ${t.id_mesa}`}
                            </p>

                            {/* Insertamos el componente de progreso aquí */}
                            {t.tiempo_asignado > 0 && (
                                <BarraProgreso fechaInicio={t.fecha_inicio} tiempoTotalMin={t.tiempo_asignado} />
                            )}
                        </div>
                    ))}
                    {preparando.length === 0 && <p style={{ textAlign: 'center', color: '#93c5fd' }}>Cocina disponible</p>}
                </div>

                {/* COLUMNA 3: LISTOS */}
                <div style={{ ...colStyle, backgroundColor: '#d1fae5' }}>
                    <h2 style={{ textAlign: 'center', color: '#047857' }}>🎉 ¡Listo para Retirar!</h2>
                    {listos.map(t => (
                        <div key={t.id_pedido} style={{ ...cardStyle, backgroundColor: '#10b981', color: 'white' }}>
                            <h3 style={{ margin: 0, fontSize: '2rem' }}>Pedido #{t.id_pedido}</h3>
                            {/* Para la columna "¡Listo para Retirar!" */}
                            <p style={{ margin: '5px 0 0 0', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                {t.id_mesa === 0 ? `🛍️ Para: ${t.cliente_nombre}` : `🪑 Paleta: ${t.id_mesa}`}
                            </p>
                        </div>
                    ))}

                    {/* 🌟 TAREA 3: incidentes (SUSPENDIDO/CANCELADO) en diseño rojo de alerta,
                        visibles solo durante 60s desde que el cocinero los reportó */}
                    {itemsProblemaVigentes.map(item => (
                        <div key={`problema-${item.id_detalle}`} style={{ ...cardStyle, backgroundColor: '#fee2e2', border: '2px solid #ef4444', color: '#991b1b' }}>
                            <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{item.cantidad}x {item.plato_nombre}</h3>
                            <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>
                                {item.id_mesa === 0 ? `🛍️ Para: ${item.cliente_nombre}` : `🪑 Paleta: ${item.id_mesa}`}
                            </p>
                            <p style={{ margin: '10px 0 0 0', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                {item.estado_item === 'CANCELADO' ? '❌ Cancelado' : '⚠️ Problema con el pedido'}
                            </p>
                            <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem' }}>Por favor acércate a caja</p>
                        </div>
                    ))}

                    {listos.length === 0 && itemsProblemaVigentes.length === 0 && (
                        <p style={{ textAlign: 'center', color: '#6ee7b7' }}>Esperando platos listos...</p>
                    )}
                </div>

            </div>
        </div>
    );
}

export default PantallaTurnos;