'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHero } from '@/components/app-hero';
import { EmptyState, SectionHeader } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, logoutStaff } from '@/lib/auth';
import { CATEGORY_SCOPE_LABELS, ROLE_LABELS } from '@/lib/access-control';
import { categoryLabel } from '@/lib/labels';
import type { ClubCategory } from '@/lib/types';
import { getCategoryReadinessChecks, getCategoryReadinessSummary, getDataTotals, getDuplicateChecks, getOverallDataQuality, qualityLabel, qualityToneClass } from '@/lib/data-quality';
import { fetchAuditLogs, getSupabaseUserEmail, hasSupabaseConfig, signOutSupabase, tableSchemaSyncEnabled } from '@/lib/supabase';
import { getLocalStorageUsageKb, getLocalStorageWarning } from '@/lib/app-storage';

const formatDate = (value: string) => new Date(value).toLocaleString('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const categories: ClubCategory[] = ['Sub20', 'Sub17', 'Sub15'];

const categoryFromScope = (scope?: string): ClubCategory => {
  if (scope === 'U15') return 'Sub15';
  if (scope === 'U17') return 'Sub17';
  if (scope === 'U20') return 'Sub20';
  return 'Sub20';
};

export default function ConfiguracionPage() {
  const router = useRouter();
  const {
    backendMode,
    syncStatus,
    data,
    filters,
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
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const session = getStaffSession();
  const [safePointCategory, setSafePointCategory] = useState<ClubCategory>(categoryFromScope(session.categoryScope));

  useEffect(() => {
    void getSupabaseUserEmail().then(setSupabaseUser);
    void fetchAuditLogs(30).then((result) => { if (result.ok) setAuditLogs(result.logs); });
  }, []);

  useEffect(() => {
    if (filters.category === 'Sub20' || filters.category === 'Sub17' || filters.category === 'Sub15') {
      setSafePointCategory(filters.category);
    }
  }, [filters.category]);

  const wellnessOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const wellnessLinks = [
    { category: 'Sub20' as ClubCategory, href: `${wellnessOrigin}/wellness/u20`, label: 'Wellness U20' },
    { category: 'Sub17' as ClubCategory, href: `${wellnessOrigin}/wellness/u17`, label: 'Wellness U17' },
    { category: 'Sub15' as ClubCategory, href: `${wellnessOrigin}/wellness/u15`, label: 'Wellness U15' },
  ];
  const readinessChecks = getCategoryReadinessChecks(data, safePointCategory);
  const duplicateChecks = getDuplicateChecks(data);
  const duplicateStatus = getOverallDataQuality(duplicateChecks);
  const dataTotals = getDataTotals(data);
  const categorySummary = getCategoryReadinessSummary(data, safePointCategory);
  const selectedCategoryLabel = categoryLabel(safePointCategory);
  const qualityStatus = getOverallDataQuality(readinessChecks);
  const safePointLabel = `Punto seguro antes de carga ${selectedCategoryLabel} · ${new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}`;
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
      <AppHero title="Configuración" subtitle="Cuenta y respaldos." />

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Cuenta" title="Usuario" />
          <div className="grid" style={{ gap: 10 }}>
            <div className="mini-stat-card"><strong>Correo</strong><div className="muted-line">{supabaseUser ?? session.email ?? 'No disponible'}</div></div>
            <div className="mini-stat-card"><strong>Área</strong><div className="muted-line">{session.displayName || 'Sin área'}</div></div>
            <div className="mini-stat-card"><strong>Rol</strong><div className="muted-line">{session.platformRole ? ROLE_LABELS[session.platformRole] : 'No asignado'}</div></div>
            <div className="mini-stat-card"><strong>Alcance</strong><div className="muted-line">{session.categoryScope ? CATEGORY_SCOPE_LABELS[session.categoryScope] : 'No asignado'} · {session.accessLevel === 'read' ? 'Solo lectura' : 'Edición completa'}</div></div>
            <button type="button" className="btn secondary" onClick={handleSupabaseSignOut}>Cerrar sesión</button>
          </div>
        </div>

        <div className="card">
          <SectionHeader eyebrow="Sistema" title="Estado" />
          <div className="grid" style={{ gap: 10 }}>
            <div className="mini-stat-card"><strong>Modo</strong><div className="muted-line">{backendMode === 'supabase' ? 'Supabase' : 'Local'}</div></div>
            <div className="mini-stat-card"><strong>Sincronización</strong><div className="muted-line">{syncStatus}</div></div>
            {(() => {
              const usage = getLocalStorageUsageKb();
              const warn = getLocalStorageWarning();
              return (
                <div className="mini-stat-card">
                  <strong>Almacenamiento local</strong>
                  <div className={`storage-bar-wrap storage-bar-${warn}`}>
                    <div className="storage-bar-track"><div className="storage-bar-fill" style={{ width: `${usage.pct}%` }} /></div>
                    <div className="muted-line">{usage.usedKb} KB / {usage.totalKb} KB ({usage.pct}%)</div>
                  </div>
                  {warn !== 'ok' && <div style={{ color: warn === 'danger' ? 'var(--red)' : 'var(--amber)', fontSize: 12, fontWeight: 800, marginTop: 4 }}>{warn === 'danger' ? '⚠ Almacenamiento casi lleno — haz backup y borra respaldos antiguos' : 'Almacenamiento al 60% — considera exportar un backup'}</div>}
                </div>
              );
            })()}
            <div className="mini-stat-card"><strong>Datos</strong><div className="muted-line">{data.players.length} jugadores · {totalRecords} registros</div></div>
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Supabase" title="Estado" />
        {!hasSupabaseConfig || !tableSchemaSyncEnabled ? (
          <EmptyState title="Supabase desactivado" text="Variables no configuradas." />
        ) : supabaseUser ? (
          <div className="grid" style={{ gap: 12 }}>
            <div className="mini-stat-card"><strong>Sesión activa</strong><div className="muted-line">{supabaseUser}</div></div>
            <div className="btn-row">
              <button type="button" className="btn" onClick={handlePushSupabase}>Enviar a Supabase</button>
              <button type="button" className="btn secondary" onClick={handlePullSupabase}>Leer Supabase</button>
            </div>
          </div>
        ) : (
          <EmptyState title="Sesión no detectada" text="Inicia sesión nuevamente." />
        )}
        {remoteMessage && <div className="empty" style={{ marginTop: 12 }}>{remoteMessage}</div>}
      </div>

      <div className="card backup-control-card">
        <SectionHeader eyebrow="Respaldos" title={`Punto seguro antes de cargar ${selectedCategoryLabel}`} subtitle="Crea una copia manual por categoría y descarga JSON antes de cargar datos reales." />
        <div className="backup-summary-grid">
          <div className="mini-stat-card"><strong>{localBackups.length}</strong><div className="muted-line">copias locales</div></div>
          <div className="mini-stat-card"><strong>{categorySummary.players}</strong><div className="muted-line">jugadores {selectedCategoryLabel}</div></div>
          <div className="mini-stat-card"><strong>{categorySummary.microcycles}</strong><div className="muted-line">microciclos {selectedCategoryLabel}</div></div>
          <div className="mini-stat-card"><strong>{safePointCategory === 'Sub20' ? dataTotals.gpsRecords : 'N/A'}</strong><div className="muted-line">GPS solo U20</div></div>
        </div>
        <div className="backup-category-panel">
          <label className="field">
            <span>Categoría del punto seguro</span>
            <select value={safePointCategory} onChange={(event) => setSafePointCategory(event.target.value as ClubCategory)}>
              {categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
            </select>
          </label>
          <div className="backup-quick-actions">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={safePointCategory === category ? 'btn' : 'btn secondary'}
                onClick={() => setSafePointCategory(category)}
              >
                {categoryLabel(category)}
              </button>
            ))}
          </div>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              createLocalSnapshot(safePointLabel);
              setMessage(`Punto seguro ${selectedCategoryLabel} creado. Exporta JSON para guardar una copia fuera del navegador.`);
            }}
          >
            Crear punto seguro {selectedCategoryLabel}
          </button>
          <button type="button" className="btn secondary" onClick={handleExport}>Descargar JSON completo</button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              createLocalSnapshot(`Copia manual ${selectedCategoryLabel}`);
              setMessage(`Copia local ${selectedCategoryLabel} creada.`);
            }}
          >
            Copia rápida
          </button>
          <label className="btn secondary" style={{ cursor: 'pointer' }}>
            Importar JSON
            <input type="file" accept="application/json,.json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
        {message && <div className="empty" style={{ marginTop: 12 }}>{message}</div>}
      </div>

      <div className="card data-quality-card">
        <SectionHeader eyebrow="Calidad de datos" title={`Checklist ${selectedCategoryLabel}`} subtitle="Validación rápida antes de cargar información real por categoría." />
        <div className={`quality-overview ${qualityToneClass(qualityStatus)}`}>
          <strong>{qualityLabel(qualityStatus)}</strong>
          <span>{qualityStatus === 'ok' ? `Base ${selectedCategoryLabel} lista para cargar con mayor confianza.` : 'Revisa los puntos marcados antes de hacer carga masiva.'}</span>
        </div>
        <div className="quality-check-grid">
          {readinessChecks.map((check) => (
            <div key={check.id} className={`quality-check ${qualityToneClass(check.severity)}`}>
              <div>
                <strong>{check.label}</strong>
                <span>{check.detail}</span>
              </div>
              <em>{qualityLabel(check.severity)}</em>
            </div>
          ))}
        </div>
      </div>

      <div className="card data-quality-card">
        <SectionHeader eyebrow="Control" title="Duplicados y consistencia" subtitle="Revisión operativa para evitar sesiones, partidos, wellness o cargas repetidas." />
        <div className={`quality-overview ${qualityToneClass(duplicateStatus)}`}>
          <strong>{qualityLabel(duplicateStatus)}</strong>
          <span>{duplicateStatus === 'ok' ? 'No se detectan duplicados críticos en los datos actuales.' : 'Revisa estos puntos antes de aplicar restricciones SQL o cargar datos masivos.'}</span>
        </div>
        <div className="quality-check-grid">
          {duplicateChecks.map((check) => (
            <div key={check.id} className={`quality-check ${qualityToneClass(check.severity)}`}>
              <div>
                <strong>{check.label}</strong>
                <span>{check.detail}</span>
              </div>
              <em>{qualityLabel(check.severity)}</em>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Wellness" title="Links por categoría" subtitle="Comparte el enlace correspondiente en cada grupo de WhatsApp." />
        <div className="wellness-links-grid">
          {wellnessLinks.map((link) => (
            <div key={link.href} className="wellness-link-card">
              <div>
                <strong>{link.label}</strong>
                <span>{categoryLabel(link.category)}</span>
              </div>
              <div className="copy-link">{link.href}</div>
              <button type="button" className="btn secondary" onClick={() => navigator.clipboard.writeText(link.href)}>Copiar link</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Auditoría" title="Cambios" />
        {auditLogs.length === 0 ? (
          <EmptyState title="Sin auditoría" text="Sin actividad reciente." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Tabla</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.created_at)}</td>
                    <td>{log.actor_email ?? 'Sistema'}</td>
                    <td>{log.action}</td>
                    <td>{log.table_name}</td>
                    <td>{log.record_label ?? log.record_id ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <SectionHeader eyebrow="Historial" title="Copias locales" />
        {localBackups.length === 0 ? (
          <EmptyState title="Sin copias locales" text="Sin copias disponibles." />
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
                    <td>{backup.playersCount} jugadores · {backup.recordsCount} registros · {backup.microcyclesCount} microciclos · {backup.gpsRecordsCount} GPS · {backup.sizeKb} KB</td>
                    <td>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => {
                          if (!confirm('Antes de restaurar, la app creará una copia del estado actual. ¿Continuar?')) return;
                          const ok = restoreLocalSnapshot(backup.id);
                          setMessage(ok ? 'Respaldo restaurado. Se creó una copia previa del estado actual.' : 'No se pudo restaurar.');
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
