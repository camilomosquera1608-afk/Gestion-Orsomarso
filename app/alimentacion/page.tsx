'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Save, Utensils } from 'lucide-react';
import { AppHero } from '@/components/app-hero';
import { GlobalFiltersBar } from '@/components/global-filters';
import { KpiCard } from '@/components/kpi-card';
import { EmptyState, SectionHeader, StatusBadge, showToast } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel } from '@/lib/labels';
import type { ClubCategory, Player } from '@/lib/types';
import {
  emptyHouseHomeData,
  fetchHouseHomeData,
  getTodayInputDate,
  mealCompletion,
  newId,
  saveHouseHomeData,
  type HouseDailyMealRecord,
  type HouseHomeData,
} from '@/lib/casa-hogar';

const categories: Array<ClubCategory | 'all'> = ['all', 'Sub20', 'Sub17', 'Sub15'];
const fmtPct = (value: number) => `${Math.round(value)}%`;
const getPlayerName = (players: Player[], playerId?: string) => players.find((item) => item.id === playerId)?.name ?? 'Jugador';

const getMealRecord = (payload: HouseHomeData, playerId: string, date: string): HouseDailyMealRecord =>
  payload.meals.find((item) => item.playerId === playerId && item.date === date) ?? {
    id: newId('meal'),
    playerId,
    date,
    breakfast: false,
    lunch: false,
    dinner: false,
    notes: '',
    responsible: '',
  };

const mealDecision = (meal?: HouseDailyMealRecord) => {
  const completed = mealCompletion(meal);
  if (completed === 3) return { label: 'Completa', tone: 'green' as const, decision: 'Sin restricción por alimentación.', detail: 'Mantener carga planificada si wellness, dolor y RPE están normales.' };
  if (completed === 2) return { label: 'Seguimiento', tone: 'amber' as const, decision: 'Monitorear energía.', detail: 'No bajar carga solo por una comida pendiente, pero observar RPE y respuesta durante la sesión.' };
  if (completed === 1) return { label: 'Alerta', tone: 'amber' as const, decision: 'Control preventivo.', detail: 'Evitar picos innecesarios si reporta baja energía, mareo o RPE alto.' };
  return { label: 'Crítica', tone: 'red' as const, decision: 'Revisar antes de campo.', detail: 'Alimentación no registrada o incompleta. Confirmar estado real antes de exponerlo a alta intensidad.' };
};

export default function AlimentacionPage() {
  const { data, filters } = useApp();
  const session = getStaffSession();
  const activeCategory = isMasterRole(session) ? filters.category : session.category;
  const [nutritionData, setNutritionData] = useState<HouseHomeData>(emptyHouseHomeData());
  const [selectedCategory, setSelectedCategory] = useState<ClubCategory | 'all'>((activeCategory === 'all' ? 'all' : activeCategory) as ClubCategory | 'all');
  const [date, setDate] = useState(filters.date || getTodayInputDate());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    void fetchHouseHomeData().then((payload) => {
      if (!mounted) return;
      setNutritionData(payload);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const visiblePlayers = useMemo(() => data.players.filter((player) => selectedCategory === 'all' || player.category === selectedCategory), [data.players, selectedCategory]);
  const todayMeals = useMemo(() => visiblePlayers.map((player) => ({ player, meal: getMealRecord(nutritionData, player.id, date), decision: mealDecision(getMealRecord(nutritionData, player.id, date)) })), [visiblePlayers, nutritionData, date]);
  const breakfast = todayMeals.filter((item) => item.meal.breakfast).length;
  const lunch = todayMeals.filter((item) => item.meal.lunch).length;
  const dinner = todayMeals.filter((item) => item.meal.dinner).length;
  const incomplete = todayMeals.filter((item) => mealCompletion(item.meal) < 3).length;
  const critical = todayMeals.filter((item) => mealCompletion(item.meal) <= 1).length;
  const completionPct = visiblePlayers.length ? ((breakfast + lunch + dinner) / (visiblePlayers.length * 3)) * 100 : 0;

  const persist = async (next: HouseHomeData, success = 'Alimentación guardada correctamente.') => {
    setNutritionData(next);
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

  const upsertMeal = async (playerId: string, patch: Partial<HouseDailyMealRecord>) => {
    const current = getMealRecord(nutritionData, playerId, date);
    const record = { ...current, ...patch };
    await persist({ ...nutritionData, meals: [...nutritionData.meals.filter((item) => !(item.playerId === playerId && item.date === date)), record] }, 'Alimentación diaria guardada.');
  };

  const markAllMeal = async (field: 'breakfast' | 'lunch' | 'dinner') => {
    const records = visiblePlayers.map((player) => ({ ...getMealRecord(nutritionData, player.id, date), [field]: true }));
    const otherMeals = nutritionData.meals.filter((item) => !(item.date === date && visiblePlayers.some((player) => player.id === item.playerId)));
    await persist({ ...nutritionData, meals: [...otherMeals, ...records] }, 'Comida marcada para todos los jugadores visibles.');
  };

  return (
    <div className="grid alimentacion-page">
      <AppHero
        heroClass="hero-alimentacion"
        title="Alimentación"
        subtitle="Registro diario de desayuno, almuerzo y cena para interpretar energía, RPE, recuperación y control de carga."
      />
      <GlobalFiltersBar />

      <div className="toolbar card house-toolbar">
        <div className="grid form-grid house-toolbar-fields">
          <label>Categoría<select className="select" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value as ClubCategory | 'all')}>{categories.map((cat) => <option key={cat} value={cat}>{cat === 'all' ? 'Todas' : categoryLabel(cat)}</option>)}</select></label>
          <label>Fecha<input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </div>
        <button className="btn" disabled={saving} onClick={() => void persist(nutritionData)}><Save size={16} /> {saving ? 'Guardando…' : 'Guardar todo'}</button>
      </div>

      <div className="grid grid-4">
        <KpiCard label="Cumplimiento" value={fmtPct(completionPct)} tone={completionPct >= 90 ? 'green' : completionPct >= 70 ? 'amber' : 'red'} trend="3 comidas por jugador" icon={<Utensils size={18} />} />
        <KpiCard label="Desayuno" value={`${breakfast}/${visiblePlayers.length}`} tone={breakfast === visiblePlayers.length ? 'green' : 'amber'} trend="Antes de entrenar" />
        <KpiCard label="Almuerzo" value={`${lunch}/${visiblePlayers.length}`} tone={lunch === visiblePlayers.length ? 'green' : 'amber'} trend="Disponibilidad energética" />
        <KpiCard label="Cena" value={`${dinner}/${visiblePlayers.length}`} tone={dinner === visiblePlayers.length ? 'green' : 'amber'} trend="Recuperación" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionHeader eyebrow="Lógica de decisión" title="Cómo usar alimentación en control de carga" subtitle="Variable de apoyo: no decide sola, pero explica baja energía, RPE alto o mala recuperación." />
          <div className="insight-list compact">
            <div><strong>Sin desayuno + entrenamiento temprano:</strong> monitorear energía y evitar picos de alta intensidad si hay síntomas.</div>
            <div><strong>Cena incompleta post sesión fuerte:</strong> revisar recuperación del día siguiente.</div>
            <div><strong>Alimentación incompleta + wellness bajo/RPE alto:</strong> subir alerta de readiness y considerar carga preventiva.</div>
          </div>
        </div>
        <div className="card">
          <SectionHeader eyebrow="Alertas" title="Prioridad del día" subtitle="Casos que requieren conversación rápida antes de entrenar." />
          {critical || incomplete ? (
            <div className="alert-stack">
              <div className={critical ? 'soft-alert danger' : 'soft-alert warning'}><AlertTriangle size={16} /> {critical} jugadores con 0 o 1 comida registrada.</div>
              <div className="soft-alert warning"><AlertTriangle size={16} /> {incomplete} jugadores con alimentación incompleta.</div>
            </div>
          ) : <div className="soft-alert success"><CheckCircle2 size={16} /> Todos los jugadores visibles tienen alimentación completa.</div>}
        </div>
      </div>

      {message ? <div className="house-message"><CheckCircle2 size={16} /> {message}</div> : null}
      {loading ? <div className="card empty">Cargando alimentación…</div> : null}

      <div className="card">
        <SectionHeader
          eyebrow="Registro diario"
          title="Desayuno · Almuerzo · Cena"
          subtitle="Marca solo lo confirmado: desayuno, almuerzo y cena. Variable de apoyo para interpretar energía, RPE y recuperación."
          action={<div className="btn-row"><button className="btn secondary" onClick={() => void markAllMeal('breakfast')}>Todos desayunaron</button><button className="btn secondary" onClick={() => void markAllMeal('lunch')}>Todos almorzaron</button><button className="btn secondary" onClick={() => void markAllMeal('dinner')}>Todos cenaron</button><button className="btn" onClick={() => window.print()}><Download size={16} /> PDF</button></div>}
        />
        {!visiblePlayers.length ? <EmptyState title="Sin jugadores" text="Ajusta la categoría o registra jugadores para iniciar el control de alimentación." /> : null}
        <div className="table-scroll"><table className="pro-table house-table"><thead><tr><th>Jugador</th><th>Categoría</th><th>Desayunó</th><th>Almorzó</th><th>Cenó</th><th>Estado</th><th>Decisión de carga</th></tr></thead><tbody>
          {todayMeals.map(({ player, meal, decision }) => <tr key={player.id}>
            <td>{getPlayerName(data.players, player.id)}</td>
            <td>{categoryLabel(player.category ?? 'Sub20')}</td>
            <td><input type="checkbox" checked={meal.breakfast} onChange={(event) => void upsertMeal(player.id, { breakfast: event.target.checked })} /></td>
            <td><input type="checkbox" checked={meal.lunch} onChange={(event) => void upsertMeal(player.id, { lunch: event.target.checked })} /></td>
            <td><input type="checkbox" checked={meal.dinner} onChange={(event) => void upsertMeal(player.id, { dinner: event.target.checked })} /></td>
            <td><StatusBadge text={decision.label} tone={decision.tone} /></td>
            <td><strong>{decision.decision}</strong><br /><small>{decision.detail}</small></td>
          </tr>)}
        </tbody></table></div>
      </div>
    </div>
  );
}
