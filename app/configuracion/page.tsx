'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHero } from '@/components/app-hero';
import { EmptyState, SectionHeader } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, logoutStaff } from '@/lib/auth';
import { getSupabaseUserEmail, hasSupabaseConfig, signOutSupabase, tableSchemaSyncEnabled } from '@/lib/supabase';

const formatDate = (value: string) => new Date(value).toLocaleString('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default function ConfiguracionPage() {
  const router = useRouter();
  const {
    backendMode,
    syncStatus,
    data,
    localBackups,
    createLocalSnapshot,
    restoreLocalSnapshot,
    importAppDataJson,
    exportAppDataJson,
    forceSync,
    pushLocalToRemote,
  } = useApp();
  const [message, setMessage] = useState('');
  const [supabaseUser, setSupabaseUser] = useState<string | null>(null);
  const [remoteMessage, setRemoteMessage] = useState('');
  const session = getStaffSession();

  useEffect(() => {
    void getSupabaseUserEmail().then(setSupabaseUser);
  }, []);

  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}/wellness-jugadores` : '/wellness-jugadores';
  const totalRecords = data.wellness.length + data.internalLoads.length + data.externalLoads.length + data.cmjRecords.length + data.nutritionRecords.length + data.neuromuscularRecords.length + data.fmsRecords.length + data.competitionRecords.length + data.competitionMatchSummaries.length + data.trainingSessionSummaries.length;

  const handleExport = () => {
    const raw = exportAppDataJson();
    const blob = new Blob([raw], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.href = url;
    link.download = `orsomarso-respaldo-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage('Respaldo exportado.');
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const raw = await file.text();
    const ok = importAppDataJson(raw);
    setMessage(ok ? 'Datos importados.' : 'No se pudo importar el archivo.');
  };

  const handleSupabaseSignOut = async () => {
    await signOutSupabase();
    logoutStaff();
    router.push('/login');
  };

  const handlePullSupabase = async () => {
    await forceSync();
    setRemoteMessage('Datos actualizados desde Supabase.');
  };

  const handlePushSupabase = async () => {
    createLocalSnapshot('Copia antes de enviar a Supabase');
    await pushLocalToRemote();
    setRemoteMessage('Datos enviados a Supabase.');
  };

  return (
    <div className="grid">
      <AppHero title="Configuración" subtitle="Seguridad, sincronización y respaldos." />

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Cuenta" title="Usuario" />
          <div className="grid" style={{ gap: 10 }}>
            <div className="mini-stat-card"><strong>Correo</strong><div className="muted-line">{supabaseUser ?? session.email ?? 'No disponible'}</div></div>
            <div className="mini-stat-card"><strong>Área</strong><div className="muted-line">{session.displayName || 'Sin área'}</div></div>
            <button type="button" className="btn secondary" onClick={handleSupabaseSignOut}>Cerrar sesión</button>
          </div>
        </div>

        <div className="card">
          <SectionHeader eyebrow="Sistema" title="Estado" />
          <div className="grid" style={{ gap: 10 }}>
            <div className="mini-stat-card"><strong>Modo</strong><div className="muted-line">{backendMode === 'supabase' ? 'Supabase' : 'Local'}</div></div>
            <div className="mini-stat-card"><strong>Sincronización</strong><div className="muted-line">{syncStatus}</div></div>
            <div className="mini-stat-card"><strong>Datos</strong><div className="muted-line">{data.players.length} jugadores · {totalRecords} registros</div></div>
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Supabase" title="Sincronización" />
        {!hasSupabaseConfig || !tableSchemaSyncEnabled ? (
          <EmptyState title="Supabase desactivado" text="Revisa las variables de entorno." />
        ) : supabaseUser ? (
          <div className="grid" style={{ gap: 12 }}>
            <div className="mini-stat-card"><strong>Sesión activa</strong><div className="muted-line">{supabaseUser}</div></div>
            <div className="btn-row">
              <button type="button" className="btn" onClick={handlePushSupabase}>Enviar a Supabase</button>
              <button type="button" className="btn secondary" onClick={handlePullSupabase}>Leer Supabase</button>
            </div>
          </div>
        ) : (
          <EmptyState title="Sesión remota no detectada" text="Vuelve a iniciar sesión." />
        )}
        {remoteMessage && <div className="empty" style={{ marginTop: 12 }}>{remoteMessage}</div>}
      </div>

      <div className="card">
        <SectionHeader eyebrow="Respaldos" title="Datos locales" />
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              createLocalSnapshot('Copia manual desde Configuración');
              setMessage('Copia local creada.');
            }}
          >
            Crear copia local
          </button>
          <button type="button" className="btn secondary" onClick={handleExport}>Exportar JSON</button>
          <label className="btn secondary" style={{ cursor: 'pointer' }}>
            Importar JSON
            <input type="file" accept="application/json,.json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
        {message && <div className="empty" style={{ marginTop: 12 }}>{message}</div>}
      </div>

      <div className="card">
        <SectionHeader eyebrow="Wellness" title="Link jugadores" />
        <div className="copy-box">
          <div className="copy-link">{shareLink}</div>
          <button type="button" className="btn secondary" onClick={() => navigator.clipboard.writeText(shareLink)}>Copiar link</button>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Historial" title="Copias locales" />
        {localBackups.length === 0 ? (
          <EmptyState title="Sin copias locales" text="Crea una copia antes de cambios importantes." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Contenido</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {localBackups.slice(0, 12).map((backup) => (
                  <tr key={backup.id}>
                    <td>{formatDate(backup.createdAt)}</td>
                    <td>{backup.label}</td>
                    <td>{backup.playersCount} jugadores · {backup.recordsCount} registros · {backup.sizeKb} KB</td>
                    <td>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => {
                          const ok = restoreLocalSnapshot(backup.id);
                          setMessage(ok ? 'Respaldo restaurado.' : 'No se pudo restaurar.');
                        }}
                      >
                        Restaurar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
