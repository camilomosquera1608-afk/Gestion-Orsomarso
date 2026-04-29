import type { AppData, ClubCategory } from '@/lib/types';
import type { StaffSession } from '@/lib/auth';

export type PlatformRole = 'admin' | 'category_admin' | 'director' | 'preparador' | 'medico' | 'analista' | 'valorador' | 'solo_lectura';
export type CategoryScope = 'ALL' | ClubCategory;
export type AccessLevel = 'full' | 'write' | 'read';

export type UserProfile = {
  id: string;
  email: string;
  fullName?: string | null;
  role: PlatformRole;
  categoryScope: CategoryScope;
  accessLevel: AccessLevel;
  isActive: boolean;
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
  Sub15: 'U15',
  Sub17: 'U17',
  Sub20: 'U20',
};

export const canWrite = (session: StaffSession | null | undefined) => {
  if (!session?.isAuthenticated) return false;
  return session.accessLevel === 'full' || session.accessLevel === 'write' || session.platformRole === 'admin' || session.platformRole === 'category_admin';
};

export const canReadAllCategories = (session: StaffSession | null | undefined) => {
  return session?.categoryScope === 'ALL' || session?.category === 'all' || session?.platformRole === 'admin';
};

export const getSessionCategoryScope = (session: StaffSession | null | undefined): CategoryScope => {
  if (!session?.isAuthenticated) return 'Sub20';
  if (session.categoryScope) return session.categoryScope;
  return session.category === 'all' ? 'ALL' : session.category;
};

export const canAccessCategory = (session: StaffSession | null | undefined, category?: ClubCategory | 'all' | string | null) => {
  if (!category || category === 'all') return true;
  const scope = getSessionCategoryScope(session);
  return scope === 'ALL' || scope === category;
};

export const getWritableDeniedMessage = (session: StaffSession | null | undefined) => {
  if (!session?.isAuthenticated) return 'Inicia sesión para guardar cambios.';
  if (!canWrite(session)) return 'Tu perfil es de solo lectura.';
  return 'No tienes permisos para modificar esta información.';
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
