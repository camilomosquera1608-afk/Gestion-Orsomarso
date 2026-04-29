'use client';

import { useMemo, useState } from 'react';
import { LogIn, Mail, ShieldCheck } from 'lucide-react';
import { createSupabaseStaffSession, loginStaff, STAFF_CREDENTIALS } from '@/lib/auth';
import type { ClubCategory } from '@/lib/types';
import { hasSupabaseConfig, sendSupabasePasswordReset, signInSupabase, tableSchemaSyncEnabled } from '@/lib/supabase';

const accessList = Object.values(STAFF_CREDENTIALS);
type WorkScope = ClubCategory | 'all';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState<WorkScope>('Sub20');
  const [demoUser, setDemoUser] = useState('');
  const [demoPassword, setDemoPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  const quickAccess = useMemo(() => accessList.filter((item) => item.display !== 'Dirección'), []);
  const localDemoAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO_AUTH === 'true';
  const remoteAuthReady = hasSupabaseConfig && tableSchemaSyncEnabled;

  const onSupabaseSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!remoteAuthReady) {
      setError('Supabase no está configurado. Revisa las variables de entorno.');
      return;
    }

    const result = await signInSupabase(email, password);
    if (!result.ok) {
      setError(`No se pudo iniciar sesión: ${result.reason}`);
      return;
    }

    createSupabaseStaffSession(result.user?.email ?? email, category);
    window.location.assign(category === 'all' ? '/ejecutivo' : '/');
  };

  const handlePasswordReset = async () => {
    setError('');
    setMessage('');
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
    const result = await sendSupabasePasswordReset(email, redirectTo);
    if (!result.ok) {
      setError(`No se pudo enviar recuperación: ${result.reason}`);
      return;
    }
    setMessage('Correo de recuperación enviado.');
  };

  const onDemoSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const result = loginStaff(demoUser, demoPassword);
    if (!result.ok) {
      setError('Acceso demo no válido.');
      return;
    }
    window.location.assign(result.session.role === 'master' ? '/informes' : '/');
  };

  const fillAccess = (item: (typeof accessList)[number]) => {
    setDemoUser(item.username);
    setDemoPassword(item.password);
    setError('');
  };

  return (
    <main className="login-page">
      <div className="login-card login-card-wide">
        <div className="login-brand">Orsomarso SC Performance</div>
        <h1>Iniciar sesión</h1>
        <p className="login-subtitle">Acceso seguro con correo y contraseña.</p>

        <form onSubmit={onSupabaseSubmit} className="grid">
          <div className="field">
            <label>Correo</label>
            <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@club.com" autoComplete="email" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña" autoComplete="current-password" />
          </div>
          <div className="field">
            <label>Área de trabajo</label>
            <select className="input" value={category} onChange={(event) => setCategory(event.target.value as WorkScope)}>
              <option value="Sub20">U20</option>
              <option value="Sub17">U17</option>
              <option value="Sub15">U15</option>
              <option value="all">Dirección</option>
            </select>
          </div>
          <button className="btn" type="submit"><LogIn size={18} /> Entrar</button>
        </form>

        <div className="btn-row login-actions">
          <button type="button" className="btn secondary" onClick={handlePasswordReset}><Mail size={16} /> Recuperar contraseña</button>
        </div>

        {error ? <div className="login-error">{error}</div> : null}
        {message ? <div className="empty login-message">{message}</div> : null}

        {localDemoAuthEnabled ? (
          <div className="login-access-panel">
            <button type="button" className="quick-access-toggle" onClick={() => setShowDemo((value) => !value)}>
              <ShieldCheck size={16} /> {showDemo ? 'Ocultar modo demo' : 'Usar modo demo local'}
            </button>
            {showDemo ? (
              <div className="grid" style={{ gap: 14 }}>
                <form onSubmit={onDemoSubmit} className="grid grid-2">
                  <div className="field">
                    <label>Usuario demo</label>
                    <input className="input" value={demoUser} onChange={(event) => setDemoUser(event.target.value)} placeholder="Sub20Local" />
                  </div>
                  <div className="field">
                    <label>Contraseña demo</label>
                    <input className="input" type="password" value={demoPassword} onChange={(event) => setDemoPassword(event.target.value)} placeholder="local-sub20" />
                  </div>
                  <button className="btn secondary" type="submit">Entrar en demo</button>
                </form>
                <div className="login-access-grid">
                  {quickAccess.map((item) => (
                    <button key={item.username} type="button" className="quick-access-card" onClick={() => fillAccess(item)}>
                      <span>{item.display}</span>
                      <small>{item.username}</small>
                    </button>
                  ))}
                  <button type="button" className="quick-access-card" onClick={() => fillAccess(STAFF_CREDENTIALS.master)}>
                    <span>Dirección</span>
                    <small>{STAFF_CREDENTIALS.master.username}</small>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="login-footnote">{remoteAuthReady ? 'Supabase activo' : 'Supabase no configurado'}</div>
      </div>
    </main>
  );
}
