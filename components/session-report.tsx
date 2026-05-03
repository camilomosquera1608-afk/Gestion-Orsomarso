import { Activity, AlertTriangle, BarChart3, Gauge, Target, Users } from 'lucide-react';
import { categoryLabel } from '@/lib/labels';
import type { ClubCategory, DailyWellnessRecord, Microcycle, Player, SessionParticipation, TrainingSessionType } from '@/lib/types';
import { formatPdfDate, formatPdfNumber, getPdfSafeText, supportsGps } from '@/lib/report-utils';
import { ReportFooter, ReportHeader } from './report-ui';
import { groupAverage } from '@/lib/utils';

type SessionReportRow = {
  player: Player; selected: boolean; participation: SessionParticipation;
  min: number; rpe: number; acc: number; dcc: number; sprints: number; rhie: number; ima: number;
  totalDistance?: number; maxVelocity?: number; playerLoad?: number; highSpeedDistance?: number; sprintDistance?: number;
};

type Props = {
  date: string; category: ClubCategory; microcycle?: Microcycle; sessionNumber?: string | number;
  sessionType: TrainingSessionType; objective?: string; observation?: string;
  rows: SessionReportRow[]; absentPlayers: Player[]; wellnessRecords?: DailyWellnessRecord[];
  dataQualityPercent?: number; generatedAt?: string; className?: string; compact?: boolean;
};

const sessionTypeLabel = (v: TrainingSessionType) => ({ cdef: 'Recuperación', cdEf: 'Ejecución', cdeF: 'Condición física', Cdef: 'Comunicación' }[v] ?? v);
const avg = (values: number[]) => groupAverage(values.filter((v) => Number.isFinite(v) && v > 0));
const safeN = (v: number | undefined) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (values: Array<number | undefined>) => values.reduce<number>((a, v) => a + safeN(v), 0);
const maxOf = (values: Array<number | undefined>) => values.reduce<number>((a, v) => Math.max(a, safeN(v)), 0);
const clamp = (v: number, mn = 0, mx = 100) => Math.max(mn, Math.min(mx, v));
const pct = (v: number, ref: number) => (ref > 0 ? clamp(Math.round((v / ref) * 100)) : 0);
const wellnessAvg = (r?: DailyWellnessRecord) => {
  if (!r) return 0;
  const vals = [r.sleep, r.fatigue, r.stress, r.musclePain, r.mood].filter((v) => Number.isFinite(v) && v > 0);
  return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
};
const tonePct = (v: number) => v >= 70 ? 'ls-kpi-green' : v >= 40 ? 'ls-kpi-amber' : 'ls-kpi-red';
const shortName = (name: string) => {
  const parts = getPdfSafeText(name, '').split(' ').filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts[1]?.[0] ?? ''}.`;
};
const rMin = (arr: number[]) => Math.min(...arr.filter((v) => v > 0), 0);
const rMax = (arr: number[]) => Math.max(...arr, 1);

function HeatCell({ value, min, max, fmt = (v: number) => String(Math.round(v)), higher = 'good' }: { value: number; min: number; max: number; fmt?: (v: number) => string; higher?: 'good' | 'bad' }) {
  const pos = clamp(Math.round(((value - min) / Math.max(1, max - min)) * 100));
  const score = higher === 'good' ? pos : 100 - pos;
  const bg = score >= 70 ? '#dcfce7' : score >= 40 ? '#fef9c3' : '#fee2e2';
  const color = score >= 70 ? '#065f46' : score >= 40 ? '#713f12' : '#7f1d1d';
  return <td style={{ background: bg, color, fontWeight: 800, textAlign: 'center', fontSize: 10 }}>{fmt(value)}</td>;
}

function MiniBar({ value, reference, color = '#1557d6' }: { value: number; reference: number; color?: string }) {
  const w = Math.max(4, pct(value, Math.max(1, reference)));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 7, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#334155', minWidth: 32, textAlign: 'right' }}>{Math.round(value)}</span>
    </div>
  );
}

function LsKpi({ label, value, note, colorClass = 'ls-kpi-blue' }: { label: string; value: string | number; note?: string; colorClass?: string }) {
  return (
    <div className={`ls-kpi ${colorClass}`}>
      <div className="ls-kpi-label">{label}</div>
      <div className="ls-kpi-value">{value}</div>
      {note ? <div className="ls-kpi-note">{note}</div> : null}
    </div>
  );
}

function SvgGauge({ value, label, max = 100 }: { value: number; label: string; max?: number }) {
  const ratio = clamp(Math.round((value / Math.max(1, max)) * 100));
  const r = 32; const circumference = Math.PI * r;
  const color = ratio >= 70 ? '#059669' : ratio >= 40 ? '#d97706' : '#dc2626';
  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 80 48" style={{ width: 72, height: 44, margin: '0 auto', display: 'block', overflow: 'visible' }}>
        <path d="M 8 40 A 32 32 0 0 1 72 40" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
        <path d="M 8 40 A 32 32 0 0 1 72 40" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - ratio / 100)} />
        <text x="40" y="36" textAnchor="middle" fontSize="13" fontWeight="900" fill="#06152f">{ratio}%</text>
      </svg>
      <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function BarSection({ title, color, data, refMax }: { title: string; color: string; data: { name: string; value: number }[]; refMax: number }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-block', width: 10, height: 10, background: color, borderRadius: 2 }} />
        {title}
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {data.map((item) => (
          <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
            <MiniBar value={item.value} reference={refMax} color={color} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SessionReportTemplate({ date, category, microcycle, sessionNumber, sessionType, objective, observation, rows, absentPlayers, wellnessRecords = [], dataQualityPercent = 0, generatedAt = new Date().toLocaleString('es-CO'), className = '', compact = false }: Props) {
  const gps = supportsGps(category);
  const reg = rows.filter((r) => r.selected || r.min > 0 || r.rpe > 0 || safeN(r.totalDistance) > 0 || safeN(r.playerLoad) > 0);
  const totalLoad = reg.reduce((a, r) => a + r.min * r.rpe, 0);
  const avgMin = avg(reg.map((r) => r.min));
  const avgRpe = avg(reg.map((r) => r.rpe));
  const totalDist = sum(reg.map((r) => r.totalDistance));
  const totalPL = sum(reg.map((r) => r.playerLoad));
  const totalHSR = sum(reg.map((r) => r.highSpeedDistance));
  const totalSprint = sum(reg.map((r) => r.sprintDistance));
  const maxVel = maxOf(reg.map((r) => r.maxVelocity));
  const avgMMin = avg(reg.map((r) => r.min > 0 && r.totalDistance ? r.totalDistance / r.min : 0));
  const avgAcc = avg(reg.map((r) => r.acc));
  const avgDcc = avg(reg.map((r) => r.dcc));
  const wellByPlayer = new Map(wellnessRecords.map((r) => [r.playerId, r]));
  const wellVals = reg.map((r) => wellnessAvg(wellByPlayer.get(r.player.id))).filter((v) => v > 0);
  const avgWell = avg(wellVals);
  const partScore = reg.length + absentPlayers.length ? pct(reg.length, reg.length + absentPlayers.length) : 0;
  const mcText = microcycle ? getPdfSafeText(microcycle.name, 'Microciclo') : 'Sin microciclo';
  const distValues = reg.map((r) => safeN(r.totalDistance));
  const plValues = reg.map((r) => safeN(r.playerLoad));
  const hsrValues = reg.map((r) => safeN(r.highSpeedDistance));
  const sprintValues = reg.map((r) => safeN(r.sprintDistance));
  const accValues = reg.map((r) => r.acc);
  const dccValues = reg.map((r) => r.dcc);
  const velValues = reg.map((r) => safeN(r.maxVelocity));
  const loadValues = reg.map((r) => r.min * r.rpe);

  return (
    <article className={`pdf-report-document ${className}`} style={{ fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <ReportHeader title="Informe de sesión" subtitle={`${formatPdfDate(date)} · Sesión ${sessionNumber || '—'}`} category={category} generatedAt={generatedAt} />

      {/* PORTADA */}
      {!compact && (
        <div className="ls-cover" style={{ pageBreakAfter: 'always' }}>
          <div className="ls-cover-top">
            <div className="ls-cover-brand">
              <img src="/orsomarso-crest.jpg" alt="Orsomarso SC" width={56} height={56} />
              <div className="ls-cover-brand-text"><span>Orsomarso Performance Hub</span><strong>Departamento de Fisiología</strong></div>
            </div>
            <div className="ls-cover-date">{formatPdfDate(date)}</div>
          </div>
          <div className="ls-cover-headline">
            <span className="ls-cover-kicker">{gps ? 'Catapult GPS · U20' : 'Carga interna'}</span>
            <h2 className="ls-cover-title">Informe<br />de Sesión</h2>
            <p className="ls-cover-subtitle">{sessionTypeLabel(sessionType)} · {mcText}</p>
          </div>
          <div className="ls-cover-chips">
            <span className="ls-cover-chip">{categoryLabel(category)}</span>
            <span className="ls-cover-chip">Sesión {sessionNumber || '—'}</span>
            <span className="ls-cover-chip">{reg.length} jugadores</span>
            <span className="ls-cover-chip">{formatPdfDate(date)}</span>
          </div>
          <hr className="ls-cover-divider" />
          <div className="ls-cover-kpis">
            {gps ? <>
              <div className="ls-cover-kpi"><div className="ls-cover-kpi-label">Distancia total</div><div className="ls-cover-kpi-value">{formatPdfNumber(totalDist)}</div><div className="ls-cover-kpi-note">metros</div></div>
              <div className="ls-cover-kpi"><div className="ls-cover-kpi-label">Player Load</div><div className="ls-cover-kpi-value">{formatPdfNumber(totalPL)}</div><div className="ls-cover-kpi-note">carga externa</div></div>
              <div className="ls-cover-kpi"><div className="ls-cover-kpi-label">Vel. máxima</div><div className="ls-cover-kpi-value">{formatPdfNumber(maxVel, 1)}</div><div className="ls-cover-kpi-note">km/h</div></div>
              <div className="ls-cover-kpi"><div className="ls-cover-kpi-label">Participación</div><div className="ls-cover-kpi-value">{partScore}%</div><div className="ls-cover-kpi-note">{reg.length}/{reg.length + absentPlayers.length}</div></div>
            </> : <>
              <div className="ls-cover-kpi"><div className="ls-cover-kpi-label">Jugadores</div><div className="ls-cover-kpi-value">{reg.length}</div><div className="ls-cover-kpi-note">registrados</div></div>
              <div className="ls-cover-kpi"><div className="ls-cover-kpi-label">Carga interna</div><div className="ls-cover-kpi-value">{Math.round(totalLoad)}</div><div className="ls-cover-kpi-note">UA totales</div></div>
              <div className="ls-cover-kpi"><div className="ls-cover-kpi-label">RPE prom.</div><div className="ls-cover-kpi-value">{avgRpe.toFixed(1)}</div><div className="ls-cover-kpi-note">escala 1–10</div></div>
              <div className="ls-cover-kpi"><div className="ls-cover-kpi-label">Wellness</div><div className="ls-cover-kpi-value">{avgWell ? avgWell.toFixed(1) : '—'}</div><div className="ls-cover-kpi-note">/5 promedio</div></div>
            </>}
          </div>
          <div className="ls-cover-footer"><span>Documento institucional — confidencial</span><span>Orsomarso SC · Rendimiento deportivo</span></div>
        </div>
      )}

      {/* PROMEDIOS GENERALES */}
      <section className="ls-section">
        <div className="ls-section-header">
          <div className="ls-section-icon"><Gauge size={15} /></div>
          <div className="ls-section-title-group">
            <span className="ls-section-eyebrow">Resumen ejecutivo</span>
            <h3 className="ls-section-title">Promedios generales de la sesión</h3>
            <p className="ls-section-subtitle">{formatPdfDate(date)} · {sessionTypeLabel(sessionType)} · {mcText}</p>
          </div>
          <span className="ls-section-badge">{reg.length} jugadores</span>
        </div>
        <div className="ls-kpi-grid">
          <LsKpi label="Tiempo prom. (min)" value={Math.round(avgMin)} note="Minutos" colorClass={tonePct(pct(avgMin, 90))} />
          <LsKpi label="RPE promedio" value={avgRpe.toFixed(1)} note="Escala 1–10" colorClass={avgRpe <= 6 ? 'ls-kpi-green' : avgRpe <= 8 ? 'ls-kpi-amber' : 'ls-kpi-red'} />
          {gps ? <>
            <LsKpi label="Distancia prom. (m)" value={formatPdfNumber(totalDist / Math.max(1, reg.length))} note="Por jugador" colorClass="ls-kpi-blue" />
            <LsKpi label="m/min promedio" value={formatPdfNumber(avgMMin, 1)} note="Intensidad" colorClass={tonePct(pct(avgMMin, 95))} />
            <LsKpi label="HSR prom. (m)" value={formatPdfNumber(totalHSR / Math.max(1, reg.length))} note="Alta velocidad" colorClass="ls-kpi-blue" />
            <LsKpi label="Sprint dist. (m)" value={formatPdfNumber(totalSprint)} note="Total equipo" colorClass="ls-kpi-blue" />
            <LsKpi label="ACC prom." value={Math.round(avgAcc)} note=">3 m/s²" colorClass="ls-kpi-neutral" />
            <LsKpi label="DEC prom." value={Math.round(avgDcc)} note=">-3 m/s²" colorClass="ls-kpi-neutral" />
          </> : <>
            <LsKpi label="Carga interna" value={Math.round(totalLoad)} note="UA totales" colorClass="ls-kpi-blue" />
            <LsKpi label="Wellness prom." value={avgWell ? avgWell.toFixed(1) : '—'} note="/5" colorClass={avgWell >= 3.7 ? 'ls-kpi-green' : avgWell >= 3.2 ? 'ls-kpi-amber' : 'ls-kpi-red'} />
            <LsKpi label="Participación" value={`${partScore}%`} note={`${reg.length}/${reg.length + absentPlayers.length}`} colorClass={tonePct(partScore)} />
            <LsKpi label="Completitud" value={`${dataQualityPercent}%`} note="Planilla" colorClass={tonePct(dataQualityPercent)} />
          </>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, paddingTop: 14, borderTop: '1px solid #e2e8f0', marginTop: 8 }}>
          <SvgGauge label="Volumen" value={gps ? pct(totalDist, reg.length * 6200) : pct(totalLoad, reg.length * 650)} />
          <SvgGauge label="Intensidad" value={gps ? pct(avgMMin, 95) : pct(avgRpe, 10) * 10} />
          <SvgGauge label={gps ? 'Participación' : 'Wellness'} value={gps ? partScore : pct(avgWell, 5)} />
        </div>
      </section>

      {/* TABLA DESCRIPTIVA CON HEATMAP */}
      {reg.length > 0 && (
        <section className="ls-section">
          <div className="ls-section-header">
            <div className="ls-section-icon"><Users size={15} /></div>
            <div className="ls-section-title-group">
              <span className="ls-section-eyebrow">Individual</span>
              <h3 className="ls-section-title">Tabla descriptiva</h3>
              <p className="ls-section-subtitle">Heatmap: verde = mayor · amarillo = medio · rojo = menor rendimiento relativo</p>
            </div>
          </div>
          <table className="ls-comparison-table" style={{ fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Jugador</th>
                <th>Pos.</th>
                <th>MIN</th>
                <th>RPE</th>
                <th>Carga</th>
                {gps ? <>
                  <th>Dist.</th><th>m/min</th><th>PL</th><th>HSR</th><th>Spr.</th><th>ACC</th><th>DCC</th><th>V.máx</th>
                </> : <>
                  <th>Wellness</th><th>Participación</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {reg.map((r) => {
                const load = r.min * r.rpe;
                const mmin = r.min > 0 && r.totalDistance ? r.totalDistance / r.min : 0;
                const well = wellnessAvg(wellByPlayer.get(r.player.id));
                return (
                  <tr key={r.player.id}>
                    <td><strong style={{ fontSize: 10, color: '#06152f' }}>{r.player.name}</strong></td>
                    <td style={{ color: '#64748b', fontSize: 9 }}>{r.player.position}</td>
                    <HeatCell value={r.min} min={rMin(reg.map((x) => x.min))} max={rMax(reg.map((x) => x.min))} />
                    <HeatCell value={r.rpe} min={0} max={10} />
                    <HeatCell value={load} min={rMin(loadValues)} max={rMax(loadValues)} />
                    {gps ? <>
                      <HeatCell value={safeN(r.totalDistance)} min={rMin(distValues)} max={rMax(distValues)} fmt={(v) => formatPdfNumber(v)} />
                      <HeatCell value={mmin} min={rMin(reg.map((x) => x.min > 0 && x.totalDistance ? x.totalDistance / x.min : 0))} max={rMax(reg.map((x) => x.min > 0 && x.totalDistance ? x.totalDistance / x.min : 0))} fmt={(v) => formatPdfNumber(v, 1)} />
                      <HeatCell value={safeN(r.playerLoad)} min={rMin(plValues)} max={rMax(plValues)} fmt={(v) => formatPdfNumber(v)} />
                      <HeatCell value={safeN(r.highSpeedDistance)} min={rMin(hsrValues)} max={rMax(hsrValues)} fmt={(v) => formatPdfNumber(v)} />
                      <HeatCell value={safeN(r.sprintDistance)} min={rMin(sprintValues)} max={rMax(sprintValues)} fmt={(v) => formatPdfNumber(v)} />
                      <HeatCell value={r.acc} min={rMin(accValues)} max={rMax(accValues)} />
                      <HeatCell value={r.dcc} min={rMin(dccValues)} max={rMax(dccValues)} />
                      <HeatCell value={safeN(r.maxVelocity)} min={rMin(velValues)} max={rMax(velValues)} fmt={(v) => v.toFixed(1)} />
                    </> : <>
                      <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 10, background: well >= 3.7 ? '#dcfce7' : well >= 3.2 ? '#fef9c3' : well > 0 ? '#fee2e2' : '#f8fafc', color: well >= 3.7 ? '#065f46' : well >= 3.2 ? '#713f12' : '#7f1d1d' }}>{well ? well.toFixed(1) : '—'}</td>
                      <td style={{ textAlign: 'center', fontSize: 9 }}>{r.participation}</td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* BARRAS INDIVIDUALES GPS */}
      {gps && reg.length > 0 && (
        <section className="ls-section">
          <div className="ls-section-header">
            <div className="ls-section-icon"><BarChart3 size={15} /></div>
            <div className="ls-section-title-group">
              <span className="ls-section-eyebrow">Individual</span>
              <h3 className="ls-section-title">Distancia, HSR y Sprint por jugador</h3>
            </div>
          </div>
          <BarSection title={`Distancia Total (m) · Prom: ${formatPdfNumber(totalDist / Math.max(1, reg.length))} m`} color="#1557d6"
            data={[...reg].sort((a, b) => safeN(b.totalDistance) - safeN(a.totalDistance)).map((r) => ({ name: shortName(r.player.name), value: safeN(r.totalDistance) }))}
            refMax={rMax(distValues)} />
          <BarSection title={`Alta Velocidad HSR (m) · Prom: ${formatPdfNumber(totalHSR / Math.max(1, reg.length))} m`} color="#dc2626"
            data={[...reg].sort((a, b) => safeN(b.highSpeedDistance) - safeN(a.highSpeedDistance)).map((r) => ({ name: shortName(r.player.name), value: safeN(r.highSpeedDistance) }))}
            refMax={rMax(hsrValues)} />
          <BarSection title={`Sprint Distance (m) · Prom: ${formatPdfNumber(totalSprint / Math.max(1, reg.length))} m`} color="#d97706"
            data={[...reg].sort((a, b) => safeN(b.sprintDistance) - safeN(a.sprintDistance)).map((r) => ({ name: shortName(r.player.name), value: safeN(r.sprintDistance) }))}
            refMax={rMax(sprintValues)} />
        </section>
      )}

      {/* ACC / DCC / VELOCIDAD */}
      {gps && reg.length > 0 && (
        <section className="ls-section">
          <div className="ls-section-header">
            <div className="ls-section-icon"><Activity size={15} /></div>
            <div className="ls-section-title-group">
              <span className="ls-section-eyebrow">Individual</span>
              <h3 className="ls-section-title">ACC, DCC y Velocidad máxima</h3>
            </div>
          </div>
          <div className="ls-two-col">
            <div>
              <BarSection title={`ACC >3 m/s² · Prom: ${Math.round(avgAcc)}`} color="#1557d6"
                data={[...reg].sort((a, b) => b.acc - a.acc).map((r) => ({ name: shortName(r.player.name), value: r.acc }))}
                refMax={rMax(accValues)} />
              <BarSection title={`DEC >-3 m/s² · Prom: ${Math.round(avgDcc)}`} color="#dc2626"
                data={[...reg].sort((a, b) => b.dcc - a.dcc).map((r) => ({ name: shortName(r.player.name), value: r.dcc }))}
                refMax={rMax(dccValues)} />
            </div>
            <div>
              <BarSection title={`Velocidad máxima (km/h) · Máx: ${formatPdfNumber(maxVel, 1)}`} color="#059669"
                data={[...reg].sort((a, b) => safeN(b.maxVelocity) - safeN(a.maxVelocity)).map((r) => ({ name: shortName(r.player.name), value: safeN(r.maxVelocity) }))}
                refMax={rMax(velValues)} />
            </div>
          </div>
        </section>
      )}

      {/* LECTURA */}
      <section className="ls-section">
        <div className="ls-section-header">
          <div className="ls-section-icon"><Target size={15} /></div>
          <div className="ls-section-title-group">
            <span className="ls-section-eyebrow">Análisis</span>
            <h3 className="ls-section-title">Lectura de sesión</h3>
          </div>
        </div>
        <div className="ls-insight">
          {reg.length ? gps
            ? `Sesión ${sessionNumber || '—'} · ${categoryLabel(category)} · ${reg.length} jugadores. Distancia ${formatPdfNumber(totalDist)} m (${formatPdfNumber(totalDist / Math.max(1, reg.length))} m prom.), Player Load ${formatPdfNumber(totalPL)}, HSR ${formatPdfNumber(totalHSR)} m, sprint ${formatPdfNumber(totalSprint)} m, velocidad máxima ${formatPdfNumber(maxVel, 1)} km/h.`
            : `Sesión ${sessionNumber || '—'} · ${categoryLabel(category)} · ${reg.length} jugadores. RPE ${avgRpe.toFixed(1)}, ${Math.round(avgMin)} min prom., carga interna ${Math.round(totalLoad)} UA, wellness ${avgWell ? avgWell.toFixed(1) : 'sin registro'}/5.`
            : 'Sin registros para análisis.'}
        </div>
        {objective?.trim() ? <div className="ls-insight green"><strong>Objetivo:</strong> {getPdfSafeText(objective)}</div> : null}
        {observation?.trim() ? <div className="ls-insight" style={{ borderLeftColor: '#94a3b8' }}><strong>Observación:</strong> {getPdfSafeText(observation)}</div> : null}
      </section>

      {/* ALERTAS */}
      {(reg.filter((r) => r.rpe >= 8).length > 0 || absentPlayers.length > 0) && (
        <section className="ls-section">
          <div className="ls-section-header">
            <div className="ls-section-icon" style={{ color: '#dc2626' }}><AlertTriangle size={15} /></div>
            <div className="ls-section-title-group">
              <span className="ls-section-eyebrow">Monitoreo</span>
              <h3 className="ls-section-title">Alertas</h3>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {reg.filter((r) => r.rpe >= 8).length > 0 && <div className="ls-insight red"><strong>RPE elevado:</strong> {reg.filter((r) => r.rpe >= 8).map((r) => r.player.name).join(', ')}</div>}
            {absentPlayers.length > 0 && <div className="ls-insight amber"><strong>Sin registrar ({absentPlayers.length}):</strong> {absentPlayers.slice(0, 10).map((p) => p.name).join(', ')}{absentPlayers.length > 10 ? '…' : ''}</div>}
          </div>
        </section>
      )}

      <ReportFooter category={category} />
    </article>
  );
}
