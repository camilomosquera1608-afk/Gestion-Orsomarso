'use client';

import { categoryLabel } from '@/lib/labels';
import type { ClubCategory, DailyExternalLoadRecord, DailyInternalLoadRecord, DailyWellnessRecord, Microcycle, Player, SessionParticipation, TrainingSessionType } from '@/lib/types';
import { formatPdfDate, formatPdfNumber, getPdfSafeText, supportsGps } from '@/lib/report-utils';
import { ReportFooter, ReportHeader } from './report-ui';
import { computeWellnessScore, getPlayerDayLoad, groupAverage } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
type Row = {
  player: Player; selected: boolean; participation: SessionParticipation;
  min: number; rpe: number; acc: number; dcc: number; sprints: number; rhie: number; ima: number;
  totalDistance?: number; maxVelocity?: number; playerLoad?: number;

};
type Props = {
  date: string; category: ClubCategory; microcycle?: Microcycle;
  sessionNumber?: string | number; sessionType: TrainingSessionType;
  objective?: string; observation?: string; rows: Row[]; absentPlayers: Player[];
  wellnessRecords?: DailyWellnessRecord[];
  allWellnessRecords?: DailyWellnessRecord[];
  allInternalLoads?: DailyInternalLoadRecord[];
  allExternalLoads?: DailyExternalLoadRecord[];
  allPlayers?: Player[];
  dataQualityPercent?: number;
  generatedAt?: string; className?: string; compact?: boolean;
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const avg = (a: number[]) => groupAverage(a.filter(v => Number.isFinite(v) && v > 0));
const safeN = (v?: number) => Number.isFinite(Number(v)) ? Number(v) : 0;
const sumN = (a: Array<number | undefined>) => a.reduce<number>((s, v) => s + safeN(v), 0);
const maxN = (a: Array<number | undefined>) => a.reduce<number>((s, v) => Math.max(s, safeN(v)), 0);
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const pct = (v: number, ref: number) => ref > 0 ? clamp(Math.round(v / ref * 100)) : 0;
const wellAvg = (r?: DailyWellnessRecord) => computeWellnessScore(r);
const wellnessReadiness = (r?: DailyWellnessRecord) => wellAvg(r);
const rMin = (a: number[]) => Math.min(...a.filter(v => v > 0), 0);
const rMax = (a: number[]) => Math.max(...a, 1);
const sessionLabel = (v: TrainingSessionType) =>
  ({ 'MD+1': 'Match Day +1', 'MD+2': 'Match Day +2', 'MD-5': 'Match Day -5', 'MD-4': 'Match Day -4', 'MD-3': 'Match Day -3', 'MD-2': 'Match Day -2', 'MD-1': 'Match Day -1', MD: 'Match Day', 'REC_ACTIVA': 'REC. ACTIVA', 'REC_PASIVA': 'REC. PASIVA', 'CDE_F_OPT_JUGADORES': 'CDe/f (Optimización Jugadores)', 'CDE_F_OPT_EQUIPO': 'Cde/f (Optimización Equipo)', 'CDE_F_OPT_CONDICIONAL': 'cde/F (Optimización Condicional)', 'CDE_F_OPT_JUGADOR': 'cdE/f (Optimización Jugador)' }[v] ?? v);

const dateObj = (value: string) => {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const dayDiff = (date: string, reference: string) => {
  const a = dateObj(date); const b = dateObj(reference);
  if (!a || !b) return 9999;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};
const meanClean = (values: number[]) => {
  const clean = values.filter(v => Number.isFinite(v) && v > 0);
  return clean.length ? clean.reduce((a, v) => a + v, 0) / clean.length : 0;
};
const stdClean = (values: number[]) => {
  const clean = values.filter(v => Number.isFinite(v) && v > 0);
  if (clean.length < 2) return 0;
  const m = meanClean(clean);
  return Math.sqrt(clean.reduce((s, v) => s + Math.pow(v - m, 2), 0) / clean.length);
};
const sumWindowLoad = (playerId: string, referenceDate: string, minDays: number, maxDays: number, internalLoads: DailyInternalLoadRecord[], externalLoads: DailyExternalLoadRecord[]) => {
  const dates = Array.from(new Set([
    ...internalLoads.filter(r => r.playerId === playerId).map(r => r.date),
    ...externalLoads.filter(r => r.playerId === playerId).map(r => r.date),
  ])).filter(d => {
    const diff = dayDiff(d, referenceDate);
    return diff >= minDays && diff <= maxDays;
  });
  return dates.reduce((total, d) => total + getPlayerDayLoad(playerId, d, { internalLoads, externalLoads }), 0);
};
const acwrLabel = (ratio: number) => {
  if (!ratio) return { label: 's/d', tone: 'neutral', note: 'sin crónico suficiente' };
  if (ratio < 0.8) return { label: ratio.toFixed(2), tone: 'yellow', note: 'baja exposición reciente' };
  if (ratio <= 1.3) return { label: ratio.toFixed(2), tone: 'green', note: 'rango estable' };
  if (ratio <= 1.6) return { label: ratio.toFixed(2), tone: 'yellow', note: 'incremento moderado' };
  return { label: ratio.toFixed(2), tone: 'red', note: 'pico de carga' };
};
const positionFocus = (position: string) => {
  if (position === 'Lateral' || position === 'Extremo') return 'Controlar sprint, alta velocidad, aceleraciones y desaceleraciones.';
  if (position === 'Mediocampista') return 'Controlar distancia total, m/min, carga acumulada y recuperación metabólica.';
  if (position === 'Defensa central') return 'Controlar acciones neuromusculares, desaceleraciones, duelos, saltos y cambios de dirección.';
  if (position === 'Delantero') return 'Controlar sprint, finalizaciones, aceleraciones cortas y exposición a máxima velocidad.';
  return 'Controlar minutos, RPE y carga neuromuscular según rol de la sesión.';
};
const microcycleContext = (sessionType: TrainingSessionType) =>
  `${sessionType}: etiqueta de ubicación respecto al partido. La interpretación de carga se basa en datos reales de la sesión, RPE, wellness, dolor, disponibilidad y carga acumulada; no en una carga estimada por MD.`;
const loadDecision = (score: number, acwr: number, wellDelta: number, status: Player['status'], hasPain: boolean) => {
  if (status === 'Lesionado' || score < 40 || hasPain) return { label: 'Evaluación / modificado', pct: '0-50%', tone: 'red', text: 'Valorar antes de campo; priorizar fisioterapia, movilidad o sesión modificada.' };
  if (status === 'Readaptación' || score < 55 || acwr > 1.6) return { label: 'Trabajo modificado', pct: '50-65%', tone: 'red', text: 'Reducir volumen e intensidad; evitar sprint, cambios bruscos o desaceleraciones altas.' };
  if (status === 'Molestia' || score < 70 || acwr > 1.3 || wellDelta <= -1) return { label: 'Carga controlada', pct: '65-80%', tone: 'yellow', text: 'Mantener participación parcial, controlar RPE y limitar el componente de mayor riesgo posicional.' };
  if (score < 85 || wellDelta <= -0.5) return { label: 'Control preventivo', pct: '80-90%', tone: 'yellow', text: 'Puede entrenar, con seguimiento de respuesta durante y después de la sesión.' };
  return { label: 'Carga completa', pct: '90-100%', tone: 'green', text: 'Disponible para la carga planificada si la evaluación de campo es normal.' };
};

const isSpeedRole = (position: string) => ['Extremo', 'Lateral', 'Delantero'].includes(position);
const loadComponentFocus = (r: Row) => {
  const parts: string[] = [];
  if (r.sprints >= 4) parts.push('sprint');
  if (r.dcc >= 55) parts.push('desaceleraciones');
  if (r.acc >= 65) parts.push('aceleraciones');
  if (r.rhie >= 15) parts.push('RHIE/intermitencia');
  return parts.length ? parts.join(', ') : 'el componente dominante de su posición';
};
const concreteNextAction = (item: { row: Row; player: Player; decision: { label: string; pct: string }; reasons: string[]; score: number }, invalidGps = false) => {
  const r = item.row;
  if (invalidGps) return 'Validar GPS antes de usar métricas externas; decidir con RPE, wellness y criterio del staff.';
  if (item.decision.label.includes('Evaluación')) return 'No iniciar campo sin valoración; priorizar fisioterapia o sesión modificada.';
  if (item.decision.label === 'Trabajo modificado') return `Reducir volumen e intensidad; evitar ${loadComponentFocus(r)} y controlar respuesta post-sesión.`;
  if (item.decision.label === 'Carga controlada') return `Participación parcial; limitar ${loadComponentFocus(r)} y revisar RPE/wellness antes de aumentar carga.`;
  if (item.decision.label === 'Control preventivo') return `Mantener carga planificada con seguimiento; no repetir picos de ${loadComponentFocus(r)} si persiste fatiga.`;
  return 'Puede realizar la carga planificada si no hay dolor ni restricción de staff.';
};
const stimulationAction = (r: Row) => {
  if (r.min < 60) return 'Considerar complemento de minutos si no hay restricción.';
  if (isSpeedRole(r.player.position) && r.sprints === 0) return 'Considerar exposición progresiva a alta velocidad/sprint si el objetivo lo permite.';
  return 'Considerar complemento individual para acercarlo a la demanda del grupo.';
};

// Shorten name but keep enough to be identifiable
const fmt = (name: string) => {
  const p = getPdfSafeText(name, '').split(' ').filter(Boolean);
  if (p.length <= 2) return p.join(' ');
  // First name + second name initial + first surname
  return `${p[0]} ${p[1]?.[0] ?? ''}.${p[2] ? ' ' + p[2] : ''}`;
};

const C = {
  navy: '#06152f', blue: '#1557d6', blue2: '#2563eb',
  green: '#059669', red: '#dc2626', amber: '#d97706',
  muted: '#64748b', line: '#e2e8f0', soft: '#f0f4fb', text: '#1e293b',
};

// ─── Heatmap cell ──────────────────────────────────────────────────────────────
function HC({ v, lo, hi, f = (x: number) => String(Math.round(x)), inv = false, allowZero = false }: {
  v: number; lo: number; hi: number; f?: (x: number) => string; inv?: boolean; allowZero?: boolean;
}) {
  // If value is 0 and not explicitly allowed, show as neutral grey (not red)
  if (v === 0 && !allowZero) {
    return <td style={{ background: '#f1f5f9', color: '#94a3b8', fontWeight: 700, textAlign: 'center', fontSize: 10, padding: '5px 3px' }}>—</td>;
  }
  const pos = clamp(Math.round((v - lo) / Math.max(1, hi - lo) * 100));
  const score = inv ? 100 - pos : pos;
  const [bg, fg] = score >= 65 ? ['#d1fae5','#065f46'] : score >= 35 ? ['#fef9c3','#713f12'] : ['#fee2e2','#7f1d1d'];
  return <td style={{ background: bg, color: fg, fontWeight: 900, textAlign: 'center', fontSize: 10, padding: '5px 3px' }}>{f(v)}</td>;
}

// ─── Horizontal bar ────────────────────────────────────────────────────────────
function HBar({ name, value, maxVal, color, unit = '', f }: {
  name: string; value: number; maxVal: number; color: string; unit?: string; f?: (v: number) => string;
}) {
  const w = Math.max(3, pct(value, maxVal));
  const isTop = value >= maxVal * 0.97;
  const display = f ? f(value) : `${Math.round(value)}${unit}`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 48px', gap: 6, alignItems: 'center', marginBottom: 2 }}>
      <span style={{ fontSize: 9.5, fontWeight: isTop ? 900 : 700, color: isTop ? C.navy : C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      <div style={{ height: 9, background: C.soft, borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${w}%`, borderRadius: 99, background: isTop ? color : `${color}88` }} />
      </div>
      <span style={{ fontSize: 9.5, fontWeight: 900, color: isTop ? color : C.text, textAlign: 'right' }}>{display}</span>
    </div>
  );
}

// ─── Gauge SVG ─────────────────────────────────────────────────────────────────
function Gauge({ val, label, sub, color }: { val: number; label: string; sub: string; color: string }) {
  const ratio = clamp(val);
  const r = 34; const circ = Math.PI * r;
  return (
    <div style={{ textAlign: 'center', display: 'grid', gap: 3 }}>
      <svg viewBox="0 0 80 54" style={{ width: 80, height: 54, overflow: 'visible' }}>
        <path d="M 8 46 A 34 34 0 0 1 72 46" fill="none" stroke={C.line} strokeWidth="9" strokeLinecap="round" />
        <path d="M 8 46 A 34 34 0 0 1 72 46" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - ratio / 100)} />
        <text x="40" y="40" textAnchor="middle" fontSize="15" fontWeight="900" fill={C.navy}>{ratio}%</text>
      </svg>
      <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: C.muted }}>{label}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color: C.text }}>{sub}</div>
    </div>
  );
}

// ─── KPI tile ──────────────────────────────────────────────────────────────────
function KTile({ label, value, note, accent }: { label: string; value: string | number; note?: string; accent: string }) {
  return (
    <div className="sr-ktile" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="sr-ktile-label">{label}</div>
      <div className="sr-ktile-value">{value}</div>
      {note && <div className="sr-ktile-note">{note}</div>}
    </div>
  );
}

// ─── Section header — DIM style colored bar ───────────────────────────────────
function Sec({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="sr-sec-header">
      <div className="sr-sec-eyebrow">{eyebrow}</div>
      <div className="sr-sec-title">{title}</div>
      {sub && <div className="sr-sec-sub">{sub}</div>}
    </div>
  );
}

// ─── Bar section (2-column label + bars + values) ─────────────────────────────
function BarCol({ title, color, items, maxVal, f }: {
  title: string; color: string; items: { name: string; value: number }[]; maxVal: number; f?: (v: number) => string;
}) {
  const clean = items.filter((item) => Number.isFinite(item.value) && item.value > 0).slice(0, 22);
  if (!clean.length) return null;
  const localMax = Math.max(maxVal, ...clean.map((item) => item.value), 1);
  return (
    <div>
      <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
        {title}
      </div>
      {clean.map(item => <HBar key={item.name} name={item.name} value={item.value} maxVal={localMax} color={color} {...(f ? { f } : {})} />)}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function SessionReportTemplate({
  date, category, microcycle, sessionNumber, sessionType,
  objective, observation, rows, absentPlayers,
  wellnessRecords = [],
  allWellnessRecords = wellnessRecords,
  allInternalLoads = [],
  allExternalLoads = [],
  allPlayers = [],
  dataQualityPercent = 0,
  generatedAt = new Date().toLocaleString('es-CO'),
  className = '', compact = false,
}: Props) {
  const gps = supportsGps(category);
  const reg = rows.filter(r => r.selected || r.min > 0 || r.rpe > 0 || safeN(r.totalDistance) > 0);

  // Aggregates
  const totalLoad = reg.reduce((a, r) => a + r.min * r.rpe, 0);
  const avgMin  = avg(reg.map(r => r.min));
  const avgRpe  = avg(reg.map(r => r.rpe));
  const totalDist = sumN(reg.map(r => r.totalDistance));
  const totalPL   = sumN(reg.map(r => r.playerLoad));
  const totalSpr  = sumN(reg.map(r => r.sprints));
  const totalHSR  = sumN(reg.map(r => r.rhie));
  const maxVel    = maxN(reg.map(r => r.maxVelocity));
  const avgMMin   = avg(reg.map(r => r.min > 0 && r.totalDistance ? r.totalDistance / r.min : 0));
  const avgAcc    = avg(reg.map(r => r.acc));
  const avgDcc    = avg(reg.map(r => r.dcc));
  const avgIma    = avg(reg.map(r => r.ima));
  const avgLoad   = totalLoad / Math.max(1, reg.length);
  const wellMap   = new Map(wellnessRecords.map(r => [r.playerId, r]));
  const avgWell   = avg(reg.map(r => wellAvg(wellMap.get(r.player.id))).filter(v => v > 0));
  const avgReadiness = avg(reg.map(r => wellnessReadiness(wellMap.get(r.player.id))).filter(v => v > 0));
  const avgFatigue = avg(reg.map(r => safeN(wellMap.get(r.player.id)?.fatigue)).filter(v => v > 0));
  const avgStress = avg(reg.map(r => safeN(wellMap.get(r.player.id)?.stress)).filter(v => v > 0));
  const avgPain = avg(reg.map(r => safeN(wellMap.get(r.player.id)?.musclePain)).filter(v => v > 0));
  const loadWellnessRatio = avgReadiness > 0 ? avgLoad / avgReadiness : 0;
  const partScore = reg.length + absentPlayers.length ? pct(reg.length, reg.length + absentPlayers.length) : 0;
  const volScore  = gps ? pct(totalDist, reg.length * 6200) : pct(totalLoad, reg.length * 650);
  const intScore  = gps ? pct(avgMMin, 95) : pct(avgRpe * 10, 100);
  const mcText    = microcycle ? getPdfSafeText(microcycle.name, 'Microciclo') : 'Sin microciclo';

  // Sorted lists
  const byDist = [...reg].sort((a, b) => safeN(b.totalDistance) - safeN(a.totalDistance));

  const byAcc  = [...reg].sort((a, b) => b.acc - a.acc);
  const byDcc  = [...reg].sort((a, b) => b.dcc - a.dcc);
  const byVel  = [...reg].sort((a, b) => safeN(b.maxVelocity) - safeN(a.maxVelocity));

  // Ranges
  const distArr = reg.map(r => safeN(r.totalDistance));
  const plArr   = reg.map(r => safeN(r.playerLoad));

  const accArr  = reg.map(r => r.acc);
  const dccArr  = reg.map(r => r.dcc);
  const velArr  = reg.map(r => safeN(r.maxVelocity));
  const loadArr = reg.map(r => r.min * r.rpe);
  const mminArr = reg.map(r => r.min > 0 && r.totalDistance ? r.totalDistance / r.min : 0);

  // Only show sprint if there's meaningful data
  // Sprints and RHIE are shown from GPS params
  const highRpe   = reg.filter(r => r.rpe >= 8);
  const lowWell   = reg.filter(r => { const w = wellAvg(wellMap.get(r.player.id)); return w > 0 && w < 3.2; });
  const invalidGpsRows = gps
    ? reg.filter(r => r.min >= 20 && safeN(r.totalDistance) < 500 && safeN(r.playerLoad) < 50)
    : [];
  const scientificRows = reg.map(r => {
    const p = r.player;
    const todayWell = wellAvg(wellMap.get(p.id));
    const baselineValues = allWellnessRecords
      .filter(w => w.playerId === p.id)
      .filter(w => { const diff = dayDiff(w.date, date); return diff >= 1 && diff <= 28; })
      .map(wellAvg)
      .filter(v => v > 0);
    const wellnessBaseline = meanClean(baselineValues);
    const wellnessSd = stdClean(baselineValues);
    const wellnessDelta = todayWell && wellnessBaseline ? todayWell - wellnessBaseline : 0;
    const z = wellnessSd > 0 && todayWell ? wellnessDelta / wellnessSd : 0;
    const loadToday = r.min * r.rpe;
    const load7 = sumWindowLoad(p.id, date, 0, 6, allInternalLoads, allExternalLoads) || loadToday;
    const chronicBlocks = [
      sumWindowLoad(p.id, date, 7, 13, allInternalLoads, allExternalLoads),
      sumWindowLoad(p.id, date, 14, 20, allInternalLoads, allExternalLoads),
      sumWindowLoad(p.id, date, 21, 27, allInternalLoads, allExternalLoads),
    ].filter(v => v > 0);
    const chronic = chronicBlocks.length ? chronicBlocks.reduce((a, v) => a + v, 0) / chronicBlocks.length : 0;
    const acwr = chronic > 0 ? load7 / chronic : 0;
    const mmin = r.min > 0 && r.totalDistance ? r.totalDistance / r.min : 0;
    const neuromuscular = r.acc + r.dcc + r.sprints + r.rhie;
    const injuryFlag = p.status !== 'Disponible' || Boolean(p.injuryArea || p.injuryType || (p.injuryHistory ?? []).some(i => i.status === 'activa'));
    const hasPain = Boolean(wellMap.get(p.id)?.musclePain && (wellMap.get(p.id)?.musclePain ?? 0) <= 2) || injuryFlag;
    const acwrPenalty = acwr === 0 ? 8 : acwr > 1.6 ? 30 : acwr > 1.3 ? 18 : acwr < 0.8 ? 10 : 0;
    const wellnessPenalty = todayWell === 0 ? 10 : todayWell < 3 ? 30 : todayWell < 3.5 ? 18 : wellnessDelta <= -1 ? 20 : wellnessDelta <= -0.5 ? 10 : 0;
    const statusPenalty = p.status === 'Disponible' ? 0 : p.status === 'Molestia' ? 18 : p.status === 'Readaptación' ? 30 : 45;
    const rpePenalty = r.rpe >= 9 ? 15 : r.rpe >= 8 ? 9 : 0;
    const score = clamp(100 - acwrPenalty - wellnessPenalty - statusPenalty - rpePenalty, 0, 100);
    const decision = loadDecision(score, acwr, wellnessDelta, p.status, hasPain);
    const reasons = [
      todayWell && todayWell < 3.2 ? `wellness bajo ${todayWell.toFixed(1)}` : '',
      wellnessDelta <= -0.5 ? `caída ${wellnessDelta.toFixed(1)} vs línea base` : '',
      acwr > 1.3 ? `ACR ${acwr.toFixed(2)}` : '',
      r.rpe >= 8 ? `RPE ${r.rpe}` : '',
      injuryFlag ? `estado ${p.status}${p.injuryArea ? ` · ${p.injuryArea}` : ''}` : '',
    ].filter(Boolean);
    return { row: r, player: p, todayWell, wellnessBaseline, wellnessDelta, z, loadToday, load7, chronic, acwr, mmin, neuromuscular, score, decision, reasons };
  }).sort((a, b) => a.score - b.score);
  const invalidGpsIds = new Set(invalidGpsRows.map(r => r.player.id));
  const priorityRows = scientificRows.filter(r => r.score < 70 || r.reasons.length > 0).slice(0, 6);
  const avgAcwr = meanClean(scientificRows.map(r => r.acwr));
  const avgNeuromuscular = meanClean(scientificRows.map(r => r.neuromuscular));
  const lowReadinessCount = scientificRows.filter(r => r.score < 70).length;
  const fullLoadCount = scientificRows.filter(r => r.decision.label === 'Carga completa').length;
  const neuromuscularRows = gps ? [...reg]
    .filter(r => !invalidGpsIds.has(r.player.id))
    .map(r => ({ row: r, value: r.acc + r.dcc + r.sprints + r.rhie, focus: loadComponentFocus(r) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8) : [];
  const nextSessionRows = scientificRows
    .filter(item => item.decision.label !== 'Carga completa' || item.reasons.length > 0 || invalidGpsIds.has(item.player.id))
    .slice(0, 8);
  const avgDistPlayer = gps ? totalDist / Math.max(1, reg.length) : 0;
  const avgPlayerLoad = gps ? totalPL / Math.max(1, reg.length) : 0;
  const subStimRows = gps ? reg
    .filter(r => !invalidGpsIds.has(r.player.id))
    .map(r => {
      const well = wellAvg(wellMap.get(r.player.id));
      const reasons = [
        safeN(r.totalDistance) > 0 && avgDistPlayer > 0 && safeN(r.totalDistance) < avgDistPlayer * 0.8 ? `distancia ${Math.round((safeN(r.totalDistance) / Math.max(1, avgDistPlayer)) * 100)}% del promedio` : '',
        safeN(r.playerLoad) > 0 && avgPlayerLoad > 0 && safeN(r.playerLoad) < avgPlayerLoad * 0.8 ? `Player Load bajo (${Math.round((safeN(r.playerLoad) / Math.max(1, avgPlayerLoad)) * 100)}% del promedio)` : '',
        isSpeedRole(r.player.position) && r.sprints === 0 && safeN(r.maxVelocity) < maxVel * 0.88 ? 'sin exposición relevante a sprint/velocidad' : '',
        r.min > 0 && r.min < avgMin * 0.85 ? `menos minutos que el grupo (${Math.round(r.min)} min)` : '',
      ].filter(Boolean);
      const readyForExtra = r.rpe < 8 && (!well || well >= 3.2) && r.player.status === 'Disponible';
      return { row: r, player: r.player, reasons, readyForExtra };
    })
    .filter(item => item.reasons.length > 0)
    .sort((a, b) => (b.readyForExtra ? 1 : 0) - (a.readyForExtra ? 1 : 0) || a.row.rpe - b.row.rpe)
    .slice(0, 8) : [];

  return (
    <article className={`pdf-report-document session-report-document ${className}`} style={{ fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
      {compact && (
        <ReportHeader
          title="Informe de sesión"
          subtitle={`${formatPdfDate(date)} · Sesión ${sessionNumber || '—'}`}
          category={category}
          generatedAt={generatedAt}
        />
      )}

      {/* ══ PORTADA — estilo Palmeiras ════════════════════════════════════ */}
      {!compact && (
        <div className="sr-cover-palmeiras">
          {/* Top header — club name */}
          <div className="srp-top">
            <div className="srp-club-name">ORSOMARSO SC</div>
            <div className="srp-dept">DEPARTAMENTO DE RENDIMIENTO</div>
          </div>

          {/* Big crest — centered */}
          <div className="srp-crest-wrap">
            <div className="srp-crest">
              <img src="/orsomarso-crest.jpg" alt="Orsomarso SC" width={160} height={160} />
            </div>
          </div>

          {/* Report title */}
          <div className="srp-title-block">
            <div className="srp-report-label">
              {gps ? 'CATAPULT GPS · U20' : 'CARGA INTERNA'} &nbsp;·&nbsp; {sessionLabel(sessionType).toUpperCase()}
            </div>
            <div className="srp-title">INFORME DE SESIÓN</div>
            <div className="srp-subtitle">{mcText}</div>
          </div>

          {/* Meta chips */}
          <div className="srp-chips">
            {[categoryLabel(category), `Sesión ${sessionNumber || '—'}`, `${reg.length} jugadores`, formatPdfDate(date)]
              .map(t => <span key={t} className="srp-chip">{t}</span>)}
          </div>

          {/* KPI strip at bottom */}
          <div className="srp-kpi-strip">
            {gps ? <>
              <div className="srp-kpi"><div className="srp-kpi-label">DISTANCIA TOTAL</div><div className="srp-kpi-value">{formatPdfNumber(totalDist)} m</div><div className="srp-kpi-note">{formatPdfNumber(totalDist / Math.max(1, reg.length))} m / jugador</div></div>
              <div className="srp-kpi-div" />
              <div className="srp-kpi"><div className="srp-kpi-label">PLAYER LOAD</div><div className="srp-kpi-value">{formatPdfNumber(totalPL)}</div><div className="srp-kpi-note">carga externa total</div></div>
              <div className="srp-kpi-div" />
              <div className="srp-kpi"><div className="srp-kpi-label">VEL. MÁXIMA</div><div className="srp-kpi-value">{formatPdfNumber(maxVel, 1)} km/h</div><div className="srp-kpi-note">mejor registro</div></div>
              <div className="srp-kpi-div" />
              <div className="srp-kpi"><div className="srp-kpi-label">PARTICIPACIÓN</div><div className="srp-kpi-value">{partScore}%</div><div className="srp-kpi-note">{reg.length} de {reg.length + absentPlayers.length}</div></div>
            </> : <>
              <div className="srp-kpi"><div className="srp-kpi-label">JUGADORES</div><div className="srp-kpi-value">{reg.length}</div><div className="srp-kpi-note">registrados</div></div>
              <div className="srp-kpi-div" />
              <div className="srp-kpi"><div className="srp-kpi-label">CARGA INTERNA</div><div className="srp-kpi-value">{Math.round(totalLoad)} UA</div><div className="srp-kpi-note">total</div></div>
              <div className="srp-kpi-div" />
              <div className="srp-kpi"><div className="srp-kpi-label">RPE PROMEDIO</div><div className="srp-kpi-value">{avgRpe.toFixed(1)}</div><div className="srp-kpi-note">escala 1–10</div></div>
              <div className="srp-kpi-div" />
              <div className="srp-kpi"><div className="srp-kpi-label">WELLNESS</div><div className="srp-kpi-value">{avgReadiness ? avgReadiness.toFixed(1) : '—'}</div><div className="srp-kpi-note">readiness /5</div></div>
            </>}
          </div>
        </div>
      )}

      {!compact && (
        <div className="sr-report-topbar">
          <div>
            <span>DIRECCIÓN DE RENDIMIENTO</span>
            <strong>INFORME SESIÓN GRUPAL {sessionNumber || '—'}</strong>
          </div>
          <img src="/orsomarso-crest.jpg" alt="Orsomarso SC" width={48} height={48} />
          <div>
            <span>{formatPdfDate(date)}</span>
            <strong>{mcText}</strong>
          </div>
        </div>
      )}

      {/* ══ PÁGINA 2: RESUMEN + TABLA ════════════════════════════════════════ */}
      <section style={{ display: 'grid', gap: 10, marginBottom: 6 }}>
        <Sec eyebrow="Resumen ejecutivo" title="Promedios generales de la sesión"
          sub={`${formatPdfDate(date)} · ${sessionLabel(sessionType)} · ${mcText}`} />

        {/* Gauges — fila compacta */}
        <div className="sr-gauges-row">
          <Gauge val={volScore} label="Volumen vs ref."
            sub={gps ? `${formatPdfNumber(totalDist / Math.max(1, reg.length))} m` : `${Math.round(totalLoad / Math.max(1, reg.length))} UA`}
            color={volScore >= 65 ? C.green : volScore >= 40 ? C.amber : C.red} />
          <Gauge val={intScore} label="Intensidad vs ref."
            sub={gps ? `${formatPdfNumber(avgMMin, 1)} m/min` : `RPE ${avgRpe.toFixed(1)}`}
            color={intScore >= 65 ? C.green : intScore >= 40 ? C.amber : C.red} />
          <Gauge val={partScore} label="Participación"
            sub={`${reg.length} / ${reg.length + absentPlayers.length}`}
            color={partScore >= 70 ? C.green : partScore >= 45 ? C.amber : C.red} />
          <Gauge val={pct(avgReadiness, 5)} label="Wellness"
            sub={avgReadiness ? `${avgReadiness.toFixed(1)} / 5` : 'sin datos'}
            color={avgReadiness >= 3.7 ? C.green : avgReadiness >= 3.2 ? C.amber : C.red} />
        </div>

        {/* KPI tiles */}
        <div className="sr-kpi-grid">
          <KTile label="Tiempo prom." value={`${Math.round(avgMin)} min`} note="Por jugador" accent={C.blue} />
          <KTile label="RPE promedio" value={avgRpe.toFixed(1)} note="Escala 1–10"
            accent={avgRpe <= 6 ? C.green : avgRpe <= 8 ? C.amber : C.red} />
          {gps ? <>
            <KTile label="Distancia prom." value={`${formatPdfNumber(totalDist / Math.max(1, reg.length))} m`} note="Por jugador" accent={C.blue} />
            <KTile label="m/min" value={formatPdfNumber(avgMMin, 1)} note="Intensidad locomotora"
              accent={avgMMin >= 75 ? C.green : avgMMin >= 55 ? C.amber : C.red} />
            <KTile label="Carga interna" value={`${Math.round(avgLoad)} UA`} note="MIN×RPE prom." accent={C.amber} />
            <KTile label="Player Load" value={formatPdfNumber(totalPL / Math.max(1, reg.length))} note="Prom. jugador" accent={C.navy} />
            <KTile label="ACC / DCC" value={`${Math.round(avgAcc)} / ${Math.round(avgDcc)}`} note="Promedios" accent={C.navy} />
            <KTile label="IMA prom." value={formatPdfNumber(avgIma, 1)} note="Cambios de intensidad" accent={C.blue2} />
            <KTile label="Wellness readiness" value={avgReadiness ? avgReadiness.toFixed(1) : '—'} note="Promedio 1–5; mayor = mejor" accent={avgReadiness >= 3.7 ? C.green : C.amber} />
            <KTile label="Carga/Wellness" value={loadWellnessRatio ? formatPdfNumber(loadWellnessRatio, 0) : '—'} note="UA por punto wellness" accent={loadWellnessRatio > 160 ? C.red : loadWellnessRatio > 115 ? C.amber : C.green} />
          </> : <>
            <KTile label="Carga total" value={`${Math.round(totalLoad)} UA`} note="Equipo" accent={C.blue} />
            <KTile label="Wellness readiness" value={avgReadiness ? avgReadiness.toFixed(1) : '—'} note="/5 ajustado"
              accent={avgReadiness >= 3.7 ? C.green : C.amber} />
            <KTile label="Energía / músculo" value={`${avgFatigue ? avgFatigue.toFixed(1) : '—'} / ${avgPain ? avgPain.toFixed(1) : '—'}`} note="Mayor = mejor estado" accent={(avgFatigue >= 3.7 && avgPain >= 3.7) ? C.green : (avgFatigue >= 3.0 && avgPain >= 3.0) ? C.amber : C.red} />
            <KTile label="Completitud" value={`${dataQualityPercent}%`} note="Planilla" accent={C.green} />
            <KTile label="Participación" value={`${partScore}%`} note={`${reg.length}/${reg.length + absentPlayers.length}`}
              accent={partScore >= 70 ? C.green : C.amber} />
          </>}
        </div>
      </section>

      {/* Tabla descriptiva */}
      {reg.length > 0 && (
        <section className="sr-section">
          <Sec eyebrow="Individual" title="Tabla descriptiva"
            sub="Heatmap: verde = mejor · amarillo = medio · rojo = menor rendimiento relativo" />
          <table className="sr-heat-table">
            <thead>
              <tr>
                <th className="sr-th-name">Jugador</th>
                <th>Pos.</th><th>MIN</th><th>RPE</th><th>Carga</th>
                {gps ? <>
                  <th>ACC</th><th>DCC</th><th>Sprints</th><th>RHIE</th>
                  <th>Dist. (m)</th><th>Vel. máx</th><th>Player Load</th>
                </> : <>
                  <th>Wellness</th><th>Participación</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {reg.map(r => {
                const load = r.min * r.rpe;
                const mmin = r.min > 0 && r.totalDistance ? r.totalDistance / r.min : 0;
                const well = wellAvg(wellMap.get(r.player.id));
                return (
                  <tr key={r.player.id}>
                    <td className="sr-td-name">{r.player.name}</td>
                    <td className="sr-td-pos">{r.player.position}</td>
                    <HC v={r.min}  lo={rMin(reg.map(x => x.min))} hi={rMax(reg.map(x => x.min))} />
                    <HC v={r.rpe}  lo={0} hi={10} allowZero={false} />
                    <HC v={load}   lo={rMin(loadArr)} hi={rMax(loadArr)} allowZero={false} />
                    {gps ? <>
                      <HC v={r.acc}  lo={rMin(accArr)} hi={rMax(accArr)} allowZero />
                      <HC v={r.dcc}  lo={rMin(dccArr)} hi={rMax(dccArr)} allowZero />
                      <HC v={r.sprints} lo={rMin(reg.map(x=>x.sprints))} hi={rMax(reg.map(x=>x.sprints))} allowZero />
                      <HC v={r.rhie} lo={rMin(reg.map(x=>x.rhie))} hi={rMax(reg.map(x=>x.rhie))} allowZero />
                      <HC v={safeN(r.totalDistance)} lo={rMin(distArr)} hi={rMax(distArr)} f={v => formatPdfNumber(v)} />
                      <HC v={safeN(r.maxVelocity)}   lo={rMin(velArr)}  hi={rMax(velArr)}  f={v => v.toFixed(1)} />
                      <HC v={safeN(r.playerLoad)}    lo={rMin(plArr)}   hi={rMax(plArr)}   f={v => formatPdfNumber(v)} />
                    </> : <>
                      <td style={{ textAlign: 'center', fontWeight: 900, fontSize: 10, background: well >= 3.7 ? '#d1fae5' : well >= 3.2 ? '#fef9c3' : well > 0 ? '#fee2e2' : C.soft, color: well >= 3.7 ? '#065f46' : well >= 3.2 ? '#713f12' : '#7f1d1d' }}>{well ? well.toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'center', fontSize: 9, color: C.muted }}>{r.participation}</td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ══ PÁGINA 3 (GPS): BARRAS EN 2 COLUMNAS ════════════════════════════ */}
      {gps && reg.length > 0 && (
        <section className="sr-section" style={{ pageBreakBefore: 'always' }}>
          <Sec eyebrow="Individual" title="Métricas por jugador" />

          {/* Fila 1: Distancia + Sprint efforts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
            <BarCol title={`Distancia total · prom ${formatPdfNumber(totalDist / Math.max(1, reg.length))} m`}
              color={C.blue}
              items={byDist.map(r => ({ name: fmt(r.player.name), value: safeN(r.totalDistance) }))}
              maxVal={rMax(distArr)} />
            <BarCol title={`Sprint efforts · prom ${Math.round(groupAverage(reg.map(r=>r.sprints)))}`}
              color={C.red}
              items={[...reg].sort((a,b)=>b.sprints-a.sprints).map(r => ({ name: fmt(r.player.name), value: r.sprints }))}
              maxVal={Math.max(...reg.map(r=>r.sprints), 1)} />
          </div>

          {/* Fila 2: ACC + DCC + Velocidad máxima */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: false ? 20 : 0 }}>
            <BarCol title={`ACC >3 m/s² · prom ${Math.round(avgAcc)}`}
              color={C.blue2}
              items={byAcc.map(r => ({ name: fmt(r.player.name), value: r.acc }))}
              maxVal={rMax(accArr)} />
            <BarCol title={`DEC >-3 m/s² · prom ${Math.round(avgDcc)}`}
              color={C.red}
              items={byDcc.map(r => ({ name: fmt(r.player.name), value: r.dcc }))}
              maxVal={rMax(dccArr)} />
            <BarCol title={`Vel. máxima · máx ${formatPdfNumber(maxVel, 1)} km/h`}
              color={C.green}
              items={byVel.map(r => ({ name: fmt(r.player.name), value: safeN(r.maxVelocity) }))}
              maxVal={rMax(velArr)} f={v => v.toFixed(1)} />
          </div>


        </section>
      )}

      {gps && neuromuscularRows.length > 0 && (
        <section className="sr-section">
          <Sec eyebrow="Carga neuromuscular" title="Ranking de demanda neuromuscular"
            sub="Ordena a los jugadores por ACC + DCC + sprints + RHIE para identificar quién concentró más acciones de alta exigencia." />
          <table className="sr-heat-table" style={{ fontSize: 9.5 }}>
            <thead><tr>
              <th className="sr-th-name">Jugador</th><th>Pos.</th><th>ACC</th><th>DCC</th><th>Sprints</th><th>RHIE</th><th>Total neuro</th>
            </tr></thead>
            <tbody>
              {neuromuscularRows.map(item => (
                <tr key={`neuro-${item.row.player.id}`}>
                  <td className="sr-td-name">{item.row.player.name}</td>
                  <td className="sr-td-pos">{item.row.player.position}</td>
                  <td style={{ textAlign:'center', fontWeight:900 }}>{item.row.acc}</td>
                  <td style={{ textAlign:'center', fontWeight:900 }}>{item.row.dcc}</td>
                  <td style={{ textAlign:'center', fontWeight:900 }}>{item.row.sprints}</td>
                  <td style={{ textAlign:'center', fontWeight:900 }}>{item.row.rhie}</td>
                  <td style={{ textAlign:'center', fontWeight:900, color: item.value >= avgNeuromuscular * 1.25 ? C.red : item.value >= avgNeuromuscular ? C.amber : C.green }}>{item.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ══ SECCIÓN YOUTH (U17/U15): CARGA + WELLNESS ═══════════════════════ */}
      {!gps && reg.length > 0 && (
        <section className="sr-section">
          <Sec eyebrow="Individual" title="Carga individual y bienestar" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <BarCol title={`Carga interna (MIN×RPE) · prom ${Math.round(totalLoad / Math.max(1, reg.length))} UA`}
              color={C.blue}
              items={[...reg].sort((a, b) => b.min * b.rpe - a.min * a.rpe).map(r => ({ name: fmt(r.player.name), value: r.min * r.rpe }))}
              maxVal={rMax(loadArr)} />
            <BarCol title={`Tiempo en sesión · prom ${Math.round(avgMin)} min`}
              color={C.blue2}
              items={[...reg].sort((a, b) => b.min - a.min).map(r => ({ name: fmt(r.player.name), value: r.min }))}
              maxVal={rMax(reg.map(x => x.min))} />
          </div>
          {wellnessRecords.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: C.green, marginBottom: 8 }}>
                Wellness del día · promedio {avgWell ? avgWell.toFixed(1) : '—'}/5
              </div>
              <table className="sr-heat-table" style={{ fontSize: 10 }}>
                <thead><tr>
                  <th className="sr-th-name">Jugador</th>
                  <th>Sueño</th><th>Energía</th><th>Tranquilidad</th><th>Músculo</th><th>Ánimo</th><th>Prom.</th>
                </tr></thead>
                <tbody>
                  {reg.map(r => {
                    const w = wellMap.get(r.player.id);
                    const wa = w ? (w.sleep + w.fatigue + w.stress + w.musclePain + w.mood) / 5 : 0;
                    return (
                      <tr key={r.player.id}>
                        <td className="sr-td-name">{r.player.name}</td>
                        {w ? <>
                          <HC v={w.sleep}      lo={1} hi={5} f={v => v.toFixed(0)} />
                          <HC v={w.fatigue}    lo={1} hi={5} f={v => v.toFixed(0)} />
                          <HC v={w.stress}     lo={1} hi={5} f={v => v.toFixed(0)} />
                          <HC v={w.musclePain} lo={1} hi={5} f={v => v.toFixed(0)} />
                          <HC v={w.mood}       lo={1} hi={5} f={v => v.toFixed(0)} />
                          <HC v={wa}           lo={1} hi={5} f={v => v.toFixed(1)} />
                        </> : <td colSpan={6} style={{ textAlign: 'center', color: C.muted, fontSize: 10 }}>Sin registro</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ══ RELACIÓN CARGA + WELLNESS ═══════════════════════════════════════ */}
      {wellnessRecords.length > 0 && reg.length > 0 && (
        <section className="sr-section">
          <Sec eyebrow="Control integrado" title="Relación carga externa/interna vs wellness"
            sub="Cruce operativo para detectar jugadores con alta carga y baja disposición subjetiva." />
          <div className="sr-kpi-grid" style={{ marginBottom: 10 }}>
            <KTile label="Readiness grupal" value={avgReadiness ? avgReadiness.toFixed(1) : '—'} note="Promedio 1–5; mayor = mejor" accent={avgReadiness >= 3.7 ? C.green : avgReadiness >= 3.2 ? C.amber : C.red} />
            <KTile label="Energía prom." value={avgFatigue ? avgFatigue.toFixed(1) : '—'} note="Mayor = más fresco" accent={avgFatigue >= 3.7 ? C.green : avgFatigue >= 3.0 ? C.amber : C.red} />
            <KTile label="Estado muscular" value={avgPain ? avgPain.toFixed(1) : '—'} note="Mayor = sin dolor" accent={avgPain >= 3.7 ? C.green : avgPain >= 3.0 ? C.amber : C.red} />
            <KTile label="Tranquilidad" value={avgStress ? avgStress.toFixed(1) : '—'} note="Mayor = menos estrés" accent={avgStress >= 3.7 ? C.green : avgStress >= 3.0 ? C.amber : C.red} />
          </div>
        </section>
      )}

      {/* ══ INDIVIDUALIZACIÓN CIENTÍFICA ═════════════════════════════════════ */}
      {false && reg.length > 0 && (
        <section className="sr-section" style={{ pageBreakBefore: gps ? 'always' : undefined }}>
          <Sec eyebrow="Individualización" title="Matriz científica para ajustar la próxima carga"
            sub="Integra línea base individual, carga 7d vs habitual, wellness, estado médico, posición y respuesta de la sesión." />
          <div className="sr-kpi-grid" style={{ marginBottom: 10 }}>
            <KTile label="Readiness medio" value={`${Math.round(meanClean(scientificRows.map(r => r.score)))}%`} note={`${lowReadinessCount} jugador(es) <70%`} accent={lowReadinessCount >= 3 ? C.red : lowReadinessCount >= 1 ? C.amber : C.green} />
            <KTile label="ACR medio" value={avgAcwr ? avgAcwr.toFixed(2) : 's/d'} note="Carga 7d vs carga habitual semanal" accent={avgAcwr > 1.6 ? C.red : avgAcwr > 1.3 || avgAcwr < 0.8 ? C.amber : C.green} />
            <KTile label="Carga completa" value={`${fullLoadCount}/${scientificRows.length}`} note="Jugadores con 90-100% sugerido" accent={fullLoadCount >= scientificRows.length * .7 ? C.green : C.amber} />
            <KTile label="Neuromuscular prom." value={avgNeuromuscular ? Math.round(avgNeuromuscular) : '—'} note="ACC+DCC+sprints+RHIE" accent={C.blue2} />
          </div>
          <table className="sr-heat-table" style={{ fontSize: 9.5 }}>
            <thead><tr>
              <th className="sr-th-name">Jugador</th><th>Pos.</th><th>Readiness</th><th>Wellness</th><th>Δ línea base</th><th>Carga hoy</th><th>7d</th><th>ACR</th><th>Decisión próxima carga</th><th>Motivo principal</th>
            </tr></thead>
            <tbody>
              {scientificRows.map(item => {
                const ac = acwrLabel(item.acwr);
                return (
                  <tr key={`sci-${item.player.id}`}>
                    <td className="sr-td-name">{item.player.name}</td>
                    <td className="sr-td-pos">{item.player.position}</td>
                    <td style={{ textAlign:'center', fontWeight:900, color: item.score >= 85 ? '#065f46' : item.score >= 70 ? '#713f12' : '#7f1d1d', background: item.score >= 85 ? '#d1fae5' : item.score >= 70 ? '#fef9c3' : '#fee2e2' }}>{Math.round(item.score)}%</td>
                    <td style={{ textAlign:'center', fontWeight:900 }}>{item.todayWell ? item.todayWell.toFixed(1) : '—'}</td>
                    <td style={{ textAlign:'center', fontWeight:900, color: item.wellnessDelta <= -1 ? C.red : item.wellnessDelta <= -0.5 ? C.amber : C.green }}>{item.wellnessBaseline ? `${item.wellnessDelta >= 0 ? '+' : ''}${item.wellnessDelta.toFixed(1)}` : 's/d'}</td>
                    <td style={{ textAlign:'center', fontWeight:900 }}>{Math.round(item.loadToday)}</td>
                    <td style={{ textAlign:'center', fontWeight:900 }}>{Math.round(item.load7)}</td>
                    <td style={{ textAlign:'center', fontWeight:900, color: ac.tone === 'red' ? C.red : ac.tone === 'yellow' ? C.amber : C.green }}>{ac.label}</td>
                    <td style={{ fontWeight:900 }}>{item.decision.label} · {item.decision.pct}</td>
                    <td style={{ color:C.muted }}>{item.reasons[0] ?? positionFocus(item.player.position)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="sr-insight sr-insight-neutral" style={{ marginTop: 8 }}>
            Lectura científica: la recomendación no usa un umbral único para todo el plantel; compara cada jugador contra su línea base individual de 28 días, su relación 7d/habitual, su posición, el RPE de la sesión, el estado médico y el wellness del día. La decisión final debe confirmarse con observación de campo y criterio médico/deportivo.
          </div>
        </section>
      )}

      {false && priorityRows.length > 0 && (
        <section className="sr-section">
          <Sec eyebrow="Decisiones" title="Prioridades individuales para el cuerpo técnico"
            sub="Acciones sugeridas para convertir el informe en ajustes concretos de carga." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {priorityRows.map(item => (
              <div key={`prio-${item.player.id}`} className={`sr-alert ${item.decision.tone === 'red' ? 'sr-alert-red' : item.decision.tone === 'yellow' ? 'sr-alert-amber' : 'sr-alert-blue'}`}>
                <strong>{item.player.name} · {item.decision.label} ({item.decision.pct})</strong><br />
                {item.decision.text}<br />
                <span style={{ color: C.muted }}>Línea base wellness {item.wellnessBaseline ? item.wellnessBaseline.toFixed(1) : 's/d'} · hoy {item.todayWell ? item.todayWell.toFixed(1) : 's/d'} · 7d {Math.round(item.load7)} UA · {positionFocus(item.player.position)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {false && nextSessionRows.length > 0 && (
        <section className="sr-section">
          <Sec eyebrow="Próxima sesión" title="Recomendación concreta por jugador"
            sub="Convierte la decisión porcentual en restricciones y focos prácticos para la siguiente sesión." />
          <table className="sr-heat-table" style={{ fontSize: 9.5 }}>
            <thead><tr>
              <th className="sr-th-name">Jugador</th><th>Decisión</th><th>Motivo</th><th>Acción concreta</th>
            </tr></thead>
            <tbody>
              {nextSessionRows.map(item => (
                <tr key={`next-${item.player.id}`}>
                  <td className="sr-td-name">{item.player.name}</td>
                  <td style={{ fontWeight:900 }}>{item.decision.label} · {item.decision.pct}</td>
                  <td style={{ color:C.muted }}>{item.reasons.slice(0, 2).join(' · ') || positionFocus(item.player.position)}</td>
                  <td style={{ color:C.text }}>{concreteNextAction(item, invalidGpsIds.has(item.player.id))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {false && subStimRows.length > 0 && (
        <section className="sr-section">
          <Sec eyebrow="Subestimulación" title="Jugadores con posible necesidad de complemento"
            sub="Detecta baja exposición relativa dentro de la sesión. Solo debe convertirse en compensatorio si no hay dolor, restricción o fatiga elevada." />
          <table className="sr-heat-table" style={{ fontSize: 9.5 }}>
            <thead><tr>
              <th className="sr-th-name">Jugador</th><th>Pos.</th><th>RPE</th><th>Señal</th><th>Recomendación</th>
            </tr></thead>
            <tbody>
              {subStimRows.map(item => (
                <tr key={`stim-${item.player.id}`}>
                  <td className="sr-td-name">{item.player.name}</td>
                  <td className="sr-td-pos">{item.player.position}</td>
                  <td style={{ textAlign:'center', fontWeight:900 }}>{item.row.rpe || '—'}</td>
                  <td style={{ color:C.muted }}>{item.reasons.join(' · ')}</td>
                  <td style={{ color: item.readyForExtra ? C.green : C.amber, fontWeight:800 }}>
                    {item.readyForExtra ? stimulationAction(item.row) : 'No compensar automáticamente; revisar wellness, RPE o disponibilidad primero.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Datos + alertas simples */}
      <section className="sr-section">
        <Sec eyebrow="Datos" title="Resumen de sesión y alertas" />
        <div className="sr-insight">
          {reg.length
            ? gps
              ? `Sesión ${sessionNumber || '—'} · ${categoryLabel(category)} · ${reg.length} jugadores. Distancia acumulada ${formatPdfNumber(totalDist)} m (${formatPdfNumber(totalDist / Math.max(1, reg.length))} m/jugador), Player Load ${formatPdfNumber(totalPL)}, RHIE ${formatPdfNumber(totalHSR)}, IMA prom. ${formatPdfNumber(avgIma, 1)} · Sprint efforts ${formatPdfNumber(totalSpr)}, velocidad máxima ${formatPdfNumber(maxVel, 1)} km/h.`
              : `Sesión ${sessionNumber || '—'} · ${categoryLabel(category)} · ${reg.length} jugadores. Carga interna total ${Math.round(totalLoad)} UA (${Math.round(avgMin)} min, RPE ${avgRpe.toFixed(1)}).${avgReadiness ? ` Wellness readiness ${avgReadiness.toFixed(1)}/5.` : ''}`
            : 'Sin registros de sesión.'}
        </div>
        {objective?.trim() && <div className="sr-insight sr-insight-green" style={{ marginTop: 8 }}><strong>Objetivo:</strong> {getPdfSafeText(objective)}</div>}
        {observation?.trim() && <div className="sr-insight sr-insight-neutral" style={{ marginTop: 8 }}><strong>Observación:</strong> {getPdfSafeText(observation)}</div>}
        {(highRpe.length > 0 || lowWell.length > 0 || invalidGpsRows.length > 0 || absentPlayers.length > 0) && (
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {highRpe.length > 0 && <div className="sr-alert sr-alert-red">⚠ RPE elevado (≥8): {highRpe.map(r => r.player.name).join(', ')}</div>}
            {lowWell.length > 0 && <div className="sr-alert sr-alert-amber">⚠ Wellness bajo: {lowWell.map(r => r.player.name).join(', ')}</div>}
            {invalidGpsRows.length > 0 && <div className="sr-alert sr-alert-amber">⚠ Revisar GPS: {invalidGpsRows.map(r => r.player.name).join(', ')} presentan minutos altos con distancia/Player Load casi nulos.</div>}
            {absentPlayers.length > 0 && <div className="sr-alert sr-alert-blue">Sin registrar ({absentPlayers.length}): {absentPlayers.map(p => p.name).join(', ')}</div>}
          </div>
        )}
      </section>

      <ReportFooter category={category} />
    </article>
  );
}
