'use client';

import { useEffect, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, WeekCalendar, useConfirm } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { averageWellness, calculateInternalLoad, groupAverage, getMicrocyclesForCategory, findMicrocycleByDate } from '@/lib/utils';
import { buildMicrocycleWeek } from '@/lib/operational-helpers';
import { supportsGps } from '@/lib/report-utils';
import { findOverlappingMicrocycle } from '@/lib/operational-validation';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const sessionLabels: Record<string, string> = { cdef: 'Recuperación', cdEf: 'Ejecución', cdeF: 'Condición física', Cdef: 'Comunicación' };

export default function MicrocicloPage() {
  const { data, filters, setFilters, updateMicrocycle, deleteMicrocycle, deleteTrainingSessionSummary } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = master ? filters.category : session.category;
  const effectiveCategory = (activeCategory === 'all' ? 'Sub20' : activeCategory) as 'Sub15' | 'Sub17' | 'Sub20';
  const gpsEnabled = supportsGps(effectiveCategory);
  const youthSimple = !gpsEnabled;
  const categoryMicrocycles = getMicrocyclesForCategory(data.microcycles, effectiveCategory);
  const detectedMicrocycle = findMicrocycleByDate(data.microcycles, filters.date, filters.microcycleId, effectiveCategory);
  const microcycle = detectedMicrocycle ?? categoryMicrocycles.find((x) => x.id === filters.microcycleId) ?? categoryMicrocycles[0] ?? { id: `mc-${effectiveCategory.toLowerCase()}-1`, name: 'Microciclo 1', category: effectiveCategory, startDate: '', endDate: '' };
  const hasRange = Boolean(microcycle.startDate && microcycle.endDate);
  const weekDays = buildMicrocycleWeek(data, microcycle, effectiveCategory);
  const [microcycleMessage, setMicrocycleMessage] = useState('');
  const { confirm: showConfirm, ConfirmModal } = useConfirm();
  const saveMicrocycleDraft = (nextMicrocycle: typeof microcycle) => {
    const normalized = { ...nextMicrocycle, category: effectiveCategory };
    if (!normalized.name?.trim()) {
      setMicrocycleMessage('El microciclo debe tener nombre.');
      return;
    }
    if (normalized.startDate && normalized.endDate && normalized.startDate > normalized.endDate) {
      setMicrocycleMessage('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }
    const overlap = findOverlappingMicrocycle(data.microcycles, normalized);
    if (overlap) {
      setMicrocycleMessage('Ya existe un microciclo de esta categoría con el mismo nombre o con fechas solapadas.');
      return;
    }
    setMicrocycleMessage('Microciclo guardado.');
    updateMicrocycle(normalized);
  };

  useEffect(() => {
    if (microcycle.id !== filters.microcycleId) setFilters({ microcycleId: microcycle.id });
  }, [filters.microcycleId, microcycle.id, setFilters]);

  const players = data.players.filter((player) => player.category === effectiveCategory && (filters.playerId === 'all' || player.id === filters.playerId));
  const recordsInRange = (date: string) => hasRange && date >= microcycle.startDate && date <= microcycle.endDate;
  const recordBelongsToMicrocycle = (date: string, microcycleId?: string) => hasRange ? recordsInRange(date) : (microcycleId ?? microcycle.id) === microcycle.id;
  const sessionRecords = data.externalLoads
    .filter((x) => (x.category === effectiveCategory || data.players.find((p) => p.id === x.playerId)?.category === effectiveCategory) && recordBelongsToMicrocycle(x.date, x.microcycleId))
    .sort((a, b) => (a.date + (a.sessionNumber ?? 0)).localeCompare(b.date + (b.sessionNumber ?? 0)));

  const uniqueDays = Array.from(new Set<string>(sessionRecords.map((record) => record.date))).filter((date) => !hasRange || recordsInRange(date));
  const dayData = uniqueDays.map((date) => ({
    date: date.slice(5),
    wellness: groupAverage(players.map((player) => averageWellness(data.wellness.find((x) => x.playerId === player.id && x.date === date)))),
    minutos: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.min ?? 0)),
    rpe: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.rpe ?? 0)),
    acc: groupAverage(players.map((player) => data.externalLoads.find((x) => x.playerId === player.id && x.date === date)?.acc ?? 0)),
  }));

  const availabilitySummary = {
    disponibles: players.filter((p) => p.status === 'Disponible').length,
    molestia: players.filter((p) => p.status === 'Molestia').length,
    readaptacion: players.filter((p) => p.status === 'Readaptación').length,
    lesionados: players.filter((p) => p.status === 'Lesionado').length,
  };
  const playersWithoutRecords = players.filter((player) => !sessionRecords.some((record) => record.playerId === player.id));

  const accumulated = players.map((player) => ({
    jugador: player.name,
    carga: data.internalLoads.filter((x) => x.playerId === player.id && (!hasRange || recordsInRange(x.date))).reduce((acc, item) => acc + calculateInternalLoad(item), 0),
    minutos: data.externalLoads.filter((x) => x.playerId === player.id && (!hasRange || recordsInRange(x.date))).reduce((acc, item) => acc + (item.min ?? 0), 0),
    rpe: groupAverage(data.externalLoads.filter((x) => x.playerId === player.id && (!hasRange || recordsInRange(x.date))).map((item) => item.rpe ?? 0)),
    acc: data.externalLoads.filter((x) => x.playerId === player.id && (!hasRange || recordsInRange(x.date))).reduce((acc, item) => acc + (item.acc ?? 0), 0),
  })).sort((a, b) => youthSimple ? b.minutos - a.minutos : b.acc - a.acc);

  const deleteSessionFromMicrocycle = async (sessionId: string) => {
    const target = data.trainingSessionSummaries.find((item) => item.id === sessionId);
    if (!target) return;
    const ok = await showConfirm({
      title: `¿Eliminar sesión ${target.sessionNumber || '-'} del ${target.date}?`,
      description: 'Se quitará la participación y carga asociada a esta sesión.',
      danger: true,
    });
    if (!ok) return;
    deleteTrainingSessionSummary(sessionId);
    setMicrocycleMessage(`Sesión ${target.sessionNumber || '-'} eliminada correctamente.`);
  };

  const deleteCurrentMicrocycle = async () => {
    if (!microcycle?.id) return;
    const usedBySessions = data.trainingSessionSummaries.filter((item) => item.microcycleId === microcycle.id).length;
    const usedByLoads = data.externalLoads.filter((item) => item.microcycleId === microcycle.id).length;
    const desc = usedBySessions || usedByLoads
      ? `Este microciclo tiene ${usedBySessions} sesión(es) y ${usedByLoads} registro(s) asociados. Se quitará la asociación pero NO se borrarán los datos.`
      : 'Esta acción no se puede deshacer.';
    const ok = await showConfirm({
      title: `¿Eliminar "${microcycle.name}"?`,
      description: desc,
      danger: true,
    });
    if (!ok) return;
    deleteMicrocycle(microcycle.id);
    setMicrocycleMessage("Microciclo eliminado. Las sesiones y cargas asociadas se conservaron.");
  };

  const createNextMicrocycle = () => {
    const usedNumbers = categoryMicrocycles
      .map((item) => item.weekNumber ?? Number(String(item.id).match(/(\d+)$/)?.[1]))
      .filter((value) => Number.isFinite(value));
    const nextNumber = (usedNumbers.length ? Math.max(...usedNumbers) : categoryMicrocycles.length) + 1;
    const id = `mc-${effectiveCategory.toLowerCase()}-${nextNumber}`;
    updateMicrocycle({ id, name: `Microciclo ${nextNumber}`, category: effectiveCategory, startDate: '', endDate: '', weekNumber: nextNumber, status: 'activo' });
    setFilters({ microcycleId: id });
  };

  const timeline = sessionRecords.reduce((acc, record) => {
    const existing = acc.find((item) => item.date === record.date && item.sessionNumber === (record.sessionNumber ?? 1));
    if (!existing) {
      const bucket = sessionRecords.filter((x) => x.date === record.date && (x.sessionNumber ?? 1) === (record.sessionNumber ?? 1));
      acc.push({
        date: record.date,
        sessionNumber: record.sessionNumber ?? 1,
        sessionType: record.sessionType ?? '-',
        avgRpe: groupAverage(bucket.map((x) => x.rpe ?? 0)),
        avgMin: groupAverage(bucket.map((x) => x.min ?? 0)),
        avgAcc: groupAverage(bucket.map((x) => x.acc ?? 0)),
        players: bucket.length,
      });
    }
    return acc;
  }, [] as Array<{date:string;sessionNumber:number;sessionType:string;avgRpe:number;avgMin:number;avgAcc:number;players:number}>);

  return (
    <div className="grid">
      <AppHero heroClass="hero-microciclo" title="Planificación semanal" subtitle={`${categoryLabel(effectiveCategory)} · microciclo independiente por categoría${gpsEnabled ? ' · GPS Catapult' : ''}`} />
      <GlobalFiltersBar />
      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="section-eyebrow">Planificación</span><h3 style={{ margin: 0 }}>Datos del microciclo</h3>
          <div className="btn-row"><button type="button" className="btn secondary" onClick={createNextMicrocycle}>Crear microciclo</button><button type="button" className="btn danger" onClick={deleteCurrentMicrocycle}>Eliminar microciclo</button></div>
        </div>
        <div className="summary-chip" style={{ marginBottom: 12 }}>Define nombre, categoría y rango. Cada categoría tiene su propio microciclo activo.</div>
        {microcycleMessage ? <div className="empty" style={{ marginBottom: 12 }}>{microcycleMessage}</div> : null}
        <div className="grid grid-4">
          <div className="field">
            <label>Nombre</label>
            <input className="input" value={microcycle.name} onChange={(e) => saveMicrocycleDraft({ ...microcycle, category: effectiveCategory, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Categoría</label>
            <input className="input" value={categoryLabel(microcycle.category ?? effectiveCategory)} readOnly />
          </div>
          <div className="field">
            <label>Semana</label>
            <input className="input" type="number" value={microcycle.weekNumber ?? ''} onChange={(e) => saveMicrocycleDraft({ ...microcycle, category: effectiveCategory, weekNumber: Number(e.target.value) || undefined })} />
          </div>
          <div className="field">
            <label>Fecha de inicio</label>
            <input className="input" type="date" value={microcycle.startDate ?? ''} onChange={(e) => saveMicrocycleDraft({ ...microcycle, category: effectiveCategory, startDate: e.target.value })} />
          </div>
          <div className="field">
            <label>Fecha de fin</label>
            <input className="input" type="date" value={microcycle.endDate ?? ''} onChange={(e) => saveMicrocycleDraft({ ...microcycle, category: effectiveCategory, endDate: e.target.value })} />
          </div>
        </div>
        <div className="muted-line" style={{ marginTop: 12 }}>
          {hasRange
            ? `Rango activo del ${microcycle.name}: ${microcycle.startDate} a ${microcycle.endDate}.`
            : 'Este microciclo aún no tiene rango de fechas. Asigna inicio y fin para que aparezca correctamente en Diario y Sesión.'}
        </div>
      </div>
      <div className="grid grid-4">
        <KpiCard label="Microciclo activo" value={microcycle.name} tone="blue" trend={hasRange ? 'Rango asignado' : 'Pendiente de fechas'} />
        <KpiCard label="Wellness promedio" value={groupAverage(dayData.map((d) => d.wellness)).toFixed(1)} tone="green" trend="Promedio del rango" />
        <KpiCard label="MIN acumulados" value={accumulated.reduce((acc, item) => acc + item.minutos, 0).toFixed(0)} tone="dark" trend="Volumen semanal" />
        <KpiCard label={youthSimple ? 'RPE promedio' : 'ACC acumulado'} value={youthSimple ? groupAverage(accumulated.map((x) => x.rpe)).toFixed(1) : accumulated.reduce((acc, item) => acc + item.acc, 0).toFixed(0)} tone="amber" trend="Indicador de carga" />
      </div>

      <div className="grid grid-4">
        <KpiCard label="Disponibles" value={String(availabilitySummary.disponibles)} />
        <KpiCard label="Molestia" value={String(availabilitySummary.molestia)} />
        <KpiCard label="Readaptación" value={String(availabilitySummary.readaptacion)} />
        <KpiCard label="Lesionados" value={String(availabilitySummary.lesionados)} />
      </div>

      <div className="card">
        <SectionHeader eyebrow="Calendario" title="Semana operativa del microciclo" subtitle="Días, sesiones, competencia y completitud de registros por fecha." />
        {weekDays.length ? <WeekCalendar days={weekDays} onDeleteSession={deleteSessionFromMicrocycle} /> : <EmptyState title="Microciclo sin rango de fechas" text="Asigna fecha de inicio y fin para construir el calendario semanal." />}
      </div>

      <div className="card">
        <SectionHeader eyebrow="Semana" title="Timeline del microciclo" subtitle="Sesiones detectadas dentro del rango asignado." />
        <div className="timeline-grid">
          {timeline.map((item) => (
            <div key={`${item.date}-${item.sessionNumber}`} className="timeline-card">
              <div className="timeline-date">{item.date}</div>
              <strong>Sesión {item.sessionNumber}</strong>
              <div className="muted-line">{item.sessionType} · {sessionLabels[item.sessionType] ?? 'Sin etiqueta'}</div>
              <div className="timeline-metrics">
                <span>MIN {item.avgMin.toFixed(0)}</span>
                <span>RPE {item.avgRpe.toFixed(1)}</span>
                {!youthSimple ? <span>ACC {item.avgAcc.toFixed(0)}</span> : null}
                <span>{item.players} jugadores</span>
              </div>
            </div>
          ))}
          {!timeline.length ? <EmptyState title="No hay sesiones cargadas" text="Cuando guardes sesiones dentro del rango, aparecerán en esta planificación." /> : null}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Control de carga" title="Tendencia diaria del microciclo" subtitle="Lectura acumulada de bienestar y minutos." />
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="wellness" stroke="#1d4ed8" name="Wellness" strokeWidth={3} />
                <Line yAxisId="right" type="monotone" dataKey="minutos" stroke="#60a5fa" name="MIN" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <SectionHeader eyebrow="Métrica principal" title={youthSimple ? 'RPE por día' : 'ACC por día'} subtitle="Comportamiento por día del microciclo." />
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey={youthSimple ? 'rpe' : 'acc'} fill="#1d4ed8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHeader eyebrow="Alertas" title="Alertas del microciclo" subtitle="Disponibilidad y registros faltantes." />
        <div className="grid" style={{ gap: 10 }}>
          {players.filter((player) => player.status === 'Lesionado').map((player) => <div key={player.id} className="alert-item tone-red">{player.name} tiene lesión activa.</div>)}
          {playersWithoutRecords.map((player) => <div key={`missing-${player.id}`} className="alert-item tone-yellow">{player.name} no tiene registros en este microciclo.</div>)}
          {!players.filter((player) => player.status === 'Lesionado').length && !playersWithoutRecords.length ? <div className="empty">Sin alertas relevantes.</div> : null}
        </div>
      </div>

      <div className="card table-wrap">
        <SectionHeader eyebrow="Control" title="Jugadores sin registros en el microciclo" />
        {playersWithoutRecords.length ? <table><thead><tr><th>Jugador</th><th>Posición</th><th>Estado</th></tr></thead><tbody>{playersWithoutRecords.map((player) => <tr key={player.id}><td>{player.name}</td><td>{player.position}</td><td>{player.status}</td></tr>)}</tbody></table> : <div className="empty">Todos los jugadores tienen registros.</div>}
      </div>

      <div className="card table-wrap">
        <SectionHeader eyebrow="Ranking" title="Ranking del microciclo" subtitle="Carga acumulada por jugador." />
        <table>
          <thead><tr><th>Jugador</th><th>MIN acumulados</th><th>RPE promedio</th>{!youthSimple ? <th>ACC acumulado</th> : null}<th>Carga interna</th></tr></thead>
          <tbody>{accumulated.map((item) => <tr key={item.jugador}><td>{item.jugador}</td><td>{item.minutos}</td><td>{item.rpe}</td>{!youthSimple ? <td>{item.acc}</td> : null}<td>{item.carga}</td></tr>)}</tbody>
        </table>
      </div>
      {ConfirmModal}
    </div>
  );
}