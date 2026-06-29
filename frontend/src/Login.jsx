import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

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
    <div style={{ maxWidth: 360, margin: '90px auto', padding: 28, fontFamily: 'sans-serif', background: '#fff', borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0, color: '#7d1620' }}>🔒 Acceso de personal</h2>
      <form onSubmit={manejarSubmit}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Usuario"
          autoFocus
          style={{ display: 'block', width: '100%', marginBottom: 12, padding: 10, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Contraseña"
          style={{ display: 'block', width: '100%', marginBottom: 12, padding: 10, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
        {error && <p style={{ color: '#b91c1c', fontSize: 14 }}>{error}</p>}
        <button
          type="submit"
          disabled={cargando || !username.trim() || !password.trim()}
          style={{ width: '100%', padding: 12, background: cargando ? '#9ca3af' : '#7d1620', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: cargando ? 'not-allowed' : 'pointer' }}
        >
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}

export default Login;
