'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BedDouble, BookOpen, CalendarDays, CheckCircle2, ClipboardList, DoorOpen, Download, HeartPulse, Home, Save, ShieldCheck, Utensils, Users } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge, showToast } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import type { ClubCategory, Player } from '@/lib/types';
import {
  buildHouseAlerts,
  buildHouseDashboard,
  buildPlayerHouseLight,
  computeEvaluationScore,
  emptyHouseHomeData,
  fetchHouseHomeData,
  getCurrentMonth,
  getCurrentYear,
  getTodayInputDate,
  newId,
  saveHouseHomeData,
  type AcademicStatus,
  type HouseDailyMealRecord,
  type HouseDailyNewsRecord,
  type HouseExitPermissionRecord,
  type HouseHomeData,
  type HouseMonthlyEvaluationRecord,
  type HouseNewsSeverity,
  type HouseNewsStatus,
  type HousePermissionStatus,
  type HousePlayerRecord,
  type HousePlayerStatus,
  type HouseRoomRecord,
} from '@/lib/casa-hogar';

const categories: Array<ClubCategory | 'all'> = ['all', 'Sub20', 'Sub17', 'Sub15'];
const tabs = ['Dashboard', 'Jugadores', 'Alimentación', 'Evaluación mensual', 'Habitaciones', 'Permisos', 'Académico', 'Novedades', 'Informe'] as const;
type Tab = typeof tabs[number];

const scoreFields = [
  ['convivenciaScore', 'Convivencia'],
  ['responsabilidadScore', 'Responsabilidad'],
  ['alimentacionHabitosScore', 'Alimentación y hábitos'],
  ['compromisoDeportivoScore', 'Compromiso deportivo'],
  ['formacionIntegralScore', 'Formación integral'],
  ['bienestarEmocionalScore', 'Bienestar emocional'],
] as const;

const trafficTone = (value?: string) => value === 'Verde' ? 'green' : value === 'Amarillo' ? 'amber' : value === 'Rojo' ? 'red' : 'neutral';
const alertTone = (value: string) => value === 'critical' || value === 'Crítica' ? 'red' : value === 'warning' || value === 'Alerta' ? 'amber' : 'blue';

const getPlayerName = (players: Player[], playerId?: string) => players.find((item) => item.id === playerId)?.name ?? 'Jugador';
const fmtScore = (value?: number) => Number(value ?? 0).toFixed(1);

const getDefaultEvaluation = (playerId: string, month: number, year: number): HouseMonthlyEvaluationRecord => {
  const base = {
    id: newId('house-eval'),
    playerId,
    month,
    year,
    convivenciaScore: 3,
    responsabilidadScore: 3,
    alimentacionHabitosScore: 3,
    compromisoDeportivoScore: 3,
    formacionIntegralScore: 3,
    bienestarEmocionalScore: 3,
    observations: '',
    commitments: '',
    recommendations: '',
    responsible: '',
  };
  return { ...base, ...computeEvaluationScore(base) };
};

const getMealRecord = (houseData: HouseHomeData, playerId: string, date: string): HouseDailyMealRecord =>
  houseData.meals.find((item) => item.playerId === playerId && item.date === date) ?? {
    id: newId('house-meal'),
    playerId,
    date,
    breakfast: false,
    lunch: false,
    dinner: false,
    notes: '',
    responsible: '',
  };

export default function CasaHogarPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const [houseData, setHouseData] = useState<HouseHomeData>(emptyHouseHomeData());
  const [selectedTab, setSelectedTab] = useState<Tab>('Dashboard');
  const [selectedCategory, setSelectedCategory] = useState<ClubCategory | 'all'>((activeCategory === 'all' ? 'all' : activeCategory) as ClubCategory | 'all');
  const [date, setDate] = useState(filters.date || getTodayInputDate());
  const [month, setMonth] = useState(getCurrentMonth());
  const [year, setYear] = useState(getCurrentYear());
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    void fetchHouseHomeData().then((payload) => {
      if (!mounted) return;
      setHouseData(payload);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const visiblePlayers = useMemo(() => data.players.filter((player) => {
    if (selectedCategory !== 'all' && player.category !== selectedCategory) return false;
    return player.status !== 'Lesionado' || true;
  }), [data.players, selectedCategory]);

  const housePlayers = useMemo(() => {
    const ids = new Set(houseData.players.filter((item) => item.belongsHouse && item.status !== 'Egresado').map((item) => item.playerId));
    return visiblePlayers.filter((player) => ids.has(player.id));
  }, [houseData.players, visiblePlayers]);

  useEffect(() => {
    if (!selectedPlayerId && housePlayers[0]) setSelectedPlayerId(housePlayers[0].id);
  }, [housePlayers, selectedPlayerId]);

  const dashboard = useMemo(() => buildHouseDashboard(houseData, visiblePlayers, date, month, year), [houseData, visiblePlayers, date, month, year]);
  const alerts = useMemo(() => buildHouseAlerts(houseData, data.players, data.wellness, date, month, year), [houseData, data.players, data.wellness, date, month, year]);
  const roomsOccupancy = useMemo(() => houseData.rooms.map((room) => ({ room, assigned: houseData.players.filter((player) => player.belongsHouse && player.room === room.roomName).length })), [houseData.players, houseData.rooms]);

  const persist = async (next: HouseHomeData, success = 'Casa Hogar guardada correctamente.') => {
    setHouseData(next);
    setSaving(true);
    const result = await saveHouseHomeData(next);
    setSaving(false);
    if (result.ok) {
      setMessage(success);
      showToast(success, 'green');
    } else {
      const reason = result.reason || 'No se pudo guardar en Supabase. Se conserva respaldo local.';
      setMessage(reason);
      showToast(reason, 'amber');
    }
  };

  const upsertHousePlayer = async (player: Player, patch: Partial<HousePlayerRecord>) => {
    const existing = houseData.players.find((item) => item.playerId === player.id);
    const record: HousePlayerRecord = {
      id: existing?.id ?? newId('house-player'),
      playerId: player.id,
      category: player.category,
      belongsHouse: existing?.belongsHouse ?? false,
      room: existing?.room ?? '',
      bed: existing?.bed ?? '',
      status: existing?.status ?? 'Activo',
      notes: existing?.notes ?? '',
      ...patch,
    };
    await persist({ ...houseData, players: [...houseData.players.filter((item) => item.playerId !== player.id), record] }, 'Jugador actualizado en Casa Hogar.');
  };

  const upsertMeal = async (playerId: string, patch: Partial<HouseDailyMealRecord>) => {
    const current = getMealRecord(houseData, playerId, date);
    const record = { ...current, ...patch };
    await persist({ ...houseData, meals: [...houseData.meals.filter((item) => !(item.playerId === playerId && item.date === date)), record] }, 'Alimentación diaria guardada.');
  };

  const markAllMeal = async (field: 'breakfast' | 'lunch' | 'dinner') => {
    const records = housePlayers.map((player) => ({ ...getMealRecord(houseData, player.id, date), [field]: true }));
    const otherMeals = houseData.meals.filter((item) => !(item.date === date && housePlayers.some((player) => player.id === item.playerId)));
    await persist({ ...houseData, meals: [...otherMeals, ...records] }, 'Comida marcada para todos los jugadores visibles.');
  };

  const upsertEvaluation = async (record: HouseMonthlyEvaluationRecord) => {
    const computed = computeEvaluationScore(record);
    const nextRecord = { ...record, ...computed };
    await persist({ ...houseData, evaluations: [...houseData.evaluations.filter((item) => item.id !== nextRecord.id), nextRecord] }, 'Evaluación mensual guardada.');
  };

  const addRoom = async () => {
    const record: HouseRoomRecord = { id: newId('house-room'), roomName: `Habitación ${houseData.rooms.length + 1}`, capacity: 4, responsible: '', status: 'Activa', notes: '' };
    await persist({ ...houseData, rooms: [...houseData.rooms, record] }, 'Habitación creada.');
  };

  const updateRoom = async (room: HouseRoomRecord) => persist({ ...houseData, rooms: houseData.rooms.map((item) => item.id === room.id ? room : item) }, 'Habitación actualizada.');

  const addPermission = async () => {
    if (!selectedPlayerId) return showToast('Selecciona un jugador de Casa Hogar.', 'amber');
    const record: HouseExitPermissionRecord = { id: newId('house-permission'), playerId: selectedPlayerId, date, departureTime: '', returnTime: '', reason: '', authorizedBy: session.displayName || session.email || '', status: 'Pendiente', notes: '' };
    await persist({ ...houseData, permissions: [record, ...houseData.permissions] }, 'Permiso de salida creado.');
  };

  const updatePermission = async (record: HouseExitPermissionRecord) => persist({ ...houseData, permissions: houseData.permissions.map((item) => item.id === record.id ? record : item) }, 'Permiso actualizado.');

  const addAcademic = async () => {
    if (!selectedPlayerId) return showToast('Selecciona un jugador de Casa Hogar.', 'amber');
    const record = { id: newId('house-academic'), playerId: selectedPlayerId, month, year, academicAttendance: 3, academicPerformance: 3, pendingTasks: '', academicAlerts: '', tutorNotes: '', familyContact: '', status: 'Estable' as AcademicStatus };
    await persist({ ...houseData, academic: [record, ...houseData.academic] }, 'Seguimiento académico creado.');
  };

  const updateAcademic = async (record: HouseHomeData['academic'][number]) => persist({ ...houseData, academic: houseData.academic.map((item) => item.id === record.id ? record : item) }, 'Seguimiento académico actualizado.');

  const addNews = async () => {
    if (!selectedPlayerId) return showToast('Selecciona un jugador de Casa Hogar.', 'amber');
    const record: HouseDailyNewsRecord = { id: newId('house-news'), playerId: selectedPlayerId, date, type: 'Seguimiento especial', description: '', severity: 'Seguimiento', responsible: session.displayName || session.email || '', followUpRequired: true, status: 'Abierta' };
    await persist({ ...houseData, news: [record, ...houseData.news] }, 'Novedad creada.');
  };

  const updateNews = async (record: HouseDailyNewsRecord) => persist({ ...houseData, news: houseData.news.map((item) => item.id === record.id ? record : item) }, 'Novedad actualizada.');

  const selectedPlayer = data.players.find((item) => item.id === selectedPlayerId) ?? housePlayers[0];
  const selectedEvaluation = selectedPlayer ? houseData.evaluations.find((item) => item.playerId === selectedPlayer.id && item.month === month && item.year === year) ?? getDefaultEvaluation(selectedPlayer.id, month, year) : null;

  const renderDashboard = () => (
    <div className="grid grid-2">
      <div className="card house-command-card">
        <SectionHeader eyebrow="Casa Hogar" title="Semáforo institucional" subtitle="Cruce de alimentación, evaluación mensual, wellness, novedades y permisos." />
        <div className="house-player-signal-list">
          {housePlayers.map((player) => {
            const latestWellness = data.wellness.filter((item) => item.playerId === player.id).sort((a, b) => b.date.localeCompare(a.date))[0];
            const signal = buildPlayerHouseLight(houseData, player.id, date, month, year, latestWellness);
            const house = houseData.players.find((item) => item.playerId === player.id);
            return (
              <div key={player.id} className={`house-signal-row signal-${signal.light.toLowerCase()}`}>
                <div>
                  <strong>{player.name}</strong>
                  <span>{player.position} · {categoryLabel(player.category)} · {house?.room || 'Sin habitación'}</span>
                </div>
                <StatusBadge text={`${signal.label} · ${fmtScore(signal.score)}`} tone={trafficTone(signal.light)} />
              </div>
            );
          })}
          {!housePlayers.length ? <EmptyState title="Sin jugadores de Casa Hogar" text="Marca jugadores como pertenecientes a Casa Hogar para iniciar el seguimiento." /> : null}
        </div>
      </div>
      <div className="card">
        <SectionHeader eyebrow="Alertas" title="Prioridades del día" subtitle="Eventos que requieren seguimiento institucional." />
        <div className="house-alert-list">
          {alerts.map((alert) => (
            <div key={alert.id} className={`house-alert-item alert-${alert.level}`}>
              <AlertTriangle size={16} />
              <div>
                <strong>{alert.title}</strong>
                <span>{alert.detail}</span>
              </div>
            </div>
          ))}
          {!alerts.length ? <EmptyState icon="check" title="Sin alertas críticas" text="El módulo no detecta novedades abiertas para la fecha y mes seleccionado." /> : null}
        </div>
      </div>
    </div>
  );

  const renderPlayers = () => (
    <div className="card">
      <SectionHeader eyebrow="Roster Casa Hogar" title="Asignación de jugadores" subtitle="Define pertenencia, habitación, cama y estado institucional." />
      <div className="table-scroll">
        <table className="pro-table house-table">
          <thead><tr><th>Jugador</th><th>Categoría</th><th>Casa Hogar</th><th>Habitación</th><th>Cama</th><th>Estado</th><th>Observación</th></tr></thead>
          <tbody>
            {visiblePlayers.map((player) => {
              const house = houseData.players.find((item) => item.playerId === player.id);
              return (
                <tr key={player.id}>
                  <td><strong>{player.name}</strong><span className="muted-line">{player.position}</span></td>
                  <td>{categoryLabel(player.category)}</td>
                  <td><input type="checkbox" checked={Boolean(house?.belongsHouse)} onChange={(event) => void upsertHousePlayer(player, { belongsHouse: event.target.checked, status: house?.status ?? 'Activo' })} /></td>
                  <td><input className="input mini" value={house?.room ?? ''} onChange={(event) => void upsertHousePlayer(player, { room: event.target.value, belongsHouse: house?.belongsHouse ?? true })} placeholder="Hab. 1" /></td>
                  <td><input className="input mini" value={house?.bed ?? ''} onChange={(event) => void upsertHousePlayer(player, { bed: event.target.value, belongsHouse: house?.belongsHouse ?? true })} placeholder="Cama A" /></td>
                  <td><select className="select mini" value={house?.status ?? 'Activo'} onChange={(event) => void upsertHousePlayer(player, { status: event.target.value as HousePlayerStatus, belongsHouse: house?.belongsHouse ?? true })}>{['Activo', 'Traslado', 'Salida temporal', 'Egresado'].map((value) => <option key={value}>{value}</option>)}</select></td>
                  <td><input className="input" value={house?.notes ?? ''} onChange={(event) => void upsertHousePlayer(player, { notes: event.target.value, belongsHouse: house?.belongsHouse ?? true })} placeholder="Observación" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMeals = () => (
    <div className="card">
      <SectionHeader
        eyebrow="Alimentación diaria"
        title="Desayuno · almuerzo · cena"
        subtitle="Marca cumplimiento de comidas por jugador y registra observaciones del día."
        action={<div className="btn-row"><button className="btn secondary" onClick={() => void markAllMeal('breakfast')}>Todos desayuno</button><button className="btn secondary" onClick={() => void markAllMeal('lunch')}>Todos almuerzo</button><button className="btn secondary" onClick={() => void markAllMeal('dinner')}>Todos cena</button></div>}
      />
      <div className="table-scroll">
        <table className="pro-table house-table">
          <thead><tr><th>Jugador</th><th>Hab.</th><th>Desayuno</th><th>Almuerzo</th><th>Cena</th><th>Responsable</th><th>Observación</th></tr></thead>
          <tbody>
            {housePlayers.map((player) => {
              const house = houseData.players.find((item) => item.playerId === player.id);
              const meal = getMealRecord(houseData, player.id, date);
              return (
                <tr key={player.id}>
                  <td><strong>{player.name}</strong><span className="muted-line">{player.position}</span></td>
                  <td>{house?.room || '—'}</td>
                  <td><input type="checkbox" checked={meal.breakfast} onChange={(event) => void upsertMeal(player.id, { breakfast: event.target.checked })} /></td>
                  <td><input type="checkbox" checked={meal.lunch} onChange={(event) => void upsertMeal(player.id, { lunch: event.target.checked })} /></td>
                  <td><input type="checkbox" checked={meal.dinner} onChange={(event) => void upsertMeal(player.id, { dinner: event.target.checked })} /></td>
                  <td><input className="input mini" value={meal.responsible ?? ''} onChange={(event) => void upsertMeal(player.id, { responsible: event.target.value })} /></td>
                  <td><input className="input" value={meal.notes ?? ''} onChange={(event) => void upsertMeal(player.id, { notes: event.target.value })} placeholder="Novedad alimentaria" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!housePlayers.length ? <EmptyState title="Sin jugadores asignados" text="Primero marca jugadores como pertenecientes a Casa Hogar." /> : null}
    </div>
  );

  const renderEvaluation = () => selectedEvaluation && selectedPlayer ? (
    <div className="grid grid-2">
      <div className="card">
        <SectionHeader eyebrow="Evaluación mensual" title={selectedPlayer.name} subtitle="Calificación integral de 1 a 5 por dimensión." />
        <div className="grid form-grid">
          <label>Jugador<select className="select" value={selectedPlayer.id} onChange={(event) => setSelectedPlayerId(event.target.value)}>{housePlayers.map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}</select></label>
          {scoreFields.map(([key, label]) => (
            <label key={key}>{label}<input className="input" type="number" min="1" max="5" step="0.1" value={selectedEvaluation[key]} onChange={(event) => void upsertEvaluation({ ...selectedEvaluation, [key]: Number(event.target.value) })} /></label>
          ))}
          <label>Responsable<input className="input" value={selectedEvaluation.responsible ?? ''} onChange={(event) => void upsertEvaluation({ ...selectedEvaluation, responsible: event.target.value })} /></label>
        </div>
      </div>
      <div className="card">
        <SectionHeader eyebrow="Resultado" title={`Promedio ${fmtScore(selectedEvaluation.generalScore)}`} subtitle="Semáforo mensual y compromisos." action={<StatusBadge text={selectedEvaluation.trafficLight} tone={trafficTone(selectedEvaluation.trafficLight)} />} />
        <label>Observaciones<textarea className="textarea" value={selectedEvaluation.observations ?? ''} onChange={(event) => void upsertEvaluation({ ...selectedEvaluation, observations: event.target.value })} /></label>
        <label>Compromisos<textarea className="textarea" value={selectedEvaluation.commitments ?? ''} onChange={(event) => void upsertEvaluation({ ...selectedEvaluation, commitments: event.target.value })} /></label>
        <label>Recomendaciones<textarea className="textarea" value={selectedEvaluation.recommendations ?? ''} onChange={(event) => void upsertEvaluation({ ...selectedEvaluation, recommendations: event.target.value })} /></label>
      </div>
    </div>
  ) : <EmptyState title="Sin jugador seleccionado" text="Asigna jugadores a Casa Hogar para evaluar mensualmente." />;

  const renderRooms = () => (
    <div className="card">
      <SectionHeader eyebrow="Habitaciones" title="Ocupación y control interno" subtitle="Capacidad, responsable y asignación por habitación." action={<button className="btn" onClick={() => void addRoom()}><BedDouble size={16} /> Nueva habitación</button>} />
      <div className="grid grid-2">
        {roomsOccupancy.map(({ room, assigned }) => (
          <div key={room.id} className={`card room-card ${assigned > room.capacity ? 'room-over' : ''}`}>
            <div className="room-card-head"><input className="input" value={room.roomName} onChange={(event) => void updateRoom({ ...room, roomName: event.target.value })} /><StatusBadge text={`${assigned}/${room.capacity}`} tone={assigned > room.capacity ? 'red' : 'green'} /></div>
            <div className="grid form-grid"><label>Capacidad<input className="input" type="number" value={room.capacity} onChange={(event) => void updateRoom({ ...room, capacity: Number(event.target.value) })} /></label><label>Responsable<input className="input" value={room.responsible ?? ''} onChange={(event) => void updateRoom({ ...room, responsible: event.target.value })} /></label></div>
            <textarea className="textarea" value={room.notes ?? ''} onChange={(event) => void updateRoom({ ...room, notes: event.target.value })} placeholder="Observaciones de la habitación" />
          </div>
        ))}
      </div>
      {!houseData.rooms.length ? <EmptyState title="Sin habitaciones creadas" text="Crea habitaciones para controlar ocupación y sobreocupación." /> : null}
    </div>
  );

  const renderPermissions = () => (
    <div className="card">
      <SectionHeader eyebrow="Permisos" title="Control de salida y regreso" subtitle="Registra permisos, autorizaciones y regresos pendientes." action={<button className="btn" onClick={() => void addPermission()}><DoorOpen size={16} /> Nuevo permiso</button>} />
      <div className="table-scroll"><table className="pro-table house-table"><thead><tr><th>Jugador</th><th>Fecha</th><th>Salida</th><th>Regreso</th><th>Motivo</th><th>Autoriza</th><th>Estado</th><th>Notas</th></tr></thead><tbody>
        {houseData.permissions.map((record) => <tr key={record.id}>
          <td>{getPlayerName(data.players, record.playerId)}</td>
          <td><input className="input mini" type="date" value={record.date} onChange={(event) => void updatePermission({ ...record, date: event.target.value })} /></td>
          <td><input className="input mini" type="time" value={record.departureTime ?? ''} onChange={(event) => void updatePermission({ ...record, departureTime: event.target.value })} /></td>
          <td><input className="input mini" type="time" value={record.returnTime ?? ''} onChange={(event) => void updatePermission({ ...record, returnTime: event.target.value })} /></td>
          <td><input className="input" value={record.reason ?? ''} onChange={(event) => void updatePermission({ ...record, reason: event.target.value })} /></td>
          <td><input className="input" value={record.authorizedBy ?? ''} onChange={(event) => void updatePermission({ ...record, authorizedBy: event.target.value })} /></td>
          <td><select className="select mini" value={record.status} onChange={(event) => void updatePermission({ ...record, status: event.target.value as HousePermissionStatus })}>{['Pendiente', 'Autorizado', 'Rechazado', 'Cumplido', 'Vencido'].map((value) => <option key={value}>{value}</option>)}</select></td>
          <td><input className="input" value={record.notes ?? ''} onChange={(event) => void updatePermission({ ...record, notes: event.target.value })} /></td>
        </tr>)}
      </tbody></table></div>
    </div>
  );

  const renderAcademic = () => (
    <div className="card">
      <SectionHeader eyebrow="Formación" title="Seguimiento académico" subtitle="Asistencia, rendimiento escolar, compromisos y contacto familiar." action={<button className="btn" onClick={() => void addAcademic()}><BookOpen size={16} /> Nuevo seguimiento</button>} />
      <div className="table-scroll"><table className="pro-table house-table"><thead><tr><th>Jugador</th><th>Mes</th><th>Asistencia</th><th>Rendimiento</th><th>Estado</th><th>Pendientes</th><th>Observación tutor</th><th>Familia</th></tr></thead><tbody>
        {houseData.academic.map((record) => <tr key={record.id}>
          <td>{getPlayerName(data.players, record.playerId)}</td>
          <td>{record.month}/{record.year}</td>
          <td><input className="input mini" type="number" min="1" max="5" value={record.academicAttendance ?? 3} onChange={(event) => void updateAcademic({ ...record, academicAttendance: Number(event.target.value) })} /></td>
          <td><input className="input mini" type="number" min="1" max="5" value={record.academicPerformance ?? 3} onChange={(event) => void updateAcademic({ ...record, academicPerformance: Number(event.target.value) })} /></td>
          <td><select className="select mini" value={record.status} onChange={(event) => void updateAcademic({ ...record, status: event.target.value as AcademicStatus })}>{['Estable', 'Seguimiento', 'Alerta'].map((value) => <option key={value}>{value}</option>)}</select></td>
          <td><input className="input" value={record.pendingTasks ?? ''} onChange={(event) => void updateAcademic({ ...record, pendingTasks: event.target.value })} /></td>
          <td><input className="input" value={record.tutorNotes ?? ''} onChange={(event) => void updateAcademic({ ...record, tutorNotes: event.target.value })} /></td>
          <td><input className="input" value={record.familyContact ?? ''} onChange={(event) => void updateAcademic({ ...record, familyContact: event.target.value })} /></td>
        </tr>)}
      </tbody></table></div>
    </div>
  );

  const renderNews = () => (
    <div className="card">
      <SectionHeader eyebrow="Novedades" title="Registro diario positivo o de seguimiento" subtitle="Convivencia, salud, disciplina, permisos, felicitaciones y casos especiales." action={<button className="btn" onClick={() => void addNews()}><ClipboardList size={16} /> Nueva novedad</button>} />
      <div className="house-news-grid">
        {houseData.news.map((record) => <div className={`card house-news-item news-${record.severity.toLowerCase()}`} key={record.id}>
          <div className="btn-row between"><strong>{getPlayerName(data.players, record.playerId)}</strong><StatusBadge text={record.severity} tone={alertTone(record.severity)} /></div>
          <div className="grid form-grid"><label>Tipo<input className="input" value={record.type} onChange={(event) => void updateNews({ ...record, type: event.target.value })} /></label><label>Estado<select className="select" value={record.status} onChange={(event) => void updateNews({ ...record, status: event.target.value as HouseNewsStatus })}>{['Abierta', 'En seguimiento', 'Cerrada'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Nivel<select className="select" value={record.severity} onChange={(event) => void updateNews({ ...record, severity: event.target.value as HouseNewsSeverity })}>{['Informativa', 'Seguimiento', 'Alerta', 'Crítica'].map((value) => <option key={value}>{value}</option>)}</select></label></div>
          <textarea className="textarea" value={record.description} onChange={(event) => void updateNews({ ...record, description: event.target.value })} placeholder="Descripción de la novedad" />
        </div>)}
      </div>
    </div>
  );

  const renderReport = () => (
    <div className="card house-report-print" id="house-report">
      <SectionHeader eyebrow="Informe ejecutivo" title="Casa Hogar · Reporte mensual" subtitle="Documento institucional para coordinación y dirección." action={<button className="btn" onClick={() => window.print()}><Download size={16} /> Exportar PDF</button>} />
      <div className="house-report-cover">
        <span>Orsomarso Performance</span>
        <h2>Informe Casa Hogar</h2>
        <p>{selectedCategory === 'all' ? 'Todas las categorías' : categoryLabel(selectedCategory)} · {month}/{year}</p>
      </div>
      <div className="grid grid-4 report-kpis">
        <KpiCard label="Jugadores" value={String(dashboard.totalHouse)} trend="Casa Hogar" />
        <KpiCard label="Promedio" value={fmtScore(dashboard.avgScore)} trend="Evaluación mensual" tone={dashboard.avgScore >= 4 ? 'green' : dashboard.avgScore >= 3 ? 'amber' : 'red'} />
        <KpiCard label="Alertas" value={String(alerts.length)} trend="Institucionales" tone={alerts.some((alert) => alert.level === 'critical') ? 'red' : alerts.length ? 'amber' : 'green'} />
        <KpiCard label="Habitaciones" value={String(dashboard.roomsOccupied)} trend="Ocupadas" />
      </div>
      <div className="grid grid-2">
        <div><h3>Jugadores en alerta</h3>{alerts.slice(0, 8).map((alert) => <p key={alert.id}><strong>{alert.title}:</strong> {alert.detail}</p>)}</div>
        <div><h3>Recomendaciones institucionales</h3><p>Priorizar seguimiento de alimentación incompleta, evaluaciones menores a 3.0, habitaciones sin asignar y novedades abiertas.</p><p>Integrar la lectura con wellness, carga de entrenamiento y disponibilidad médica.</p></div>
      </div>
      <h3>Evaluación mensual</h3>
      <div className="table-scroll"><table className="pro-table"><thead><tr><th>Jugador</th><th>Hab.</th><th>Conv.</th><th>Resp.</th><th>Hábitos</th><th>Deportivo</th><th>Formación</th><th>Emocional</th><th>Prom.</th><th>Estado</th></tr></thead><tbody>
        {housePlayers.map((player) => {
          const house = houseData.players.find((item) => item.playerId === player.id);
          const evaluation = houseData.evaluations.find((item) => item.playerId === player.id && item.month === month && item.year === year);
          return <tr key={player.id}><td>{player.name}</td><td>{house?.room || '—'}</td><td>{fmtScore(evaluation?.convivenciaScore)}</td><td>{fmtScore(evaluation?.responsabilidadScore)}</td><td>{fmtScore(evaluation?.alimentacionHabitosScore)}</td><td>{fmtScore(evaluation?.compromisoDeportivoScore)}</td><td>{fmtScore(evaluation?.formacionIntegralScore)}</td><td>{fmtScore(evaluation?.bienestarEmocionalScore)}</td><td>{fmtScore(evaluation?.generalScore)}</td><td>{evaluation?.trafficLight ?? 'Pendiente'}</td></tr>;
        })}
      </tbody></table></div>
    </div>
  );

  return (
    <div className="grid casa-hogar-page">
      <AppHero
        heroClass="hero-casa-hogar"
        title="Casa Hogar"
        subtitle="Control institucional de convivencia, alimentación, habitaciones, formación, permisos y bienestar integral."
      />
      <GlobalFiltersBar />

      <div className="toolbar card house-toolbar">
        <div className="grid form-grid house-toolbar-fields">
          <label>Categoría<select className="select" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value as ClubCategory | 'all')}>{categories.map((cat) => <option key={cat} value={cat}>{cat === 'all' ? 'Todas' : categoryLabel(cat)}</option>)}</select></label>
          <label>Fecha<input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label>Mes<input className="input" type="number" min="1" max="12" value={month} onChange={(event) => setMonth(Number(event.target.value))} /></label>
          <label>Año<input className="input" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label>
        </div>
        <button className="btn" disabled={saving} onClick={() => void persist(houseData)}><Save size={16} /> {saving ? 'Guardando…' : 'Guardar todo'}</button>
      </div>

      <div className="grid grid-4">
        <KpiCard label="Casa Hogar" value={String(dashboard.totalHouse)} tone="blue" trend="Jugadores activos" icon={<Home size={18} />} />
        <KpiCard label="Alimentación incompleta" value={String(dashboard.incompleteMeals)} tone={dashboard.incompleteMeals ? 'amber' : 'green'} trend={date} icon={<Utensils size={18} />} />
        <KpiCard label="Promedio mensual" value={fmtScore(dashboard.avgScore)} tone={dashboard.avgScore >= 4 ? 'green' : dashboard.avgScore >= 3 ? 'amber' : 'red'} trend={`${dashboard.evaluations} evaluaciones`} icon={<ShieldCheck size={18} />} />
        <KpiCard label="Alertas" value={String(alerts.length)} tone={alerts.some((alert) => alert.level === 'critical') ? 'red' : alerts.length ? 'amber' : 'green'} trend="Prioridad institucional" icon={<AlertTriangle size={18} />} />
      </div>

      {message ? <div className="house-message"><CheckCircle2 size={16} /> {message}</div> : null}
      {loading ? <div className="card empty">Cargando Casa Hogar…</div> : null}

      <div className="house-tabs">
        {tabs.map((tab) => <button key={tab} type="button" className={`house-tab ${selectedTab === tab ? 'active' : ''}`} onClick={() => setSelectedTab(tab)}>{tab}</button>)}
      </div>

      {selectedTab === 'Dashboard' ? renderDashboard() : null}
      {selectedTab === 'Jugadores' ? renderPlayers() : null}
      {selectedTab === 'Alimentación' ? renderMeals() : null}
      {selectedTab === 'Evaluación mensual' ? renderEvaluation() : null}
      {selectedTab === 'Habitaciones' ? renderRooms() : null}
      {selectedTab === 'Permisos' ? renderPermissions() : null}
      {selectedTab === 'Académico' ? renderAcademic() : null}
      {selectedTab === 'Novedades' ? renderNews() : null}
      {selectedTab === 'Informe' ? renderReport() : null}
    </div>
  );
}
