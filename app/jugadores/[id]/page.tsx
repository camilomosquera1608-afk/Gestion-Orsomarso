'use client';

import { ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import { AppHero } from '@/components/app-hero';
import { PlayerStatusBadge, WellnessBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel, calcAge, formatBirthDateForDisplay, normalizeBirthDateInput } from '@/lib/labels';
import { ClubCategory, PlayerStatus, Position } from '@/lib/types';
import { averageWellness, calculateInternalLoad, groupAverage } from '@/lib/utils';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const statuses: PlayerStatus[] = ['Disponible', 'Molestia', 'Readaptación', 'Lesionado'];
const positions: Position[] = ['Portero', 'Defensa central', 'Lateral', 'Mediocampista', 'Extremo', 'Delantero'];
const categories: ClubCategory[] = ['Sub15', 'Sub17', 'Sub20'];

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const { data, updatePlayer } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const player = data.players.find((item) => item.id === params.id);

  if (!player) return <div className="empty">Jugador no encontrado o eliminado.</div>;

  const latestDate = [...new Set(data.wellness.filter((x) => x.playerId === player.id).map((x) => x.date))].sort().at(-1) ?? '2026-04-23';
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

  const alerts = [
    averageWellness(latestWellness) < 3 ? `Wellness bajo (${averageWellness(latestWellness).toFixed(1)})` : null,
    player.status !== 'Disponible' ? `Estado actual: ${player.status}` : null,
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
      <AppHero title={`Perfil individual · ${player.name}`} subtitle={`Base ${categoryLabel(player.category)}`} />
      <div className="card player-card executive-player-card">
        <img src={player.photo} alt={player.name} width={90} height={90} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 18 }} />
        <div>
          <h3 style={{ margin: 0 }}>{player.name}</h3>
          <div className="player-meta">
            <span>{calcAge(player.birthDate) ?? player.age} años</span>
            <span>{player.position}</span>
            <span>Base {categoryLabel(player.category)}</span>
            <span>{player.birthDate ? `Nac. ${formatBirthDateForDisplay(player.birthDate)}` : 'Sin fecha'}</span>
            <span>{player.height} cm</span>
            <span>{player.weight} kg</span>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <PlayerStatusBadge status={player.status} />
          </div>
        </div>
        <div className="summary-chip">Última fecha: {latestDate}</div>
      </div>

      {!master ? (
        <div className="card">
          <h3>Editar jugador</h3>
          <div className="grid grid-3">
            <div className="field"><label>Nombre</label><input className="input" value={player.name} onChange={(e) => patchPlayer({ name: e.target.value })} /></div>
            <div className="field"><label>Fecha de nacimiento</label><input className="input" type="date" value={normalizeBirthDateInput(player.birthDate)} onChange={(e) => patchPlayer({ birthDate: formatBirthDateForDisplay(e.target.value) })} /></div>
            <div className="field"><label>Posición</label><select className="select" value={player.position} onChange={(e) => patchPlayer({ position: e.target.value as Position })}>{positions.map((position) => <option key={position}>{position}</option>)}</select></div>
          </div>
          <div className="grid grid-3">
            <div className="field"><label>Categoría base</label><select className="select" value={player.category} onChange={(e) => patchPlayer({ category: e.target.value as ClubCategory })}>{categories.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}</select></div>
            <div className="field"><label>Estatura (cm)</label><input className="input" type="number" step="0.01" value={player.height} onChange={(e) => patchPlayer({ height: Number.parseFloat(e.target.value) || 0 })} /></div>
            <div className="field"><label>Peso (kg)</label><input className="input" type="number" step="0.01" value={player.weight} onChange={(e) => patchPlayer({ weight: Number.parseFloat(e.target.value) || 0 })} /></div>
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

      <div className="grid grid-2">
            <div className="field"><label>Estado</label><select className="select" value={player.status} onChange={(e) => patchPlayer({ status: e.target.value as PlayerStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>
            <div className="field"><label>Foto</label><input className="input" type="file" accept=".jpg,.jpeg,.png,image/png,image/jpeg" onChange={handlePhotoChange} /></div>
          </div>
        </div>
      ) : null}

      {!master ? <div className="card">
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
                  medicalNote: '',
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
        <div className="card"><span className="kpi-label">Wellness actual</span><div style={{ marginTop: 10 }}><WellnessBadge value={averageWellness(latestWellness)} /></div></div>
        <div className="card"><span className="kpi-label">Carga interna</span><div className="kpi-value">{latestInternal ? calculateInternalLoad(latestInternal) : 0}</div></div>
        <div className="card"><span className="kpi-label">{youthSimple ? 'RPE actual' : 'ACC actual'}</span><div className="kpi-value">{youthSimple ? (latestExternal?.rpe ?? 0) : (latestExternal?.acc ?? 0)}</div></div>
        <div className="card"><span className="kpi-label">CMJ actual</span><div className="kpi-value">{latestCmj?.value ?? 0} cm</div><div className="kpi-trend">Δ vs anterior: {latestCmj && previousCmj ? (latestCmj.value - previousCmj.value).toFixed(1) : '0.0'} cm</div></div>
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
        <h3>Historial de participaciones temporales</h3>
        {temporaryMovements.length ? (
          <div className="grid" style={{ gap: 10 }}>
            {temporaryMovements.map((item, index) => (
              <div key={`${item.date}-${item.module}-${index}`} className="mini-stat-card">
                <strong>{item.module}</strong>
                <div className="muted-line">{item.date}</div>
                <div className="muted-line">Base {categoryLabel(item.baseCategory)} · Participó con {categoryLabel(item.actingCategory)}</div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
