import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import './OpsTheme.css';

function AccesoDenegado() {
  return (
    <div className="ops-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="ops-card" style={{ width: '100%', maxWidth: 420, padding: '44px 36px', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'var(--ops-danger-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
        }}>
          <ShieldAlert size={26} color="var(--ops-danger)" />
        </div>
        <h1 style={{ fontFamily: 'var(--ops-font-display)', fontSize: '1.4rem', margin: '0 0 10px', color: 'var(--ops-ink)' }}>
          Acceso denegado
        </h1>
        <p style={{ color: 'var(--ops-ink-soft)', fontSize: '0.95rem', margin: '0 0 24px' }}>
          Tu usuario no tiene permisos para ver esta sección.
        </p>
        <Link to="/" className="ops-btn ops-btn--primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

export default AccesoDenegado;
