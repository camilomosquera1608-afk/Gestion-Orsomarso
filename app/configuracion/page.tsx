'use client';

import { AppHero } from '@/components/app-hero';
import { useApp } from '@/context/app-context';
import { STAFF_CREDENTIALS, getStaffSession, isMasterRole } from '@/lib/auth';

export default function ConfiguracionPage() {
  const { backendMode, syncStatus } = useApp();
  const session = getStaffSession();
  if (isMasterRole(session)) {
    return <div className="grid"><AppHero title="Configuración" /><div className="empty">El usuario maestro no gestiona configuración operativa.</div></div>;
  }
  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}/wellness-jugadores` : '/wellness-jugadores';

  return (
    <div className="grid">
      <AppHero title="Configuración" />
      <div className="grid grid-2">
        <div className="card">
          <h3>Wellness jugadores</h3>
          <div className="copy-box">
            <div className="copy-link">{shareLink}</div>
            <button type="button" className="btn secondary" onClick={() => navigator.clipboard.writeText(shareLink)}>Copiar link</button>
          </div>
        </div>
        <div className="card">
          <h3>Estado del backend</h3>
          <div className="grid" style={{ gap: 10 }}>
            <div className="mini-stat-card"><strong>Modo</strong><div className="muted-line">{backendMode === 'supabase' ? 'Supabase' : 'Local'}</div></div>
            <div className="mini-stat-card"><strong>Sincronización</strong><div className="muted-line">{syncStatus}</div></div>
          </div>
        </div>
      </div>
      <div className="card">
        <h3>Accesos creados</h3>
        <div className="grid grid-2">
          {Object.values(STAFF_CREDENTIALS).map((item) => (
            <div key={item.username} className="mini-stat-card">
              <strong>{item.display}</strong>
              <div className="muted-line">Usuario: {item.username}</div>
              <div className="muted-line">Contraseña: {item.password}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
