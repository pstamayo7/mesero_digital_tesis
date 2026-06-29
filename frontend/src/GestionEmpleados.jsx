import { useEffect, useState } from 'react';
import { Lock, Pencil, Unlock, UserPlus } from 'lucide-react';
import { apiFetch } from './utils/apiFetch';
import './OpsTheme.css';

const ROLES = [
  { valor: 'empleado', texto: 'Empleado' },
  { valor: 'administrador', texto: 'Administrador' },
];

const BADGE_ROL = {
  administrador: 'bg-[var(--ops-accent-soft)] text-[var(--ops-accent-dark)]',
  empleado: 'bg-stone-100 text-stone-600',
};

const TEXTO_ROL = {
  administrador: 'Administrador',
  empleado: 'Empleado',
};

const FORM_VACIO = { nombre_completo: '', username: '', password: '', rol: 'empleado' };

function GestionEmpleados() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null); // null = creando nuevo
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargarUsuarios = async () => {
    setCargando(true);
    try {
      const res = await apiFetch('/admin/usuarios');
      if (res.ok) setUsuarios(await res.json());
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const mostrarMensaje = (texto) => {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 3000);
  };

  const abrirModalNuevo = () => {
    setUsuarioEditando(null);
    setForm(FORM_VACIO);
    setError('');
    setModalAbierto(true);
  };

  const abrirModalEditar = (usuario) => {
    setUsuarioEditando(usuario);
    setForm({
      nombre_completo: usuario.nombre_completo || '',
      username: usuario.username,
      password: '',
      rol: usuario.rol,
    });
    setError('');
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setUsuarioEditando(null);
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();
    setError('');

    if (!usuarioEditando && form.password.trim().length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setGuardando(true);
    try {
      let res;
      if (usuarioEditando) {
        const body = {
          nombre_completo: form.nombre_completo,
          rol: form.rol,
        };
        if (form.password.trim()) body.password = form.password.trim();
        res = await apiFetch(`/admin/usuarios/${usuarioEditando.id_usuario}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await apiFetch('/admin/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }

      if (res.ok) {
        mostrarMensaje(usuarioEditando ? 'Empleado actualizado' : 'Empleado creado');
        cerrarModal();
        cargarUsuarios();
      } else {
        const detalle = await res.json().catch(() => null);
        setError(detalle?.detail || 'No se pudo guardar el empleado.');
      }
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (usuario) => {
    const accion = usuario.activo ? 'desactivar' : 'reactivar';
    if (!window.confirm(`¿Seguro que deseas ${accion} a "${usuario.username}"?`)) return;

    const res = usuario.activo
      ? await apiFetch(`/admin/usuarios/${usuario.id_usuario}`, { method: 'DELETE' })
      : await apiFetch(`/admin/usuarios/${usuario.id_usuario}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activo: true }),
        });

    if (res.ok || res.status === 204) {
      mostrarMensaje(usuario.activo ? 'Acceso revocado' : 'Acceso restaurado');
      cargarUsuarios();
    } else {
      const detalle = await res.json().catch(() => null);
      alert(detalle?.detail || `No se pudo ${accion} al empleado.`);
    }
  };

  const kowalski = 'transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95';

  return (
    <div className="min-h-[60vh]">
      {/* ===================== CABECERA ===================== */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h1 style={{ fontFamily: 'var(--ops-font-display)' }} className="text-3xl font-bold text-stone-800">
          Gestión de Personal
        </h1>
        <div className="flex items-center gap-3">
          {mensaje && (
            <span className="text-sm font-semibold px-4 py-2 rounded-full" style={{ background: 'var(--ops-success-soft)', color: 'var(--ops-success)' }}>
              {mensaje}
            </span>
          )}
          <button
            onClick={abrirModalNuevo}
            className={`flex items-center gap-2 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md transform-gpu will-change-transform ${kowalski}`}
            style={{ background: 'var(--ops-accent)' }}
          >
            <UserPlus size={16} /> Nuevo empleado
          </button>
        </div>
      </div>

      {/* ===================== TABLA ===================== */}
      <div className="ops-card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
              <th className="px-6 py-4 font-semibold">Nombre</th>
              <th className="px-6 py-4 font-semibold">Usuario (login)</th>
              <th className="px-6 py-4 font-semibold">Rol</th>
              <th className="px-6 py-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-stone-400">
                  Cargando empleados...
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-stone-400">
                  Todavía no hay empleados registrados.
                </td>
              </tr>
            ) : (
              usuarios.map((usuario) => (
                <tr
                  key={usuario.id_usuario}
                  className={`border-t border-stone-100 ${usuario.activo ? '' : 'opacity-50'}`}
                >
                  <td className="px-6 py-4 font-medium text-stone-800">
                    {usuario.nombre_completo || <span className="text-stone-400 italic">Sin nombre</span>}
                  </td>
                  <td className="px-6 py-4 text-stone-600">{usuario.username}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${BADGE_ROL[usuario.rol] || 'bg-stone-100 text-stone-600'}`}>
                      {TEXTO_ROL[usuario.rol] || usuario.rol}
                    </span>
                    {!usuario.activo && (
                      <span className="ml-2 inline-block px-3 py-1 rounded-full text-xs font-semibold bg-stone-200 text-stone-500">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => abrirModalEditar(usuario)}
                      className={`inline-flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold px-3 py-1.5 rounded-lg text-sm ${kowalski}`}
                    >
                      <Pencil size={13} /> Editar
                    </button>
                    <button
                      onClick={() => alternarActivo(usuario)}
                      className={`inline-flex items-center gap-1.5 font-semibold px-3 py-1.5 rounded-lg text-sm ${kowalski} ${
                        usuario.activo
                          ? 'bg-[var(--ops-danger-soft)] text-[var(--ops-danger)] hover:opacity-90'
                          : 'bg-[var(--ops-success-soft)] text-[var(--ops-success)] hover:opacity-90'
                      }`}
                    >
                      {usuario.activo ? <><Lock size={13} /> Desactivar</> : <><Unlock size={13} /> Reactivar</>}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ===================== MODAL CREAR/EDITAR ===================== */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={cerrarModal}
        >
          <form
            onSubmit={guardarUsuario}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
          >
            <h2 style={{ fontFamily: 'var(--ops-font-display)' }} className="text-xl font-bold text-stone-800 mb-6">
              {usuarioEditando ? 'Editar empleado' : 'Nuevo empleado'}
            </h2>

            <label className="ops-label">Nombre completo</label>
            <input
              value={form.nombre_completo}
              onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
              placeholder="Ej. María Pérez"
              className="ops-input mb-4"
            />

            <label className="ops-label">Nombre de usuario</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="ej. mperez"
              disabled={!!usuarioEditando}
              required={!usuarioEditando}
              className="ops-input mb-4 disabled:bg-stone-100 disabled:text-stone-400"
            />

            <label className="ops-label">
              Contraseña {usuarioEditando && <span className="text-stone-400 font-normal">(dejar en blanco para no cambiarla)</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={usuarioEditando ? '••••••••' : 'Mínimo 6 caracteres'}
              required={!usuarioEditando}
              className="ops-input mb-4"
            />

            <label className="ops-label">Rol</label>
            <select
              value={form.rol}
              onChange={(e) => setForm({ ...form, rol: e.target.value })}
              className="ops-input mb-6"
            >
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>{r.texto}</option>
              ))}
            </select>

            {error && <p style={{ color: 'var(--ops-danger)' }} className="text-sm mb-4">{error}</p>}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cerrarModal}
                className={`ops-btn ops-btn--muted ${kowalski}`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className={`ops-btn ops-btn--primary ${kowalski}`}
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default GestionEmpleados;
