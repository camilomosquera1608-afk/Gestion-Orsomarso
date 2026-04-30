'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { ACCESS_LEVEL_LABELS, CATEGORY_SCOPE_LABELS, ROLE_LABELS, type AccessLevel, type CategoryScope, type PlatformRole, type UserProfile } from '@/lib/access-control';
import { getStaffSession } from '@/lib/auth';
import { fetchAuditLogsDetailed, fetchProfiles, updateProfileAccess, type AuditLogRow } from '@/lib/supabase';

const roleOptions: PlatformRole[] = ['admin', 'category_admin', 'director', 'preparador', 'medico', 'analista', 'valorador', 'solo_lectura'];
const categoryOptions: CategoryScope[] = ['ALL', 'Sub15', 'Sub17', 'Sub20'];
const accessOptions: AccessLevel[] = ['full', 'write', 'read'];

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatShortDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const moduleLabel = (value?: string | null) => String(value ?? '-').replace(/_/g, ' ');

const actionLabel = (action: string) => {
  const value = action.toLowerCase();
  if (value.includes('insert') || value.includes('create')) return 'Creó';
  if (value.includes('update')) return 'Editó';
  if (value.includes('delete')) return 'Eliminó';
  return action;
};

const roleTone = (role: PlatformRole): 'blue' | 'neutral' | 'green' => role === 'admin' ? 'blue' : role === 'solo_lectura' ? 'neutral' : 'green';

export default function AdministracionPage() {
  const session = getStaffSession();
  const isAdmin = session.platformRole === 'admin' && session.accessLevel === 'full';
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [auditUserFilter, setAuditUserFilter] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    const [profilesResult, logsResult] = await Promise.all([fetchProfiles(), fetchAuditLogsDetailed(30)]);
    if (profilesResult.ok) setProfiles(profilesResult.profiles);
    else setError(profilesResult.reason ?? 'No se pudieron cargar usuarios.');
    if (logsResult.ok) setLogs(logsResult.logs);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) void loadData();
  }, [isAdmin]);

  const stats = useMemo(() => {
    const active = profiles.filter((profile) => profile.isActive).length;
    const admins = profiles.filter((profile) => profile.role === 'admin').length;
    const categoryAdmins = profiles.filter((profile) => profile.role === 'category_admin').length;
    return { active, admins, categoryAdmins };
  }, [profiles]);

  const filteredLogs = useMemo(() => logs.filter((log) => {
    const user = (log.actor_email ?? 'Sistema').toLowerCase();
    const module = moduleLabel(log.table_name).toLowerCase();
    const action = log.action.toLowerCase();
    return (!auditUserFilter || user.includes(auditUserFilter.toLowerCase()))
      && (!auditModuleFilter || module.includes(auditModuleFilter.toLowerCase()))
      && (!auditActionFilter || action.includes(auditActionFilter.toLowerCase()));
  }), [logs, auditUserFilter, auditModuleFilter, auditActionFilter]);

  const visibleLogs = showAllLogs ? filteredLogs : filteredLogs.slice(0, 5);

  const updateProfile = async (profile: UserProfile, patch: Partial<UserProfile>) => {
    const next = { ...profile, ...patch };
    setProfiles((prev) => prev.map((item) => (item.id === profile.id ? next : item)));
    setMessage('Guardando...');
    const result = await updateProfileAccess({
      id: next.id,
      fullName: next.fullName,
      role: next.role,
      categoryScope: next.categoryScope,
      accessLevel: next.accessLevel,
      isActive: next.isActive,
    });
    if (!result.ok) {
      setError(result.reason ?? 'No se pudo actualizar el perfil.');
      setMessage('');
      await loadData();
      return;
    }
    setMessage('Guardado.');
    const logsResult = await fetchAuditLogsDetailed(30);
    if (logsResult.ok) setLogs(logsResult.logs);
  };

  if (!isAdmin) {
    return (
      <div className="grid">
        <AppHero title="Administración" subtitle="Usuarios y auditoría." />
        <div className="card">
          <EmptyState icon="shield" title="Acceso restringido" text="Solo administradores." />
        </div>
      </div>
    );
  }

  return (
    <div className="grid">
      <AppHero title="Administración" subtitle="Usuarios, permisos y auditoría." />

      <div className="grid grid-3">
        <div className="card compact-card"><SectionHeader eyebrow="Usuarios" title={String(profiles.length)} subtitle="Perfiles" /></div>
        <div className="card compact-card"><SectionHeader eyebrow="Activos" title={String(stats.active)} subtitle="Con acceso" /></div>
        <div className="card compact-card"><SectionHeader eyebrow="Administradores" title={String(stats.admins + stats.categoryAdmins)} subtitle="General y categoría" /></div>
      </div>

      <div className="card">
        <SectionHeader
          eyebrow="Accesos"
          title="Usuarios"
          action={<button type="button" className="btn secondary" onClick={() => void loadData()}>{loading ? 'Cargando...' : 'Actualizar'}</button>}
        />
        {error ? <div className="empty admin-message admin-error">{error}</div> : null}
        {message ? <div className="empty admin-message">{message}</div> : null}
        <div className="table-wrap">
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Alcance</th>
                <th>Permiso</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td><strong>{profile.email}</strong></td>
                  <td>
                    <input
                      className="input admin-input"
                      value={profile.fullName ?? ''}
                      placeholder="Nombre"
                      onChange={(event) => setProfiles((prev) => prev.map((item) => item.id === profile.id ? { ...item, fullName: event.target.value } : item))}
                      onBlur={(event) => void updateProfile(profile, { fullName: event.target.value })}
                    />
                  </td>
                  <td>
                    <select className="input admin-input" value={profile.role} onChange={(event) => void updateProfile(profile, { role: event.target.value as PlatformRole })}>
                      {roleOptions.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="input admin-input" value={profile.categoryScope} onChange={(event) => void updateProfile(profile, { categoryScope: event.target.value as CategoryScope })}>
                      {categoryOptions.map((category) => <option key={category} value={category}>{CATEGORY_SCOPE_LABELS[category]}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="input admin-input" value={profile.accessLevel} onChange={(event) => void updateProfile(profile, { accessLevel: event.target.value as AccessLevel })}>
                      {accessOptions.map((level) => <option key={level} value={level}>{ACCESS_LEVEL_LABELS[level]}</option>)}
                    </select>
                  </td>
                  <td>
                    <button type="button" className="button-plain" onClick={() => void updateProfile(profile, { isActive: !profile.isActive })}>
                      <StatusBadge text={profile.isActive ? 'Activo' : 'Inactivo'} tone={profile.isActive ? roleTone(profile.role) : 'red'} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!profiles.length && !loading ? <EmptyState title="Sin perfiles" text="Crea usuarios en Supabase Auth." /> : null}
      </div>

      <div className="card audit-compact-card">
        <SectionHeader
          eyebrow="Auditoría"
          title="Últimos cambios"
          action={<button type="button" className="btn secondary btn-compact" onClick={() => setShowAllLogs((value) => !value)}>{showAllLogs ? 'Contraer' : 'Ver historial'}</button>}
        />
        <div className="audit-filter-row">
          <input className="input admin-input" placeholder="Usuario" value={auditUserFilter} onChange={(event) => setAuditUserFilter(event.target.value)} />
          <input className="input admin-input" placeholder="Módulo" value={auditModuleFilter} onChange={(event) => setAuditModuleFilter(event.target.value)} />
          <select className="input admin-input" value={auditActionFilter} onChange={(event) => setAuditActionFilter(event.target.value)}>
            <option value="">Acción</option>
            <option value="insert">Creó</option>
            <option value="update">Editó</option>
            <option value="delete">Eliminó</option>
          </select>
        </div>
        {visibleLogs.length ? (
          <div className="audit-mini-list">
            {visibleLogs.map((log) => (
              <div className="audit-mini-row" key={log.id}>
                <span>{formatShortDate(log.created_at)}</span>
                <strong>{log.actor_email ?? 'Sistema'}</strong>
                <em>{moduleLabel(log.table_name)}</em>
                <StatusBadge text={actionLabel(log.action)} tone="neutral" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin cambios" text="La actividad aparecerá aquí." />
        )}
        {showAllLogs && filteredLogs.length ? (
          <div className="table-wrap audit-full-table-wrap">
            <table className="data-table admin-table audit-table-compact">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Módulo</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.created_at)}</td>
                    <td>{log.actor_email ?? 'Sistema'}</td>
                    <td>{actionLabel(log.action)}</td>
                    <td>{moduleLabel(log.table_name)}</td>
                    <td>{log.record_label ?? log.record_id ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
