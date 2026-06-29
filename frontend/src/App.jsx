// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ChefHat, CreditCard, LayoutDashboard, LogOut, MonitorPlay, Smartphone } from 'lucide-react';

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
import './OpsTheme.css';

// 🔒 Barra superior de Operaciones: identidad de marca + navegación entre
// estaciones + sesión activa. Misma barra en TODAS las pantallas (Kiosko,
// Turnos, Cocina, Caja, Administración) para que el sistema se vea uniforme.
function BarraNavegacion() {
  const { usuario, logout } = useAuth();
  const location = useLocation();

  const enlaceEstilo = (ruta) => ({
    display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none',
    fontSize: '0.85rem', fontWeight: 600, padding: '8px 14px', borderRadius: 9,
    color: location.pathname.toLowerCase() === ruta.toLowerCase() ? 'var(--ops-accent-contrast)' : '#cfd1d8',
    backgroundColor: location.pathname.toLowerCase() === ruta.toLowerCase() ? 'var(--ops-accent)' : 'transparent',
    transition: 'background-color 160ms ease, color 160ms ease',
  });

  return (
    <nav style={{
      background: '#15171c', padding: '14px 28px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid #2a2c34',
    }}>
      <div className="ops-brand">
        <img src="/logo.png" alt="Doña Zita" />
        <div className="ops-brand-text" style={{ color: '#f3f1ec' }}>
          <strong style={{ fontSize: '1.05rem' }}>Doña Zita</strong>
          <small style={{ color: '#9a9ca5' }}>Operaciones</small>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Link to="/" style={enlaceEstilo('/')}><Smartphone size={15} /> Kiosko</Link>
        <Link to="/cocina" style={enlaceEstilo('/cocina')}><ChefHat size={15} /> Cocina</Link>
        <Link to="/turnos" style={enlaceEstilo('/turnos')}><MonitorPlay size={15} /> Turnos</Link>
        <Link to="/caja" style={enlaceEstilo('/caja')}><CreditCard size={15} /> Caja</Link>
        <Link to="/AdminDashboard" style={enlaceEstilo('/AdminDashboard')}><LayoutDashboard size={15} /> Administración</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {usuario ? (
          <>
            <span style={{ fontSize: '0.82rem', color: '#9a9ca5' }}>
              {usuario.username} <span style={{ opacity: 0.7 }}>· {usuario.rol}</span>
            </span>
            <button onClick={logout} className="ops-btn ops-btn--ghost" style={{ color: '#cfd1d8', borderColor: '#3a3d48', padding: '7px 14px' }}>
              <LogOut size={14} /> Salir
            </button>
          </>
        ) : (
          <Link to="/login" className="ops-btn ops-btn--primary" style={{ textDecoration: 'none', padding: '7px 16px' }}>
            Iniciar sesión
          </Link>
        )}
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <BarraNavegacion />

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
