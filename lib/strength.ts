import type { Player, StrengthExerciseDesign, StrengthGroup, StrengthSession, StrengthSessionType, StrengthZone } from './types';

export const STRENGTH_TYPES: StrengthSessionType[] = ['Concéntrica', 'Excéntrica', 'Reactiva', 'Hipertrofia recuperación'];
export const STRENGTH_GROUPS: StrengthGroup[] = ['Todo el plantel', 'Titulares', 'Suplentes', 'No convocados', 'Retorno/readaptación'];
export const STRENGTH_ZONES: StrengthZone[] = ['Cadena posterior', 'Cadena anterior', 'Hipertrofia', 'Zona lumbo-pélvica'];
export const STRENGTH_ZONE_GROUPS: Array<{ label: string; options: StrengthZone[]; hint: string }> = [
  { label: 'Tren inferior', options: ['Cadena posterior', 'Cadena anterior'], hint: 'Posterior: isquios, glúteo, gemelo/sóleo. Anterior: cuádriceps, cadera, rodilla.' },
  { label: 'Tren superior / soporte', options: ['Hipertrofia', 'Zona lumbo-pélvica'], hint: 'Hipertrofia: soporte/recuperación. Lumbo-pélvica: core, pelvis, estabilidad.' },
];

export const strengthFactor = (type: StrengthSessionType) => {
  if (type === 'Excéntrica') return 1.3;
  if (type === 'Reactiva') return 1.2;
  if (type === 'Hipertrofia recuperación') return 0.8;
  return 1.0;
};

export const strengthLoad = (duration: number, rpe: number, type: StrengthSessionType) =>
  Math.round(Math.max(0, Number(duration) || 0) * Math.max(0, Number(rpe) || 0) * strengthFactor(type));


export const strengthExerciseId = () => `strength-exercise-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const STRENGTH_EXERCISE_PRESETS: Record<StrengthSessionType, Array<Omit<StrengthExerciseDesign, 'id'>>> = {
  'Concéntrica': [
    { name: 'Sentadilla / prensa', zone: 'Cadena anterior', sets: 4, reps: '5-6', load: 'RPE objetivo', note: 'Producción de fuerza controlada' },
    { name: 'Hip thrust', zone: 'Cadena posterior', sets: 3, reps: '6-8', load: 'RPE objetivo', note: 'Extensión de cadera' },
    { name: 'Core antirotación', zone: 'Zona lumbo-pélvica', sets: 3, reps: '8-10', load: 'Controlado', note: 'Estabilidad' },
  ],
  'Excéntrica': [
    { name: 'Nórdico / curl excéntrico', zone: 'Cadena posterior', sets: 3, reps: '4-6', load: 'Controlado', note: 'Isquios' },
    { name: 'Copenhagen', zone: 'Cadena posterior', sets: 3, reps: '6-8', load: 'Controlado', note: 'Aductor' },
    { name: 'Split squat tempo', zone: 'Cadena anterior', sets: 3, reps: '6', load: '3-4 s bajada', note: 'Cuádriceps' },
  ],
  'Reactiva': [
    { name: 'Pogos / contactos rápidos', zone: 'Cadena posterior', sets: 3, reps: '10-15', load: 'Bajo', note: 'Tobillo y rigidez' },
    { name: 'Saltos horizontales', zone: 'Cadena anterior', sets: 3, reps: '4-6', load: 'Calidad', note: 'Potencia y control' },
    { name: 'Drop jump bajo', zone: 'Cadena anterior', sets: 3, reps: '4-5', load: 'Calidad', note: 'CEA' },
  ],
  'Hipertrofia recuperación': [
    { name: 'Circuito tren inferior liviano', zone: 'Hipertrofia', sets: 2, reps: '10-12', load: 'Bajo-moderado', note: 'Recuperación activa' },
    { name: 'Tren superior soporte', zone: 'Hipertrofia', sets: 3, reps: '8-12', load: 'Moderado', note: 'Mantenimiento' },
    { name: 'Core / movilidad lumbo-pélvica', zone: 'Zona lumbo-pélvica', sets: 2, reps: '8-10', load: 'Controlado', note: 'Recuperación y control' },
  ],
};

export const strengthId = () => `strength-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const strengthResponseId = () => `strength-response-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const getPlannedPlayerIds = (session: StrengthSession, players: Player[]) => {
  const included = new Set(session.playerIds ?? []);
  const excluded = new Set(session.excludedPlayerIds ?? []);
  if (!included.size && session.group === 'Todo el plantel') {
    players.forEach((p) => included.add(p.id));
  }
  return Array.from(included).filter((id) => !excluded.has(id));
};

export const rpeDiffLabel = (expected: number, real?: number) => {
  if (!Number.isFinite(Number(real)) || !real) return { label: 'Sin RPE', tone: 'neutral' as const, text: 'Falta respuesta rápida del jugador.' };
  const diff = Number(real) - Number(expected);
  if (diff >= 3) return { label: `+${diff}`, tone: 'red' as const, text: 'Mala tolerancia: percibió la fuerza mucho más exigente de lo planificado.' };
  if (diff >= 2) return { label: `+${diff}`, tone: 'amber' as const, text: 'Alerta leve: revisar recuperación y dolor antes de aumentar carga.' };
  if (diff <= -2) return { label: `${diff}`, tone: 'blue' as const, text: 'Más fácil de lo esperado: revisar si el estímulo fue suficiente.' };
  return { label: diff > 0 ? `+${diff}` : String(diff), tone: 'green' as const, text: 'Tolerancia esperada.' };
};

export const strengthDecision = (session: StrengthSession, rpe?: number, completed?: string, pain?: boolean) => {
  const expected = Number(session.expectedRpe || 0);
  const real = Number(rpe || 0);
  const diff = real && expected ? real - expected : 0;
  if (pain) return 'Dolor post fuerza: revisar zona y modificar próxima carga si persiste.';
  if (completed === 'No completó') return 'No completó: revisar motivo antes de planificar nueva carga.';
  if (diff >= 3) return 'Control preventivo: no aumentar campo/fuerza hasta verificar recuperación.';
  if (session.type === 'Excéntrica' && real >= 7) return 'Evitar repetir sprint máximo o excéntrico intenso sobre la misma zona.';
  if (session.type === 'Reactiva' && real >= 7) return 'Controlar impactos, saltos, aceleraciones y desaceleraciones en la próxima sesión.';
  if (session.type === 'Hipertrofia recuperación' && real >= 7) return 'No interpretarla como recuperación: fue percibida como carga moderada-alta.';
  return 'Compatible con la planificación si wellness y dolor están normales.';
};

export const groupPlayerHint = (group: StrengthGroup) => {
  if (group === 'Titulares') return 'Recuperación, mantenimiento, activación o preventivo.';
  if (group === 'Suplentes') return 'Estímulo compensatorio o mantenimiento de fuerza.';
  if (group === 'No convocados') return 'Compensatorio más completo según disponibilidad.';
  if (group === 'Retorno/readaptación') return 'Progresión controlada con restricciones.';
  return 'Plan común para todo el grupo.';
};
