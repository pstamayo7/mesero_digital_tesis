import { useState, useEffect } from 'react';
import { Archive, Armchair, Banknote, CheckCircle2, Receipt, ShoppingBag } from 'lucide-react';
import { apiFetch } from './utils/apiFetch';
import './OpsTheme.css';

function Caja() {
    const [cuentas, setCuentas] = useState([]);
    const [cargando, setCargando] = useState(true);

   const cargarCuentas = () => {

        // 🌟 TRUCO: Date.now() obliga al navegador a pedir datos frescos siempre
    apiFetch('/caja/pendientes?t=' + Date.now())
      .then(res => res.json())
            .then(datos => {
                // 🌟 EL ESPÍA: Imprime en consola lo que manda Python
                console.log("Datos de Python:", datos);
                setCuentas(datos.cuentas || []);
                setCargando(false);
            })
            .catch(err => {
                console.error("Error cargando caja:", err);
                setCargando(false);
            });
    };

    // Cargamos al inicio y actualizamos cada 10 segundos
    useEffect(() => {
        cargarCuentas();
        const intv = setInterval(cargarCuentas, 10000);
        return () => clearInterval(intv);
    }, []);

    const manejarCobro = async (id_pedido, id_mesa, total) => {
        // 🌟 Mismo endpoint para cobrar o archivar: en ambos casos hay que cerrar el
        // pedido y liberar la mesa en el backend. Solo cambia el mensaje de confirmación.
        const pedidoAnulado = total <= 0;
        const mensajeConfirmacion = pedidoAnulado
            ? `Este pedido quedó en $0.00 (ítems cancelados/suspendidos). ¿Archivar el Pedido #${id_pedido} y liberar la mesa?`
            : `¿Confirmas el pago de $${total} por el Pedido #${id_pedido}?`;
        const confirmar = window.confirm(mensajeConfirmacion);

        if (confirmar) {
            try {
                const respuesta = await apiFetch(`/caja/cobrar/${id_pedido}`, {
                    method: 'POST'
                });

                if (respuesta.ok) {
                    const mensajeExito = pedidoAnulado ? 'Orden archivada.' : 'Pago registrado.';
                    alert(`${mensajeExito} ${id_mesa > 0 ? `La Paleta ${id_mesa} ha sido liberada.` : 'Pedido para llevar entregado.'}`);
                    cargarCuentas(); // Recargamos la lista para que desaparezca
                } else {
                    alert("Hubo un error al procesar el cobro.");
                }
            } catch (error) {
                alert("Error de conexión con el servidor.");
            }
        }
    };

    return (
    <div className="ops-page" style={{ padding: '32px 36px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div className="ops-brand">
          <img src="/logo.png" alt="Doña Zita" />
          <div className="ops-brand-text">
            <strong style={{ fontSize: '1.3rem' }}>Doña Zita</strong>
            <small>Caja y Facturación</small>
          </div>
        </div>
        <span style={{ fontSize: '0.85rem', color: 'var(--ops-ink-soft)' }}>
          {cuentas.length} {cuentas.length === 1 ? 'cuenta pendiente' : 'cuentas pendientes'}
        </span>
      </header>

      {cargando ? (
        <p style={{ color: 'var(--ops-ink-soft)' }}>Cargando cuentas pendientes...</p>
      ) : cuentas.length === 0 ? (
        <div className="ops-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <CheckCircle2 size={30} color="var(--ops-success)" style={{ marginBottom: 10 }} />
          <h2 style={{ margin: 0, fontFamily: 'var(--ops-font-display)', fontSize: '1.2rem', color: 'var(--ops-ink)' }}>
            No hay cuentas por cobrar en este momento.
          </h2>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {cuentas.map(cuenta => {
            const esParaLlevar = cuenta.id_mesa === 0;

            // 🌟 BLINDAJE: Si Postgres mandó el JSON como texto, lo convertimos a lista real
            let detallesArray = [];
            try {
              detallesArray = typeof cuenta.detalles === 'string' ? JSON.parse(cuenta.detalles) : (cuenta.detalles || []);
            } catch (e) {
              console.error("Error parseando detalle", e);
            }

            // 🌟 ESTADO "ANULADO": si todos los ítems del pedido fueron suspendidos o
            // cancelados en cocina, /caja/pendientes ya recalcula total_final en 0. Acá
            // solo decidimos cómo se ve la tarjeta para que el cajero no confunda esto
            // con un cobro real.
            const totalNumerico = parseFloat(cuenta.total_final) || 0;
            const pedidoAnulado = totalNumerico <= 0;

            return (
              <div key={cuenta.id_pedido} className="ops-card" style={{ padding: '22px', borderTop: '3px solid var(--ops-accent)' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontFamily: 'var(--ops-font-display)', fontSize: '1.1rem', color: 'var(--ops-ink)' }}>
                    Pedido #{cuenta.id_pedido}
                  </h3>
                  <span className="ops-badge" style={{ background: 'var(--ops-accent-soft)', color: 'var(--ops-accent-dark)' }}>
                    {esParaLlevar ? <ShoppingBag size={13} /> : <Armchair size={13} />}
                    {esParaLlevar ? 'Llevar' : `Paleta ${cuenta.id_mesa}`}
                  </span>
                </div>

                <p style={{ margin: '5px 0', fontSize: '0.95rem', color: 'var(--ops-ink)' }}>
                  <strong>Cliente:</strong> {cuenta.cliente_nombre}
                </p>
                <p style={{ margin: '5px 0 18px 0', fontSize: '0.95rem', color: 'var(--ops-ink)' }}>
                  <strong>Apertura:</strong> {new Date(cuenta.fecha_apertura).toLocaleTimeString()}
                </p>

                {detallesArray.length > 0 && (
                  <div style={{ backgroundColor: 'var(--ops-surface-alt)', padding: '15px', borderRadius: 'var(--ops-radius-sm)', marginBottom: '15px', border: '1px solid var(--ops-border)' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '0 0 10px 0', color: 'var(--ops-ink-soft)', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', borderBottom: '1px solid var(--ops-border)', paddingBottom: '8px' }}>
                      <Receipt size={14} /> Detalle de consumo
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.92rem' }}>
                      {detallesArray.map((item, index) => (
                        <li key={index} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--ops-border)', padding: '8px 0' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span><strong>{item.cantidad}x</strong> {item.plato}</span>
                            {/* Filtramos basura como "empty" o "[]" */}
                            {item.notas && item.notas !== 'empty' && item.notas !== '[]' && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--ops-ink-soft)', fontStyle: 'italic' }}>{item.notas}</span>
                            )}
                          </div>
                          <strong style={{ color: 'var(--ops-ink)' }}>
                            ${parseFloat(item.subtotal || 0).toFixed(2)}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--ops-surface-alt)', padding: '14px 16px', borderRadius: 'var(--ops-radius-sm)', marginBottom: '15px' }}>
                  <span style={{ fontSize: '0.95rem', color: 'var(--ops-ink-soft)' }}>
                    {pedidoAnulado ? 'Pedido anulado:' : 'Total a cobrar:'}
                  </span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: pedidoAnulado ? 'var(--ops-ink-soft)' : 'var(--ops-success)' }}>
                    ${totalNumerico.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() => manejarCobro(cuenta.id_pedido, cuenta.id_mesa, totalNumerico)}
                  className="ops-btn"
                  style={{
                    width: '100%', padding: '13px 18px', fontSize: '0.98rem',
                    backgroundColor: pedidoAnulado ? 'var(--ops-surface-alt)' : 'var(--ops-success)',
                    color: pedidoAnulado ? 'var(--ops-ink-soft)' : '#fff',
                    border: pedidoAnulado ? '1px solid var(--ops-border)' : 'none',
                  }}
                >
                  {pedidoAnulado ? <><Archive size={16} /> Archivar orden cancelada</> : <><Banknote size={16} /> Cobrar y liberar</>}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}

export default Caja;
