import { useState, useEffect } from 'react'
import './MonitorCocina.css'

function TemporizadorPedido({ fechaInicio, tiempoPrep }) {
  const [minutosRestantes, setMinutosRestantes] = useState('--')
  const [segundosRestantes, setSegundosRestantes] = useState('--')
  const [atrasado, setAtrasado] = useState(false)

  useEffect(() => {
    if (!fechaInicio) return;
    
    const calcularTiempo = () => {
      // 1. Obtenemos la hora actual de tu computadora
      const ahora = new Date();
      
      // 2. PARCHEO DE ZONA HORARIA: 
      // Reemplazamos cualquier "Z" (UTC) o "T" y forzamos a JS a interpretar la fecha
      // exactamente como viene de la base de datos (hora local), sin conversiones.
      // Así evitamos el salto de 5 horas.
      const fechaLimpia = fechaInicio.replace('T', ' ').replace('Z', '').split('.')[0];
      const inicio = new Date(fechaLimpia.replace(/-/g, '/')); 

      const tiempoMaximoMs = tiempoPrep * 60 * 1000;
      const tiempoTranscurridoMs = ahora - inicio;
      const restanteMs = tiempoMaximoMs - tiempoTranscurridoMs;

      if (restanteMs <= 0) {
        setAtrasado(true);
        const excesoMs = Math.abs(restanteMs);
        setMinutosRestantes(Math.floor(excesoMs / 60000));
        setSegundosRestantes(Math.floor((excesoMs % 60000) / 1000).toString().padStart(2, '0'));
      } else {
        setAtrasado(false);
        setMinutosRestantes(Math.floor(restanteMs / 60000));
        setSegundosRestantes(Math.floor((restanteMs % 60000) / 1000).toString().padStart(2, '0'));
      }
    }
    
    calcularTiempo();
    const intv = setInterval(calcularTiempo, 1000);
    return () => clearInterval(intv);
  }, [fechaInicio, tiempoPrep]);

  if (!fechaInicio) return null;
  
  return (
    <span style={{ color: atrasado ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
      {atrasado ? `🚨 +${minutosRestantes}:${segundosRestantes}` : `⏱️ ${minutosRestantes}:${segundosRestantes}`}
    </span>
  )
}
function MonitorCocina() {
  const [comandas, setComandas] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargarComandas = () => {
    fetch('http://127.0.0.1:8000/cocina/ordenes')
      .then(res => res.json())
      .then(datos => {
        const agrupadas = {}
        datos.ordenes.forEach(item => {
          if (!agrupadas[item.id_pedido]) {
            agrupadas[item.id_pedido] = {
              id_pedido: item.id_pedido,
              id_mesa: item.id_mesa,
              fecha_inicio_global: null,
              tiempo_max_prep: 0, // 🌟 CORRECCIÓN 1: Volvemos a usar el cuello de botella
              items: []
            }
          }
          
          // Buscamos el plato que más se demora (Ej: 18 mins)
          if (item.tiempo_prep_min > agrupadas[item.id_pedido].tiempo_max_prep) {
            agrupadas[item.id_pedido].tiempo_max_prep = item.tiempo_prep_min
          }
          
          if (item.fecha_inicio_preparacion) {
            agrupadas[item.id_pedido].fecha_inicio_global = item.fecha_inicio_preparacion
          }
          agrupadas[item.id_pedido].items.push(item)
        })

        setComandas(Object.values(agrupadas))
        setCargando(false)
      })
      .catch(() => setCargando(false))
  }

  useEffect(() => {
    cargarComandas()
    const intv = setInterval(cargarComandas, 4000)
    return () => clearInterval(intv)
  }, [])

  const manejarAceptarPedido = async (id_pedido) => {
    await fetch(`http://127.0.0.1:8000/cocina/pedido/preparar/${id_pedido}`, { method: 'POST' })
    cargarComandas()
  }

  const manejarRechazo = async (id_detalle) => {
    const confirmar = window.confirm("¿Seguro que deseas rechazar y eliminar este plato de la orden?")
    if (confirmar) {
      await fetch(`http://127.0.0.1:8000/cocina/rechazar/${id_detalle}`, { method: 'POST' })
      cargarComandas()
    }
  }

  const manejarAccionItem = async (id_detalle, accion) => {
    if (accion === 'LISTO') {
      await fetch(`http://127.0.0.1:8000/cocina/entregar/${id_detalle}`, { method: 'POST' })
    } else {
      alert(`Acción administrativa [${accion}] registrada para el ítem ${id_detalle}`)
    }
    cargarComandas()
  }

  const pedidosEnPreparacion = comandas.filter(c => c.items.some(i => i.estado_item === 'PREPARANDO')).length;
  // 2. ¿Podemos aceptar más? Solo si hay menos de 2.
  const cocinaSaturada = pedidosEnPreparacion >= 2;
  
  // 3. Seguimos forzando el orden FIFO para el siguiente turno disponible
  const primerPedidoPendiente = comandas.find(c => c.items.some(i => i.estado_item === 'SOLICITADO'));
  const idSiguienteTurno = primerPedidoPendiente ? primerPedidoPendiente.id_pedido : null;

  return (
    <div className="monitor-cocina">
      <header className="cocina-header">
        <h1>👨‍🍳 Monitor de Producción</h1>
      </header>

      {cargando ? (
        <p className="carga-texto">Sincronizando...</p>
      ) : comandas.length === 0 ? (
        <p className="vacio-texto">🎉 Cola vacía.</p>
      ) : (
        <div className="comandas-grid">
          {comandas.map((comanda) => {
            const tieneSolicitados = comanda.items.some(i => i.estado_item === 'SOLICITADO')
            // Verificamos si este pedido es el que toca atender obligatoriamente
            const esElTurno = comanda.id_pedido === idSiguienteTurno
            
            return (
              <div key={comanda.id_pedido} className="comanda-tarjeta">
                <div className="comanda-cabecera">
                  <div>
                    <span className="pedido-num">Pedido #{comanda.id_pedido}</span>
                    <span className="mesa-num"> 🪑 Paleta: {comanda.id_mesa}</span>
                  </div>
                  {!tieneSolicitados && (
                    <TemporizadorPedido fechaInicio={comanda.fecha_inicio_global} tiempoPrep={comanda.tiempo_max_prep} />
                  )}
                </div>

                {tieneSolicitados && (
                  <div style={{ padding: '10px' }}>
                    <button 
                      onClick={() => manejarAceptarPedido(comanda.id_pedido)} 
                      // Bloqueamos si no es su turno OR si la cocina ya tiene 2 pedidos adentro
                      disabled={!esElTurno || cocinaSaturada}
                      className="btn-accion aceptar" 
                      style={{ 
                        width: '100%', 
                        padding: '12px',
                        // Verde si está listo, Naranja si la cocina está llena, Gris si no es su turno
                        backgroundColor: esElTurno ? (cocinaSaturada ? '#d97706' : '#10b981') : '#4b5563', 
                        cursor: (!esElTurno || cocinaSaturada) ? 'not-allowed' : 'pointer',
                        opacity: (!esElTurno || cocinaSaturada) ? '0.5' : '1'
                      }}
                    >
                      {esElTurno 
                        ? (cocinaSaturada ? "⏳ Cocina Llena (Espera que salga un plato)" : "👨‍🍳 Iniciar Preparación") 
                        : "⏳ Esperando turno anterior..."}
                    </button>
                  </div>
                )}
                
                <div className="comanda-items">
                  {comanda.items.map((item) => (
                    <div key={item.id_detalle} className={`item-fila estado-${item.estado_item.toLowerCase()}`}>
                      <div className="item-info">
                        <span className="item-nombre"><strong>{item.cantidad}x</strong> {item.plato_nombre}</span>
                        {item.especificaciones_ia && <span className="item-notas">⚠️ {item.especificaciones_ia}</span>}
                      </div>

                      <div className="item-acciones">
                        {item.estado_item === 'SOLICITADO' && (
                          <button 
                            onClick={() => manejarRechazo(item.id_detalle)} 
                            className="btn-accion rechazar"
                            disabled={!esElTurno} 
                            style={{ 
                              opacity: esElTurno ? '1' : '0.5',
                              padding: '4px 8px', 
                              fontSize: '0.75rem', 
                              maxWidth: '90px', 
                              backgroundColor: '#991b1b',
                              marginLeft: 'auto' // Lo empuja a la derecha
                            }}
                          >
                            ⚠️ Problema
                          </button>
                        )}
                        
                        {item.estado_item === 'PREPARANDO' && (
                          <>
                            <button onClick={() => manejarAccionItem(item.id_detalle, 'LISTO')} className="btn-accion listo">
                              ✓ ¡Listo!
                            </button>
                            <button onClick={() => manejarAccionItem(item.id_detalle, 'DEMORADO')} className="btn-accion demorar" style={{flex: '0.5'}}>
                              Retraso
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MonitorCocina