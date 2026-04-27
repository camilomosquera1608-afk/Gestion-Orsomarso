'use client';

import { useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { ToneBadge } from '@/components/status-badge';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import { ClubCategory } from '@/lib/types';
import { useApp } from '@/context/app-context';
import { downloadCsv } from '@/lib/export';
import { NutritionPlan } from '@/lib/types';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const tabs = ['Nutrición', 'Perfil neuromuscular', 'CMJ', 'FMS'] as const;
const plans: NutritionPlan[] = ['Normocalorico', 'Hipercalorico', 'Hipocalorico'];

type TabName = (typeof tabs)[number];

const compareTone = (delta: number, reverse = false): 'green' | 'yellow' | 'red' => {
  if (delta === 0) return 'yellow';
  const improved = reverse ? delta < 0 : delta > 0;
  return improved ? 'green' : 'red';
};

export default function ValoracionesPage() {
  const {
    data,
    filters,
    setFilters,
    addNutritionRecord,
    updateNutritionRecord,
    deleteNutritionRecord,
    addNeuromuscularRecord,
    updateNeuromuscularRecord,
    deleteNeuromuscularRecord,
    addCMJRecord,
    updateCMJRecord,
    deleteCMJRecord,
    addFMSRecord,
    updateFMSRecord,
    deleteFMSRecord,
  } = useApp();

  const session = getStaffSession();
  const master = isMasterRole(session);
  const activeCategory = (master ? (filters.category === 'all' ? 'Sub20' : filters.category) : session.category) as ClubCategory;

  const [activeTab, setActiveTab] = useState<TabName>('Nutrición');
  const [message, setMessage] = useState('');
  const [editingNutritionId, setEditingNutritionId] = useState('');
  const [editingNeuroId, setEditingNeuroId] = useState('');
  const [editingCmjId, setEditingCmjId] = useState('');
  const [editingFmsId, setEditingFmsId] = useState('');

  const categoryPlayers = data.players.filter((player) => player.category === activeCategory);
  const selectedPlayerId = filters.playerId === 'all' || !categoryPlayers.some((player) => player.id === filters.playerId) ? categoryPlayers[0]?.id ?? '' : filters.playerId;
  const selectedPlayer = data.players.find((player) => player.id === selectedPlayerId) ?? categoryPlayers[0];
  if (!selectedPlayer) return <div className="empty">No hay jugadores disponibles en esta categoría.</div>;

  const nutritionHistory = useMemo(() => data.nutritionRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => b.date.localeCompare(a.date)), [data.nutritionRecords, selectedPlayerId]);
  const neuromuscularHistory = useMemo(() => data.neuromuscularRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => b.date.localeCompare(a.date)), [data.neuromuscularRecords, selectedPlayerId]);
  const cmjHistory = useMemo(() => data.cmjRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => b.date.localeCompare(a.date)), [data.cmjRecords, selectedPlayerId]);
  const fmsHistory = useMemo(() => data.fmsRecords.filter((record) => record.playerId === selectedPlayerId).sort((a, b) => b.date.localeCompare(a.date)).map((record) => ({ ...record, total: record.shoulderMobility + record.squat + record.legRaise + record.hurdleStep + record.lunge + record.trunkStability + record.rotaryStability })), [data.fmsRecords, selectedPlayerId]);

  const latestNutrition = nutritionHistory[0];
  const previousNutrition = nutritionHistory[1];
  const latestNeuro = neuromuscularHistory[0];
  const previousNeuro = neuromuscularHistory[1];
  const latestCmj = cmjHistory[0];
  const previousCmj = cmjHistory[1];
  const latestFms = fmsHistory[0];
  const previousFms = fmsHistory[1];

  const editingNutrition = nutritionHistory.find((item) => item.id === editingNutritionId);
  const editingNeuro = neuromuscularHistory.find((item) => item.id === editingNeuroId);
  const editingCmj = cmjHistory.find((item) => item.id === editingCmjId);
  const editingFms = fmsHistory.find((item) => item.id === editingFmsId);

  const clearEditors = () => {
    setEditingNutritionId('');
    setEditingNeuroId('');
    setEditingCmjId('');
    setEditingFmsId('');
  };

  const submitNutrition = (formData: FormData) => {
    const record = {
      id: editingNutritionId || crypto.randomUUID(),
      playerId: selectedPlayerId,
      date: String(formData.get('date')),
      weight: Number(formData.get('weight')),
      height: Number(formData.get('height')),
      bodyFat: Number(formData.get('bodyFat')),
      skinfoldSum: Number(formData.get('skinfoldSum')),
      plan: String(formData.get('plan')) as NutritionPlan,
    };
    if (editingNutritionId) {
      updateNutritionRecord(record);
      setMessage('Valoración de nutrición actualizada.');
    } else {
      addNutritionRecord(record);
      setMessage('Valoración de nutrición guardada.');
    }
    setEditingNutritionId('');
  };

  const submitNeuromuscular = (formData: FormData) => {
    const neuroRecord = {
      id: editingNeuroId || crypto.randomUUID(),
      playerId: selectedPlayerId,
      date: String(formData.get('date')),
      cmj: Number(formData.get('cmj')),
      sj: Number(formData.get('sj')),
      reactiveJumps: Number(formData.get('reactiveJumps')),
    };
    const cmjRecord = {
      id: editingCmjId || crypto.randomUUID(),
      playerId: selectedPlayerId,
      date: neuroRecord.date,
      value: neuroRecord.cmj,
    };

    if (editingNeuroId) {
      updateNeuromuscularRecord(neuroRecord);
      if (editingCmjId) updateCMJRecord(cmjRecord);
      setMessage('Perfil neuromuscular actualizado.');
    } else {
      addNeuromuscularRecord(neuroRecord);
      addCMJRecord(cmjRecord);
      setMessage('Perfil neuromuscular guardado.');
    }
    setEditingNeuroId('');
    setEditingCmjId('');
  };

  const submitFMS = (formData: FormData) => {
    const record = {
      id: editingFmsId || crypto.randomUUID(),
      playerId: selectedPlayerId,
      date: String(formData.get('date')),
      shoulderMobility: Number(formData.get('shoulderMobility')),
      squat: Number(formData.get('squat')),
      legRaise: Number(formData.get('legRaise')),
      hurdleStep: Number(formData.get('hurdleStep')),
      lunge: Number(formData.get('lunge')),
      trunkStability: Number(formData.get('trunkStability')),
      rotaryStability: Number(formData.get('rotaryStability')),
    };
    if (editingFmsId) {
      updateFMSRecord(record);
      setMessage('Valoración FMS actualizada.');
    } else {
      addFMSRecord(record);
      setMessage('Valoración FMS guardada.');
    }
    setEditingFmsId('');
  };

  const improvementNotes = activeTab === 'Nutrición' && latestNutrition && previousNutrition ? [
    `Peso ${(latestNutrition.weight - previousNutrition.weight).toFixed(1)} kg`,
    `% grasa ${(latestNutrition.bodyFat - previousNutrition.bodyFat).toFixed(1)}`,
    `Σ pliegues ${(latestNutrition.skinfoldSum - previousNutrition.skinfoldSum).toFixed(1)}`,
  ] : activeTab === 'Perfil neuromuscular' && latestNeuro && previousNeuro ? [
    `CMJ ${(latestNeuro.cmj - previousNeuro.cmj).toFixed(1)} cm`,
    `SJ ${(latestNeuro.sj - previousNeuro.sj).toFixed(1)} cm`,
    `Reactivos ${(latestNeuro.reactiveJumps - previousNeuro.reactiveJumps).toFixed(1)}`,
  ] : activeTab === 'CMJ' && latestCmj && previousCmj ? [
    `CMJ ${(latestCmj.value - previousCmj.value).toFixed(1)} cm`,
  ] : activeTab === 'FMS' && latestFms && previousFms ? [
    `Total FMS ${(latestFms.total - previousFms.total).toFixed(0)} puntos`,
    'Revisar pruebas con puntaje 1.',
  ] : ['Carga nuevos registros para activar comparación automática.'];

  return (
    <div className="grid">
      <AppHero title="Valoraciones" />
      <GlobalFiltersBar />
      <div className="card">
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'end' }}>
          <div className="field" style={{ maxWidth: 360 }}>
            <label>Jugador seleccionado</label>
            <select className="select" value={selectedPlayerId} onChange={(e) => setFilters({ playerId: e.target.value })}>
              {categoryPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </div>
          <button className="btn secondary" onClick={clearEditors}>Limpiar edición</button>
        </div>
        {selectedPlayer ? <div style={{ marginTop: 14, fontWeight: 700 }}>{selectedPlayer.name}</div> : null}
      </div>
      {message ? <div className="card"><strong>{message}</strong></div> : null}

      <div className="card">
        <div className="tabs">
          {tabs.map((tab) => <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}
        </div>

        <div className="grid grid-3" style={{ marginBottom: 18 }}>
          <div className="card compact-card">
            <h3 style={{ marginBottom: 10 }}>Actual vs anterior</h3>
            {activeTab === 'Nutrición' && latestNutrition ? <>
              <div className="muted-line">Peso {latestNutrition.weight} kg</div>
              {previousNutrition ? <ToneBadge text={`Δ ${(latestNutrition.weight - previousNutrition.weight).toFixed(1)} kg`} tone={compareTone(latestNutrition.weight - previousNutrition.weight)} /> : null}
              <div className="muted-line" style={{ marginTop: 10 }}>% grasa {latestNutrition.bodyFat}</div>
              {previousNutrition ? <ToneBadge text={`Δ ${(latestNutrition.bodyFat - previousNutrition.bodyFat).toFixed(1)} %`} tone={compareTone(latestNutrition.bodyFat - previousNutrition.bodyFat, true)} /> : null}
            </> : null}
            {activeTab === 'Perfil neuromuscular' && latestNeuro ? <>
              <div className="muted-line">CMJ {latestNeuro.cmj} · SJ {latestNeuro.sj}</div>
              {previousNeuro ? <ToneBadge text={`Δ CMJ ${(latestNeuro.cmj - previousNeuro.cmj).toFixed(1)}`} tone={compareTone(latestNeuro.cmj - previousNeuro.cmj)} /> : null}
            </> : null}
            {activeTab === 'CMJ' && latestCmj ? <>
              <div className="muted-line">CMJ actual {latestCmj.value} cm</div>
              {previousCmj ? <ToneBadge text={`Δ ${(latestCmj.value - previousCmj.value).toFixed(1)} cm`} tone={compareTone(latestCmj.value - previousCmj.value)} /> : null}
            </> : null}
            {activeTab === 'FMS' && latestFms ? <>
              <div className="muted-line">Total actual {latestFms.total}</div>
              {previousFms ? <ToneBadge text={`Δ ${(latestFms.total - previousFms.total).toFixed(0)} puntos`} tone={compareTone(latestFms.total - previousFms.total)} /> : null}
            </> : null}
          </div>
          <div className="card compact-card" style={{ gridColumn: 'span 2' }}>
            <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Punto de mejora sugerido</h3>
              {activeTab === 'Nutrición' ? <button className="btn secondary" onClick={() => downloadCsv(`nutricion-${selectedPlayerId}.csv`, nutritionHistory.map((r) => ({ fecha: r.date, peso: r.weight, estatura: r.height, grasa: r.bodyFat, sumatoria_pliegues: r.skinfoldSum, plan: r.plan })))}>Exportar CSV</button> : null}
              {activeTab === 'Perfil neuromuscular' ? <button className="btn secondary" onClick={() => downloadCsv(`neuromuscular-${selectedPlayerId}.csv`, neuromuscularHistory.map((r) => ({ fecha: r.date, cmj: r.cmj, sj: r.sj, reactivos: r.reactiveJumps })))}>Exportar CSV</button> : null}
              {activeTab === 'CMJ' ? <button className="btn secondary" onClick={() => downloadCsv(`cmj-${selectedPlayerId}.csv`, cmjHistory.map((r) => ({ fecha: r.date, cmj: r.value })))}>Exportar CSV</button> : null}
              {activeTab === 'FMS' ? <button className="btn secondary" onClick={() => downloadCsv(`fms-${selectedPlayerId}.csv`, fmsHistory.map((r) => ({ fecha: r.date, movilidad_hombros: r.shoulderMobility, sentadilla: r.squat, elevacion_pierna: r.legRaise, paso_obstaculo: r.hurdleStep, zancada: r.lunge, estabilidad_tronco: r.trunkStability, estabilidad_rotacion: r.rotaryStability, total: r.total })))}>Exportar CSV</button> : null}
            </div>
            <div className="grid" style={{ gap: 10 }}>{improvementNotes.map((note) => <div key={note} className="alert-item tone-yellow">{note}</div>)}</div>
          </div>
        </div>

        {activeTab === 'Nutrición' && (
          <div className="grid grid-2">
            <form className="card grid" action={submitNutrition}>
              <h3>{editingNutrition ? 'Editar nutrición' : 'Cargar nutrición'}</h3>
              <input className="input" type="date" name="date" defaultValue={editingNutrition?.date ?? filters.date} key={`nutrition-${editingNutritionId || 'new'}`} required />
              <div className="grid grid-2">
                <input className="input" type="number" step="0.1" name="weight" placeholder="Peso" defaultValue={editingNutrition?.weight ?? selectedPlayer?.weight} key={`nutrition-weight-${editingNutritionId || 'new'}`} required />
                <input className="input" type="number" step="0.1" name="height" placeholder="Estatura" defaultValue={editingNutrition?.height ?? selectedPlayer?.height} key={`nutrition-height-${editingNutritionId || 'new'}`} required />
              </div>
              <div className="grid grid-2">
                <input className="input" type="number" step="0.1" name="bodyFat" placeholder="% de grasa" defaultValue={editingNutrition?.bodyFat ?? ''} key={`nutrition-fat-${editingNutritionId || 'new'}`} required />
                <input className="input" type="number" step="0.1" name="skinfoldSum" placeholder="Sumatoria de pliegues" defaultValue={editingNutrition?.skinfoldSum ?? ''} key={`nutrition-skin-${editingNutritionId || 'new'}`} required />
              </div>
              <select className="select" name="plan" defaultValue={editingNutrition?.plan ?? 'Normocalorico'} key={`nutrition-plan-${editingNutritionId || 'new'}`}>{plans.map((plan) => <option key={plan}>{plan}</option>)}</select>
              <button className="btn" type="submit">{editingNutrition ? 'Actualizar nutrición' : 'Guardar nutrición'}</button>
            </form>
            <div className="card">
              <h3>Comparación histórica</h3>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={[...nutritionHistory].reverse().map((row) => ({ fecha: row.date.slice(5), peso: row.weight, grasa: row.bodyFat, pliegues: row.skinfoldSum }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="peso" stroke="#1d4ed8" strokeWidth={3} />
                    <Line type="monotone" dataKey="grasa" stroke="#93c5fd" strokeWidth={3} />
                    <Line type="monotone" dataKey="pliegues" stroke="#f59e0b" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card table-wrap" style={{ gridColumn: '1 / -1' }}>
              <h3>Todas las valoraciones de nutrición</h3>
              <table><thead><tr><th>Fecha</th><th>Peso</th><th>Estatura</th><th>% grasa</th><th>Σ pliegues</th><th>Plan</th><th>Acciones</th></tr></thead><tbody>{nutritionHistory.map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.weight}</td><td>{row.height}</td><td>{row.bodyFat}</td><td>{row.skinfoldSum}</td><td>{row.plan}</td><td><div className="btn-row"><button type="button" className="btn secondary" onClick={() => setEditingNutritionId(row.id)}>Editar</button><button type="button" className="btn danger" onClick={() => deleteNutritionRecord(row.id)}>Eliminar</button></div></td></tr>)}</tbody></table>
            </div>
          </div>
        )}

        {activeTab === 'Perfil neuromuscular' && (
          <div className="grid grid-2">
            <form className="card grid" action={submitNeuromuscular}>
              <h3>{editingNeuro ? 'Editar perfil neuromuscular' : 'Cargar perfil neuromuscular'}</h3>
              <input className="input" type="date" name="date" defaultValue={editingNeuro?.date ?? filters.date} key={`neuro-date-${editingNeuroId || 'new'}`} required />
              <div className="grid grid-3">
                <input className="input" type="number" step="0.1" name="cmj" placeholder="Salto CMJ" defaultValue={editingNeuro?.cmj ?? ''} key={`neuro-cmj-${editingNeuroId || 'new'}`} required />
                <input className="input" type="number" step="0.1" name="sj" placeholder="Salto SJ" defaultValue={editingNeuro?.sj ?? ''} key={`neuro-sj-${editingNeuroId || 'new'}`} required />
                <input className="input" type="number" step="0.1" name="reactiveJumps" placeholder="Saltos reactivos" defaultValue={editingNeuro?.reactiveJumps ?? ''} key={`neuro-rj-${editingNeuroId || 'new'}`} required />
              </div>
              <button className="btn" type="submit">{editingNeuro ? 'Actualizar perfil' : 'Guardar perfil'}</button>
            </form>
            <div className="card">
              <h3>Comparación histórica</h3>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={[...neuromuscularHistory].reverse().map((row) => ({ fecha: row.date.slice(5), cmj: row.cmj, sj: row.sj, reactivos: row.reactiveJumps }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="cmj" stroke="#1d4ed8" strokeWidth={3} />
                    <Line type="monotone" dataKey="sj" stroke="#60a5fa" strokeWidth={3} />
                    <Line type="monotone" dataKey="reactivos" stroke="#93c5fd" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card table-wrap" style={{ gridColumn: '1 / -1' }}>
              <h3>Todas las valoraciones neuromusculares</h3>
              <table><thead><tr><th>Fecha</th><th>CMJ</th><th>SJ</th><th>Reactivos</th><th>Acciones</th></tr></thead><tbody>{neuromuscularHistory.map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.cmj}</td><td>{row.sj}</td><td>{row.reactiveJumps}</td><td><div className="btn-row"><button type="button" className="btn secondary" onClick={() => { setEditingNeuroId(row.id); const paired = cmjHistory.find((cmj) => cmj.date === row.date); setEditingCmjId(paired?.id ?? ''); }}>Editar</button><button type="button" className="btn danger" onClick={() => { deleteNeuromuscularRecord(row.id); const paired = cmjHistory.find((cmj) => cmj.date === row.date); if (paired) deleteCMJRecord(paired.id); }}>Eliminar</button></div></td></tr>)}</tbody></table>
            </div>
          </div>
        )}

        {activeTab === 'CMJ' && (
          <div className="grid grid-2">
            <div className="card">
              <h3>Evolución histórica de CMJ</h3>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={[...cmjHistory].reverse().map((row) => ({ fecha: row.date.slice(5), cmj: row.value }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="cmj" stroke="#1d4ed8" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card table-wrap">
              <h3>Historial CMJ</h3>
              <table><thead><tr><th>Fecha</th><th>CMJ</th><th>Acciones</th></tr></thead><tbody>{cmjHistory.map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.value}</td><td><div className="btn-row"><button type="button" className="btn secondary" onClick={() => setEditingCmjId(row.id)}>Seleccionar</button><button type="button" className="btn danger" onClick={() => deleteCMJRecord(row.id)}>Eliminar</button></div></td></tr>)}</tbody></table>
              {editingCmj ? <div style={{ marginTop: 16 }} className="grid"><strong>Editar CMJ rápido</strong><button type="button" className="btn secondary" onClick={() => { const next = window.prompt('Nuevo valor CMJ', String(editingCmj.value)); if (next) { updateCMJRecord({ ...editingCmj, value: Number(next) }); setMessage('CMJ actualizado.'); setEditingCmjId(''); } }}>Editar valor seleccionado</button></div> : null}
            </div>
          </div>
        )}

        {activeTab === 'FMS' && (
          <div className="grid grid-2">
            <form className="card grid" action={submitFMS}>
              <h3>{editingFms ? 'Editar FMS' : 'Cargar FMS'}</h3>
              <input className="input" type="date" name="date" defaultValue={editingFms?.date ?? filters.date} key={`fms-date-${editingFmsId || 'new'}`} required />
              <div className="grid grid-3">
                <input className="input" type="number" min="1" max="3" name="shoulderMobility" placeholder="Movilidad hombros" defaultValue={editingFms?.shoulderMobility ?? ''} key={`fms-1-${editingFmsId || 'new'}`} required />
                <input className="input" type="number" min="1" max="3" name="squat" placeholder="Sentadilla" defaultValue={editingFms?.squat ?? ''} key={`fms-2-${editingFmsId || 'new'}`} required />
                <input className="input" type="number" min="1" max="3" name="legRaise" placeholder="Elevación de pierna" defaultValue={editingFms?.legRaise ?? ''} key={`fms-3-${editingFmsId || 'new'}`} required />
                <input className="input" type="number" min="1" max="3" name="hurdleStep" placeholder="Paso obstáculo" defaultValue={editingFms?.hurdleStep ?? ''} key={`fms-4-${editingFmsId || 'new'}`} required />
                <input className="input" type="number" min="1" max="3" name="lunge" placeholder="Zancada" defaultValue={editingFms?.lunge ?? ''} key={`fms-5-${editingFmsId || 'new'}`} required />
                <input className="input" type="number" min="1" max="3" name="trunkStability" placeholder="Estabilidad de tronco" defaultValue={editingFms?.trunkStability ?? ''} key={`fms-6-${editingFmsId || 'new'}`} required />
                <input className="input" type="number" min="1" max="3" name="rotaryStability" placeholder="Estabilidad con rotación" defaultValue={editingFms?.rotaryStability ?? ''} key={`fms-7-${editingFmsId || 'new'}`} required />
              </div>
              <button className="btn" type="submit">{editingFms ? 'Actualizar FMS' : 'Guardar FMS'}</button>
            </form>
            <div className="card">
              <h3>Evolución FMS</h3>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={[...fmsHistory].reverse().map((row) => ({ fecha: row.date.slice(5), total: row.total }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke="#1d4ed8" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card table-wrap" style={{ gridColumn: '1 / -1' }}>
              <h3>Todas las valoraciones FMS</h3>
              <table><thead><tr><th>Fecha</th><th>Total</th><th>Hombros</th><th>Sentadilla</th><th>Pierna</th><th>Obstáculo</th><th>Zancada</th><th>Tronco</th><th>Rotación</th><th>Acciones</th></tr></thead><tbody>{fmsHistory.map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.total}</td><td>{row.shoulderMobility}</td><td>{row.squat}</td><td>{row.legRaise}</td><td>{row.hurdleStep}</td><td>{row.lunge}</td><td>{row.trunkStability}</td><td>{row.rotaryStability}</td><td><div className="btn-row"><button type="button" className="btn secondary" onClick={() => setEditingFmsId(row.id)}>Editar</button><button type="button" className="btn danger" onClick={() => deleteFMSRecord(row.id)}>Eliminar</button></div></td></tr>)}</tbody></table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
