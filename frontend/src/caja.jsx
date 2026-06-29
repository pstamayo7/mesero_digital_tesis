import { useState, useEffect } from 'react';
import './App.css'; // O crea un Caja.css si quieres estilos separados
import { apiFetch } from './utils/apiFetch';

function Caja() {
    const [cuentas, setCuentas] = useState([]);
    const [cargando, setCargando] = useState(true);

   const cargarCuentas = () => {
        
        // 🌟 TRUCO: Date.now() obliga al navegador a pedir datos frescos siempre
    apiFetch('/caja/pendientes?t=' + Date.now()) 
      .then(res => res.json())
            .then(datos => {
                // 🌟 EL ESPÍA: Imprime en consola lo que manda Python
                console.log("👀 Datos de Python:", datos);
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
                    const mensajeExito = pedidoAnulado ? '🗂️ ¡Orden archivada!' : '✅ ¡Pago registrado!';
                    alert(`${mensajeExito} ${id_mesa > 0 ? `La Paleta ${id_mesa} ha sido liberada.` : 'Pedido para llevar entregado.'}`);
                    cargarCuentas(); // Recargamos la lista para que desaparezca
                } else {
                    alert("❌ Hubo un error al procesar el cobro.");
                }
            } catch (error) {
                alert("❌ Error de conexión con el servidor.");
            }
        }
    };

    return (
    <div style={{ padding: '40px', backgroundColor: '#f1f5f9', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#1e293b', color: 'white', padding: '20px', borderRadius: '10px', marginBottom: '30px' }}>
        <h1 style={{ margin: 0 }}>💵 Caja y Facturación</h1>
      </header>

      {cargando ? (
        <p>Cargando cuentas pendientes...</p>
      ) : cuentas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', backgroundColor: 'white', borderRadius: '10px' }}>
          <h2>No hay cuentas por cobrar en este momento. 😴</h2>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
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
              <div key={cuenta.id_pedido} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderTop: '5px solid #3b82f6' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0 }}>Pedido #{cuenta.id_pedido}</h3>
                  <span style={{ backgroundColor: esParaLlevar ? '#8b5cf6' : '#3b82f6', color: 'white', padding: '5px 10px', borderRadius: '5px', fontWeight: 'bold' }}>
                    {esParaLlevar ? '🛍️ Llevar' : `🪑 Paleta ${cuenta.id_mesa}`}
                  </span>
                </div>

                <p style={{ margin: '5px 0', fontSize: '1.1rem' }}>
                  <strong>Cliente:</strong> {cuenta.cliente_nombre}
                </p>
                <p style={{ margin: '5px 0 20px 0', fontSize: '1.1rem' }}>
                  <strong>Apertura:</strong> {new Date(cuenta.fecha_apertura).toLocaleTimeString()}
                </p>

                {/* 🌟 AQUÍ VA EL TICKET DE CONSUMO 🌟 */}
                {detallesArray.length > 0 && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#475569', borderBottom: '2px solid #cbd5e1', paddingBottom: '5px' }}>
                      🧾 Detalle de Consumo
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.95rem' }}>
                      {detallesArray.map((item, index) => (
                        <li key={index} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #cbd5e1', padding: '8px 0' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span><strong>{item.cantidad}x</strong> {item.plato}</span>
                            {/* Filtramos basura como "empty" o "[]" */}
                            {item.notas && item.notas !== 'empty' && item.notas !== '[]' && (
                              <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>* {item.notas}</span>
                            )}
                          </div>
                          <strong style={{ color: '#334155' }}>
                            ${parseFloat(item.subtotal || 0).toFixed(2)}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                  <span style={{ fontSize: '1.2rem', color: '#64748b' }}>
                    {pedidoAnulado ? 'Pedido anulado:' : 'Total a cobrar:'}
                  </span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: pedidoAnulado ? '#6b7280' : '#10b981' }}>
                    ${totalNumerico.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() => manejarCobro(cuenta.id_pedido, cuenta.id_mesa, totalNumerico)}
                  style={{
                    width: '100%', padding: '15px', border: 'none', borderRadius: '8px',
                    fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer',
                    backgroundColor: pedidoAnulado ? '#4b5563' : '#10b981', color: 'white'
                  }}
                >
                  {pedidoAnulado ? '🗂️ Archivar Orden Cancelada' : '💵 Cobrar y Liberar'}
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