import { useState, useEffect } from 'react'

// 🌟 CONTRATO DE DATOS: este modal lee/escribe 'mods_estructuradas' usando exactamente
// la misma forma que genera ia_service.py por voz: [{ tipo: "EXTRA"|"SIN", ingrediente, recargo }].
// El campo 'modificaciones' (string) se reconstruye igual que el backend lo hace
// (join ordenado alfabéticamente por "tipo ingrediente") para que la vista de texto
// de respaldo en Kiosko.jsx luzca idéntica sin importar el origen del ítem.
function ModalEdicionPlato({ item, idPlato, precioBase, extrasDisponibles, onGuardar, onCerrar }) {
  const [ingredientesBase, setIngredientesBase] = useState([])
  const [cargandoBase, setCargandoBase] = useState(true)

  // Clon local de las modificaciones: nunca tocamos el item del carrito hasta "Guardar".
  const [modsSeleccionadas, setModsSeleccionadas] = useState(
    () => (item.mods_estructuradas || []).map(mod => ({ ...mod }))
  )

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/menu/${idPlato}/ingredientes`)
      .then(res => res.json())
      .then(data => setIngredientesBase(data.ingredientes_base || []))
      .catch(err => console.error("Error cargando receta base:", err))
      .finally(() => setCargandoBase(false))
  }, [idPlato])

  const tieneMod = (tipo, ingrediente) =>
    modsSeleccionadas.some(m => m.tipo === tipo && m.ingrediente === ingrediente)

  const alternarSin = (ingrediente) => {
    setModsSeleccionadas(prev => {
      if (prev.some(m => m.tipo === "SIN" && m.ingrediente === ingrediente)) {
        return prev.filter(m => !(m.tipo === "SIN" && m.ingrediente === ingrediente))
      }
      return [...prev, { tipo: "SIN", ingrediente, recargo: 0 }]
    })
  }

  const alternarExtra = (extra) => {
    setModsSeleccionadas(prev => {
      if (prev.some(m => m.tipo === "EXTRA" && m.ingrediente === extra.ingrediente)) {
        return prev.filter(m => !(m.tipo === "EXTRA" && m.ingrediente === extra.ingrediente))
      }
      return [...prev, { tipo: "EXTRA", ingrediente: extra.ingrediente, recargo: extra.precio_extra }]
    })
  }

  const recargoExtrasActual = modsSeleccionadas
    .filter(m => m.tipo === "EXTRA")
    .reduce((suma, m) => suma + (m.recargo || 0), 0)

  const precioUnitarioPreview = precioBase + recargoExtrasActual

  const guardarCambios = () => {
    // Mismo orden que ia_service.py (línea: sorted(mods_lista, key=lambda x: f"{x.tipo} {x.ingrediente}"))
    const modsOrdenadas = [...modsSeleccionadas].sort((a, b) =>
      `${a.tipo} ${a.ingrediente}`.localeCompare(`${b.tipo} ${b.ingrediente}`)
    )
    const recargoTotal = modsOrdenadas
      .filter(m => m.tipo === "EXTRA")
      .reduce((suma, m) => suma + (m.recargo || 0), 0)
    const precioUnitarioFinal = precioBase + recargoTotal

    const itemActualizado = {
      ...item,
      mods_estructuradas: modsOrdenadas,
      modificaciones: modsOrdenadas.map(m => `${m.tipo} ${m.ingrediente}`).join(", "),
      precio_unitario: precioUnitarioFinal,
      subtotal: precioUnitarioFinal * item.cantidad
    }
    onGuardar(itemActualizado)
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
      onClick={onCerrar}
    >
      <div
        style={{
          backgroundColor: 'white', borderRadius: '12px', padding: '25px',
          maxWidth: '500px', width: '90%', maxHeight: '85vh', overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>✏️ Editar: {item.plato}</h2>

        <h3 style={{ color: '#dc2626', marginBottom: '10px' }}>🚫 Quitar ingredientes</h3>
        {cargandoBase ? (
          <p>Cargando receta...</p>
        ) : ingredientesBase.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Este plato no tiene ingredientes base configurados.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {ingredientesBase.map(ingrediente => {
              const activo = tieneMod("SIN", ingrediente)
              return (
                <button
                  key={`sin-${ingrediente}`}
                  onClick={() => alternarSin(ingrediente)}
                  style={{
                    padding: '10px 16px', borderRadius: '20px', border: '2px solid #dc2626',
                    backgroundColor: activo ? '#dc2626' : 'white',
                    color: activo ? 'white' : '#dc2626',
                    fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  {activo ? `✓ SIN ${ingrediente}` : ingrediente}
                </button>
              )
            })}
          </div>
        )}

        <h3 style={{ color: '#059669', marginBottom: '10px' }}>➕ Agregar extras</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          {extrasDisponibles.map(extra => {
            const activo = tieneMod("EXTRA", extra.ingrediente)
            return (
              <button
                key={`extra-${extra.ingrediente}`}
                onClick={() => alternarExtra(extra)}
                style={{
                  padding: '10px 16px', borderRadius: '20px', border: '2px solid #059669',
                  backgroundColor: activo ? '#059669' : 'white',
                  color: activo ? 'white' : '#059669',
                  fontWeight: 'bold', cursor: 'pointer'
                }}
              >
                {activo ? `✓ ${extra.ingrediente}` : `${extra.ingrediente} (+$${extra.precio_extra.toFixed(2)})`}
              </button>
            )
          })}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#f3f4f6', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px'
        }}>
          <span>Precio unitario actualizado:</span>
          <strong style={{ fontSize: '1.2rem', color: '#059669' }}>${precioUnitarioPreview.toFixed(2)}</strong>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCerrar}
            style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#6b7280', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={guardarCambios}
            style={{ flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalEdicionPlato
