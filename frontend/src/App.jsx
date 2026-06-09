// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// 📦 Importación de Pantallas
import Kiosko from './Kiosko';
import MonitorCocina from './MonitorCocina';
import PantallaTurnos from './PantallaTurnos';
import Caja from './caja';
import AdminDashboard from './AdminDashboard';

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
      {/* Barra de navegación técnica (Simulador de múltiples terminales) */}
      <nav style={{
        background: '#1e293b',
        padding: '15px',
        display: 'flex',
        gap: '25px',
        justifyContent: 'center',
        borderBottom: '3px solid #334155',
        flexWrap: 'wrap'
      }}>
        <Link to="/" style={linkStyle}>📱 Vista Kiosko</Link>
        <Link to="/cocina" style={linkStyle}>👨‍🍳 Monitor Cocina</Link>
        <Link to="/turnos" style={linkStyle}>📺 Pantalla Turnos</Link>
        <Link to="/caja" style={adminStyle}>💵 Caja / Cobros</Link>
        <Link to="/AdminDashboard" style={adminStyle}>⚙️ Administración</Link>
      </nav>

      {/* Enrutador de Componentes */}
      <Routes>
        {/* Entorno interactivo del comensal */}
        <Route path="/" element={<Kiosko />} />

        {/* Terminal secundaria del cocinero */}
        <Route path="/cocina" element={<MonitorCocina />} />

        {/* Pantalla pública de visualización */}
        <Route path="/turnos" element={<PantallaTurnos />} />

        {/* Terminal del cajero para cobrar y despachar */}
        <Route path="/caja" element={<Caja />} />

        {/* Panel de control del gerente/administrador */}
        <Route path="/AdminDashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;