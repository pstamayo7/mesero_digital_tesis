import { Link } from 'react-router-dom';

function AccesoDenegado() {
  return (
    <div style={{ textAlign: 'center', marginTop: 100, fontFamily: 'sans-serif' }}>
      <h1>🚫 Acceso denegado</h1>
      <p>Tu usuario no tiene permisos para ver esta sección.</p>
      <Link to="/" style={{ color: '#7d1620', fontWeight: 'bold' }}>Volver al inicio</Link>
    </div>
  );
}

export default AccesoDenegado;
