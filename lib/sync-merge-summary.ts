import type { AppData } from './types';

export type SyncMergeConflictNote = {
  entity: string;
  localOnlyCount: number;
  detail: string;
};

const remoteIds = (remote: AppData, local: AppData, key: keyof AppData) => {
  const remoteSet = new Set(
    ((remote[key] as Array<{ id: string }>) ?? []).map((item) => item.id),
  );
  return ((local[key] as Array<{ id: string }>) ?? []).filter(
    (item) => item.id && !remoteSet.has(item.id),
  ).length;
};

/** Registros presentes solo en local tras una lectura remota (posible pendiente de sync). */
export const computeSyncMergeConflicts = (
  remote: AppData,
  local: AppData,
): SyncMergeConflictNote[] => {
  const checks: Array<{ entity: string; count: number }> = [
    { entity: 'Wellness', count: remoteIds(remote, local, 'wellness') },
    { entity: 'Carga interna', count: remoteIds(remote, local, 'internalLoads') },
    { entity: 'Carga externa', count: remoteIds(remote, local, 'externalLoads') },
    { entity: 'Sesiones', count: remoteIds(remote, local, 'trainingSessionSummaries') },
    { entity: 'Partidos', count: remoteIds(remote, local, 'competitionMatchSummaries') },
    { entity: 'Microciclos', count: remoteIds(remote, local, 'microcycles') },
  ];

  return checks
    .filter((row) => row.count > 0)
    .map((row) => ({
      entity: row.entity,
      localOnlyCount: row.count,
      detail: `${row.count} registro(s) solo en este dispositivo; se conservan hasta confirmar en Supabase.`,
    }));
};
