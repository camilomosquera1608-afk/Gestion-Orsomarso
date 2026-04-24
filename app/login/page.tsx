'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginStaff } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = loginStaff(user, password);
    if (!ok) {
      setError('Usuario o contraseña incorrectos.');
      return;
    }
    router.push('/');
  };

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">Orsomarso SC</div>
        <h1>Ingreso staff</h1>
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
      </div>
    </main>
  );
}
