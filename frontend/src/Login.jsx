import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import './OpsTheme.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destinoOriginal = location.state?.from || '/';

  const manejarSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await login(username, password);
      navigate(destinoOriginal, { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="ops-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="ops-card" style={{ width: '100%', maxWidth: 380, padding: '40px 36px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 30 }}>
          <img src="/logo.png" alt="Doña Zita" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--ops-border)', marginBottom: 16 }} />
          <h1 style={{ fontFamily: 'var(--ops-font-display)', fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--ops-ink)' }}>
            Doña Zita
          </h1>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--ops-ink-soft)', marginTop: 4 }}>
            Acceso de Personal
          </span>
        </div>

        <form onSubmit={manejarSubmit}>
          <label className="ops-label" htmlFor="login-usuario">Usuario</label>
          <div style={{ position: 'relative', marginBottom: 18 }}>
            <User size={17} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ops-ink-soft)' }} />
            <input
              id="login-usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nombre de usuario"
              autoFocus
              className="ops-input"
              style={{ paddingLeft: 38 }}
            />
          </div>

          <label className="ops-label" htmlFor="login-password">Contraseña</label>
          <div style={{ position: 'relative', marginBottom: 22 }}>
            <Lock size={17} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ops-ink-soft)' }} />
            <input
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="ops-input"
              style={{ paddingLeft: 38 }}
            />
          </div>

          {error && (
            <p style={{ color: 'var(--ops-danger)', fontSize: 13.5, marginTop: -10, marginBottom: 16 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={cargando || !username.trim() || !password.trim()}
            className="ops-btn ops-btn--primary"
            style={{ width: '100%', padding: '12px 18px' }}
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
