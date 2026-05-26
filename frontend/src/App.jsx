// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Kiosko from './Kiosko'
import MonitorCocina from './MonitorCocina'

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
      </nav>

      {/* 🚦 Enrutamiento Declarativo de la Aplicación */}
      <Routes>
        {/* Ruta principal: Entorno interactivo del comensal */}
        <Route path="/" element={<Kiosko />} />
        
        {/* Ruta de producción: Terminal secundaria del cocinero */}
        <Route path="/cocina" element={<MonitorCocina />} />
      </Routes>
    </Router>
  )
}

export default App