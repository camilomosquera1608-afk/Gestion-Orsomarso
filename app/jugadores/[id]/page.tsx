'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppHero } from '@/components/app-hero';
import { CompactInfoList, EmptyState, SectionHeader } from '@/components/pro-ui';
import { PlayerStatusBadge, WellnessBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { getStaffSession } from '@/lib/auth';
import { canWrite } from '@/lib/access-control';
import { categoryLabel, calcAge, formatBirthDateForDisplay, normalizeBirthDateInput } from '@/lib/labels';
import { ClubCategory, CompetitiveRole, DominantFoot, LoadTolerance, PlayerStatus, Position } from '@/lib/types';
import { averageWellness, calculateInternalLoad, groupAverage } from '@/lib/utils';
import { readBodyMapRecords, type BodyMapRecord } from '@/lib/body-map';
import { computePlayerScientificLoadDecision } from '@/lib/scientific-load';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { computeBanisterMetrics, computeDynamicThresholds } from '@/lib/sport-science';

const statuses: PlayerStatus[] = ['Disponible', 'Molestia', 'Readaptación', 'Lesionado'];
const positions: Position[] = ['Portero', 'Defensa central', 'Lateral', 'Mediocampista', 'Extremo', 'Delantero'];
const categories: ClubCategory[] = ['Sub15', 'Sub17', 'Sub20'];
const dominantFeet: DominantFoot[] = ['Derecha', 'Izquierda', 'Ambidiestro'];
const competitiveRoles: CompetitiveRole[] = ['Titular habitual', 'Rotación', 'Suplente', 'Proyección', 'Retorno a competencia'];
const loadTolerances: LoadTolerance[] = ['Alta', 'Media', 'Baja', 'En construcción'];

const toNumberOrUndefined = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const restrictionsToText = (items?: string[]) => (items ?? []).join(', ');
const textToRestrictions = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const formatNumber = (value?: number, suffix = '') => (typeof value === 'number' && Number.isFinite(value) ? `${value}${suffix}` : 'Sin definir');

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const { data, updatePlayer } = useApp();
  const [bodyMapRecords, setBodyMapRecords] = useState<BodyMapRecord[]>([]);
  useEffect(() => {
    setBodyMapRecords(readBodyMapRecords());
  }, []);
  const session = getStaffSession();
  const canEditPlayer = canWrite(session);
  const player = data.players.find((item) => item.id === params.id);

  if (!player) return <div className="empty">Jugador no encontrado o eliminado.</div>;

  const latestDate = [...new Set(data.wellness.filter((x) => x.playerId === player.id).map((x) => x.date))].sort().at(-1) ?? new Date().toISOString().slice(0, 10);
  const latestWellness = data.wellness.find((x) => x.playerId === player.id && x.date === latestDate);
  const latestInternal = data.internalLoads.find((x) => x.playerId === player.id && x.date === latestDate);
  const latestExternal = data.externalLoads.find((x) => x.playerId === player.id && x.date === latestDate);
  const latestCmj = data.cmjRecords.filter((x) => x.playerId === player.id).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const previousCmj = data.cmjRecords.filter((x) => x.playerId === player.id).sort((a, b) => a.date.localeCompare(b.date)).at(-2);
  const groupAverageCmj = groupAverage(data.cmjRecords.filter((x) => x.date === latestDate).map((x) => x.value));
  const wellnessHistory = data.wellness.filter((x) => x.playerId === player.id).sort((a, b) => a.date.localeCompare(b.date)).map((x) => ({ fecha: x.date.slice(5), wellness: averageWellness(x) }));
  const cmjHistory = data.cmjRecords.filter((x) => x.playerId === player.id).sort((a, b) => a.date.localeCompare(b.date)).map((x) => ({ fecha: x.date.slice(5), cmj: x.value }));
  const recentSessions = data.externalLoads.filter((x) => x.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const recentCompetition = data.competitionRecords.filter((x) => x.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const youthSimple = player.category !== 'Sub20';
  const bmi = player.height && player.weight ? Number((player.weight / ((player.height / 100) ** 2)).toFixed(1)) : undefined;
  const currentWellness = averageWellness(latestWellness);
  const weeklyInternalLoad = data.internalLoads
    .filter((x) => x.playerId === player.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .reduce((total, item) => total + calculateInternalLoad(item), 0);
  const weeklyMinutes = data.externalLoads
    .filter((x) => x.playerId === player.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .reduce((total, item) => total + (item.min ?? 0), 0);
  const weeklyHsr = data.externalLoads
    .filter((x) => x.playerId === player.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .reduce((total, item) => total + (item.highSpeedDistance ?? item.hsr ?? 0), 0);
  const weeklySprint = data.externalLoads
    .filter((x) => x.playerId === player.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .reduce((total, item) => total + (item.sprintDistance ?? 0), 0);

  const injuryHistory = [
    ...(player.injuryHistory ?? []),
    ...data.competitionRecords
      .filter((x) => x.playerId === player.id && (x.injuryKind || x.medicalObservation || x.postCompetitionStatus))
      .map((x, index) => ({
        id: `comp-injury-${x.id}-${index}`,
        date: x.date,
        injuryType: x.injuryKind ?? 'Sin lesión',
        area: x.postCompetitionStatus ?? '',
        severity: player.injurySeverity ?? '',
        status: (x.injuryKind ? 'activa' : 'cerrada') as 'activa' | 'cerrada',
        medicalNote: x.medicalObservation ?? '',
        expectedReturnDate: player.returnDate ?? '',
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const temporaryMovements = [
    ...data.externalLoads.filter((x) => x.playerId === player.id && ((x.actingCategory ?? x.category) !== (x.baseCategory ?? player.category) || (x.movementType ?? 'base') !== 'base')).map((x) => ({
      date: x.date, module: 'Sesión', baseCategory: x.baseCategory ?? player.category, actingCategory: x.actingCategory ?? x.category ?? player.category, movementType: x.movementType ?? 'base', note: x.movementNote ?? '',
    })),
    ...data.competitionRecords.filter((x) => x.playerId === player.id && ((x.actingCategory ?? x.category) !== (x.baseCategory ?? player.category) || (x.movementType ?? 'base') !== 'base')).map((x) => ({
      date: x.date, module: 'Competencia', baseCategory: x.baseCategory ?? player.category, actingCategory: x.actingCategory ?? x.category ?? player.category, movementType: x.movementType ?? 'base', note: x.movementNote ?? '',
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const sessionTypeForDecision = latestExternal?.sessionType ?? 'MD-3';
  const scientificDecision = computePlayerScientificLoadDecision({
    player,
    data,
    date: latestDate,
    sessionType: sessionTypeForDecision,
    bodyRecords: bodyMapRecords,
  });
  const dynamicThresholds = computeDynamicThresholds(data, player, latestDate);
  const banister = computeBanisterMetrics(data, player, latestDate);

  const alerts = [
    currentWellness < 3 ? `Wellness bajo (${currentWellness.toFixed(1)})` : null,
    player.status !== 'Disponible' ? `Estado actual: ${player.status}` : null,
    player.maxTrainingPercent && player.maxTrainingPercent < 100 ? `Restricción de sesión: máximo ${player.maxTrainingPercent}%` : null,
    player.maxCompetitionMinutes ? `Límite competitivo: ${player.maxCompetitionMinutes} min` : null,
    player.restrictions?.length ? `Restricciones: ${player.restrictions.join(', ')}` : null,
    latestCmj && latestCmj.value < groupAverageCmj ? `CMJ por debajo del promedio grupal (${latestCmj.value} vs ${groupAverageCmj})` : null,
    (!youthSimple && (latestExternal?.acc ?? 0) > 35) ? `ACC elevado en la última sesión (${latestExternal?.acc ?? 0})` : null,
    temporaryMovements[0] ? `Último movimiento temporal: ${temporaryMovements[0].movementType} con ${categoryLabel(temporaryMovements[0].actingCategory)}` : null,
  ].filter(Boolean) as string[];

  const patchPlayer = (patch: Partial<typeof player>) => updatePlayer({ ...player, ...patch, age: calcAge((patch.birthDate ?? player.birthDate)) ?? player.age, injuryHistory: patch.injuryHistory ?? player.injuryHistory });
  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patchPlayer({ photo: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid">
      <AppHero title={`Perfil individual · ${player.name}`} subtitle={`Ficha completa para decisiones de carga · Línea base ${categoryLabel(player.category)}`} />

      <div className="player-profile-summary">
        <div className="card player-card executive-player-card profile-cover-card">
          <img src={player.photo || '/orsomarso-crest.jpg'} alt={player.name} width={90} height={90} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 18 }} />
          <div>
            <h3 style={{ margin: 0 }}>{player.jerseyNumber ? `#${player.jerseyNumber} · ` : ''}{player.name}</h3>
            <div className="player-meta">
              <span>{calcAge(player.birthDate) ?? player.age} años</span>
              <span>{player.position}</span>
              {player.secondaryPosition ? <span>Sec. {player.secondaryPosition}</span> : null}
              <span>Línea base {categoryLabel(player.category)}</span>
              <span>{player.dominantFoot ? `Pie ${player.dominantFoot}` : 'Pie sin definir'}</span>
              <span>{player.competitiveRole ?? 'Rol sin definir'}</span>
              <span>{player.height} cm</span>
              <span>{player.weight} kg</span>
              {bmi ? <span>IMC {bmi}</span> : null}
            </div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <PlayerStatusBadge status={player.status} />
              <span className="summary-chip">Última fecha: {latestDate}</span>
              {player.loadTolerance ? <span className="summary-chip">Tolerancia {player.loadTolerance}</span> : null}
            </div>
          </div>
          <div className="roster-actions">
            <Link className="btn secondary" href="/jugadores">Volver a plantilla</Link>
            <Link className="btn secondary" href="/informes">Generar informe</Link>
          </div>
        </div>
        <div className="card">
          <SectionHeader eyebrow="Jugador" title="Estado reciente" />
          <CompactInfoList items={[
            { label: 'Wellness', value: latestWellness ? currentWellness.toFixed(1) : 'Sin registro', tone: latestWellness ? 'blue' : 'neutral' },
            { label: 'Carga interna', value: latestInternal ? calculateInternalLoad(latestInternal) : 'Sin registro', tone: latestInternal ? 'dark' : 'neutral' },
            { label: 'Última sesión', value: latestExternal?.date ?? 'Sin registro' },
            { label: 'Último partido', value: recentCompetition[0]?.date ?? 'Sin registro' },
            { label: 'Minutos recientes', value: recentCompetition[0]?.minutesPlayed ?? 0 },
            { label: 'Alertas actuales', value: alerts.length, tone: alerts.length ? 'amber' : 'green' },
          ]} />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <SectionHeader eyebrow="Ficha" title="Datos personales" />
          <CompactInfoList items={[
            { label: 'Nacimiento', value: player.birthDate ? formatBirthDateForDisplay(player.birthDate) : 'Sin fecha' },
            { label: 'Documento', value: player.documentId ?? 'Sin definir' },
            { label: 'Nacionalidad', value: player.nationality ?? 'Sin definir' },
            { label: 'Lugar', value: player.birthplace ?? 'Sin definir' },
            { label: 'Teléfono jugador', value: player.phone ?? 'Sin definir' },
            { label: 'Emergencia', value: player.emergencyContactName ? `${player.emergencyContactName} · ${player.emergencyContactPhone ?? ''}` : 'Sin definir' },
          ]} />
        </div>
        <div className="card">
          <SectionHeader eyebrow="Carga" title="Referencias individuales dinámicas" subtitle="Rango normal calculado con las últimas 4-8 semanas del propio jugador." />
          <CompactInfoList items={[
            { label: 'Wellness normal', value: dynamicThresholds.wellness.p10 !== undefined ? `${dynamicThresholds.wellness.p10} - ${dynamicThresholds.wellness.p90}` : 'Sin historial' },
            { label: 'RPE normal', value: dynamicThresholds.rpe.p10 !== undefined ? `${dynamicThresholds.rpe.p10} - ${dynamicThresholds.rpe.p90}` : 'Sin historial' },
            { label: 'Carga normal', value: dynamicThresholds.load.p10 !== undefined ? `${dynamicThresholds.load.p10} - ${dynamicThresholds.load.p90} UA` : 'Sin historial' },
            { label: 'Vmax referencia', value: formatNumber(player.maxVelocityReference, ' km/h') },
            { label: 'Línea base wellness', value: formatNumber(player.baselineWellness) },
            { label: 'Carga objetivo', value: formatNumber(player.targetWeeklyLoad, ' UA') },
          ]} />
        </div>
        <div className="card">
          <SectionHeader eyebrow="Disponibilidad" title="Restricciones activas" />
          <CompactInfoList items={[
            { label: '% máximo sesión', value: formatNumber(player.maxTrainingPercent, '%') },
            { label: 'Minutos máximos partido', value: formatNumber(player.maxCompetitionMinutes, ' min') },
            { label: 'Fase retorno', value: player.returnToPlayPhase ?? 'Sin definir' },
            { label: 'Zonas de riesgo', value: player.riskAreas ?? 'Sin definir' },
            { label: 'Restricciones', value: player.restrictions?.length ? player.restrictions.join(', ') : 'Sin restricciones' },
            { label: 'Nota médica', value: player.medicalNotes ?? 'Sin nota' },
          ]} />
        </div>
      </div>


      <div className="grid grid-3">
        <div className="card">
          <SectionHeader eyebrow="Umbrales individuales" title="Percentiles y z-score" subtitle="Alarma real cuando el dato sale de su rango habitual individual." />
          <CompactInfoList items={[
            { label: 'Wellness hoy', value: dynamicThresholds.wellness.today ?? 's/d', tone: dynamicThresholds.wellness.tone },
            { label: 'Wellness z-score', value: dynamicThresholds.wellness.zScore ?? 's/d', tone: dynamicThresholds.wellness.tone },
            { label: 'RPE hoy', value: dynamicThresholds.rpe.today ?? 's/d', tone: dynamicThresholds.rpe.tone },
            { label: 'RPE z-score', value: dynamicThresholds.rpe.zScore ?? 's/d', tone: dynamicThresholds.rpe.tone },
            { label: 'Carga hoy', value: dynamicThresholds.load.today ? `${dynamicThresholds.load.today} UA` : 's/d', tone: dynamicThresholds.load.tone },
            { label: 'Carga z-score', value: dynamicThresholds.load.zScore ?? 's/d', tone: dynamicThresholds.load.tone },
          ]} />
        </div>
        <div className="card">
          <SectionHeader eyebrow="Banister" title="Fitness-fatiga" subtitle="CTL τ=42 días · ATL τ=7 días · TSB=CTL-ATL." />
          <CompactInfoList items={[
            { label: 'CTL fitness', value: `${banister.ctl} UA`, tone: 'blue' },
            { label: 'ATL fatiga', value: `${banister.atl} UA`, tone: banister.atl > banister.ctl ? 'amber' : 'green' },
            { label: 'TSB forma', value: `${banister.tsb} UA`, tone: banister.tsb < 0 ? 'amber' : 'green' },
            { label: 'Próximo MD', value: banister.projectedMatchDate ?? 'Sin fecha' },
            { label: 'TSB proyectado', value: banister.projectedTsb !== undefined ? `${banister.projectedTsb} UA` : 's/d', tone: banister.tone },
            { label: 'Lectura', value: banister.label, tone: banister.tone },
          ]} />
        </div>
        <div className="card">
          <SectionHeader eyebrow="Interpretación" title="Perfil de confianza" />
          <CompactInfoList items={[
            { label: 'Wellness muestras', value: dynamicThresholds.wellness.count },
            { label: 'RPE muestras', value: dynamicThresholds.rpe.count },
            { label: 'Carga muestras', value: dynamicThresholds.load.count },
            { label: 'Wellness', value: dynamicThresholds.wellness.message, tone: dynamicThresholds.wellness.tone },
            { label: 'RPE', value: dynamicThresholds.rpe.message, tone: dynamicThresholds.rpe.tone },
            { label: 'Carga', value: dynamicThresholds.load.message, tone: dynamicThresholds.load.tone },
          ]} />
        </div>
      </div>

      <div className="player-detail-tabs no-print">
        <span className="player-detail-tab">Resumen</span>
        <span className="player-detail-tab">Carga</span>
        <span className="player-detail-tab">Wellness</span>
        <span className="player-detail-tab">Competencia</span>
        <span className="player-detail-tab">Valoraciones</span>
        <span className="player-detail-tab">Historial médico</span>
      </div>

      {canEditPlayer ? (
        <div className="card grid">
          <SectionHeader eyebrow="Edición" title="Editar ficha completa del jugador" subtitle="Estos campos alimentan la lectura de disponibilidad y control individual de carga." />
          <div className="grid grid-3">
            <div className="field"><label>Nombre</label><input className="input" value={player.name} onChange={(e) => patchPlayer({ name: e.target.value })} /></div>
            <div className="field"><label>Documento / ID</label><input className="input" value={player.documentId ?? ''} onChange={(e) => patchPlayer({ documentId: e.target.value })} /></div>
            <div className="field"><label>Fecha de nacimiento</label><input className="input" type="date" value={normalizeBirthDateInput(player.birthDate)} onChange={(e) => patchPlayer({ birthDate: formatBirthDateForDisplay(e.target.value) })} /></div>
          </div>
          <div className="grid grid-3">
            <div className="field"><label>Nacionalidad</label><input className="input" value={player.nationality ?? ''} onChange={(e) => patchPlayer({ nationality: e.target.value })} /></div>
            <div className="field"><label>Lugar nacimiento</label><input className="input" value={player.birthplace ?? ''} onChange={(e) => patchPlayer({ birthplace: e.target.value })} /></div>
            <div className="field"><label>Teléfono jugador</label><input className="input" value={player.phone ?? ''} onChange={(e) => patchPlayer({ phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-4">
            <div className="field"><label>Dorsal</label><input className="input" type="number" min="1" max="99" value={player.jerseyNumber ?? ''} onChange={(e) => patchPlayer({ jerseyNumber: toNumberOrUndefined(e.target.value) })} /></div>
            <div className="field"><label>Posición</label><select className="select" value={player.position} onChange={(e) => patchPlayer({ position: e.target.value as Position })}>{positions.map((position) => <option key={position}>{position}</option>)}</select></div>
            <div className="field"><label>Posición secundaria</label><select className="select" value={player.secondaryPosition ?? ''} onChange={(e) => patchPlayer({ secondaryPosition: (e.target.value || undefined) as Position | undefined })}><option value="">Sin definir</option>{positions.map((position) => <option key={position}>{position}</option>)}</select></div>
            <div className="field"><label>Pie dominante</label><select className="select" value={player.dominantFoot ?? ''} onChange={(e) => patchPlayer({ dominantFoot: (e.target.value || undefined) as DominantFoot | undefined })}><option value="">Sin definir</option>{dominantFeet.map((foot) => <option key={foot}>{foot}</option>)}</select></div>
          </div>
          <div className="grid grid-4">
            <div className="field"><label>Categoría de referencia</label><select className="select" value={player.category} onChange={(e) => patchPlayer({ category: e.target.value as ClubCategory })}>{categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}</select></div>
            <div className="field"><label>Rol competitivo</label><select className="select" value={player.competitiveRole ?? ''} onChange={(e) => patchPlayer({ competitiveRole: (e.target.value || undefined) as CompetitiveRole | undefined })}><option value="">Sin definir</option>{competitiveRoles.map((role) => <option key={role}>{role}</option>)}</select></div>
            <div className="field"><label>Fecha ingreso</label><input className="input" type="date" value={player.dateJoined ?? ''} onChange={(e) => patchPlayer({ dateJoined: e.target.value })} /></div>
            <div className="field"><label>Estado</label><select className="select" value={player.status} onChange={(e) => patchPlayer({ status: e.target.value as PlayerStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>
          </div>
          <div className="grid grid-3">
            <div className="field"><label>Estatura (cm)</label><input className="input" type="number" step="0.01" value={player.height} onChange={(e) => patchPlayer({ height: Number.parseFloat(e.target.value) || 0 })} /></div>
            <div className="field"><label>Peso (kg)</label><input className="input" type="number" step="0.01" value={player.weight} onChange={(e) => patchPlayer({ weight: Number.parseFloat(e.target.value) || 0 })} /></div>
            <div className="field"><label>Foto</label><input className="input" type="file" accept=".jpg,.jpeg,.png,image/png,image/jpeg" onChange={handlePhotoChange} /></div>
          </div>

          <SectionHeader eyebrow="Carga" title="Editar referencias individuales" subtitle="Úsalas como marco de comparación para decisiones de carga." />
          <div className="grid grid-4">
            <div className="field"><label>Tolerancia a carga</label><select className="select" value={player.loadTolerance ?? ''} onChange={(e) => patchPlayer({ loadTolerance: (e.target.value || undefined) as LoadTolerance | undefined })}><option value="">Sin definir</option>{loadTolerances.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Vmax referencia</label><input className="input" type="number" step="0.01" value={player.maxVelocityReference ?? ''} onChange={(e) => patchPlayer({ maxVelocityReference: toNumberOrUndefined(e.target.value) })} /></div>
            <div className="field"><label>Línea base wellness</label><input className="input" type="number" step="0.1" min="1" max="5" value={player.baselineWellness ?? ''} onChange={(e) => patchPlayer({ baselineWellness: toNumberOrUndefined(e.target.value) })} /></div>
            <div className="field"><label>RPE habitual</label><input className="input" type="number" step="0.1" min="0" max="10" value={player.baselineRpe ?? ''} onChange={(e) => patchPlayer({ baselineRpe: toNumberOrUndefined(e.target.value) })} /></div>
          </div>
          <div className="grid grid-4">
            <div className="field"><label>Carga semanal objetivo</label><input className="input" type="number" value={player.targetWeeklyLoad ?? ''} onChange={(e) => patchPlayer({ targetWeeklyLoad: toNumberOrUndefined(e.target.value) })} /></div>
            <div className="field"><label>HSR objetivo</label><input className="input" type="number" value={player.targetWeeklyHsr ?? ''} onChange={(e) => patchPlayer({ targetWeeklyHsr: toNumberOrUndefined(e.target.value) })} /></div>
            <div className="field"><label>Sprint objetivo</label><input className="input" type="number" value={player.targetWeeklySprintDistance ?? ''} onChange={(e) => patchPlayer({ targetWeeklySprintDistance: toNumberOrUndefined(e.target.value) })} /></div>
            <div className="field"><label>Minutos objetivo 7d</label><input className="input" type="number" value={player.targetMinutes7d ?? ''} onChange={(e) => patchPlayer({ targetMinutes7d: toNumberOrUndefined(e.target.value) })} /></div>
          </div>

          <SectionHeader eyebrow="Disponibilidad" title="Editar restricciones y antecedentes" />
          <div className="grid grid-4">
            <div className="field"><label>% máximo sesión</label><input className="input" type="number" min="0" max="100" value={player.maxTrainingPercent ?? ''} onChange={(e) => patchPlayer({ maxTrainingPercent: toNumberOrUndefined(e.target.value) })} /></div>
            <div className="field"><label>Minutos máximos partido</label><input className="input" type="number" min="0" max="120" value={player.maxCompetitionMinutes ?? ''} onChange={(e) => patchPlayer({ maxCompetitionMinutes: toNumberOrUndefined(e.target.value) })} /></div>
            <div className="field"><label>Fase retorno</label><input className="input" value={player.returnToPlayPhase ?? ''} onChange={(e) => patchPlayer({ returnToPlayPhase: e.target.value })} /></div>
            <div className="field"><label>Zonas de riesgo</label><input className="input" value={player.riskAreas ?? ''} onChange={(e) => patchPlayer({ riskAreas: e.target.value })} /></div>
          </div>
          <div className="field"><label>Restricciones actuales</label><input className="input" value={restrictionsToText(player.restrictions)} onChange={(e) => patchPlayer({ restrictions: textToRestrictions(e.target.value) })} /></div>
          <div className="grid grid-3">
            <div className="field"><label>Alergias</label><input className="input" value={player.allergies ?? ''} onChange={(e) => patchPlayer({ allergies: e.target.value })} /></div>
            <div className="field"><label>Condiciones crónicas</label><input className="input" value={player.chronicConditions ?? ''} onChange={(e) => patchPlayer({ chronicConditions: e.target.value })} /></div>
            <div className="field"><label>Nota médica/deportiva</label><input className="input" value={player.medicalNotes ?? ''} onChange={(e) => patchPlayer({ medicalNotes: e.target.value })} /></div>
          </div>
          <div className="grid grid-3">
            <div className="field"><label>Acudiente</label><input className="input" value={player.guardianName ?? ''} onChange={(e) => patchPlayer({ guardianName: e.target.value })} /></div>
            <div className="field"><label>Teléfono acudiente</label><input className="input" value={player.guardianPhone ?? ''} onChange={(e) => patchPlayer({ guardianPhone: e.target.value })} /></div>
            <div className="field"><label>Teléfono emergencia</label><input className="input" value={player.emergencyContactPhone ?? ''} onChange={(e) => patchPlayer({ emergencyContactPhone: e.target.value })} /></div>
          </div>
        </div>
      ) : null}

      {canEditPlayer ? <div className="card">
        <h3>Lesión o novedad física</h3>
        <div className="grid grid-4">
          <input className="input" placeholder="Zona afectada" value={player.injuryArea ?? ''} onChange={(e) => patchPlayer({ injuryArea: e.target.value })} />
          <input className="input" placeholder="Tipo de lesión/molestia" value={player.injuryType ?? ''} onChange={(e) => patchPlayer({ injuryType: e.target.value })} />
          <input className="input" placeholder="Severidad" value={player.injurySeverity ?? ''} onChange={(e) => patchPlayer({ injurySeverity: e.target.value })} />
          <input className="input" type="date" value={player.returnDate ?? ''} onChange={(e) => patchPlayer({ returnDate: e.target.value })} />
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              if (!player.injuryType) return;
              const next = [
                {
                  id: crypto.randomUUID(),
                  date: new Date().toISOString().slice(0, 10),
                  injuryType: player.injuryType ?? 'Sin detalle',
                  area: player.injuryArea ?? '',
                  severity: player.injurySeverity ?? '',
                  status: (player.status === 'Disponible' ? 'cerrada' : 'activa') as 'activa' | 'cerrada',
                  medicalNote: player.medicalNotes ?? '',
                  expectedReturnDate: player.returnDate ?? '',
                },
                ...(player.injuryHistory ?? []),
              ];
              patchPlayer({ injuryHistory: next });
            }}
          >
            Guardar en historial de lesiones
          </button>
        </div>
      </div> : null}

      <div className="grid grid-4">
        <div className="card"><span className="kpi-label">Wellness actual</span><div style={{ marginTop: 10 }}><WellnessBadge value={currentWellness} /></div><div className="kpi-trend">Línea base: {formatNumber(player.baselineWellness)}</div></div>
        <div className="card"><span className="kpi-label">Carga interna 7 días</span><div className="kpi-value">{weeklyInternalLoad}</div><div className="kpi-trend">Objetivo: {formatNumber(player.targetWeeklyLoad, ' UA')}</div></div>
        <div className="card"><span className="kpi-label">Minutos 7 días</span><div className="kpi-value">{weeklyMinutes}</div><div className="kpi-trend">Objetivo: {formatNumber(player.targetMinutes7d, ' min')}</div></div>
        <div className="card"><span className="kpi-label">Alta velocidad / sprint</span><div className="kpi-value">{weeklyHsr}/{weeklySprint}</div><div className="kpi-trend">m HSR / m sprint</div></div>
      </div>

      <div className="card">
        <SectionHeader
          eyebrow="Decisión científica diaria"
          title="Recomendación de carga individual"
          subtitle="Cruza wellness, línea base, carga 7d vs habitual, RPE, alta velocidad, mapa corporal, estado médico y día MD."
        />
        <div className="grid grid-4">
          <div className="mini-stat-card">
            <span className="kpi-label">Decisión</span>
            <div className="kpi-value" style={{ fontSize: '1.45rem' }}>{scientificDecision.state}</div>
            <div className="kpi-trend">{scientificDecision.percent} · score {scientificDecision.score}%</div>
          </div>
          <div className="mini-stat-card">
            <span className="kpi-label">Carga 7d vs habitual</span>
            <div className="kpi-value" style={{ fontSize: '1.45rem' }}>{scientificDecision.metrics.acuteChronicRatio ? scientificDecision.metrics.acuteChronicRatio.toFixed(2) : 's/d'}</div>
            <div className="kpi-trend">7d {Math.round(scientificDecision.metrics.load7d)} UA · habitual {Math.round(scientificDecision.metrics.chronicWeeklyLoad)} UA</div>
          </div>
          <div className="mini-stat-card">
            <span className="kpi-label">Alta velocidad / sprint</span>
            <div className="kpi-value" style={{ fontSize: '1.45rem' }}>{Math.round(scientificDecision.metrics.hsr7d)} / {Math.round(scientificDecision.metrics.sprint7d)}</div>
            <div className="kpi-trend">Días sin HSR {scientificDecision.metrics.daysSinceHighSpeed ?? 's/d'} · sin sprint {scientificDecision.metrics.daysSinceSprint ?? 's/d'}</div>
          </div>
          <div className="mini-stat-card">
            <span className="kpi-label">Confianza del dato</span>
            <div className="kpi-value" style={{ fontSize: '1.45rem' }}>{scientificDecision.confidence}</div>
            <div className="kpi-trend">Calidad {scientificDecision.metrics.dataQuality}% · MD {sessionTypeForDecision}</div>
          </div>
        </div>
        <div className="grid grid-3" style={{ marginTop: 14 }}>
          <div className="mini-stat-card">
            <strong>Motivos principales</strong>
            <ul className="compact-list">
              {scientificDecision.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
          <div className="mini-stat-card">
            <strong>Restricciones sugeridas</strong>
            {scientificDecision.restrictions.length ? (
              <ul className="compact-list">{scientificDecision.restrictions.map((item) => <li key={item}>{item}</li>)}</ul>
            ) : <div className="muted-line">Sin restricciones adicionales por los datos actuales.</div>}
          </div>
          <div className="mini-stat-card">
            <strong>Foco próxima sesión</strong>
            <ul className="compact-list">
              {scientificDecision.nextFocus.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <div className="muted-line" style={{ marginTop: 8 }}>{scientificDecision.metrics.externalToleranceLabel}</div>
            <div className="muted-line">{scientificDecision.metrics.competitiveLoadLabel}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3>Panel de alertas</h3>
          {alerts.length ? alerts.map((alert) => <div key={alert} className="alert-item tone-yellow" style={{ marginBottom: 10 }}>{alert}</div>) : <div className="empty">Sin alertas recientes.</div>}
        </div>
        <div className="card">
          <h3>Wellness histórico</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={wellnessHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="wellness" stroke="#1d4ed8" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>CMJ histórico</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={cmjHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="cmj" stroke="#1d4ed8" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Historial de lesiones</h3>
        {injuryHistory.length ? (
          <div className="grid" style={{ gap: 10 }}>
            {injuryHistory.map((item) => (
              <div key={item.id} className="mini-stat-card">
                <strong>{item.date} · {item.injuryType}</strong>
                <div className="muted-line">Zona: {item.area || '-'}</div>
                <div className="muted-line">Severidad: {item.severity || '-'}</div>
                <div className="muted-line">Estado: {item.status}</div>
                <div className="muted-line">Retorno: {item.expectedReturnDate || '-'}</div>
                <div className="muted-line">{item.medicalNote || 'Sin observación médica'}</div>
              </div>
            ))}
          </div>
        ) : <div className="empty">Sin lesiones registradas.</div>}
      </div>

      <div className="card">
        <h3>Historial de participaciones temporales</h3>
        {temporaryMovements.length ? (
          <div className="grid" style={{ gap: 10 }}>
            {temporaryMovements.map((item, index) => (
              <div key={`${item.date}-${item.module}-${index}`} className="mini-stat-card">
                <strong>{item.module}</strong>
                <div className="muted-line">{item.date}</div>
                <div className="muted-line">Categoría de referencia {categoryLabel(item.baseCategory)} · Participó con {categoryLabel(item.actingCategory)}</div>
                <div className="muted-line">{item.movementType}{item.note ? ` · ${item.note}` : ''}</div>
              </div>
            ))}
          </div>
        ) : <div className="empty">Sin movimientos temporales registrados.</div>}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Últimas 3 sesiones</h3>
          <div className="grid" style={{ gap: 10 }}>
            {recentSessions.map((item) => (
              <div key={item.id} className="mini-stat-card">
                <strong>{item.date}</strong>
                <div className="muted-line">Sesión {item.sessionNumber ?? '-'} · {item.sessionType ?? '-'}</div>
                <div className="muted-line">MIN {item.min} · RPE {item.rpe ?? 0}</div>
              </div>
            ))}
            {!recentSessions.length ? <div className="empty">Sin sesiones registradas.</div> : null}
          </div>
        </div>
        <div className="card">
          <h3>Últimos partidos</h3>
          <div className="grid" style={{ gap: 10 }}>
            {recentCompetition.map((match) => (
              <div key={match.id} className="mini-stat-card">
                <strong>{match.competitionName ?? match.opponent}</strong>
                <div className="muted-line">{match.date} · {match.minutesPlayed} min</div>
                <div className="muted-line">G {match.goals} · A {match.assists} · TA {match.yellowCards} · TR {match.redCards}</div>
              </div>
            ))}
            {!recentCompetition.length ? <div className="empty">Sin partidos registrados.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
