'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginStaff, STAFF_CREDENTIALS } from '@/lib/auth';

const examples = Object.values(STAFF_CREDENTIALS);

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = loginStaff(user, password);
    if (!result.ok) {
      setError('Usuario o contraseña incorrectos.');
      return;
    }
    router.push(result.session.role === 'master' ? '/informes' : '/');
  };

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">Orsomarso SC Performance</div>
        <h1>Ingreso por categoría</h1>
        <form onSubmit={onSubmit} className="grid">
          <div className="field">
            <label>Usuario</label>
            <input className="input" value={user} onChange={(e) => setUser(e.target.value)} placeholder="Usuario" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" />
          </div>
          <button className="btn" type="submit">Entrar</button>
        </form>
        {error ? <div className="login-error">{error}</div> : null}
        <div className="mini-stat-card" style={{ marginTop: 18 }}>
          <strong>Accesos creados</strong>
          <div className="muted-line">U15, U17, U20 y Maestro.</div>
        </div>
      </div>
    </main>
  );
}
