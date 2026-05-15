'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, HeartPulse, Save, Stethoscope, Users } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { BodyMapSelector } from '@/components/body-map-selector';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge } from '@/components/pro-ui';
import { PlayerStatusBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { buildAvailabilityCenter } from '@/lib/strategic-helpers';
import { formatDateShort } from '@/lib/operational-helpers';
import { bodyMapRecordFromRemoteRow, bodyMapRecordToRemoteRow, getBodyMapDecision, mergeBodyMapRecords, newBodyMapId, readBodyMapRecords, REMOTE_BODY_MAP_TABLE, saveBodyMapRecords, type BodyMapRecord, type BodyMapRecordType, type BodyMapSide, type BodyMapStatus } from '@/lib/body-map';
import { supabase, tableSchemaSyncEnabled } from '@/lib/supabase';

export default function AvailabilityPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const center = buildAvailabilityCenter(data, filters, activeCategory);
  const [bodyRecords, setBodyRecords] = useState<BodyMapRecord[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [region, setRegion] = useState('Isquiotibial');
  const [side, setSide] = useState<BodyMapSide>('Derecha');
  const [type, setType] = useState<BodyMapRecordType>('Molestia');
  const [intensity, setIntensity] = useState(0);
  const [limitation, setLimitation] = useState(false);
  const [sprint, setSprint] = useState(false);
  const [cod, setCod] = useState(false);
  const [status, setStatus] = useState<BodyMapStatus>('En seguimiento');
  const [restriction, setRestriction] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadBodyRecords = async () => {
      const localRecords = readBodyMapRecords();
      if (!supabase || !tableSchemaSyncEnabled) {
        if (active) setBodyRecords(mergeBodyMapRecords(localRecords));
        return;
      }

      const { data: remoteRows, error } = await supabase
        .from(REMOTE_BODY_MAP_TABLE)
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(250);

      if (!active) return;
      if (error) {
        console.warn('No se pudieron cargar mapas corporales remotos. Ejecuta el SQL V130_BODY_MAP_WELLNESS_STAFF.sql.', error.message);
        setBodyRecords(mergeBodyMapRecords(localRecords));
        return;
      }

      const remoteRecords = (remoteRows ?? []).map((row) => bodyMapRecordFromRemoteRow(row as Record<string, any>));
      setBodyRecords(mergeBodyMapRecords([...remoteRecords, ...localRecords]));
    };

    void loadBodyRecords();
    const timer = supabase && tableSchemaSyncEnabled ? window.setInterval(() => { void loadBodyRecords(); }, 45000) : undefined;
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!selectedPlayerId && center.rows[0]?.player.id) setSelectedPlayerId(center.rows[0].player.id);
  }, [center.rows, selectedPlayerId]);

  const bodyDecision = getBodyMapDecision({ region, type, intensity, limitation, increasesWithSprint: sprint, increasesWithChangeOfDirection: cod, status });
  const openBodyRecords = useMemo(() => bodyRecords
    .filter((record) => record.status !== 'Cerrado' && (activeCategory === 'all' || record.category === activeCategory || data.players.find((player) => player.id === record.playerId)?.category === activeCategory))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [bodyRecords, activeCategory, data.players]);

  const saveAvailabilityBodyMap = async () => {
    if (!selectedPlayerId) return;
    const player = data.players.find((item) => item.id === selectedPlayerId);
    const decision = getBodyMapDecision({ region, type, intensity, limitation, increasesWithSprint: sprint, increasesWithChangeOfDirection: cod, status });
    const record: BodyMapRecord = {
      id: newBodyMapId(),
      playerId: selectedPlayerId,
      date: filters.date,
      category: player?.category,
      source: 'Cuerpo técnico',
      type,
      region,
      side,
      intensity,
      limitation,
      increasesWithSprint: sprint,
      increasesWithChangeOfDirection: cod,
      restriction: restriction || decision.restriction,
      action: `${decision.decision} · ${decision.pct}`,
      status,
      createdAt: new Date().toISOString(),
    };
    const next = mergeBodyMapRecords([record, ...bodyRecords]);
    saveBodyMapRecords(next);
    setBodyRecords(next);

    if (supabase && tableSchemaSyncEnabled) {
      const { data: remotePlayer } = await supabase
        .from('players')
        .select('id')
        .eq('legacy_id', selectedPlayerId)
        .maybeSingle();
      const { error } = await supabase
        .from(REMOTE_BODY_MAP_TABLE)
        .upsert(bodyMapRecordToRemoteRow(record, remotePlayer?.id ?? null), { onConflict: 'legacy_id', ignoreDuplicates: false });
      if (error) console.warn('No se pudo guardar mapa corporal remoto.', error.message);
    }

    setMessage(`Disponibilidad registrada para ${player?.name ?? 'jugador'}: ${decision.decision}.`);
  };

  return (
    <div className="grid availability-page">
      <AppHero
        title="Centro médico y disponibilidad"
        subtitle={`Estado del plantel, incidencias y readaptación · ${activeCategory === 'all' ? 'Todas' : categoryLabel(activeCategory)} · ${formatDateShort(filters.date)}`}
      />
      <GlobalFiltersBar />

      <div className="card availability-body-map-card">
        <SectionHeader
          eyebrow="Disponibilidad con mapa corporal"
          title="Reporte rápido de molestia, dolor o lesión"
          subtitle="La misma silueta del wellness permite validar zonas reportadas y convertirlas en restricción de carga. No reemplaza valoración médica."
        />
        <div className="grid grid-2 body-map-staff-layout">
          <div className="grid form-grid">
            <label>Jugador
              <select className="select" value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)}>
                {center.rows.map((row) => <option key={row.player.id} value={row.player.id}>{row.player.name}</option>)}
              </select>
            </label>
            <label>Tipo
              <select className="select" value={type} onChange={(event) => setType(event.target.value as BodyMapRecordType)}>
                {['Fatiga muscular', 'Molestia', 'Dolor muscular', 'Lesión confirmada', 'Seguimiento'].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>Lado
              <select className="select" value={side} onChange={(event) => setSide(event.target.value as BodyMapSide)}>
                {['Derecha', 'Izquierda', 'Bilateral', 'Central'].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>Estado
              <select className="select" value={status} onChange={(event) => setStatus(event.target.value as BodyMapStatus)}>
                {['Abierto', 'En seguimiento', 'Cerrado'].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>Intensidad 0 a 10
              <input className="input" type="number" min="0" max="10" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
            </label>
            <div className="body-map-checks">
              <label><input type="checkbox" checked={limitation} onChange={(event) => setLimitation(event.target.checked)} /> Limita entrenamiento</label>
              <label><input type="checkbox" checked={sprint} onChange={(event) => setSprint(event.target.checked)} /> Aumenta al sprintar</label>
              <label><input type="checkbox" checked={cod} onChange={(event) => setCod(event.target.checked)} /> Aumenta al frenar/girar</label>
            </div>
            <label className="full-width">Restricción específica opcional
              <input className="input" value={restriction} onChange={(event) => setRestriction(event.target.value)} placeholder={bodyDecision.restriction} />
            </label>
            <div className="soft-alert warning full-width"><AlertTriangle size={16} /> <strong>{bodyDecision.decision} · {bodyDecision.pct}</strong> {restriction || bodyDecision.restriction}</div>
            <button className="btn full-width" type="button" onClick={saveAvailabilityBodyMap}><Save size={16} /> Guardar disponibilidad corporal</button>
            {message ? <div className="soft-alert success full-width">{message}</div> : null}
          </div>
          <BodyMapSelector value={region} onChange={setRegion} />
        </div>
      </div>

      <div className="grid grid-4">
        <KpiCard label="Disponibles" value={String(center.statusCounts.Disponible)} tone="green" icon={<Users size={18} />} trend="Habilitados para planificar" />
        <KpiCard label="Molestia" value={String(center.statusCounts.Molestia)} tone="amber" icon={<Stethoscope size={18} />} trend="Control preventivo" />
        <KpiCard label="Readaptación" value={String(center.statusCounts.Readaptación)} tone="blue" icon={<Activity size={18} />} trend="Carga progresiva" />
        <KpiCard label="Lesionados" value={String(center.statusCounts.Lesionado)} tone="red" icon={<HeartPulse size={18} />} trend="Seguimiento médico" />
      </div>

      {openBodyRecords.length ? (
        <div className="card">
          <SectionHeader eyebrow="Alertas corporales activas" title="Restricciones para decidir carga" subtitle="Se alimenta del wellness de jugadores y de los reportes del cuerpo técnico/fisioterapia." />
          <div className="table-scroll"><table className="pro-table"><thead><tr><th>Jugador</th><th>Fecha</th><th>Zona</th><th>Tipo</th><th>Intensidad</th><th>Decisión</th><th>Restricción</th></tr></thead><tbody>
            {openBodyRecords.slice(0, 12).map((record) => {
              const player = data.players.find((item) => item.id === record.playerId);
              const decision = getBodyMapDecision(record);
              return <tr key={record.id}>
                <td>{player?.name ?? 'Jugador'}</td>
                <td>{formatDateShort(record.date)}</td>
                <td>{record.region} · {record.side}</td>
                <td>{record.type}</td>
                <td>{record.intensity}/10</td>
                <td><StatusBadge text={decision.decision} tone={decision.decision.includes('No campo') || decision.decision.includes('modificado') ? 'red' : decision.decision.includes('Reducir') ? 'amber' : 'blue'} /></td>
                <td>{record.restriction || decision.restriction}</td>
              </tr>;
            })}
          </tbody></table></div>
        </div>
      ) : null}

      <div className="card medical-command-card">
        <SectionHeader
          eyebrow="Disponibilidad"
          title="Mapa médico del plantel"
          subtitle="Disponibilidad e incidencias."
          action={<Link className="btn secondary" href="/jugadores">Ver plantilla</Link>}
        />
        <div className="availability-board">
          {center.rows.map((row) => (
            <Link href={`/jugadores/${row.player.id}`} key={row.player.id} className={`availability-row ui-tone-${row.tone}`}>
              <div className="availability-main">
                <div className="player-avatar">{row.player.name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{row.player.name}</strong>
                  <span>{row.player.position} · {categoryLabel(row.player.category)}</span>
                </div>
              </div>
              <PlayerStatusBadge status={row.player.status} />
              <div className="availability-metrics">
                <span>Wellness {row.latestWellness ? row.latestWellness.toFixed(1) : '—'}</span>
                <span>{row.todayMinutes} min hoy</span>
                <span>{row.weeklyMinutes} min periodo</span>
              </div>
              <div className="availability-note">
                <strong>{row.recommendation}</strong>
                {row.latestMedicalObservation ? <span>{row.latestMedicalObservation}</span> : <span>Sin observación médica reciente.</span>}
              </div>
            </Link>
          ))}
          {!center.rows.length ? <EmptyState title="No hay jugadores visibles" text="Ajusta filtros de categoría, posición o estado para ver disponibilidad." /> : null}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Readaptación" title="Jugadores en seguimiento" subtitle="Control de disponibilidad y carga progresiva." />
          <div className="medical-focus-list">
            {center.rows.filter((row) => row.player.status !== 'Disponible').map((row) => (
              <div key={row.player.id} className="medical-focus-item">
                <div>
                  <strong>{row.player.name}</strong>
                  <span>{row.player.status} · {row.player.position}</span>
                </div>
                <StatusBadge text={row.recommendation} tone={row.tone} />
              </div>
            ))}
            {!center.rows.some((row) => row.player.status !== 'Disponible') ? <EmptyState icon="check" title="Plantel sin incidencias activas" text="Sin incidencias." /> : null}
          </div>
        </div>
        <div className="card">
          <SectionHeader eyebrow="Historial" title="Observaciones médicas recientes" subtitle="Incidencias registradas desde competencia o estado del jugador." />
          <div className="medical-focus-list">
            {center.recentMedical.map((record) => {
              const player = data.players.find((item) => item.id === record.playerId);
              return (
                <div key={record.id} className="medical-focus-item">
                  <div>
                    <strong>{player?.name ?? 'Jugador'}</strong>
                    <span>{formatDateShort(record.date)} · vs {record.opponent}</span>
                  </div>
                  <span className="muted-line">{record.medicalObservation || record.medicalStatus || 'Sin detalle'}</span>
                </div>
              );
            })}
            {!center.recentMedical.length ? <EmptyState icon="check" title="Sin incidencias médicas recientes" text="Cuando existan observaciones médicas, aparecerán en este panel." /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
