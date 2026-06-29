// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// 📦 Importación de Pantallas
import Kiosko from './Kiosko';
import MonitorCocina from './MonitorCocina';
import PantallaTurnos from './PantallaTurnos';
import Caja from './caja';
import AdminDashboard from './AdminDashboard';
import Login from './Login';
import AccesoDenegado from './AccesoDenegado';
import RutaProtegida from './RutaProtegida';
import { AuthProvider, useAuth } from './context/AuthContext';

// 🔒 Si hay sesión de empleado/admin, muestra quién es y un botón de salir;
// si no, un enlace a /login. El Kiosko y la Pantalla de Turnos son públicos
// y no dependen de esto.
function SesionBarra() {
  const { usuario, logout } = useAuth();
  const linkStyle = { color: '#f8fafc', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.95rem' };

  if (!usuario) {
    return <Link to="/login" style={linkStyle}>🔒 Iniciar sesión</Link>;
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#f8fafc' }}>
      <span style={{ fontSize: '0.9rem' }}>👤 {usuario.username} ({usuario.rol})</span>
      <button
        onClick={logout}
        style={{ background: '#7d1620', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 'bold', cursor: 'pointer' }}
      >
        Salir
      </button>
    </span>
  );
}

function App() {
  // 🎨 Estilos reutilizables para los botones del menú superior
  const linkStyle = {
    color: '#f8fafc', // Blanco hueso
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '1rem',
  };

  const adminStyle = {
    ...linkStyle,
    color: '#10b981', // Verde esmeralda para módulos administrativos
  };

  return (
    <Router>
      <AuthProvider>
        {/* Barra de navegación técnica (Simulador de múltiples terminales) */}
        <nav style={{
          background: '#1e293b',
          padding: '15px',
          display: 'flex',
          gap: '25px',
          justifyContent: 'center',
          alignItems: 'center',
          borderBottom: '3px solid #334155',
          flexWrap: 'wrap'
        }}>
          <Link to="/" style={linkStyle}>📱 Vista Kiosko</Link>
          <Link to="/cocina" style={linkStyle}>👨‍🍳 Monitor Cocina</Link>
          <Link to="/turnos" style={linkStyle}>📺 Pantalla Turnos</Link>
          <Link to="/caja" style={adminStyle}>💵 Caja / Cobros</Link>
          <Link to="/AdminDashboard" style={adminStyle}>⚙️ Administración</Link>
          <SesionBarra />
        </nav>

        {/* Enrutador de Componentes */}
        <Routes>
          {/* Entorno interactivo del comensal: público, sin login */}
          <Route path="/" element={<Kiosko />} />

          {/* Pantalla pública de visualización: público, sin login */}
          <Route path="/turnos" element={<PantallaTurnos />} />

          {/* Login de personal */}
          <Route path="/login" element={<Login />} />
          <Route path="/acceso-denegado" element={<AccesoDenegado />} />

          {/* Terminal secundaria del cocinero: empleado o administrador */}
          <Route
            path="/cocina"
            element={
              <RutaProtegida rolesPermitidos={['empleado', 'administrador']}>
                <MonitorCocina />
              </RutaProtegida>
            }
          />

          {/* Terminal del cajero: empleado o administrador */}
          <Route
            path="/caja"
            element={
              <RutaProtegida rolesPermitidos={['empleado', 'administrador']}>
                <Caja />
              </RutaProtegida>
            }
          />

          {/* Panel de control: exclusivo del administrador */}
          <Route
            path="/AdminDashboard"
            element={
              <RutaProtegida rolesPermitidos={['administrador']}>
                <AdminDashboard />
              </RutaProtegida>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
