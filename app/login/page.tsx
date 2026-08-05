'use client';

import { useEffect, useMemo, useState , type FormEvent } from 'react';
import { LogIn, Mail, ShieldCheck } from 'lucide-react';
import { createSupabaseStaffSessionFromProfile, loginStaff, loginStaffEmergency, STAFF_CREDENTIALS } from '@/lib/auth';
import { fetchCurrentUserProfile, hasSupabaseConfig, sendSupabasePasswordReset, signInSupabase, tableSchemaSyncEnabled } from '@/lib/supabase';

const accessList = Object.values(STAFF_CREDENTIALS);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoUser, setDemoUser] = useState('');
  const [demoPassword, setDemoPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  const quickAccess = useMemo(() => accessList.filter((item) => item.display !== 'Dirección'), []);
  const remoteAuthReady = hasSupabaseConfig && tableSchemaSyncEnabled;
  // FIX: Habilitar modo demo local cuando Supabase no está disponible, tiene problemas de rendimiento o hay errores
  // También habilitar automáticamente cuando Supabase está desconectado
  const localDemoAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO_AUTH === 'true' || !hasSupabaseConfig || !remoteAuthReady;
  
  // FIX: Mostrar automáticamente el modo demo si Supabase no está disponible
  useEffect(() => {
    if (!remoteAuthReady && !showDemo) {
      setShowDemo(true);
    }
  }, [remoteAuthReady, showDemo]);

  const handleQuickLogin = (user: string, pass: string) => {
    setError('');
    setMessage('');
    const result = loginStaffEmergency(user, pass);
    if (result.ok) {
      window.location.assign(result.session.role === 'master' ? '/informes/jugador-periodo' : '/');
    } else {
      setError('Acceso demo no válido.');
    }
  };

  const onSupabaseSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!remoteAuthReady) {
      // Si Supabase no está configurado, intentar login local inteligente
      const emergencyResult = loginStaffEmergency(email, password);
      if (emergencyResult.ok) {
        window.location.assign(emergencyResult.session.role === 'master' ? '/informes/jugador-periodo' : '/');
        return;
      }
      setError('Supabase no está configurado. Usa los accesos directos de abajo.');
      setShowDemo(true);
      return;
    }

    const result = await signInSupabase(email, password);
    if (!result.ok) {
      const errorMessage = result.reason || 'Error desconocido de conexión';
      
      // FIX: Si Supabase falla por problemas de red o conexión (Failed to fetch), intentar fallback local
      const emergencyResult = loginStaffEmergency(email, password);
      if (emergencyResult.ok) {
        window.location.assign(emergencyResult.session.role === 'master' ? '/informes/jugador-periodo' : '/');
        return;
      }

      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('fetch') || errorMessage.includes('Timeout') || (result.status && result.status >= 500)) {
        setError('Servidor Supabase no disponible (Failed to fetch). Usa los botones de acceso directo de abajo.');
        setShowDemo(true);
        return;
      }
      setError(`No se pudo iniciar sesión: ${errorMessage}`);
      return;
    }

    const profileResult = await fetchCurrentUserProfile();
    if (!profileResult.ok) {
      setError(profileResult.reason ?? 'Tu usuario no tiene perfil asignado.');
      return;
    }

    const session = createSupabaseStaffSessionFromProfile(profileResult.profile);
    window.location.assign(session.category === 'all' ? '/ejecutivo' : '/');
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

  const onDemoSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const result = loginStaffEmergency(demoUser, demoPassword);
    if (!result.ok) {
      setError('Acceso demo no válido.');
      return;
    }
    window.location.assign(result.session.role === 'master' ? '/informes/jugador-periodo' : '/');
  };

  const fillAccess = (item: (typeof accessList)[number]) => {
    handleQuickLogin(item.username, item.password);
  };

  return (
    <main className="login-page">
      {/* Left side — brand */}
      <div className="login-left">
        <div className="login-crest">
          <img src="/orsomarso-crest.jpg" alt="Orsomarso SC" />
        </div>
        <div className="login-club-name">Orsomarso SC</div>
        <div className="login-club-sub">Performance Hub</div>
        <div className="login-season">Temporada 2026 · Departamento de Rendimiento</div>
      </div>

      {/* Right side — form */}
      <div className="login-right">
        <div className="login-right-inner">
          <div className="login-right-header">
            <div className="login-brand">Orsomarso Performance</div>
            <h1 className="login-right-title">Iniciar sesión</h1>
            <p className="login-right-sub">Acceso exclusivo del staff autorizado.</p>
          </div>

        <form onSubmit={onSupabaseSubmit} className="grid">
          <div className="field">
            <label>Correo / Usuario</label>
            <input className="input" type="text" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@club.com o Sub17Local" autoComplete="username" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña" autoComplete="current-password" />
          </div>
          <button className="btn" type="submit"><LogIn size={18} /> Entrar</button>
        </form>

        <div className="btn-row login-actions">
          <button type="button" className="btn secondary" onClick={handlePasswordReset}><Mail size={16} /> Recuperar contraseña</button>
        </div>

        {error ? <div className="login-error">{error}</div> : null}
        {message ? <div className="empty login-message">{message}</div> : null}

        <div className="login-access-panel" style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 10 }}>
            ⚡ Acceso Directo de Emergencia (1-Clic):
          </div>
          <div className="login-access-grid">
            {quickAccess.map((item) => (
              <button key={item.username} type="button" className="quick-access-card" onClick={() => fillAccess(item)}>
                <span>{item.display}</span>
                <small>{item.username}</small>
              </button>
            ))}
            <button type="button" className="quick-access-card" onClick={() => handleQuickLogin(STAFF_CREDENTIALS.master.username, STAFF_CREDENTIALS.master.password)}>
              <span>Dirección</span>
              <small>{STAFF_CREDENTIALS.master.username}</small>
            </button>
          </div>
        </div>

        {localDemoAuthEnabled ? (
          <div className="login-access-panel" style={{ marginTop: 14 }}>
            <button type="button" className="quick-access-toggle" onClick={() => setShowDemo((value) => !value)}>
              <ShieldCheck size={16} /> {showDemo ? 'Ocultar formulario manual demo' : 'Formulario manual demo'}
            </button>
            {showDemo ? (
              <div className="grid" style={{ gap: 14, marginTop: 10 }}>
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
              </div>
            ) : null}
          </div>
        ) : null}

          <div className="login-footnote">{remoteAuthReady ? 'Acceso remoto activo (Con fallback local)' : 'Modo local activo'}</div>
        </div>
      </div>
    </main>
  );
}
