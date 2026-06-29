// Wrapper de fetch para llamadas que requieren sesión (empleado/administrador).
// El Kiosko y la Pantalla de Turnos son públicos y siguen usando fetch() normal.
//
// - Adjunta automáticamente "Authorization: Bearer <token>" si hay sesión activa.
// - Si el backend responde 401 (token vencido/inválido), dispara un logout
//   automático. AuthProvider se registra a sí mismo vía registrarLogoutGlobal
//   para que esto funcione sin que apiFetch dependa de React.

export const API_BASE = 'http://127.0.0.1:8000';
export const STORAGE_KEY = 'dz_auth';

let logoutGlobal = () => {};

export function registrarLogoutGlobal(fn) {
  logoutGlobal = fn;
}

export function leerSesionGuardada() {
  try {
    const guardado = sessionStorage.getItem(STORAGE_KEY);
    return guardado ? JSON.parse(guardado) : null;
  } catch {
    return null;
  }
}

export async function apiFetch(path, opciones = {}) {
  const sesion = leerSesionGuardada();
  const headers = new Headers(opciones.headers || {});
  if (sesion?.token) {
    headers.set('Authorization', `Bearer ${sesion.token}`);
  }

  const respuesta = await fetch(`${API_BASE}${path}`, { ...opciones, headers });

  if (respuesta.status === 401) {
    logoutGlobal();
  }

  return respuesta;
}
