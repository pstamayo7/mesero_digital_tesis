import React, { useState, useEffect } from 'react';
import AdminReportes from './AdminReportes'
import GestionEmpleados from './GestionEmpleados'
import { apiFetch } from './utils/apiFetch'
import './OpsTheme.css'
import {
  BarChart3, Camera, Check, ChefHat, Package, Pencil,
  SlidersHorizontal, Trash2, UtensilsCrossed, Users, X
} from 'lucide-react'

export default function AdminDashboard() {
  const [tabActiva, setTabActiva] = useState('platos');
  const [mensaje, setMensaje] = useState('');
  
  const [config, setConfig] = useState({ max_platos_kiosko: 0, capacidad_paila_cocina: 0, cantidad_cocineros: 0, porcentaje_tiempo_extra: 0, total_paletas: 0 });
  const [ingredientes, setIngredientes] = useState([]);
  const [platos, setPlatos] = useState([]);
  const [categorias, setCategorias] = useState([]);

  // Estados para Modal de Recetas
  const [modalReceta, setModalReceta] = useState({ visible: false, plato: null, ingredientesReceta: [] });
  const [nuevoIngReceta, setNuevoIngReceta] = useState({ id_ingrediente: '', cantidad_base: 1 });

  // Estado para el Modal de Edición de Plato
  const [platoEditando, setPlatoEditando] = useState(null); // copia editable del plato, o null si está cerrado

  // Estados para los Formularios Elegantes (NUEVO)
  const [mostrarFormPlato, setMostrarFormPlato] = useState(false);
  const [nuevoPlatoNombre, setNuevoPlatoNombre] = useState('');
  
  const [mostrarFormIngrediente, setMostrarFormIngrediente] = useState(false);
  const [nuevoIngNombre, setNuevoIngNombre] = useState('');
  
  // Estado para la pestaña de Fotos
  const [platosGestion, setPlatosGestion] = useState([]);

  useEffect(() => {
    cargarConfiguracion();
    cargarIngredientes();
    cargarPlatos();
    cargarCategorias();
  }, []);

  const mostrarMensaje = (texto) => {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 3000);
  };

  // ================= API CALLS =================
  const cargarConfiguracion = async () => {
    const res = await apiFetch('/admin/configuracion');
    if (res.ok) setConfig(await res.json());
  };

  const guardarConfiguracion = async (e) => {
    e.preventDefault();
    const res = await apiFetch('/admin/configuracion', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
    if (res.ok) mostrarMensaje("Configuración guardada correctamente");
  };

  const cargarIngredientes = async () => {
    const res = await apiFetch('/admin/ingredientes');
    if (res.ok) setIngredientes(await res.json());
  };

  const guardarIngrediente = async (ing, esNuevo = false) => {
    // Saneamos espacios fantasma antes de que lleguen a PostgreSQL (rompen el cruce de nombres con el LLM)
    const ingSaneado = { ...ing, nombre: ing.nombre.trim() };
    const url = esNuevo ? '/admin/ingredientes' : `/admin/ingredientes/${ing.id_ingrediente}`;
    const method = esNuevo ? 'POST' : 'PUT';
    const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ingSaneado) });
    if (res.ok) {
      mostrarMensaje(esNuevo ? "Ingrediente agregado" : "Ingrediente actualizado");
      cargarIngredientes();
    }
  };

  const cargarPlatos = async () => {
    const res = await apiFetch('/admin/platos');
    if (res.ok) setPlatos(await res.json());
  };

  const cargarCategorias = async () => {
    const res = await apiFetch('/admin/categorias');
    if (res.ok) setCategorias(await res.json());
  };

  const guardarPlato = async (plato, esNuevo = false) => {
    // Saneamos espacios fantasma antes de que lleguen a PostgreSQL (rompen el cruce de nombres con el LLM)
    const platoSaneado = { ...plato, nombre: plato.nombre.trim() };
    const url = esNuevo ? '/admin/platos' : `/admin/platos/${plato.id_plato}`;
    const method = esNuevo ? 'POST' : 'PUT';
    const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(platoSaneado) });
    if (res.ok) {
      mostrarMensaje(esNuevo ? "Plato creado" : "Plato actualizado");
      cargarPlatos();
    }
  };

  // ================= EDICIÓN Y BORRADO LÓGICO =================
  const abrirEdicionPlato = (plato) => setPlatoEditando({ ...plato });

  const guardarEdicionPlato = async () => {
    await guardarPlato({
      id_plato: platoEditando.id_plato,
      id_categoria: parseInt(platoEditando.id_categoria),
      nombre: platoEditando.nombre,
      precio_base: parseFloat(platoEditando.precio_base),
      requiere_coccion: platoEditando.requiere_coccion,
      tiempo_prep_min: parseInt(platoEditando.tiempo_prep_min)
    });
    setPlatoEditando(null);
  };

  const eliminarPlato = async (plato) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar "${plato.nombre}" del menú?`)) return;
    const res = await apiFetch(`/admin/platos/${plato.id_plato}`, { method: 'DELETE' });
    if (res.ok) {
      mostrarMensaje("Plato eliminado del menú");
      setPlatos(prev => prev.filter(p => p.id_plato !== plato.id_plato));
    }
  };

  // ================= API RECETAS =================
  const abrirReceta = async (plato) => {
    const res = await apiFetch(`/admin/receta/${plato.id_plato}`);
    const data = res.ok ? await res.json() : [];
    setModalReceta({ visible: true, plato, ingredientesReceta: data });
  };

  const agregarAReceta = async () => {
    if(!nuevoIngReceta.id_ingrediente) return;
    const body = { 
      id_plato: modalReceta.plato.id_plato, 
      id_ingrediente: parseInt(nuevoIngReceta.id_ingrediente), 
      cantidad_base: parseFloat(nuevoIngReceta.cantidad_base) 
    };
    await apiFetch('/admin/receta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    abrirReceta(modalReceta.plato); 
  };

  const quitarDeReceta = async (id_ing) => {
    await apiFetch(`/admin/receta/${modalReceta.plato.id_plato}/${id_ing}`, { method: 'DELETE' });
    abrirReceta(modalReceta.plato);
  };

  // ================= GESTIÓN DE FOTOS =================
  const cargarPlatosGestion = async () => {
    try {
      const res = await apiFetch('/admin/platos/todos');
      if (res.ok) {
        const data = await res.json();
        setPlatosGestion(data.platos);
      }
    } catch (error) { console.error("Error cargando platos", error); }
  };

  // Corregido: Ahora escucha a `tabActiva`, no a `subPagina`
  useEffect(() => {
    if (tabActiva === 'fotos') cargarPlatosGestion();
  }, [tabActiva]);

  const subirImagen = async (id_plato, event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("imagen", file);
    
    try {
      const res = await apiFetch(`/admin/platos/${id_plato}/imagen`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        mostrarMensaje("Imagen actualizada con éxito");
        cargarPlatosGestion(); // Recargamos para ver la nueva foto
      }
    } catch (error) {
      alert("Error al subir la imagen");
    }
  };

  // ================= FUNCIONES DE CREACIÓN ELEGANTE =================
  const confirmarNuevoPlato = () => {
    if (nuevoPlatoNombre.trim() !== '') {
      guardarPlato({ id_categoria: 1, nombre: nuevoPlatoNombre, precio_base: 0, requiere_coccion: true, tiempo_prep_min: 5 }, true);
      setMostrarFormPlato(false);
      setNuevoPlatoNombre('');
    }
  };

  const confirmarNuevoIngrediente = () => {
    if (nuevoIngNombre.trim() !== '') {
      guardarIngrediente({ nombre: nuevoIngNombre, stock_actual: 0, precio_extra: 0 }, true);
      setMostrarFormIngrediente(false);
      setNuevoIngNombre('');
    }
  };

  // ================= ESTILOS DEL SISTEMA "OPERACIONES" =================
  const theme = {
    card: { backgroundColor: 'var(--ops-surface)', borderRadius: 'var(--ops-radius)', padding: '24px', border: '1px solid var(--ops-border)', boxShadow: 'var(--ops-shadow-sm)', marginBottom: '20px' },
    input: { padding: '10px', borderRadius: 'var(--ops-radius-sm)', border: '1px solid var(--ops-border)', width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'var(--ops-font-body)' },
    btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: 'var(--ops-accent)', color: 'var(--ops-accent-contrast)', padding: '10px 16px', border: 'none', borderRadius: 'var(--ops-radius-sm)', cursor: 'pointer', fontWeight: 600, transition: 'transform 160ms var(--ops-ease), filter 160ms ease' },
    btnSecondary: { display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: 'var(--ops-surface-alt)', color: 'var(--ops-ink)', padding: '10px 16px', border: '1px solid var(--ops-border)', borderRadius: 'var(--ops-radius-sm)', cursor: 'pointer', fontWeight: 600, transition: 'transform 160ms var(--ops-ease), filter 160ms ease' },
    th: { textAlign: 'left', padding: '12px', backgroundColor: 'var(--ops-surface-alt)', color: 'var(--ops-ink-soft)', borderBottom: '1px solid var(--ops-border)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.3px' },
    td: { padding: '12px', borderBottom: '1px solid var(--ops-border)' }
  };

  const iconosTab = {
    reportes: BarChart3, platos: UtensilsCrossed, fotos: Camera,
    ingredientes: Package, empleados: Users, configuracion: SlidersHorizontal,
  };

  return (
  <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--ops-surface-alt)', fontFamily: 'var(--ops-font-body)' }}>

    {/* ================= ASIDE (BARRA LATERAL) ================= */}
    <aside style={{ width: '260px', backgroundColor: 'var(--ops-dark-surface)', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 10px rgba(0,0,0,0.1)', zIndex: 10 }}>
      <div style={{ padding: '22px 20px', borderBottom: '1px solid var(--ops-dark-border)' }}>
        <div className="ops-brand">
          <img src="/logo.png" alt="Doña Zita" />
          <div className="ops-brand-text" style={{ color: '#f3f1ec' }}>
            <strong style={{ fontSize: '1.05rem' }}>Doña Zita</strong>
            <small style={{ color: 'var(--ops-dark-text-soft)' }}>Panel Administrativo</small>
          </div>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
        {[
          { id: 'reportes', texto: 'Reportes & IA' },
          { id: 'platos', texto: 'Menú & Recetas' },
          { id: 'fotos', texto: 'Fotos del Menú' },
          { id: 'ingredientes', texto: 'Inventario' },
          { id: 'empleados', texto: 'Gestión de Personal' },
          { id: 'configuracion', texto: 'Configuración' }
        ].map(item => {
          const Icono = iconosTab[item.id];
          return (
            <button
              key={item.id}
              onClick={() => setTabActiva(item.id)}
              style={{
                padding: '14px 25px', textAlign: 'left', fontSize: '14.5px', border: 'none', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center',
                transition: 'background-color 160ms ease, color 160ms ease',
                backgroundColor: tabActiva === item.id ? 'var(--ops-dark-surface-alt)' : 'transparent',
                color: tabActiva === item.id ? 'var(--ops-accent)' : '#cfd1d8',
                borderLeft: tabActiva === item.id ? '3px solid var(--ops-accent)' : '3px solid transparent',
                fontWeight: tabActiva === item.id ? 600 : 500
              }}
            >
              <Icono size={17} /> {item.texto}
            </button>
          );
        })}
      </nav>
    </aside>

    {/* ================= CONTENIDO PRINCIPAL ================= */}
    <main style={{ flex: 1, padding: '40px', overflowY: 'auto', backgroundColor: 'var(--ops-surface-alt)' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontFamily: 'var(--ops-font-display)', color: 'var(--ops-ink)', margin: 0 }}>
          {tabActiva === 'reportes' ? 'Análisis de Datos' : tabActiva === 'platos' ? 'Gestión de Menú' : tabActiva === 'fotos' ? 'Fotografías del Menú' : tabActiva === 'ingredientes' ? 'Control de Stock' : tabActiva === 'empleados' ? 'Gestión de Personal' : 'Configuración'}
        </h1>
        {mensaje && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--ops-success-soft)', color: 'var(--ops-success)', padding: '9px 18px', borderRadius: 'var(--ops-radius-sm)', fontWeight: 600, fontSize: '0.88rem' }}>
            <Check size={15} /> {mensaje}
          </div>
        )}
      </div>

      {/* --- INYECTAMOS LOS MÓDULOS AQUÍ --- */}
      {tabActiva === 'reportes' && <AdminReportes />}
      {tabActiva === 'empleados' && <GestionEmpleados />}
      
      {/* ================= PESTAÑA: PLATOS ================= */}
      {tabActiva === 'platos' && (
        <div style={theme.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--ops-font-display)', color: 'var(--ops-ink)' }}>Gestión de Platos</h2>
            
            {/* PESTAÑITA ELEGANTE DE CREACIÓN */}
            {!mostrarFormPlato ? (
              <button style={theme.btnPrimary} onClick={() => setMostrarFormPlato(true)}>+ Nuevo Plato</button>
            ) : (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: 'var(--ops-surface-alt)', padding: '10px', borderRadius: 'var(--ops-radius-sm)', border: '1px solid var(--ops-border)' }}>
                <input 
                  style={{...theme.input, width: '250px', border: '1px solid var(--ops-border)'}} 
                  placeholder="Ej: Churrasco Especial" 
                  autoFocus
                  value={nuevoPlatoNombre}
                  onChange={e => setNuevoPlatoNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmarNuevoPlato(); if (e.key === 'Escape') setMostrarFormPlato(false); }}
                />
                <button style={theme.btnPrimary} onClick={confirmarNuevoPlato}>Guardar</button>
                <button style={theme.btnSecondary} onClick={() => { setMostrarFormPlato(false); setNuevoPlatoNombre(''); }}>Cancelar</button>
              </div>
            )}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={theme.th}>Plato</th><th style={theme.th}>Categoría</th><th style={theme.th}>Precio ($)</th><th style={theme.th}>Tiempo (min)</th><th style={theme.th}>Acciones</th></tr></thead>
            <tbody>
              {platos.map(plato => (
                <tr key={plato.id_plato}>
                  <td style={theme.td}><input style={{...theme.input, border: '1px solid transparent', backgroundColor: 'transparent'}} defaultValue={plato.nombre} onBlur={e => guardarPlato({...plato, nombre: e.target.value})} onFocus={e => e.target.style.border = '1px solid var(--ops-border)'} /></td>
                  <td style={theme.td}>{plato.categoria_nombre}</td>
                  <td style={theme.td}><input type="number" style={{...theme.input, border: '1px solid transparent', backgroundColor: 'transparent'}} defaultValue={plato.precio_base} onBlur={e => guardarPlato({...plato, precio_base: parseFloat(e.target.value)})} onFocus={e => e.target.style.border = '1px solid var(--ops-border)'} /></td>
                  <td style={theme.td}><input type="number" style={{...theme.input, border: '1px solid transparent', backgroundColor: 'transparent'}} defaultValue={plato.tiempo_prep_min} onBlur={e => guardarPlato({...plato, tiempo_prep_min: parseInt(e.target.value)})} onFocus={e => e.target.style.border = '1px solid var(--ops-border)'} /></td>
                  <td style={theme.td}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{...theme.btnSecondary, backgroundColor: 'var(--ops-warning-soft)', borderColor: 'transparent', color: 'var(--ops-warning)'}} onClick={() => abrirReceta(plato)}>
                        <ChefHat size={14} /> Receta
                      </button>
                      <button style={{...theme.btnSecondary, backgroundColor: 'var(--ops-accent-soft)', borderColor: 'transparent', color: 'var(--ops-accent-dark)'}} onClick={() => abrirEdicionPlato(plato)} title="Editar plato">
                        <Pencil size={14} /> Editar
                      </button>
                      <button style={{...theme.btnSecondary, backgroundColor: 'var(--ops-danger-soft)', borderColor: 'transparent', color: 'var(--ops-danger)'}} onClick={() => eliminarPlato(plato)} title="Eliminar plato">
                        <Trash2 size={14} /> Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= PESTAÑA NUEVA: FOTOS DEL MENÚ ================= */}
      {tabActiva === 'fotos' && (
        <div style={{ ...theme.card }}>
          <h2 style={{ margin: '0 0 20px 0', fontFamily: 'var(--ops-font-display)', color: 'var(--ops-ink)' }}>Fotografías para el Kiosko</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
            {platosGestion.map(plato => (
              <div key={plato.id_plato} style={{ border: '1px solid var(--ops-border)', borderRadius: 'var(--ops-radius-sm)', padding: '15px', textAlign: 'center', backgroundColor: 'var(--ops-surface-alt)' }}>
               <img
  src={`http://127.0.0.1:8000${plato.ruta_imagen}`}
  alt={plato.nombre}
  onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/250x150?text=Sin+Foto'; }}
  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: 'var(--ops-radius-sm)', marginBottom: '10px' }}
/>
                <h4 style={{ margin: '0 0 5px 0', color: 'var(--ops-ink)' }}>{plato.nombre}</h4>
                <span style={{ color: 'var(--ops-success)', fontWeight: 'bold', display: 'block', marginBottom: '15px' }}>${parseFloat(plato.precio_base).toFixed(2)}</span>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', backgroundColor: 'var(--ops-accent)', color: 'var(--ops-accent-contrast)', padding: '8px 15px', borderRadius: 'var(--ops-radius-sm)', fontSize: '14px', fontWeight: 600 }}>
                  <Camera size={15} /> Subir nueva foto
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => subirImagen(plato.id_plato, e)}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* ================= PESTAÑA: INGREDIENTES ================= */}
      {tabActiva === 'ingredientes' && (
        <div style={theme.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--ops-font-display)', color: 'var(--ops-ink)' }}>Control de Stock</h2>

            {/* PESTAÑITA ELEGANTE DE CREACIÓN */}
            {!mostrarFormIngrediente ? (
              <button style={theme.btnPrimary} onClick={() => setMostrarFormIngrediente(true)}>+ Nuevo Ingrediente</button>
            ) : (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: 'var(--ops-surface-alt)', padding: '10px', borderRadius: 'var(--ops-radius-sm)', border: '1px solid var(--ops-border)' }}>
                <input
                  style={{...theme.input, width: '250px', border: '1px solid var(--ops-border)'}}
                  placeholder="Ej: Aguacate (u)"
                  autoFocus
                  value={nuevoIngNombre}
                  onChange={e => setNuevoIngNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmarNuevoIngrediente(); if (e.key === 'Escape') setMostrarFormIngrediente(false); }}
                />
                <button style={theme.btnPrimary} onClick={confirmarNuevoIngrediente}>Guardar</button>
                <button style={theme.btnSecondary} onClick={() => { setMostrarFormIngrediente(false); setNuevoIngNombre(''); }}>Cancelar</button>
              </div>
            )}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={theme.th}>Ingrediente</th><th style={theme.th}>Stock Actual</th><th style={theme.th}>Precio Extra ($)</th></tr></thead>
            <tbody>
              {ingredientes.map(ing => (
                <tr key={ing.id_ingrediente}>
                  <td style={theme.td}><input style={{...theme.input, border: '1px solid transparent', backgroundColor: 'transparent'}} defaultValue={ing.nombre} onBlur={e => guardarIngrediente({...ing, nombre: e.target.value})} onFocus={e => e.target.style.border = '1px solid var(--ops-border)'} /></td>
                  
                  <td style={theme.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '18px', color: ing.stock_actual < 5 ? 'var(--ops-danger)' : 'var(--ops-success)', minWidth: '40px' }}>
                        {ing.stock_actual}
                      </span>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <input
                          type="number" step="0.5" id={`stockInput-${ing.id_ingrediente}`}
                          style={{...theme.input, width: '70px', padding: '8px'}} placeholder="+ / -"
                        />
                        <button style={{...theme.btnSecondary, padding: '8px 12px'}} onClick={() => {
                            const input = document.getElementById(`stockInput-${ing.id_ingrediente}`);
                            const ajuste = parseFloat(input.value);
                            if (!isNaN(ajuste)) {
                              const nuevoStock = ing.stock_actual + ajuste;
                              if (nuevoStock < 0) alert("El stock no puede ser negativo.");
                              else { guardarIngrediente({...ing, stock_actual: nuevoStock}); input.value = ''; }
                            }
                          }}><Check size={14} /></button>
                      </div>
                    </div>
                  </td>

                  <td style={theme.td}><input type="number" step="0.05" style={{...theme.input, border: '1px solid transparent', backgroundColor: 'transparent'}} defaultValue={ing.precio_extra} onBlur={e => guardarIngrediente({...ing, precio_extra: parseFloat(e.target.value)})} onFocus={e => e.target.style.border = '1px solid var(--ops-border)'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* ================= PESTAÑA: CONFIGURACIÓN ================= */}
      {tabActiva === 'configuracion' && (
        <div style={{...theme.card, maxWidth: '600px', margin: '0 auto'}}>
          <h2 style={{ margin: '0 0 20px 0', fontFamily: 'var(--ops-font-display)', color: 'var(--ops-ink)' }}>Parámetros Operativos</h2>
          <form onSubmit={guardarConfiguracion} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <label className="ops-label">Máximo platos Kiosko <input type="number" style={{...theme.input, marginTop: 4}} value={config.max_platos_kiosko} onChange={e => setConfig({...config, max_platos_kiosko: parseInt(e.target.value)})} /></label>
            <label className="ops-label">Capacidad paila (cocina) <input type="number" style={{...theme.input, marginTop: 4}} value={config.capacidad_paila_cocina} onChange={e => setConfig({...config, capacidad_paila_cocina: parseInt(e.target.value)})} /></label>
            <label className="ops-label">Cocineros activos <input type="number" style={{...theme.input, marginTop: 4}} value={config.cantidad_cocineros} onChange={e => setConfig({...config, cantidad_cocineros: parseInt(e.target.value)})} /></label>
            <label className="ops-label">Margen tiempo IA (ej. 0.10) <input type="number" step="0.01" style={{...theme.input, marginTop: 4}} value={config.porcentaje_tiempo_extra} onChange={e => setConfig({...config, porcentaje_tiempo_extra: parseFloat(e.target.value)})} /></label>
            <button type="submit" style={{...theme.btnPrimary, marginTop: '10px', padding: '12px', justifyContent: 'center'}}>Guardar configuración</button>
          </form>
        </div>
      )}

    </main>

    {/* ================= MODAL DE RECETAS ================= */}
    {modalReceta.visible && (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15,16,19,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}>
        <div style={{ backgroundColor: 'var(--ops-surface)', padding: '30px', borderRadius: 'var(--ops-radius)', width: '500px', maxWidth: '90%', boxShadow: 'var(--ops-shadow)' }}>
          <h2 style={{ marginTop: 0, fontFamily: 'var(--ops-font-display)', color: 'var(--ops-ink)' }}>Receta: {modalReceta.plato.nombre}</h2>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '15px', backgroundColor: 'var(--ops-surface-alt)', borderRadius: 'var(--ops-radius-sm)' }}>
            <select style={theme.input} value={nuevoIngReceta.id_ingrediente} onChange={e => setNuevoIngReceta({...nuevoIngReceta, id_ingrediente: e.target.value})}>
              <option value="">Selecciona ingrediente...</option>
              {ingredientes.map(ing => <option key={ing.id_ingrediente} value={ing.id_ingrediente}>{ing.nombre}</option>)}
            </select>
            <input type="number" step="0.1" style={{...theme.input, width: '90px'}} placeholder="Cant." value={nuevoIngReceta.cantidad_base} onChange={e => setNuevoIngReceta({...nuevoIngReceta, cantidad_base: e.target.value})} />
            <button style={theme.btnPrimary} onClick={agregarAReceta}>Añadir</button>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {modalReceta.ingredientesReceta.length === 0 ? <p style={{ color: 'var(--ops-ink-soft)', textAlign: 'center' }}>No hay ingredientes asignados.</p> : null}
            {modalReceta.ingredientesReceta.map(item => (
              <li key={item.id_ingrediente} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid var(--ops-border)', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--ops-ink)' }}>{item.ingrediente_nombre}</span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--ops-ink-soft)', fontSize: '14px' }}>Cant:</span>
                  <input
                    type="number" step="0.1" style={{...theme.input, width: '70px', padding: '5px', textAlign: 'center'}}
                    defaultValue={item.cantidad_base}
                    onBlur={async (e) => {
                      const nuevaCant = parseFloat(e.target.value);
                      if(nuevaCant !== item.cantidad_base && !isNaN(nuevaCant)) {
                        const body = { id_plato: modalReceta.plato.id_plato, id_ingrediente: item.id_ingrediente, cantidad_base: nuevaCant };
                        await apiFetch('/admin/receta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                        abrirReceta(modalReceta.plato);
                      }
                    }}
                  />
                  <button style={{ display: 'inline-flex', border: 'none', background: 'transparent', color: 'var(--ops-danger)', cursor: 'pointer', marginLeft: '5px' }} onClick={() => quitarDeReceta(item.id_ingrediente)}>
                    <X size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button style={{...theme.btnSecondary, width: '100%', marginTop: '20px', padding: '12px', justifyContent: 'center'}} onClick={() => setModalReceta({ visible: false, plato: null, ingredientesReceta: [] })}>
            Cerrar ventana
          </button>
        </div>
      </div>
    )}

    {/* ================= MODAL DE EDICIÓN DE PLATO ================= */}
    {platoEditando && (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15,16,19,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}>
        <div style={{ backgroundColor: 'var(--ops-surface)', padding: '30px', borderRadius: 'var(--ops-radius)', width: '420px', maxWidth: '90%', boxShadow: 'var(--ops-shadow)' }}>
          <h2 style={{ marginTop: 0, fontFamily: 'var(--ops-font-display)', color: 'var(--ops-ink)' }}>Editar plato</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ fontSize: '14px', color: 'var(--ops-ink-soft)', fontWeight: 600 }}>
              Nombre
              <input
                style={{ ...theme.input, marginTop: '4px' }}
                value={platoEditando.nombre}
                onChange={e => setPlatoEditando({ ...platoEditando, nombre: e.target.value })}
              />
            </label>

            <label style={{ fontSize: '14px', color: 'var(--ops-ink-soft)', fontWeight: 600 }}>
              Categoría
              <select
                style={{ ...theme.input, marginTop: '4px' }}
                value={platoEditando.id_categoria}
                onChange={e => setPlatoEditando({ ...platoEditando, id_categoria: e.target.value })}
              >
                {categorias.map(cat => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>{cat.nombre}</option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: '14px' }}>
              <label style={{ fontSize: '14px', color: 'var(--ops-ink-soft)', fontWeight: 600, flex: 1 }}>
                Precio ($)
                <input
                  type="number" step="0.01"
                  style={{ ...theme.input, marginTop: '4px' }}
                  value={platoEditando.precio_base}
                  onChange={e => setPlatoEditando({ ...platoEditando, precio_base: e.target.value })}
                />
              </label>
              <label style={{ fontSize: '14px', color: 'var(--ops-ink-soft)', fontWeight: 600, flex: 1 }}>
                Tiempo (min)
                <input
                  type="number"
                  style={{ ...theme.input, marginTop: '4px' }}
                  value={platoEditando.tiempo_prep_min}
                  onChange={e => setPlatoEditando({ ...platoEditando, tiempo_prep_min: e.target.value })}
                />
              </label>
            </div>

            <label style={{ fontSize: '14px', color: 'var(--ops-ink-soft)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={!!platoEditando.requiere_coccion}
                onChange={e => setPlatoEditando({ ...platoEditando, requiere_coccion: e.target.checked })}
              />
              Requiere cocción (entra a la cola de cocina)
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            <button style={{...theme.btnPrimary, flex: 1, padding: '12px', justifyContent: 'center'}} onClick={guardarEdicionPlato}>
              Guardar cambios
            </button>
            <button style={{...theme.btnSecondary, flex: 1, padding: '12px', justifyContent: 'center'}} onClick={() => setPlatoEditando(null)}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}

  </div>
);
}