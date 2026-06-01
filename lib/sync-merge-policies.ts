/**
 * Políticas de fusión local ↔ remoto al refrescar desde Supabase (app-context).
 *
 * category (ficha del jugador): categoría administrativa en plantilla.
 * actingCategory (registros de actividad): categoría en la que actuó ese día/sesión
 * (préstamo, convocatoria superior, etc.). Los filtros globales usan ambos según pantalla.
 */

export type SyncMergePolicy =
  | 'remote_primary_local_fills_gaps'
  | 'local_prefer_on_id'
  | 'competition_bidirectional_keys'
  | 'training_session_date_category_keys'
  | 'players_local_prefer';

export type SyncMergePolicyRow = {
  entity: string;
  policy: SyncMergePolicy;
  description: string;
};

export const SYNC_MERGE_POLICIES: SyncMergePolicyRow[] = [
  {
    entity: 'Jugadores',
    policy: 'players_local_prefer',
    description:
      'Remoto primero; local rellena huecos y conserva jugadores solo locales hasta que Supabase confirme la ficha.',
  },
  {
    entity: 'Wellness / cargas / evaluaciones',
    policy: 'remote_primary_local_fills_gaps',
    description:
      'Por legacy_id: campos remotos mandan; valores locales significativos se conservan si el remoto llegó vacío.',
  },
  {
    entity: 'Sesiones de entrenamiento',
    policy: 'training_session_date_category_keys',
    description:
      'Clave id o fecha+categoría+número de sesión; evita perder sesiones guardadas localmente con otro legacy_id.',
  },
  {
    entity: 'Competencia (partidos y planilla)',
    policy: 'competition_bidirectional_keys',
    description:
      'Fusiona por id, fecha+categoría+rival o matchId+playerId; prioriza el conjunto más completo.',
  },
  {
    entity: 'Microciclos',
    policy: 'local_prefer_on_id',
    description: 'Por id: remoto base, local completa campos faltantes.',
  },
];
