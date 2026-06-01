// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Kiosko from './Kiosko'
import MonitorCocina from './MonitorCocina'
import PantallaTurnos from './PantallaTurnos' 
import Caja from './caja' // 🌟 IMPORTAMOS LA CAJA

function App() {
  return (
    <Router>
      {/* 🧭 Barra de navegación técnica (Utilidad oculta para desarrollo / simulación de terminales) */}
      <nav style={{ background: '#1e293b', padding: '10px', display: 'flex', gap: '20px', justifyContent: 'center', borderBottom: '2px solid #334155' }}>
        <Link to="/" style={{ color: '#f8fafc', textDecoration: 'none', fontWeight: 'bold', fontSize: '1rem' }}>
          📱 Vista Kiosko
        </Link>
        <Link to="/cocina" style={{ color: '#f8fafc', textDecoration: 'none', fontWeight: 'bold', fontSize: '1rem' }}>
          👨‍🍳 Monitor Cocina
        </Link>
        <Link to="/turnos" style={{ color: '#f8fafc', textDecoration: 'none', fontWeight: 'bold', fontSize: '1rem' }}>
          📺 Pantalla Turnos
        </Link>
        {/* 🌟 NUEVO ENLACE PARA LA CAJA */}
        <Link to="/caja" style={{ color: '#10b981', textDecoration: 'none', fontWeight: 'bold', fontSize: '1rem' }}>
          💵 Caja / Cobros
        </Link>
      </nav>

      {/* 🚦 Enrutamiento Declarativo de la Aplicación */}
      <Routes>
        {/* Ruta principal: Entorno interactivo del comensal */}
        <Route path="/" element={<Kiosko />} />
        
        {/* Ruta de producción: Terminal secundaria del cocinero */}
        <Route path="/cocina" element={<MonitorCocina />} />

        {/* Terminal de visualización para los clientes */}
        <Route path="/turnos" element={<PantallaTurnos />} />

        {/* 🌟 NUEVA RUTA: El cajero o administrador */}
        <Route path="/caja" element={<Caja />} />
      </Routes>
    </Router>
  )
}

export default App