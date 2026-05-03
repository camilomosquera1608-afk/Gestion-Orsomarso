'use client';

import { categoryLabel } from '@/lib/labels';
import type { ClubCategory, DailyWellnessRecord, Microcycle, Player, SessionParticipation, TrainingSessionType } from '@/lib/types';
import { formatPdfDate, formatPdfNumber, getPdfSafeText, supportsGps } from '@/lib/report-utils';
import { ReportFooter, ReportHeader } from './report-ui';
import { groupAverage } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
type Row = {
  player: Player; selected: boolean; participation: SessionParticipation;
  min: number; rpe: number; acc: number; dcc: number; sprints: number; rhie: number; ima: number;
  totalDistance?: number; maxVelocity?: number; playerLoad?: number;
  highSpeedDistance?: number; sprintDistance?: number;
};
type Props = {
  date: string; category: ClubCategory; microcycle?: Microcycle;
  sessionNumber?: string | number; sessionType: TrainingSessionType;
  objective?: string; observation?: string; rows: Row[]; absentPlayers: Player[];
  wellnessRecords?: DailyWellnessRecord[]; dataQualityPercent?: number;
  generatedAt?: string; className?: string; compact?: boolean;
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const avg = (a: number[]) => groupAverage(a.filter(v => Number.isFinite(v) && v > 0));
const safeN = (v?: number) => Number.isFinite(Number(v)) ? Number(v) : 0;
const sumN = (a: Array<number | undefined>) => a.reduce<number>((s, v) => s + safeN(v), 0);
const maxN = (a: Array<number | undefined>) => a.reduce<number>((s, v) => Math.max(s, safeN(v)), 0);
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const pct = (v: number, ref: number) => ref > 0 ? clamp(Math.round(v / ref * 100)) : 0;
const wellAvg = (r?: DailyWellnessRecord) => {
  if (!r) return 0;
  const vs = [r.sleep, r.fatigue, r.stress, r.musclePain, r.mood].filter(v => Number.isFinite(v) && v > 0);
  return vs.length ? vs.reduce((a, v) => a + v, 0) / vs.length : 0;
};
const rMin = (a: number[]) => Math.min(...a.filter(v => v > 0), 0);
const rMax = (a: number[]) => Math.max(...a, 1);
const sessionLabel = (v: TrainingSessionType) =>
  ({ cdef: 'Recuperación', cdEf: 'Ejecución', cdeF: 'Condición física', Cdef: 'Comunicación' }[v] ?? v);

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
function HC({ v, lo, hi, f = (x: number) => String(Math.round(x)), inv = false }: {
  v: number; lo: number; hi: number; f?: (x: number) => string; inv?: boolean;
}) {
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
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: '12px 14px', display: 'grid', gap: 4, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', color: C.muted }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-.05em', color: C.navy, lineHeight: 1 }}>{value}</div>
      {note && <div style={{ fontSize: 9.5, fontWeight: 700, color: C.muted }}>{note}</div>}
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────
function Sec({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div style={{ paddingBottom: 8, marginBottom: 10, borderBottom: `2px solid ${C.line}` }}>
      <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.16em', color: C.blue, marginBottom: 2 }}>{eyebrow}</div>
      <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-.03em', color: C.navy }}>{title}</div>
      {sub && <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Bar section (2-column label + bars + values) ─────────────────────────────
function BarCol({ title, color, items, maxVal, f }: {
  title: string; color: string; items: { name: string; value: number }[]; maxVal: number; f?: (v: number) => string;
}) {
  return (
    <div>
      <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
        {title}
      </div>
      {items.map(item => <HBar key={item.name} name={item.name} value={item.value} maxVal={maxVal} color={color} f={f} />)}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function SessionReportTemplate({
  date, category, microcycle, sessionNumber, sessionType,
  objective, observation, rows, absentPlayers,
  wellnessRecords = [], dataQualityPercent = 0,
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
  const totalHSR  = sumN(reg.map(r => r.highSpeedDistance));
  const totalSpr  = sumN(reg.map(r => r.sprintDistance));
  const maxVel    = maxN(reg.map(r => r.maxVelocity));
  const avgMMin   = avg(reg.map(r => r.min > 0 && r.totalDistance ? r.totalDistance / r.min : 0));
  const avgAcc    = avg(reg.map(r => r.acc));
  const avgDcc    = avg(reg.map(r => r.dcc));
  const wellMap   = new Map(wellnessRecords.map(r => [r.playerId, r]));
  const avgWell   = avg(reg.map(r => wellAvg(wellMap.get(r.player.id))).filter(v => v > 0));
  const partScore = reg.length + absentPlayers.length ? pct(reg.length, reg.length + absentPlayers.length) : 0;
  const volScore  = gps ? pct(totalDist, reg.length * 6200) : pct(totalLoad, reg.length * 650);
  const intScore  = gps ? pct(avgMMin, 95) : pct(avgRpe * 10, 100);
  const mcText    = microcycle ? getPdfSafeText(microcycle.name, 'Microciclo') : 'Sin microciclo';

  // Sorted lists
  const byDist = [...reg].sort((a, b) => safeN(b.totalDistance) - safeN(a.totalDistance));
  const byHSR  = [...reg].sort((a, b) => safeN(b.highSpeedDistance) - safeN(a.highSpeedDistance));
  const bySpr  = [...reg].sort((a, b) => safeN(b.sprintDistance) - safeN(a.sprintDistance));
  const byAcc  = [...reg].sort((a, b) => b.acc - a.acc);
  const byDcc  = [...reg].sort((a, b) => b.dcc - a.dcc);
  const byVel  = [...reg].sort((a, b) => safeN(b.maxVelocity) - safeN(a.maxVelocity));

  // Ranges
  const distArr = reg.map(r => safeN(r.totalDistance));
  const plArr   = reg.map(r => safeN(r.playerLoad));
  const hsrArr  = reg.map(r => safeN(r.highSpeedDistance));
  const sprArr  = reg.map(r => safeN(r.sprintDistance));
  const accArr  = reg.map(r => r.acc);
  const dccArr  = reg.map(r => r.dcc);
  const velArr  = reg.map(r => safeN(r.maxVelocity));
  const loadArr = reg.map(r => r.min * r.rpe);
  const mminArr = reg.map(r => r.min > 0 && r.totalDistance ? r.totalDistance / r.min : 0);

  // Only show sprint if there's meaningful data
  const hasSprint = totalSpr > 0;
  const highRpe   = reg.filter(r => r.rpe >= 8);
  const lowWell   = reg.filter(r => { const w = wellAvg(wellMap.get(r.player.id)); return w > 0 && w < 3.2; });

  return (
    <article className={`pdf-report-document ${className}`} style={{ fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
      <ReportHeader
        title="Informe de sesión"
        subtitle={`${formatPdfDate(date)} · Sesión ${sessionNumber || '—'}`}
        category={category}
        generatedAt={generatedAt}
      />

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
              <div className="srp-kpi"><div className="srp-kpi-label">WELLNESS</div><div className="srp-kpi-value">{avgWell ? avgWell.toFixed(1) : '—'}</div><div className="srp-kpi-note">/5 promedio</div></div>
            </>}
          </div>
        </div>
      )}

      {/* ══ PÁGINA 2: RESUMEN + TABLA ════════════════════════════════════════ */}
      <section className="sr-section">
        <Sec eyebrow="Resumen ejecutivo" title="Promedios generales de la sesión"
          sub={`${formatPdfDate(date)} · ${sessionLabel(sessionType)} · ${mcText}`} />

        {/* Gauges + KPIs en una fila compacta */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', gap: 20, alignItems: 'start', marginBottom: 14 }}>
          <Gauge val={volScore} label="Volumen"
            sub={gps ? `${formatPdfNumber(totalDist / Math.max(1, reg.length))} m` : `${Math.round(totalLoad / Math.max(1, reg.length))} UA`}
            color={volScore >= 65 ? C.green : volScore >= 40 ? C.amber : C.red} />
          <Gauge val={intScore} label="Intensidad"
            sub={gps ? `${formatPdfNumber(avgMMin, 1)} m/min` : `RPE ${avgRpe.toFixed(1)}`}
            color={intScore >= 65 ? C.green : intScore >= 40 ? C.amber : C.red} />
          <Gauge val={partScore} label="Participación"
            sub={`${reg.length} / ${reg.length + absentPlayers.length}`}
            color={partScore >= 70 ? C.green : partScore >= 45 ? C.amber : C.red} />
          {/* KPI grid alongside */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, alignContent: 'start' }}>
            <KTile label="Tiempo prom." value={`${Math.round(avgMin)} min`} note="Por jugador" accent={C.blue} />
            <KTile label="RPE promedio" value={avgRpe.toFixed(1)} note="Escala 1–10"
              accent={avgRpe <= 6 ? C.green : avgRpe <= 8 ? C.amber : C.red} />
            {gps ? <>
              <KTile label="Distancia" value={`${formatPdfNumber(totalDist / Math.max(1, reg.length))} m`} note="Prom. jugador" accent={C.blue} />
              <KTile label="m/min" value={formatPdfNumber(avgMMin, 1)} note="Intensidad"
                accent={avgMMin >= 75 ? C.green : avgMMin >= 55 ? C.amber : C.red} />
              <KTile label="HSR prom." value={`${formatPdfNumber(totalHSR / Math.max(1, reg.length))} m`} note="Alta velocidad" accent={C.blue2} />
              <KTile label="Player Load" value={formatPdfNumber(totalPL / Math.max(1, reg.length))} note="Prom. jugador" accent={C.navy} />
              <KTile label="ACC prom." value={String(Math.round(avgAcc))} note=">3 m/s²" accent={C.navy} />
              <KTile label="DEC prom." value={String(Math.round(avgDcc))} note=">-3 m/s²" accent={C.navy} />
            </> : <>
              <KTile label="Carga total" value={`${Math.round(totalLoad)} UA`} note="Equipo" accent={C.blue} />
              <KTile label="Wellness" value={avgWell ? avgWell.toFixed(1) : '—'} note="/5 prom."
                accent={avgWell >= 3.7 ? C.green : C.amber} />
              <KTile label="Completitud" value={`${dataQualityPercent}%`} note="Planilla" accent={C.green} />
              <KTile label="Participación" value={`${partScore}%`} note={`${reg.length}/${reg.length + absentPlayers.length}`}
                accent={partScore >= 70 ? C.green : C.amber} />
            </>}
          </div>
        </div>
      </section>

      {/* Tabla descriptiva — misma página que los KPIs */}
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
                  <th>Dist. (m)</th><th>m/min</th><th>PL</th>
                  <th>HSR (m)</th>{hasSprint && <th>Spr. (m)</th>}
                  <th>ACC</th><th>DCC</th><th>V.máx</th>
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
                    <HC v={r.rpe}  lo={0} hi={10} />
                    <HC v={load}   lo={rMin(loadArr)} hi={rMax(loadArr)} />
                    {gps ? <>
                      <HC v={safeN(r.totalDistance)}    lo={rMin(distArr)} hi={rMax(distArr)} f={v => formatPdfNumber(v)} />
                      <HC v={mmin}                      lo={rMin(mminArr)} hi={rMax(mminArr)} f={v => formatPdfNumber(v, 1)} />
                      <HC v={safeN(r.playerLoad)}       lo={rMin(plArr)}   hi={rMax(plArr)}   f={v => formatPdfNumber(v)} />
                      <HC v={safeN(r.highSpeedDistance)} lo={rMin(hsrArr)} hi={rMax(hsrArr)}  f={v => formatPdfNumber(v)} />
                      {hasSprint && <HC v={safeN(r.sprintDistance)} lo={rMin(sprArr)} hi={rMax(sprArr)} f={v => formatPdfNumber(v)} />}
                      <HC v={r.acc} lo={rMin(accArr)} hi={rMax(accArr)} />
                      <HC v={r.dcc} lo={rMin(dccArr)} hi={rMax(dccArr)} />
                      <HC v={safeN(r.maxVelocity)} lo={rMin(velArr)} hi={rMax(velArr)} f={v => v.toFixed(1)} />
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

          {/* Fila 1: Distancia + HSR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
            <BarCol title={`Distancia total · prom ${formatPdfNumber(totalDist / Math.max(1, reg.length))} m`}
              color={C.blue}
              items={byDist.map(r => ({ name: fmt(r.player.name), value: safeN(r.totalDistance) }))}
              maxVal={rMax(distArr)} />
            <BarCol title={`Alta velocidad HSR · prom ${formatPdfNumber(totalHSR / Math.max(1, reg.length))} m`}
              color={C.red}
              items={byHSR.map(r => ({ name: fmt(r.player.name), value: safeN(r.highSpeedDistance) }))}
              maxVal={rMax(hsrArr)} />
          </div>

          {/* Fila 2: ACC + DCC + Velocidad máxima */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: hasSprint ? 20 : 0 }}>
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

          {/* Sprint solo si hay datos */}
          {hasSprint && (
            <BarCol title={`Sprint distance · prom ${formatPdfNumber(totalSpr / Math.max(1, reg.length))} m`}
              color={C.amber}
              items={bySpr.filter(r => safeN(r.sprintDistance) > 0).map(r => ({ name: fmt(r.player.name), value: safeN(r.sprintDistance) }))}
              maxVal={rMax(sprArr)} />
          )}
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
                  <th>Sueño</th><th>Fatiga</th><th>Estrés</th><th>Muscular</th><th>Ánimo</th><th>Prom.</th>
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
                          <HC v={w.stress}     lo={1} hi={5} f={v => v.toFixed(0)} inv />
                          <HC v={w.musclePain} lo={1} hi={5} f={v => v.toFixed(0)} inv />
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

      {/* ══ ANÁLISIS + ALERTAS ════════════════════════════════════════════════ */}
      <section className="sr-section">
        <Sec eyebrow="Análisis" title="Lectura de sesión" />
        <div className="sr-insight">
          {reg.length
            ? gps
              ? `Sesión ${sessionNumber || '—'} · ${categoryLabel(category)} · ${reg.length} jugadores. Distancia acumulada ${formatPdfNumber(totalDist)} m (${formatPdfNumber(totalDist / Math.max(1, reg.length))} m/jugador), Player Load ${formatPdfNumber(totalPL)}, HSR ${formatPdfNumber(totalHSR)} m${hasSprint ? `, Sprint ${formatPdfNumber(totalSpr)} m` : ''}, velocidad máxima ${formatPdfNumber(maxVel, 1)} km/h.`
              : `Sesión ${sessionNumber || '—'} · ${categoryLabel(category)} · ${reg.length} jugadores. Carga interna total ${Math.round(totalLoad)} UA (${Math.round(avgMin)} min, RPE ${avgRpe.toFixed(1)}).${avgWell ? ` Wellness grupal ${avgWell.toFixed(1)}/5.` : ''}`
            : 'Sin registros de sesión.'}
        </div>
        {objective?.trim() && <div className="sr-insight sr-insight-green" style={{ marginTop: 8 }}><strong>Objetivo:</strong> {getPdfSafeText(objective)}</div>}
        {observation?.trim() && <div className="sr-insight sr-insight-neutral" style={{ marginTop: 8 }}><strong>Observación:</strong> {getPdfSafeText(observation)}</div>}
        {(highRpe.length > 0 || lowWell.length > 0 || absentPlayers.length > 0) && (
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {highRpe.length > 0 && <div className="sr-alert sr-alert-red">⚠ RPE elevado (≥8): {highRpe.map(r => r.player.name).join(', ')}</div>}
            {lowWell.length > 0 && <div className="sr-alert sr-alert-amber">⚠ Wellness bajo: {lowWell.map(r => r.player.name).join(', ')}</div>}
            {absentPlayers.length > 0 && <div className="sr-alert sr-alert-blue">Sin registrar ({absentPlayers.length}): {absentPlayers.map(p => p.name).join(', ')}</div>}
          </div>
        )}
      </section>

      <ReportFooter category={category} />
    </article>
  );
}
