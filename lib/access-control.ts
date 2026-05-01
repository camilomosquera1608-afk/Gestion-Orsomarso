import type { AppData, ClubCategory } from '@/lib/types';
import type { StaffSession } from '@/lib/auth';

export type PlatformRole = 'admin' | 'category_admin' | 'director' | 'preparador' | 'medico' | 'analista' | 'valorador' | 'solo_lectura';
export type CategoryScope = 'ALL' | 'U15' | 'U17' | 'U20' | ClubCategory;
export type AccessLevel = 'full' | 'write' | 'read';

export type UserProfile = {
  id: string;
  email: string;
  fullName?: string | null;
  role: PlatformRole;
  categoryScope: CategoryScope;
  accessLevel: AccessLevel;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type SessionAccessSnapshot = {
  isAuthenticated: boolean;
  email?: string;
  displayName: string;
  provider?: string;
  rawRole?: string | null;
  normalizedRole: PlatformRole;
  rawScope?: string | null;
  normalizedScope: CategoryScope;
  rawAccessLevel?: string | null;
  normalizedAccessLevel: AccessLevel;
  isMasterSession: boolean;
  canAccessAdmin: boolean;
  canWrite: boolean;
  canReadAll: boolean;
};

export const ROLE_LABELS: Record<PlatformRole, string> = {
  admin: 'Administrador',
  category_admin: 'Administrador de categoría',
  director: 'Dirección',
  preparador: 'Preparador físico',
  medico: 'Área médica',
  analista: 'Analista',
  valorador: 'Valorador',
  solo_lectura: 'Solo lectura',
};

export const CATEGORY_SCOPE_LABELS: Record<CategoryScope, string> = {
  ALL: 'Todas',
  U15: 'U15',
  U17: 'U17',
  U20: 'U20',
  Sub15: 'U15',
  Sub17: 'U17',
  Sub20: 'U20',
};

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  full: 'Edición completa',
  write: 'Edición',
  read: 'Solo lectura',
};

const normalizeTextKey = (value?: string | null) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

export const normalizePlatformRole = (role?: string | null): PlatformRole => {
  const value = normalizeTextKey(role);
  if (['admin', 'administracion', 'administrador', 'administrador_general', 'master', 'maestro', 'super_admin', 'owner'].includes(value)) return 'admin';
  if (['category_admin', 'categoria_admin', 'administrador_de_categoria', 'admin_categoria', 'categoria'].includes(value)) return 'category_admin';
  if (['director', 'direccion', 'director_deportivo'].includes(value)) return 'director';
  if (['preparador', 'preparador_fisico', 'fisio', 'pf'].includes(value)) return 'preparador';
  if (['medico', 'area_medica', 'medicina', 'medical'].includes(value)) return 'medico';
  if (['analista', 'analisis', 'analysis'].includes(value)) return 'analista';
  if (['valorador', 'valoraciones', 'evaluator'].includes(value)) return 'valorador';
  if (['solo_lectura', 'lectura', 'read', 'readonly', 'viewer', 'consulta'].includes(value)) return 'solo_lectura';
  return 'solo_lectura';
};

export const normalizeAccessLevel = (level?: string | null, role?: PlatformRole): AccessLevel => {
  const value = normalizeTextKey(level);
  if (['full', 'edicion_completa', 'completa', 'admin', 'total', 'all'].includes(value)) return 'full';
  if (['write', 'edicion', 'editar', 'escritura', 'editor'].includes(value)) return 'write';
  if (['read', 'solo_lectura', 'lectura', 'viewer', 'readonly', 'consulta'].includes(value)) return 'read';
  if (role === 'solo_lectura') return 'read';
  if (role === 'admin' || role === 'category_admin') return 'full';
  return 'write';
};

export const normalizeCategoryScope = (scope?: string | null): CategoryScope => {
  const value = normalizeTextKey(scope);
  if (['all', 'todo', 'todos', 'todas', 'global', 'general', 'direccion', 'maestro'].includes(value)) return 'ALL';
  if (['u15', 'sub15', 'sub_15', 'sub_15s'].includes(value)) return 'Sub15';
  if (['u17', 'sub17', 'sub_17', 'sub_17s'].includes(value)) return 'Sub17';
  if (['u20', 'sub20', 'sub_20', 'sub_20s'].includes(value)) return 'Sub20';
  return 'Sub20';
};

export const normalizeClubCategory = (category?: string | null): ClubCategory | undefined => {
  const value = normalizeTextKey(category);
  if (['u15', 'sub15', 'sub_15'].includes(value)) return 'Sub15';
  if (['u17', 'sub17', 'sub_17'].includes(value)) return 'Sub17';
  if (['u20', 'sub20', 'sub_20'].includes(value)) return 'Sub20';
  return undefined;
};

const getRawScopeFromSession = (session: StaffSession | null | undefined) => {
  if (!session) return undefined;
  if (session.categoryScope) return session.categoryScope;
  if (session.category === 'all') return 'ALL';
  return session.category;
};

export const getSessionAccessSnapshot = (session: StaffSession | null | undefined): SessionAccessSnapshot => {
  const rawRole = session?.platformRole ?? session?.role ?? null;
  const normalizedRole = normalizePlatformRole(rawRole);
  const rawScope = getRawScopeFromSession(session) ?? null;
  const normalizedScope = normalizeCategoryScope(rawScope);
  const rawAccessLevel = session?.accessLevel ?? null;
  const normalizedAccessLevel = normalizeAccessLevel(rawAccessLevel, normalizedRole);
  const isMasterSession = Boolean(session?.role === 'master' && session?.category === 'all');
  const canReadAll = normalizedScope === 'ALL' || isMasterSession || normalizedRole === 'admin';
  const canWriteAccess = normalizedAccessLevel === 'full' || normalizedAccessLevel === 'write';
  const canWriteValue = Boolean(session?.isAuthenticated && canWriteAccess && normalizedRole !== 'solo_lectura');
  const canAccessAdmin = Boolean(
    session?.isAuthenticated
    && normalizedAccessLevel === 'full'
    && (
      normalizedRole === 'admin'
      || isMasterSession
      || (normalizedRole === 'category_admin' && normalizedScope === 'ALL')
    )
  );

  return {
    isAuthenticated: Boolean(session?.isAuthenticated),
    email: session?.email,
    displayName: session?.displayName ?? '',
    provider: session?.authProvider,
    rawRole,
    normalizedRole,
    rawScope,
    normalizedScope,
    rawAccessLevel,
    normalizedAccessLevel,
    isMasterSession,
    canAccessAdmin,
    canWrite: canWriteValue,
    canReadAll,
  };
};

export const hasAdministrationAccess = (session: StaffSession | null | undefined) => getSessionAccessSnapshot(session).canAccessAdmin;

export const canWrite = (session: StaffSession | null | undefined) => getSessionAccessSnapshot(session).canWrite;

export const canReadAllCategories = (session: StaffSession | null | undefined) => getSessionAccessSnapshot(session).canReadAll;

export const getSessionCategoryScope = (session: StaffSession | null | undefined): CategoryScope => {
  if (!session?.isAuthenticated) return 'Sub20';
  return getSessionAccessSnapshot(session).normalizedScope;
};

export const canAccessCategory = (session: StaffSession | null | undefined, category?: ClubCategory | 'all' | string | null) => {
  if (!category || category === 'all') return true;
  const scope = getSessionCategoryScope(session);
  const normalizedCategory = normalizeClubCategory(String(category));
  return scope === 'ALL' || (normalizedCategory ? scope === normalizedCategory : scope === category);
};

export const getWritableDeniedMessage = (session: StaffSession | null | undefined) => {
  if (!session?.isAuthenticated) return 'Inicia sesión para guardar.';
  if (!canWrite(session)) return 'Solo lectura.';
  return 'Sin permisos.';
};

export const canDeletePlayers = (session: StaffSession | null | undefined) => {
  const snapshot = getSessionAccessSnapshot(session);
  return Boolean(
    snapshot.isAuthenticated
    && snapshot.normalizedAccessLevel !== 'read'
    && ['admin', 'category_admin'].includes(snapshot.normalizedRole)
  );
};

export const canDeletePlayer = (session: StaffSession | null | undefined, player?: { category?: ClubCategory | string | null }) => {
  if (!canDeletePlayers(session)) return false;
  if (!player?.category) return true;
  return canAccessCategory(session, player.category);
};

export const getDeleteDeniedMessage = (session: StaffSession | null | undefined) => {
  if (!session?.isAuthenticated) return 'Inicia sesión para eliminar.';
  if (!canDeletePlayers(session)) return 'Solo administradores pueden eliminar jugadores.';
  return 'Sin permisos para eliminar este jugador.';
};

const byCategory = <T extends { category?: ClubCategory }>(items: T[], session: StaffSession) => {
  if (canReadAllCategories(session)) return items;
  return items.filter((item) => canAccessCategory(session, item.category));
};

const byPlayerCategory = <T extends { playerId: string; category?: ClubCategory }>(items: T[], playerCategoryById: Record<string, ClubCategory | undefined>, session: StaffSession) => {
  if (canReadAllCategories(session)) return items;
  return items.filter((item) => canAccessCategory(session, item.category ?? playerCategoryById[item.playerId]));
};

export const filterAppDataForSession = (data: AppData, session: StaffSession): AppData => {
  if (canReadAllCategories(session)) return data;
  const players = data.players.filter((player) => canAccessCategory(session, player.category));
  const allowedPlayerIds = new Set(players.map((player) => player.id));
  const playerCategoryById = Object.fromEntries(players.map((player) => [player.id, player.category]));
  const matches = byCategory(data.competitionMatchSummaries, session);
  const allowedMatchIds = new Set(matches.map((match) => match.id));

  return {
    ...data,
    players,
    wellness: byPlayerCategory(data.wellness, playerCategoryById, session).filter((item) => allowedPlayerIds.has(item.playerId)),
    internalLoads: byPlayerCategory(data.internalLoads, playerCategoryById, session).filter((item) => allowedPlayerIds.has(item.playerId)),
    externalLoads: byPlayerCategory(data.externalLoads, playerCategoryById, session).filter((item) => allowedPlayerIds.has(item.playerId)),
    cmjRecords: byPlayerCategory(data.cmjRecords, playerCategoryById, session).filter((item) => allowedPlayerIds.has(item.playerId)),
    nutritionRecords: byPlayerCategory(data.nutritionRecords, playerCategoryById, session).filter((item) => allowedPlayerIds.has(item.playerId)),
    neuromuscularRecords: byPlayerCategory(data.neuromuscularRecords, playerCategoryById, session).filter((item) => allowedPlayerIds.has(item.playerId)),
    fmsRecords: byPlayerCategory(data.fmsRecords, playerCategoryById, session).filter((item) => allowedPlayerIds.has(item.playerId)),
    competitionMatchSummaries: matches,
    competitionRecords: byPlayerCategory(data.competitionRecords, playerCategoryById, session).filter((item) => allowedPlayerIds.has(item.playerId) && (!item.matchId || allowedMatchIds.has(item.matchId))),
    trainingSessionSummaries: byCategory(data.trainingSessionSummaries, session),
    microcycles: data.microcycles,
  };
};
