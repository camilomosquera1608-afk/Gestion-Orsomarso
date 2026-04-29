'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { loginStaff, STAFF_CREDENTIALS } from '@/lib/auth';
import { tableSchemaSyncEnabled } from '@/lib/supabase';

const accessList = Object.values(STAFF_CREDENTIALS);

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const quickAccess = useMemo(() => accessList.filter((item) => item.display !== 'Maestro'), []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = loginStaff(user, password);
    if (!result.ok) {
      setError('Credenciales no válidas. Usa un acceso de categoría.');
      return;
    }
    router.push(result.session.role === 'master' ? '/informes' : '/');
  };

  const fillAccess = (item: (typeof accessList)[number]) => {
    setUser(item.username);
    setPassword(item.password);
    setError('');
  };

  return (
    <main className="login-page">
      <div className="login-card login-card-wide">
        <div className="login-brand">Orsomarso SC Performance</div>
        <h1>Acceso interno</h1>
        <p className="login-subtitle">Selecciona la categoría de trabajo. La sesión remota de Supabase se gestiona después en Configuración.</p>

        <form onSubmit={onSubmit} className="grid">
          <div className="field">
            <label>Usuario</label>
            <input className="input" value={user} onChange={(e) => setUser(e.target.value)} placeholder="Sub20Local" autoComplete="username" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="local-sub20" autoComplete="current-password" />
          </div>
          <button className="btn" type="submit"><LogIn size={18} /> Entrar</button>
        </form>

        {error ? <div className="login-error">{error}</div> : null}

        <div className="login-access-panel">
          <div>
            <strong>Accesos de categoría</strong>
            <div className="muted-line">Credenciales locales de operación.</div>
          </div>
          <div className="login-access-grid">
            {quickAccess.map((item) => (
              <button key={item.username} type="button" className="quick-access-card" onClick={() => fillAccess(item)}>
                <span>{item.display}</span>
                <small>{item.username}</small>
              </button>
            ))}
            <button type="button" className="quick-access-card" onClick={() => fillAccess(STAFF_CREDENTIALS.master)}>
              <span>Maestro</span>
              <small>{STAFF_CREDENTIALS.master.username}</small>
            </button>
          </div>
        </div>

        {tableSchemaSyncEnabled ? (
          <div className="login-footnote">Supabase activo · sincronización por tablas</div>
        ) : null}
      </div>
    </main>
  );
}
