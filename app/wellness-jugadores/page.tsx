'use client';

import { useMemo, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { ToneBadge } from '@/components/status-badge';
import { useApp } from '@/context/app-context';
import { getTrafficLight } from '@/lib/rules';

type WellnessFormState = {
  sleep: number;
  fatigue: number;
  stress: number;
  musclePain: number;
  mood: number;
};

const defaultState: WellnessFormState = {
  sleep: 0,
  fatigue: 0,
  stress: 0,
  musclePain: 0,
  mood: 0,
};

const questionMeta: Record<keyof WellnessFormState, { title: string; options: Record<number, string> }> = {
  sleep: {
    title: '¿Cómo fue la calidad de tu sueño?',
    options: { 0: 'Selecciona una opción', 1: 'Muy malo', 2: 'Malo', 3: 'Normal', 4: 'Bueno', 5: 'Excelente' },
  },
  fatigue: {
    title: '¿Cuánta energía sientes al despertar?',
    options: { 0: 'Selecciona una opción', 1: 'Muy poca', 2: 'Poca', 3: 'Normal', 4: 'Demasiada', 5: 'Mucha' },
  },
  stress: {
    title: '¿Sientes molestia o rigidez en tu cuerpo?',
    options: { 0: 'Selecciona una opción', 1: 'Demasiado', 2: 'Mucha', 3: 'Poca', 4: 'Normal', 5: 'Nada' },
  },
  musclePain: {
    title: '¿Cómo te sientes mentalmente hoy?',
    options: { 0: 'Selecciona una opción', 1: 'Muy mal', 2: 'Mal', 3: 'Normal', 4: 'Bien', 5: 'Muy bien' },
  },
  mood: {
    title: '¿Cómo te sientes emocionalmente hoy?',
    options: { 0: 'Selecciona una opción', 1: 'Muy mal', 2: 'Mal', 3: 'Normal', 4: 'Bien', 5: 'Muy bien' },
  },
};

const toneText = {
  green: 'Bien',
  yellow: 'Normal',
  red: 'Atención',
};

export default function WellnessJugadoresPage() {
  const { data, upsertWellness, backendMode, syncStatus } = useApp();
  const [message, setMessage] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState(data.players[0]?.id ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [values, setValues] = useState<WellnessFormState>(defaultState);

  const average = useMemo(() => {
    const total = values.sleep + values.fatigue + values.stress + values.musclePain + values.mood;
    return (total / 5).toFixed(1);
  }, [values]);

  const handleSubmit = (formData: FormData) => {
    const playerId = String(formData.get('playerId'));
    const player = data.players.find((item) => item.id === playerId);
    const recordDate = String(formData.get('date'));
    upsertWellness({
      id: crypto.randomUUID(),
      playerId,
      date: recordDate,
      sleep: Number(formData.get('sleep')),
      fatigue: Number(formData.get('fatigue')),
      stress: Number(formData.get('stress')),
      musclePain: Number(formData.get('musclePain')),
      mood: Number(formData.get('mood')),
    });
    setSelectedPlayerId(playerId);
    setDate(recordDate);
    setMessage(`Wellness enviado correctamente por ${player?.name ?? 'el jugador'}.`);
  };

  return (
    <div className="grid">
      <AppHero title="Wellness diario" />

      <div className="card wellness-form-card">
        <div className="wellness-public-header">
          <div>
            <h3>Formulario wellness</h3>
            <div className="wellness-average">Promedio actual: {average}</div>
          </div>
          <div className="btn-row">
            <ToneBadge text="Escala 1 a 5" tone="green" />
            {backendMode === 'supabase' ? (
              <ToneBadge text={`Sync ${syncStatus}`} tone={syncStatus === 'ready' ? 'green' : syncStatus === 'error' ? 'red' : 'yellow'} />
            ) : null}
          </div>
        </div>

        <form action={handleSubmit} className="grid">
          <div className="grid grid-2">
            <div className="field">
              <label>Jugador</label>
              <select className="select" name="playerId" value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)}>
                {data.players.map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Fecha</label>
              <input className="input" type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="wellness-preview-grid">
            {(Object.keys(values) as (keyof WellnessFormState)[]).map((key, index) => {
              const tone = getTrafficLight(values[key]) as 'green' | 'yellow' | 'red';
              return (
                <div key={key} className={`wellness-preview-card tone-${tone}`}>
                  <div className="question-number">Pregunta {index + 1}</div>
                  <div className="field">
                    <label className="wellness-question-label">{questionMeta[key].title}</label>
                    <select
                      className="select wellness-select-large"
                      name={key}
                      value={values[key]}
                      onChange={(e) => setValues((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                    >
                      {Object.entries(questionMeta[key].options).map(([value, text]) => (
                        <option key={value} value={value}>{value}. {text}</option>
                      ))}
                    </select>
                  </div>
                  <div className="wellness-preview-footer">
                    <strong>{values[key]}/5</strong>
                    <ToneBadge text={toneText[tone]} tone={tone} />
                  </div>
                </div>
              );
            })}
          </div>

          <button className="btn" type="submit">Enviar wellness</button>
        </form>

        {message ? <div style={{ marginTop: 14, fontWeight: 700 }}>{message}</div> : null}
      </div>
    </div>
  );
}
