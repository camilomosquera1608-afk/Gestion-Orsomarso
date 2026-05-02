'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { EmptyState, FormSection, SectionHeader } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel, calcAge, formatBirthDateForDisplay } from '@/lib/labels';
import { ClubCategory, PlayerStatus, Position } from '@/lib/types';

const positions: Position[] = ['Portero', 'Defensa central', 'Lateral', 'Mediocampista', 'Extremo', 'Delantero'];
const statuses: PlayerStatus[] = ['Disponible', 'Molestia', 'Readaptación', 'Lesionado'];
const categories: ClubCategory[] = ['Sub15', 'Sub17', 'Sub20'];

export default function RegistroPage() {
  const { addPlayer } = useApp();
  const session = getStaffSession();
  const master = isMasterRole(session);
  const [photoPreview, setPhotoPreview] = useState('/orsomarso-crest.jpg');
  const [message, setMessage] = useState('');

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handlePlayerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const birthDate = formatBirthDateForDisplay(String(form.get('birthDate')));
    const jerseyRaw = Number.parseInt(String(form.get('jerseyNumber')));
    addPlayer({
      id: crypto.randomUUID(),
      name: String(form.get('name')).trim(),
      age: calcAge(birthDate) ?? 0,
      birthDate,
      position: String(form.get('position')) as Position,
      category: (master ? String(form.get('category')) : session.category) as ClubCategory,
      jerseyNumber: Number.isFinite(jerseyRaw) && jerseyRaw > 0 ? jerseyRaw : undefined,
      height: Number.parseFloat(String(form.get('height'))) || 0,
      weight: Number.parseFloat(String(form.get('weight'))) || 0,
      status: String(form.get('status')) as PlayerStatus,
      photo: photoPreview || '/orsomarso-crest.jpg',
    });
    event.currentTarget.reset();
    setPhotoPreview('/orsomarso-crest.jpg');
    setMessage('Jugador agregado al plantel. La información quedó guardada en modo local seguro.');
  };

  return (
    <div className="grid">
      <AppHero title="Registro de plantilla" subtitle="Alta de jugadores con datos base, categoría y disponibilidad inicial." />

      <div className="toolbar card">
        <div>
          <span className="section-eyebrow">Acción principal</span>
          <h3 style={{ margin: 0 }}>Agregar jugador al plantel</h3>
          <div className="muted-line">Completa los datos básicos del jugador.</div>
        </div>
        <div className="btn-row">
          <Link className="btn secondary" href="/jugadores">Ver plantilla</Link>
          <Link className="btn secondary" href="/diario">Volver al parte diario</Link>
        </div>
      </div>

      {message ? <EmptyState icon="check" title="Registro guardado" text={message} action={<Link className="btn secondary" href="/jugadores">Revisar plantilla</Link>} /> : null}

      <form className="card grid" onSubmit={handlePlayerSubmit}>
        <SectionHeader eyebrow="Formulario" title="Ficha base del jugador" subtitle="Información mínima del plantel." />

        <FormSection title="Identificación" subtitle="Datos personales y foto de referencia del jugador.">
          <div className="register-photo-box">
            <img src={photoPreview} alt="Vista previa del jugador" className="register-photo-preview" />
            <div className="field">
              <label>Foto del jugador</label>
              <input className="input" type="file" accept=".jpg,.jpeg,.png,image/png,image/jpeg" onChange={handlePhotoChange} />
              <span className="field-help">Formato sugerido: JPG o PNG, rostro visible.</span>
            </div>
          </div>
          <div className="field">
            <label>Nombre completo</label>
            <input className="input" name="name" placeholder="Nombre y apellido" required />
          </div>
          <div className="field">
            <label>Número de dorsal</label>
            <input className="input" type="number" min="1" max="99" name="jerseyNumber" placeholder="Ej. 10" />
            <span className="field-help">Opcional. Facilita la identificación en planillas y reportes.</span>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>Fecha de nacimiento</label><input className="input" type="date" name="birthDate" required /></div>
            <div className="field"><label>Estado inicial</label><select className="select" name="status" required>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
        </FormSection>

        <FormSection title="Contexto deportivo" subtitle="Categoría, posición y datos físicos para lectura de rendimiento.">
          <div className="grid grid-3">
            <div className="field"><label>Posición</label><select className="select" name="position" required>{positions.map((p) => <option key={p}>{p}</option>)}</select></div>
            {master ? (
              <div className="field"><label>Categoría base</label><select className="select" name="category" required>{categories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select></div>
            ) : (
              <div className="field"><label>Categoría base</label><input className="input" name="category" value={categoryLabel(session.category)} readOnly /></div>
            )}
            
          </div>
          <div className="grid grid-2">
            <div className="field"><label>Estatura (cm)</label><input className="input" type="number" step="0.01" name="height" placeholder="Ej. 178" required /></div>
            <div className="field"><label>Peso (kg)</label><input className="input" type="number" step="0.01" name="weight" placeholder="Ej. 72.5" required /></div>
          </div>
        </FormSection>

        <div className="toolbar">
          <div className="muted-line">Después de guardar, abre la ficha del jugador para cargar seguimiento médico o revisar historial.</div>
          <button className="btn" type="submit">Agregar jugador</button>
        </div>
      </form>
    </div>
  );
}
