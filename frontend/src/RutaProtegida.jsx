import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Envoltorio de ruta: <RutaProtegida rolesPermitidos={['empleado','administrador']}>
//   <MonitorCocina />
// </RutaProtegida>
//
// - Sin sesión -> redirige a /login (recordando a dónde quería ir).
// - Con sesión pero rol no autorizado -> redirige a /acceso-denegado.
// - El Kiosko y la Pantalla de Turnos NO usan este componente: son públicos.
function RutaProtegida({ rolesPermitidos, children }) {
  const { usuario } = useAuth();
  const location = useLocation();

  if (!usuario) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/acceso-denegado" replace />;
  }

  return children;
}

export default RutaProtegida;
