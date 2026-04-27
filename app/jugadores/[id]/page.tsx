'use client';

import { ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import { AppHero } from '@/components/app-hero';
import { PlayerStatusBadge, WellnessBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { PlayerStatus } from '@/lib/types';
import { averageWellness, calculateInternalLoad, groupAverage } from '@/lib/utils';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const statuses: PlayerStatus[] = ['Disponible', 'Molestia', 'Readaptación', 'Lesionado'];

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const { data, updatePlayer } = useApp();
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

  const timeline = [
    ...data.wellness.filter((x) => x.playerId === player.id).map((x) => ({ date: x.date, type: 'Wellness', detail: `Wellness ${averageWellness(x).toFixed(1)}` })),
    ...data.externalLoads.filter((x) => x.playerId === player.id).map((x) => ({ date: x.date, type: 'Sesión', detail: `${x.sessionType ?? '-'} · MIN ${x.min} · RPE ${x.rpe ?? 0}` })),
    ...data.competitionRecords.filter((x) => x.playerId === player.id).map((x) => ({ date: x.date, type: 'Competencia', detail: `${x.opponent} · ${x.minutesPlayed} min` })),
    ...data.cmjRecords.filter((x) => x.playerId === player.id).map((x) => ({ date: x.date, type: 'CMJ', detail: `${x.value} cm` })),
  ].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 12);

  const alerts = [
    averageWellness(latestWellness) < 3 ? `Wellness bajo (${averageWellness(latestWellness).toFixed(1)})` : null,
    player.status !== 'Disponible' ? `Estado actual: ${player.status}` : null,
    latestCmj && latestCmj.value < groupAverageCmj ? `CMJ por debajo del promedio grupal (${latestCmj.value} vs ${groupAverageCmj})` : null,
    (latestExternal?.acc ?? 0) > 35 ? `ACC elevado en la última sesión (${latestExternal?.acc ?? 0})` : null,
  ].filter(Boolean) as string[];

  const patchPlayer = (patch: Partial<typeof player>) => updatePlayer({ ...player, ...patch });
  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patchPlayer({ photo: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid">
      <AppHero title={`Perfil individual · ${player.name}`} />
      <div className="card player-card executive-player-card">
        <img src={player.photo} alt={player.name} width={90} height={90} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 18 }} />
        <div>
          <h3 style={{ margin: 0 }}>{player.name}</h3>
          <div className="player-meta">
            <span>{player.age} años</span>
            <span>{player.position}</span>
            <span>{player.category ?? 'Sub20'}</span>
            <span>{player.height} cm</span>
            <span>{player.weight} kg</span>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <PlayerStatusBadge status={player.status} />
            <select className="select" value={player.status} style={{ maxWidth: 180 }} onChange={(e) => patchPlayer({ status: e.target.value as PlayerStatus })}>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>
        <div className="summary-chip">Última fecha: {latestDate}</div>
      </div>

      <div className="card">
        <h3>Foto del jugador</h3>
        <div className="register-photo-box">
          <img src={player.photo || '/orsomarso-crest.jpg'} alt={player.name} className="register-photo-preview" />
          <div className="field">
            <label>Cargar JPG o PNG</label>
            <input className="input" type="file" accept=".jpg,.jpeg,.png,image/png,image/jpeg" onChange={handlePhotoChange} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Lesión o novedad física</h3>
        <div className="grid grid-4">
          <input className="input" placeholder="Zona afectada" value={player.injuryArea ?? ''} onChange={(e) => patchPlayer({ injuryArea: e.target.value })} />
          <input className="input" placeholder="Tipo de lesión/molestia" value={player.injuryType ?? ''} onChange={(e) => patchPlayer({ injuryType: e.target.value })} />
          <input className="input" placeholder="Severidad" value={player.injurySeverity ?? ''} onChange={(e) => patchPlayer({ injurySeverity: e.target.value })} />
          <input className="input" type="date" value={player.returnDate ?? ''} onChange={(e) => patchPlayer({ returnDate: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card"><span className="kpi-label">Wellness actual</span><div style={{ marginTop: 10 }}><WellnessBadge value={averageWellness(latestWellness)} /></div></div>
        <div className="card"><span className="kpi-label">Carga interna</span><div className="kpi-value">{latestInternal ? calculateInternalLoad(latestInternal) : 0}</div></div>
        <div className="card"><span className="kpi-label">ACC actual</span><div className="kpi-value">{latestExternal?.acc ?? 0}</div></div>
        <div className="card"><span className="kpi-label">CMJ actual</span><div className="kpi-value">{latestCmj?.value ?? 0} cm</div><div className="kpi-trend">Δ vs anterior: {latestCmj && previousCmj ? (latestCmj.value - previousCmj.value).toFixed(1) : '0.0'} cm</div></div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3>Panel de alertas</h3>
          {alerts.length ? alerts.map((alert) => <div key={alert} className="alert-item tone-yellow" style={{ marginBottom: 10 }}>{alert}</div>) : <div className="empty">Sin alertas recientes.</div>}
        </div>
        <div className="card">
          <h3>Últimas 3 sesiones</h3>
          <div className="grid" style={{ gap: 10 }}>
            {recentSessions.map((session) => (
              <div key={session.id} className="mini-stat-card">
                <strong>{session.date}</strong>
                <div className="muted-line">Sesión {session.sessionNumber ?? '-'} · {session.sessionType ?? '-'}</div>
                <div className="muted-line">Participación {session.participation ?? 'Completa'} · MIN {session.min} · RPE {session.rpe ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Últimos partidos</h3>
          <div className="grid" style={{ gap: 10 }}>
            {recentCompetition.map((match) => (
              <div key={match.id} className="mini-stat-card">
                <strong>{match.opponent}</strong>
                <div className="muted-line">{match.date} · {match.minutesPlayed} min</div>
                <div className="muted-line">G {match.goals} · A {match.assists} · TA {match.yellowCards} · TR {match.redCards}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Línea temporal consolidada</h3>
        <div className="grid" style={{ gap: 10 }}>
          {timeline.map((item, index) => <div key={`${item.date}-${item.type}-${index}`} className="mini-stat-card"><strong>{item.type}</strong><div className="muted-line">{item.date}</div><div className="muted-line">{item.detail}</div></div>)}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Evolución reciente de wellness</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={wellnessHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Line type="monotone" dataKey="wellness" stroke="#1d4ed8" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>Histórico de CMJ</h3>
          <div style={{ width: '100%', height: 300 }}>
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
    </div>
  );
}
