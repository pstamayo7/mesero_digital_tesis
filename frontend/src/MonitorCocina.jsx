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

  // 🌟 REPORTAR PROBLEMA: { id_detalle, id_plato } del ítem reportado (null = modal cerrado)
  const [itemReportando, setItemReportando] = useState(null)
  const [tipoProblema, setTipoProblema] = useState('ERROR_HUMANO')
  const [ingredienteAgotado, setIngredienteAgotado] = useState('')
  const [ingredientesDelPlato, setIngredientesDelPlato] = useState([])
  const [cargandoIngredientes, setCargandoIngredientes] = useState(false)

  // 🌟 TAREA 1: solo cargamos la receta del plato que se está reportando (no la bodega
  // completa). Misma ruta que ya usa el modal de edición táctil del Kiosko.
  useEffect(() => {
    if (!itemReportando) {
      setIngredientesDelPlato([])
      return
    }
    setCargandoIngredientes(true)
    fetch(`http://127.0.0.1:8000/menu/${itemReportando.id_plato}/ingredientes`)
      .then(res => res.json())
      .then(data => setIngredientesDelPlato(data.ingredientes_base || []))
      .catch(err => console.error("Error cargando receta del plato:", err))
      .finally(() => setCargandoIngredientes(false))
  }, [itemReportando])

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
              cliente_nombre: item.cliente_nombre, // 🌟 GUARDAMOS EL NOMBRE AQUÍ
              fecha_inicio_global: null,
              tiempo_max_asignado: 0,
              solo_bebidas: true,
              items: []
            }
          }

          // Si el backend dice que es comida, cambiamos la etiqueta
          if (item.requiere_coccion === true) {
            agrupadas[item.id_pedido].solo_bebidas = false;
          }

          // 🌟 MAGIA PURA: Leemos el tiempo exacto que la base de datos selló. No sumamos nada.
          const tiempoDB = parseInt(item.tiempo_asignado_cocina) || 0;
          if (tiempoDB > agrupadas[item.id_pedido].tiempo_max_asignado) {
            agrupadas[item.id_pedido].tiempo_max_asignado = tiempoDB;
          }

          if (item.fecha_inicio_preparacion && !agrupadas[item.id_pedido].fecha_inicio_global) {
            agrupadas[item.id_pedido].fecha_inicio_global = item.fecha_inicio_preparacion;
          }

          agrupadas[item.id_pedido].items.push(item)
        })

        setComandas(Object.values(agrupadas).sort((a, b) => a.id_pedido - b.id_pedido))
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
    try {
      if (accion === 'LISTO') {
        // Hacemos la petición al backend
        const respuesta = await fetch(`http://127.0.0.1:8000/cocina/entregar/${id_detalle}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        // Verificamos si el backend arrojó un error (Ej: Error 500)
        if (!respuesta.ok) {
          const errorDatos = await respuesta.json();
          alert(`❌ Error del servidor: ${errorDatos.detail || 'Fallo desconocido'}`);
          return; // Cortamos la ejecución para no recargar datos falsos
        }
      } else {
        alert(`Acción administrativa [${accion}] registrada para el ítem ${id_detalle}`);
      }

      // Forzamos la actualización inmediata de la pantalla
      cargarComandas();

    } catch (error) {
      // Capturamos si el backend está apagado o hay un problema de CORS
      console.error("Error de conexión:", error);
      alert("❌ No se pudo conectar con el servidor. Revisa si FastAPI está encendido.");
    }
  }

  const abrirModalProblema = (id_detalle, id_plato) => {
    setItemReportando({ id_detalle, id_plato })
    setTipoProblema('ERROR_HUMANO')
    setIngredienteAgotado('')
  }

  const confirmarProblema = async () => {
    try {
      const payload = {
        item_pedido_id: itemReportando.id_detalle,
        tipo_problema: tipoProblema,
        ingrediente_agotado: tipoProblema === 'FALTA_STOCK' ? ingredienteAgotado : null
      }

      const respuesta = await fetch('http://127.0.0.1:8000/cocina/problema-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!respuesta.ok) {
        const errorDatos = await respuesta.json()
        alert(`❌ Error del servidor: ${errorDatos.detail || 'Fallo desconocido'}`)
        return
      }

      // 🌟 TAREA 1/2: Actualizamos la tarjeta localmente (sin esperar al próximo polling
      // de 4s), reflejando el MISMO mapeo de estado que aplica el backend: CLIENTE_CANCELO
      // -> CANCELADO, los demás -> SUSPENDIDO. El render más abajo separa ambos estados en
      // la sección de "Incidentes" para que no estorben la vista activa de preparación.
      const nuevoEstado = tipoProblema === 'CLIENTE_CANCELO' ? 'CANCELADO' : 'SUSPENDIDO'
      setComandas(prev => prev.map(comanda => ({
        ...comanda,
        items: comanda.items.map(item =>
          item.id_detalle === itemReportando.id_detalle ? { ...item, estado_item: nuevoEstado } : item
        )
      })))

      setItemReportando(null)
    } catch (error) {
      console.error("Error reportando problema:", error)
      alert("❌ No se pudo conectar con el servidor.")
    }
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

            // 🌟 TAREA 1/2: separamos los ítems con incidente (SUSPENDIDO o CANCELADO por el
            // cocinero) para que no estorben la cola activa. El backend de /cocina/ordenes ya
            // los excluye en el siguiente poll; esto solo cubre la ventana optimista local.
            const itemsActivos = comanda.items.filter(i => i.estado_item !== 'SUSPENDIDO' && i.estado_item !== 'CANCELADO')
            const itemsProblema = comanda.items.filter(i => i.estado_item === 'SUSPENDIDO' || i.estado_item === 'CANCELADO')

            return (
              <div key={comanda.id_pedido} className={`comanda-tarjeta ${esElTurno ? 'comanda-tarjeta--turno' : ''}`}>
                <div className="comanda-cabecera">
                  <div className="comanda-cabecera-fila">
                    <span className="pedido-titulo">Pedido #{comanda.id_pedido}</span>
                    <span className="mesa-titulo">
                      {comanda.id_mesa === 0 ? `🛍️ Llevar: ${comanda.cliente_nombre}` : `🪑 Paleta: ${comanda.id_mesa}`}
                    </span>
                  </div>
                  {comanda.fecha_inicio_global && (
                    <div className="comanda-cabecera-estado">
                      {comanda.solo_bebidas ? (
                        <span className="badge-bebidas">🥤 Despacho Inmediato</span>
                      ) : (
                        <TemporizadorPedido fechaInicio={comanda.fecha_inicio_global} tiempoPrep={comanda.tiempo_max_asignado} />
                      )}
                    </div>
                  )}
                </div>

                <div className="comanda-items">
                  {itemsActivos.map((item) => (
                    <div key={item.id_detalle} className={`item-fila estado-${item.estado_item.toLowerCase()}`}>
                      <div className="item-info">
                        <span className="item-nombre">
                          <strong>{item.cantidad}x</strong> {item.plato_nombre}
                        </span>
                        {item.especificaciones_ia && <span className="item-notas">⚠️ {item.especificaciones_ia}</span>}
                      </div>

                      <div className="item-acciones">
                        {item.estado_item === 'SOLICITADO' && (
                          <button
                            onClick={() => manejarRechazo(item.id_detalle)}
                            className="btn-accion rechazar"
                            disabled={!esElTurno}
                          >
                            ⚠️ Problema
                          </button>
                        )}

                        {item.estado_item === 'PREPARANDO' && (
                          <>
                            <button onClick={() => manejarAccionItem(item.id_detalle, 'LISTO')} className="btn-accion listo">
                              ✓ ¡Listo!
                            </button>
                            <button
                              onClick={() => abrirModalProblema(item.id_detalle, item.id_plato)}
                              className="btn-accion demorar"
                            >
                              ⚠️ Reportar Problema
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 🌟 TAREA 1/2: sección separada de incidentes, fuera de la vista activa */}
                {itemsProblema.length > 0 && (
                  <div className="comanda-incidentes">
                    <span className="incidentes-titulo">🚫 Incidentes</span>
                    {itemsProblema.map((item) => (
                      <div key={item.id_detalle} className="item-fila item-fila--incidente">
                        <div className="item-info">
                          <span className="item-nombre item-nombre--cancelado">
                            <strong>{item.cantidad}x</strong> {item.plato_nombre}
                          </span>
                        </div>
                        <span className="badge-incidente">{item.estado_item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {itemReportando !== null && (
        <div className="modal-sobrecapa" onClick={() => setItemReportando(null)}>
          <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
            <h2>🚨 Reportar Problema</h2>
            <p>¿Cuál es el problema con este plato?</p>

            <div className="modal-opciones">
              <label className={`modal-opcion ${tipoProblema === 'ERROR_HUMANO' ? 'modal-opcion--activa' : ''}`}>
                <input
                  type="radio"
                  name="tipoProblema"
                  checked={tipoProblema === 'ERROR_HUMANO'}
                  onChange={() => setTipoProblema('ERROR_HUMANO')}
                />
                Accidente / Error en cocina
              </label>
              <label className={`modal-opcion ${tipoProblema === 'FALTA_STOCK' ? 'modal-opcion--activa' : ''}`}>
                <input
                  type="radio"
                  name="tipoProblema"
                  checked={tipoProblema === 'FALTA_STOCK'}
                  onChange={() => setTipoProblema('FALTA_STOCK')}
                />
                Falta de Stock
              </label>
              <label className={`modal-opcion ${tipoProblema === 'CLIENTE_CANCELO' ? 'modal-opcion--activa' : ''}`}>
                <input
                  type="radio"
                  name="tipoProblema"
                  checked={tipoProblema === 'CLIENTE_CANCELO'}
                  onChange={() => setTipoProblema('CLIENTE_CANCELO')}
                />
                Cliente canceló el pedido
              </label>
            </div>

            {tipoProblema === 'FALTA_STOCK' && (
              <div className="modal-campo-extra">
                <label>¿Qué ingrediente se agotó?</label>
                {cargandoIngredientes ? (
                  <p className="texto-ayuda">Cargando receta del plato...</p>
                ) : ingredientesDelPlato.length === 0 ? (
                  <p className="texto-ayuda">Este plato no tiene ingredientes base configurados.</p>
                ) : (
                  <select
                    value={ingredienteAgotado}
                    onChange={(e) => setIngredienteAgotado(e.target.value)}
                    className="modal-select"
                  >
                    <option value="">-- Selecciona un ingrediente --</option>
                    {ingredientesDelPlato.map(ingrediente => (
                      <option key={ingrediente} value={ingrediente}>{ingrediente}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="modal-botones">
              <button onClick={() => setItemReportando(null)} className="btn-modal cancelar">
                Cancelar
              </button>
              <button
                onClick={confirmarProblema}
                disabled={tipoProblema === 'FALTA_STOCK' && !ingredienteAgotado}
                className="btn-modal confirmar"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MonitorCocina