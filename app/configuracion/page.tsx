'use client';

import { AppHero } from '@/components/app-hero';
import { useApp } from '@/context/app-context';

export default function ConfiguracionPage() {
  const { backendMode, syncStatus } = useApp();
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
        <h3>Pasos de Supabase</h3>
        <div className="grid" style={{ gap: 10 }}>
          <div className="mini-stat-card"><strong>1.</strong><div className="muted-line">Crear proyecto en Supabase.</div></div>
          <div className="mini-stat-card"><strong>2.</strong><div className="muted-line">Ejecutar el archivo <code>supabase/schema.sql</code> en el editor SQL.</div></div>
          <div className="mini-stat-card"><strong>3.</strong><div className="muted-line">Crear archivo <code>.env.local</code> con <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.</div></div>
          <div className="mini-stat-card"><strong>4.</strong><div className="muted-line">Reiniciar la app con <code>npm run dev</code>.</div></div>
        </div>
      </div>
    </div>
  );
}
