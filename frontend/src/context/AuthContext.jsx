import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_BASE, STORAGE_KEY, leerSesionGuardada, registrarLogoutGlobal } from '../utils/apiFetch';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // sesion = { token, usuario: { username, rol } } | null
  const [sesion, setSesion] = useState(leerSesionGuardada);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSesion(null);
  }, []);

  // apiFetch vive fuera del árbol de React: se registra aquí para poder
  // forzar logout cuando el backend responde 401 (token vencido).
  useEffect(() => {
    registrarLogoutGlobal(logout);
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const respuesta = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    if (!respuesta.ok) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    const datos = await respuesta.json();
    const nuevaSesion = { token: datos.access_token, usuario: datos.usuario };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nuevaSesion));
    setSesion(nuevaSesion);
    return nuevaSesion.usuario;
  }, []);

  const value = {
    usuario: sesion?.usuario ?? null,
    token: sesion?.token ?? null,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook acoplado a este contexto
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return contexto;
}
