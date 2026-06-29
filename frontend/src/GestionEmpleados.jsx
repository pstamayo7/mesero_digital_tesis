import { useEffect, useState } from 'react';
import { apiFetch } from './utils/apiFetch';

const ROLES = [
  { valor: 'empleado', texto: 'Empleado' },
  { valor: 'administrador', texto: 'Administrador' },
];

const BADGE_ROL = {
  administrador: 'bg-red-100 text-red-800',
  empleado: 'bg-blue-100 text-blue-800',
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
        mostrarMensaje(usuarioEditando ? '✅ Empleado actualizado' : '✅ Empleado creado');
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
      mostrarMensaje(usuario.activo ? '🔒 Acceso revocado' : '🔓 Acceso restaurado');
      cargarUsuarios();
    } else {
      const detalle = await res.json().catch(() => null);
      alert(detalle?.detail || `No se pudo ${accion} al empleado.`);
    }
  };

  const kowalski = 'transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-95';

  return (
    <div className="bg-[#fdfbf7] min-h-[60vh] -m-10 p-10 rounded-2xl">
      {/* ===================== CABECERA ===================== */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h1 className="text-3xl font-black text-red-900">Gestión de Personal</h1>
        <div className="flex items-center gap-3">
          {mensaje && (
            <span className="bg-emerald-100 text-emerald-800 font-semibold text-sm px-4 py-2 rounded-full">
              {mensaje}
            </span>
          )}
          <button
            onClick={abrirModalNuevo}
            className={`bg-red-800 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transform-gpu will-change-transform ${kowalski}`}
          >
            ➕ Nuevo Empleado
          </button>
        </div>
      </div>

      {/* ===================== TABLA ===================== */}
      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-stone-50 text-stone-500 text-sm uppercase tracking-wide">
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
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${BADGE_ROL[usuario.rol] || 'bg-stone-100 text-stone-600'}`}>
                      {TEXTO_ROL[usuario.rol] || usuario.rol}
                    </span>
                    {!usuario.activo && (
                      <span className="ml-2 inline-block px-3 py-1 rounded-full text-xs font-bold bg-stone-200 text-stone-500">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => abrirModalEditar(usuario)}
                      className={`bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-3 py-1.5 rounded-lg ${kowalski}`}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => alternarActivo(usuario)}
                      className={`font-semibold px-3 py-1.5 rounded-lg ${kowalski} ${
                        usuario.activo
                          ? 'bg-red-100 hover:bg-red-200 text-red-800'
                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                      }`}
                    >
                      {usuario.activo ? '🔒 Desactivar' : '🔓 Reactivar'}
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
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8"
          >
            <h2 className="text-xl font-black text-red-900 mb-6">
              {usuarioEditando ? 'Editar Empleado' : 'Nuevo Empleado'}
            </h2>

            <label className="block text-sm font-semibold text-stone-600 mb-1">Nombre completo</label>
            <input
              value={form.nombre_completo}
              onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
              placeholder="Ej. María Pérez"
              className="w-full mb-4 px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-red-200"
            />

            <label className="block text-sm font-semibold text-stone-600 mb-1">Nombre de usuario</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="ej. mperez"
              disabled={!!usuarioEditando}
              required={!usuarioEditando}
              className="w-full mb-4 px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:bg-stone-100 disabled:text-stone-400"
            />

            <label className="block text-sm font-semibold text-stone-600 mb-1">
              Contraseña {usuarioEditando && <span className="text-stone-400 font-normal">(dejar en blanco para no cambiarla)</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={usuarioEditando ? '••••••••' : 'Mínimo 6 caracteres'}
              required={!usuarioEditando}
              className="w-full mb-4 px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-red-200"
            />

            <label className="block text-sm font-semibold text-stone-600 mb-1">Rol</label>
            <select
              value={form.rol}
              onChange={(e) => setForm({ ...form, rol: e.target.value })}
              className="w-full mb-6 px-4 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
            >
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>{r.texto}</option>
              ))}
            </select>

            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cerrarModal}
                className={`bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold px-5 py-2.5 rounded-xl ${kowalski}`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className={`bg-red-800 hover:bg-red-700 disabled:bg-stone-400 text-white font-bold px-5 py-2.5 rounded-xl shadow-md ${kowalski}`}
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
