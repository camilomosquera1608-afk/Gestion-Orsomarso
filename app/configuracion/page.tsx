'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { EmptyState, SectionHeader } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { STAFF_CREDENTIALS, getStaffSession, isMasterRole } from '@/lib/auth';
import { getSupabaseUserEmail, hasSupabaseConfig, sendSupabasePasswordReset, signInSupabase, signOutSupabase, tableSchemaSyncEnabled } from '@/lib/supabase';

const formatDate = (value: string) => new Date(value).toLocaleString('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default function ConfiguracionPage() {
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
  const [supabaseEmail, setSupabaseEmail] = useState('');
  const [supabasePassword, setSupabasePassword] = useState('');
  const [supabaseUser, setSupabaseUser] = useState<string | null>(null);
  const [remoteMessage, setRemoteMessage] = useState('');
  const session = getStaffSession();

  useEffect(() => {
    void getSupabaseUserEmail().then(setSupabaseUser);
  }, []);

  if (isMasterRole(session)) {
    return <div className="grid"><AppHero title="Panel de seguridad local" subtitle="Respaldos, acceso y protección del almacenamiento local." /><EmptyState title="Acceso maestro" text="El usuario maestro no gestiona configuración operativa." /></div>;
  }

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
    setMessage('Respaldo exportado en JSON. Guárdalo fuera del navegador.');
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const raw = await file.text();
    const ok = importAppDataJson(raw);
    setMessage(ok ? 'Datos importados correctamente. Se creó una copia previa antes de importar.' : 'No se pudo importar el archivo. Revisa que sea un respaldo JSON válido.');
  };

  const handleSupabaseSignIn = async () => {
    setRemoteMessage('');
    const result = await signInSupabase(supabaseEmail, supabasePassword);
    if (!result.ok) {
      setRemoteMessage(`No se pudo iniciar sesión: ${result.reason}`);
      return;
    }
    setSupabaseUser(result.user?.email ?? supabaseEmail);
    setSupabasePassword('');
    setRemoteMessage('Sesión remota iniciada. Puedes sincronizar tablas.');
    await forceSync();
  };

  const handleSupabasePasswordReset = async () => {
    setRemoteMessage('');
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
    const result = await sendSupabasePasswordReset(supabaseEmail, redirectTo);
    setRemoteMessage(result.ok ? 'Correo de recuperación enviado. Abre el enlace y cambia la contraseña.' : `No se pudo enviar recuperación: ${result.reason}`);
  };

  const handleSupabaseSignOut = async () => {
    await signOutSupabase();
    setSupabaseUser(null);
    setRemoteMessage('Sesión remota cerrada. La app seguirá en modo local.');
  };

  const handlePullSupabase = async () => {
    await forceSync();
    setRemoteMessage('Datos remotos leídos desde Supabase.');
  };

  const handlePushSupabase = async () => {
    createLocalSnapshot('Copia antes de enviar a Supabase');
    await pushLocalToRemote();
    setRemoteMessage('Datos locales enviados a Supabase por tablas.');
  };

  return (
    <div className="grid">
      <AppHero title="Panel de seguridad local" subtitle="Respaldos, acceso y protección del almacenamiento local." />

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Acceso externo" title="Wellness jugadores" subtitle="Link público para registro individual." />
          <div className="copy-box">
            <div className="copy-link">{shareLink}</div>
            <button type="button" className="btn secondary" onClick={() => navigator.clipboard.writeText(shareLink)}>Copiar link</button>
          </div>
        </div>

        <div className="card">
          <SectionHeader eyebrow="Sistema" title="Estado del backend" subtitle="Modo operativo actual." />
          <div className="grid" style={{ gap: 10 }}>
            <div className="mini-stat-card"><strong>Modo</strong><div className="muted-line">{backendMode === 'supabase' ? 'Supabase remoto' : 'Local seguro'}</div></div>
            <div className="mini-stat-card"><strong>Sincronización</strong><div className="muted-line">{syncStatus}</div></div>
            <div className="mini-stat-card"><strong>Datos actuales</strong><div className="muted-line">{data.players.length} jugadores · {totalRecords} registros</div></div>
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Supabase" title="Conexión segura" subtitle="Sincronización por tablas con RLS." />
        {!hasSupabaseConfig || !tableSchemaSyncEnabled ? (
          <EmptyState title="Supabase desactivado" text="Activa table_schema en .env.local cuando quieras probar la conexión." />
        ) : supabaseUser ? (
          <div className="grid" style={{ gap: 12 }}>
            <div className="mini-stat-card"><strong>Usuario remoto</strong><div className="muted-line">{supabaseUser}</div></div>
            <div className="btn-row">
              <button type="button" className="btn" onClick={handlePushSupabase}>Enviar local a Supabase</button>
              <button type="button" className="btn secondary" onClick={handlePullSupabase}>Leer Supabase</button>
              <button type="button" className="btn secondary" onClick={handleSupabaseSignOut}>Cerrar sesión remota</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-2">
            <label className="field">Email Supabase
              <input value={supabaseEmail} onChange={(event) => setSupabaseEmail(event.target.value)} placeholder="usuario@club.com" />
            </label>
            <label className="field">Contraseña
              <input type="password" value={supabasePassword} onChange={(event) => setSupabasePassword(event.target.value)} placeholder="Contraseña" />
            </label>
            <div className="btn-row">
              <button type="button" className="btn" onClick={handleSupabaseSignIn}>Iniciar sesión remota</button>
              <button type="button" className="btn secondary" onClick={handleSupabasePasswordReset}>Recuperar contraseña</button>
            </div>
          </div>
        )}
        {remoteMessage && <div className="empty" style={{ marginTop: 12 }}>{remoteMessage}</div>}
      </div>

      <div className="card">
        <SectionHeader eyebrow="Respaldos" title="Seguridad de datos local" subtitle="Crea copias antes de probar cambios importantes." />

        <p className="muted-line">
          La app trabaja en modo local por defecto. La sincronización remota usa tablas seguras y requiere sesión de Supabase.
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              createLocalSnapshot('Copia manual desde Configuración');
              setMessage('Copia local creada correctamente.');
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
        <SectionHeader eyebrow="Historial" title="Copias locales recientes" />
        {localBackups.length === 0 ? (
          <EmptyState title="Aún no hay copias locales" text="Crea una copia antes de probar cambios grandes." />
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
                          setMessage(ok ? 'Respaldo restaurado correctamente.' : 'No se pudo restaurar esta copia.');
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

      <div className="card">
        <SectionHeader eyebrow="Usuarios" title="Accesos creados" subtitle="Credenciales operativas locales." />
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
