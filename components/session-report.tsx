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

// ─── Utils ───────────────────────────────────────────────────────────────────
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
const short = (name: string) => {
  const p = getPdfSafeText(name, '').split(' ').filter(Boolean);
  return p.length <= 2 ? p.join(' ') : `${p[0]} ${p[1]?.[0] ?? ''}.`;
};
const rMin = (a: number[]) => Math.min(...a.filter(v => v > 0), 0);
const rMax = (a: number[]) => Math.max(...a, 1);
const sessionLabel = (v: TrainingSessionType) =>
  ({ cdef: 'Recuperación', cdEf: 'Ejecución', cdeF: 'Condición física', Cdef: 'Comunicación' }[v] ?? v);

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  navy: '#06152f', blue: '#1557d6', blue2: '#2563eb',
  green: '#059669', red: '#dc2626', amber: '#d97706',
  muted: '#64748b', line: '#e2e8f0', soft: '#f0f4fb',
  text: '#1e293b',
};

// ─── Heatmap cell ─────────────────────────────────────────────────────────────
function HC({ v, lo, hi, fmt = (x: number) => String(Math.round(x)), inv = false }:
  { v: number; lo: number; hi: number; fmt?: (x: number) => string; inv?: boolean }) {
  const pos = clamp(Math.round((v - lo) / Math.max(1, hi - lo) * 100));
  const score = inv ? 100 - pos : pos;
  const [bg, fg] = score >= 65 ? ['#d1fae5', '#065f46'] : score >= 35 ? ['#fef9c3', '#713f12'] : ['#fee2e2', '#7f1d1d'];
  return (
    <td style={{ background: bg, color: fg, fontWeight: 900, textAlign: 'center', fontSize: 10, padding: '6px 4px', letterSpacing: '-.02em' }}>
      {fmt(v)}
    </td>
  );
}

// ─── Gauge SVG ───────────────────────────────────────────────────────────────
function Gauge({ val, label, sub, color }: { val: number; label: string; sub?: string; color: string }) {
  const r = 36; const circ = Math.PI * r;
  const ratio = clamp(val);
  const offset = circ * (1 - ratio / 100);
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 6, textAlign: 'center' }}>
      <svg viewBox="0 0 88 56" style={{ width: 88, height: 56, overflow: 'visible' }}>
        <defs>
          <linearGradient id={`g${color.replace('#','')}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity=".6" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        {/* Track */}
        <path d="M 8 48 A 36 36 0 0 1 80 48" fill="none" stroke={C.line} strokeWidth="10" strokeLinecap="round" />
        {/* Fill */}
        <path d="M 8 48 A 36 36 0 0 1 80 48" fill="none"
          stroke={`url(#g${color.replace('#','')})`} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} />
        {/* Value text */}
        <text x="44" y="42" textAnchor="middle" fontSize="16" fontWeight="900" fill={C.navy} letterSpacing="-1">{ratio}%</text>
      </svg>
      <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', color: C.muted }}>{label}</div>
      {sub && <div style={{ fontSize: 10, fontWeight: 700, color: C.text, marginTop: -4 }}>{sub}</div>}
    </div>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────
function KTile({ label, value, note, accent }: { label: string; value: string | number; note?: string; accent: string }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: '14px 16px',
      display: 'grid', gap: 5, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '16px 16px 0 0' }} />
      <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', color: C.muted }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-.05em', lineHeight: 1, color: C.navy }}>{value}</div>
      {note && <div style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>{note}</div>}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function Sec({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 12, borderBottom: `2px solid ${C.line}` }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.16em', color: C.blue, marginBottom: 3 }}>{eyebrow}</div>
        <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-.03em', color: C.navy }}>{title}</div>
        {sub && <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function SessionReportTemplate({
  date, category, microcycle, sessionNumber, sessionType,
  objective, observation, rows, absentPlayers,
  wellnessRecords = [], dataQualityPercent = 0,
  generatedAt = new Date().toLocaleString('es-CO'),
  className = '', compact = false,
}: Props) {
  const gps = supportsGps(category);
  const reg = rows.filter(r => r.selected || r.min > 0 || r.rpe > 0 || safeN(r.totalDistance) > 0);

  // ─ Aggregate metrics ─
  const totalLoad = reg.reduce((a, r) => a + r.min * r.rpe, 0);
  const avgMin  = avg(reg.map(r => r.min));
  const avgRpe  = avg(reg.map(r => r.rpe));
  const totalDist = sumN(reg.map(r => r.totalDistance));
  const totalPL   = sumN(reg.map(r => r.playerLoad));
  const totalHSR  = sumN(reg.map(r => r.highSpeedDistance));
  const totalSpr  = sumN(reg.map(r => r.sprintDistance));
  const totalAcc  = sumN(reg.map(r => r.acc));
  const totalDcc  = sumN(reg.map(r => r.dcc));
  const maxVel    = maxN(reg.map(r => r.maxVelocity));
  const avgMMin   = avg(reg.map(r => r.min > 0 && r.totalDistance ? r.totalDistance / r.min : 0));
  const avgAcc    = avg(reg.map(r => r.acc));
  const avgDcc    = avg(reg.map(r => r.dcc));
  const wellMap   = new Map(wellnessRecords.map(r => [r.playerId, r]));
  const avgWell   = avg(reg.map(r => wellAvg(wellMap.get(r.player.id))).filter(v => v > 0));
  const partScore = reg.length + absentPlayers.length
    ? pct(reg.length, reg.length + absentPlayers.length) : 0;

  const mcText = microcycle ? getPdfSafeText(microcycle.name, 'Microciclo') : 'Sin microciclo';
  const volScore = gps ? pct(totalDist, reg.length * 6200) : pct(totalLoad, reg.length * 650);
  const intScore = gps ? pct(avgMMin, 95) : pct(avgRpe * 10, 100);

  // ─ Range arrays for heatmap ─
  const distArr  = reg.map(r => safeN(r.totalDistance));
  const plArr    = reg.map(r => safeN(r.playerLoad));
  const hsrArr   = reg.map(r => safeN(r.highSpeedDistance));
  const sprArr   = reg.map(r => safeN(r.sprintDistance));
  const accArr   = reg.map(r => r.acc);
  const dccArr   = reg.map(r => r.dcc);
  const velArr   = reg.map(r => safeN(r.maxVelocity));
  const minArr   = reg.map(r => r.min);
  const rpeArr   = reg.map(r => r.rpe);
  const loadArr  = reg.map(r => r.min * r.rpe);
  const mminArr  = reg.map(r => r.min > 0 && r.totalDistance ? r.totalDistance / r.min : 0);

  // ─ Sorted lists for bar charts ─
  const byDist  = [...reg].sort((a, b) => safeN(b.totalDistance) - safeN(a.totalDistance));
  const byHSR   = [...reg].sort((a, b) => safeN(b.highSpeedDistance) - safeN(a.highSpeedDistance));
  const bySpr   = [...reg].sort((a, b) => safeN(b.sprintDistance) - safeN(a.sprintDistance));
  const byAcc   = [...reg].sort((a, b) => b.acc - a.acc);
  const byDcc   = [...reg].sort((a, b) => b.dcc - a.dcc);
  const byVel   = [...reg].sort((a, b) => safeN(b.maxVelocity) - safeN(a.maxVelocity));

  const highRpe  = reg.filter(r => r.rpe >= 8);
  const lowWell  = reg.filter(r => { const w = wellAvg(wellMap.get(r.player.id)); return w > 0 && w < 3.2; });

  return (
    <article className={`pdf-report-document ${className}`}
      style={{ fontFamily: "'Inter','Helvetica Neue',sans-serif", maxWidth: 960, margin: '0 auto' }}>

      <ReportHeader
        title="Informe de sesión"
        subtitle={`${formatPdfDate(date)} · Sesión ${sessionNumber || '—'}`}
        category={category}
        generatedAt={generatedAt}
      />

      {/* ══════════════════════════════════════════════════════
          PORTADA — cover page full bleed
         ══════════════════════════════════════════════════════ */}
      {!compact && (
        <div className="sr-cover" style={{ pageBreakAfter: 'always' }}>
          {/* Top bar */}
          <div className="sr-cover-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="sr-cover-logo">
                <img src="/orsomarso-crest.jpg" alt="Orsomarso" width={52} height={52} />
              </div>
              <div>
                <div className="sr-cover-brand-sup">Orsomarso Performance Hub</div>
                <div className="sr-cover-brand-name">Departamento de Fisiología</div>
              </div>
            </div>
            <div className="sr-cover-date-chip">{formatPdfDate(date)}</div>
          </div>

          {/* Big headline */}
          <div className="sr-cover-headline">
            <div className="sr-cover-tag">{gps ? '● CATAPULT GPS · U20' : '● CARGA INTERNA'}</div>
            <h1 className="sr-cover-h1">Informe<br />de Sesión</h1>
            <p className="sr-cover-sub">{sessionLabel(sessionType)} · {mcText}</p>
          </div>

          {/* Meta chips */}
          <div className="sr-cover-chips">
            {[categoryLabel(category), `Sesión ${sessionNumber || '—'}`, `${reg.length} jugadores`, formatPdfDate(date)]
              .map(t => <span key={t} className="sr-cover-chip">{t}</span>)}
          </div>

          <div className="sr-cover-hr" />

          {/* KPI cards */}
          <div className="sr-cover-kpis">
            {gps ? <>
              <div className="sr-cover-kpi"><div className="sr-ck-label">Distancia total</div><div className="sr-ck-value">{formatPdfNumber(totalDist)} m</div><div className="sr-ck-note">{formatPdfNumber(totalDist / Math.max(1, reg.length))} m / jugador</div></div>
              <div className="sr-cover-kpi"><div className="sr-ck-label">Player Load</div><div className="sr-ck-value">{formatPdfNumber(totalPL)}</div><div className="sr-ck-note">carga externa total</div></div>
              <div className="sr-cover-kpi"><div className="sr-ck-label">Vel. máxima</div><div className="sr-ck-value">{formatPdfNumber(maxVel, 1)} km/h</div><div className="sr-ck-note">mejor registro</div></div>
              <div className="sr-cover-kpi"><div className="sr-ck-label">Participación</div><div className="sr-ck-value">{partScore}%</div><div className="sr-ck-note">{reg.length} de {reg.length + absentPlayers.length}</div></div>
            </> : <>
              <div className="sr-cover-kpi"><div className="sr-ck-label">Jugadores</div><div className="sr-ck-value">{reg.length}</div><div className="sr-ck-note">registrados</div></div>
              <div className="sr-cover-kpi"><div className="sr-ck-label">Carga interna</div><div className="sr-ck-value">{Math.round(totalLoad)} UA</div><div className="sr-ck-note">total</div></div>
              <div className="sr-cover-kpi"><div className="sr-ck-label">RPE promedio</div><div className="sr-ck-value">{avgRpe.toFixed(1)}</div><div className="sr-ck-note">escala 1–10</div></div>
              <div className="sr-cover-kpi"><div className="sr-ck-label">Wellness</div><div className="sr-ck-value">{avgWell ? avgWell.toFixed(1) : '—'}</div><div className="sr-ck-note">/5 promedio</div></div>
            </>}
          </div>

          <div className="sr-cover-footer">
            <span>Documento institucional · Confidencial</span>
            <span>Orsomarso SC · Rendimiento Deportivo</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          PROMEDIOS GENERALES
         ══════════════════════════════════════════════════════ */}
      <section className="sr-section">
        <Sec eyebrow="Resumen ejecutivo" title="Promedios generales de la sesión"
          sub={`${formatPdfDate(date)} · ${sessionLabel(sessionType)} · ${mcText}`} />

        {/* Gauges row */}
        <div className="sr-gauges-row">
          <Gauge val={volScore} label="Volumen"
            sub={gps ? `${formatPdfNumber(totalDist / Math.max(1, reg.length))} m` : `${Math.round(totalLoad / Math.max(1, reg.length))} UA`}
            color={volScore >= 65 ? C.green : volScore >= 40 ? C.amber : C.red} />
          <Gauge val={intScore} label="Intensidad"
            sub={gps ? `${formatPdfNumber(avgMMin, 1)} m/min` : `RPE ${avgRpe.toFixed(1)}`}
            color={intScore >= 65 ? C.green : intScore >= 40 ? C.amber : C.red} />
          <Gauge val={partScore} label="Participación"
            sub={`${reg.length} / ${reg.length + absentPlayers.length}`}
            color={partScore >= 70 ? C.green : partScore >= 45 ? C.amber : C.red} />
          {!gps && <Gauge val={pct(avgWell, 5)} label="Wellness"
            sub={avgWell ? `${avgWell.toFixed(1)} / 5` : 'sin datos'}
            color={avgWell >= 3.7 ? C.green : avgWell >= 3.2 ? C.amber : C.red} />}
        </div>

        {/* KPI grid */}
        <div className="sr-kpi-grid">
          <KTile label="Tiempo prom." value={`${Math.round(avgMin)} min`} note="Por jugador" accent={C.blue} />
          <KTile label="RPE promedio" value={avgRpe.toFixed(1)} note="Escala 1–10"
            accent={avgRpe <= 6 ? C.green : avgRpe <= 8 ? C.amber : C.red} />
          {gps ? <>
            <KTile label="Dist. prom." value={`${formatPdfNumber(totalDist / Math.max(1, reg.length))} m`} note="Por jugador" accent={C.blue} />
            <KTile label="m / min" value={formatPdfNumber(avgMMin, 1)} note="Intensidad"
              accent={avgMMin >= 75 ? C.green : avgMMin >= 55 ? C.amber : C.red} />
            <KTile label="HSR prom." value={`${formatPdfNumber(totalHSR / Math.max(1, reg.length))} m`} note="Alta velocidad" accent={C.blue2} />
            <KTile label="Sprint dist." value={`${formatPdfNumber(totalSpr)} m`} note="Total equipo" accent={C.amber} />
            <KTile label="ACC prom." value={String(Math.round(avgAcc))} note=">3 m/s²" accent={C.navy} />
            <KTile label="DEC prom." value={String(Math.round(avgDcc))} note=">-3 m/s²" accent={C.navy} />
          </> : <>
            <KTile label="Carga interna" value={`${Math.round(totalLoad)} UA`} note="Total" accent={C.blue} />
            <KTile label="Wellness" value={avgWell ? avgWell.toFixed(1) : '—'} note="/5"
              accent={avgWell >= 3.7 ? C.green : C.amber} />
            <KTile label="Completitud" value={`${dataQualityPercent}%`} note="Planilla" accent={C.green} />
            <KTile label="Participación" value={`${partScore}%`} note={`${reg.length}/${reg.length + absentPlayers.length}`}
              accent={partScore >= 70 ? C.green : C.amber} />
          </>}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          TABLA DESCRIPTIVA — HEATMAP
         ══════════════════════════════════════════════════════ */}
      {reg.length > 0 && (
        <section className="sr-section">
          <Sec eyebrow="Individual" title="Tabla descriptiva"
            sub="Heatmap: verde = mayor rendimiento · amarillo = medio · rojo = menor" />
          <div style={{ overflowX: 'auto' }}>
            <table className="sr-heat-table">
              <thead>
                <tr>
                  <th className="sr-th-name">Jugador</th>
                  <th>Pos.</th>
                  <th>MIN</th>
                  <th>RPE</th>
                  <th>Carga</th>
                  {gps ? <>
                    <th>Dist. (m)</th><th>m/min</th><th>PL</th>
                    <th>HSR (m)</th><th>Spr. (m)</th>
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
                      <td className="sr-td-name">{short(r.player.name)}</td>
                      <td className="sr-td-pos">{r.player.position}</td>
                      <HC v={r.min}  lo={rMin(minArr)}  hi={rMax(minArr)} />
                      <HC v={r.rpe}  lo={0}             hi={10} />
                      <HC v={load}   lo={rMin(loadArr)} hi={rMax(loadArr)} />
                      {gps ? <>
                        <HC v={safeN(r.totalDistance)}    lo={rMin(distArr)} hi={rMax(distArr)} fmt={v => formatPdfNumber(v)} />
                        <HC v={mmin}                      lo={rMin(mminArr)} hi={rMax(mminArr)} fmt={v => formatPdfNumber(v, 1)} />
                        <HC v={safeN(r.playerLoad)}       lo={rMin(plArr)}   hi={rMax(plArr)}   fmt={v => formatPdfNumber(v)} />
                        <HC v={safeN(r.highSpeedDistance)} lo={rMin(hsrArr)} hi={rMax(hsrArr)}  fmt={v => formatPdfNumber(v)} />
                        <HC v={safeN(r.sprintDistance)}   lo={rMin(sprArr)}  hi={rMax(sprArr)}  fmt={v => formatPdfNumber(v)} />
                        <HC v={r.acc}  lo={rMin(accArr)} hi={rMax(accArr)} />
                        <HC v={r.dcc}  lo={rMin(dccArr)} hi={rMax(dccArr)} />
                        <HC v={safeN(r.maxVelocity)} lo={rMin(velArr)} hi={rMax(velArr)} fmt={v => v.toFixed(1)} />
                      </> : <>
                        <td style={{
                          textAlign: 'center', fontWeight: 900, fontSize: 11,
                          background: well >= 3.7 ? '#d1fae5' : well >= 3.2 ? '#fef9c3' : well > 0 ? '#fee2e2' : C.soft,
                          color: well >= 3.7 ? '#065f46' : well >= 3.2 ? '#713f12' : '#7f1d1d',
                        }}>{well ? well.toFixed(1) : '—'}</td>
                        <td style={{ textAlign: 'center', fontSize: 9, color: C.muted }}>{r.participation}</td>
                      </>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════
          BARRAS — DISTANCIA / HSR / SPRINT
         ══════════════════════════════════════════════════════ */}
      {gps && reg.length > 0 && (
        <section className="sr-section">
          <Sec eyebrow="Individual" title="Distancia, HSR y Sprint por jugador" />
          <div className="sr-bars-section">
            <div>
              <div className="sr-bars-label" style={{ color: C.blue }}>
                <span className="sr-bars-dot" style={{ background: C.blue }} />
                Distancia Total · prom: {formatPdfNumber(totalDist / Math.max(1, reg.length))} m
              </div>
              <div className="sr-bars-list">
                {byDist.map(r => <Bar key={r.player.id} name={short(r.player.name)}
                  value={safeN(r.totalDistance)} maxVal={rMax(distArr)} color={C.blue} unit=" m" />)}
              </div>
            </div>
            <div>
              <div className="sr-bars-label" style={{ color: C.red }}>
                <span className="sr-bars-dot" style={{ background: C.red }} />
                Alta Velocidad HSR · prom: {formatPdfNumber(totalHSR / Math.max(1, reg.length))} m
              </div>
              <div className="sr-bars-list">
                {byHSR.map(r => <Bar key={r.player.id} name={short(r.player.name)}
                  value={safeN(r.highSpeedDistance)} maxVal={rMax(hsrArr)} color={C.red} unit=" m" />)}
              </div>
            </div>
            <div>
              <div className="sr-bars-label" style={{ color: C.amber }}>
                <span className="sr-bars-dot" style={{ background: C.amber }} />
                Sprint Distance · prom: {formatPdfNumber(totalSpr / Math.max(1, reg.length))} m
              </div>
              <div className="sr-bars-list">
                {bySpr.map(r => <Bar key={r.player.id} name={short(r.player.name)}
                  value={safeN(r.sprintDistance)} maxVal={Math.max(1, rMax(sprArr))} color={C.amber} unit=" m" />)}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════
          ACC / DCC / VELOCIDAD MÁXIMA
         ══════════════════════════════════════════════════════ */}
      {gps && reg.length > 0 && (
        <section className="sr-section">
          <Sec eyebrow="Individual" title="ACC, DCC y Velocidad máxima" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div className="sr-bars-label" style={{ color: C.blue2 }}>
                <span className="sr-bars-dot" style={{ background: C.blue2 }} />
                Aceleraciones ACC &gt;3 m/s² · prom: {Math.round(avgAcc)}
              </div>
              <div className="sr-bars-list">
                {byAcc.map(r => <Bar key={r.player.id} name={short(r.player.name)}
                  value={r.acc} maxVal={rMax(accArr)} color={C.blue2} />)}
              </div>
              <div className="sr-bars-label" style={{ color: C.red, marginTop: 16 }}>
                <span className="sr-bars-dot" style={{ background: C.red }} />
                Desaceleraciones DEC &gt;-3 m/s² · prom: {Math.round(avgDcc)}
              </div>
              <div className="sr-bars-list">
                {byDcc.map(r => <Bar key={r.player.id} name={short(r.player.name)}
                  value={r.dcc} maxVal={rMax(dccArr)} color={C.red} />)}
              </div>
            </div>
            <div>
              <div className="sr-bars-label" style={{ color: C.green }}>
                <span className="sr-bars-dot" style={{ background: C.green }} />
                Velocidad Máxima · máx: {formatPdfNumber(maxVel, 1)} km/h
              </div>
              <div className="sr-bars-list">
                {byVel.map(r => <Bar key={r.player.id} name={short(r.player.name)}
                  value={safeN(r.maxVelocity)} maxVal={rMax(velArr)} color={C.green} fmt={v => v.toFixed(1)} />)}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════
          LECTURA + ALERTAS
         ══════════════════════════════════════════════════════ */}
      <section className="sr-section">
        <Sec eyebrow="Análisis" title="Lectura de sesión" />
        <div className="sr-insight">
          {reg.length
            ? gps
              ? `Sesión ${sessionNumber || '—'} · ${categoryLabel(category)} · ${reg.length} jugadores registrados. Distancia acumulada ${formatPdfNumber(totalDist)} m (${formatPdfNumber(totalDist / Math.max(1, reg.length))} m por jugador), Player Load total ${formatPdfNumber(totalPL)}, HSR ${formatPdfNumber(totalHSR)} m, Sprint ${formatPdfNumber(totalSpr)} m, velocidad máxima ${formatPdfNumber(maxVel, 1)} km/h.`
              : `Sesión ${sessionNumber || '—'} · ${categoryLabel(category)} · ${reg.length} jugadores registrados. RPE promedio ${avgRpe.toFixed(1)}, ${Math.round(avgMin)} min promedio, carga interna total ${Math.round(totalLoad)} UA, wellness ${avgWell ? avgWell.toFixed(1) : 'sin registro'}/5.`
            : 'Sin registros de sesión.'}
        </div>
        {objective?.trim() && <div className="sr-insight sr-insight-green"><strong>Objetivo:</strong> {getPdfSafeText(objective)}</div>}
        {observation?.trim() && <div className="sr-insight sr-insight-neutral"><strong>Observación:</strong> {getPdfSafeText(observation)}</div>}
        {(highRpe.length > 0 || lowWell.length > 0 || absentPlayers.length > 0) && (
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {highRpe.length > 0 && <div className="sr-alert sr-alert-red">⚠ RPE elevado (≥8): {highRpe.map(r => r.player.name).join(', ')}</div>}
            {lowWell.length > 0 && <div className="sr-alert sr-alert-amber">⚠ Wellness bajo: {lowWell.map(r => r.player.name).join(', ')}</div>}
            {absentPlayers.length > 0 && <div className="sr-alert sr-alert-blue">Sin registrar ({absentPlayers.length}): {absentPlayers.slice(0, 8).map(p => p.name).join(', ')}{absentPlayers.length > 8 ? '…' : ''}</div>}
          </div>
        )}
      </section>

      <ReportFooter category={category} />
    </article>
  );
}

// Allow Bar to take optional fmt
function Bar({ name, value, maxVal, color, unit = '', fmt }: {
  name: string; value: number; maxVal: number; color: string; unit?: string; fmt?: (v: number) => string;
}) {
  const w = Math.max(2, pct(value, maxVal));
  const isMax = value >= maxVal * 0.98;
  const display = fmt ? fmt(value) : `${Math.round(value)}${unit}`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 56px', gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 10, fontWeight: isMax ? 900 : 700, color: isMax ? C.navy : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <div style={{ position: 'relative', height: 10, background: C.soft, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${w}%`, borderRadius: 99, background: isMax ? `linear-gradient(90deg,${color}bb,${color})` : `${color}88`, boxShadow: isMax ? `0 1px 4px ${color}55` : 'none' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 900, color: isMax ? color : C.text, textAlign: 'right' }}>{display}</span>
    </div>
  );
}
