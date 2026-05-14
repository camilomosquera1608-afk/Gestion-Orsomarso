'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { EmptyState, FormSection, SectionHeader } from '@/components/pro-ui';
import { useApp } from '@/context/app-context';
import { getStaffSession, isMasterRole } from '@/lib/auth';
import { categoryLabel, calcAge, normalizeBirthDateInput } from '@/lib/labels';
import { ClubCategory, CompetitiveRole, DominantFoot, LoadTolerance, PlayerStatus, Position } from '@/lib/types';

const positions: Position[] = ['Portero', 'Defensa central', 'Lateral', 'Mediocampista', 'Extremo', 'Delantero'];
const statuses: PlayerStatus[] = ['Disponible', 'Molestia', 'Readaptación', 'Lesionado'];
const categories: ClubCategory[] = ['Sub15', 'Sub17', 'Sub20'];
const dominantFeet: DominantFoot[] = ['Derecha', 'Izquierda', 'Ambidiestro'];
const competitiveRoles: CompetitiveRole[] = ['Titular habitual', 'Rotación', 'Suplente', 'Proyección', 'Retorno a competencia'];
const loadTolerances: LoadTolerance[] = ['Alta', 'Media', 'Baja', 'En construcción'];

const getText = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const getOptionalText = (form: FormData, key: string) => getText(form, key) || undefined;
const getOptionalNumber = (form: FormData, key: string) => {
  const value = Number.parseFloat(String(form.get(key) ?? ''));
  return Number.isFinite(value) ? value : undefined;
};
const getPositiveInt = (form: FormData, key: string) => {
  const value = Number.parseInt(String(form.get(key) ?? ''), 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};
const getRestrictionList = (form: FormData) => getText(form, 'restrictions')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

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
    const birthDate = normalizeBirthDateInput(getText(form, 'birthDate'));
    addPlayer({
      id: crypto.randomUUID(),
      name: getText(form, 'name'),
      age: calcAge(birthDate) ?? 0,
      birthDate,
      documentId: getOptionalText(form, 'documentId'),
      nationality: getOptionalText(form, 'nationality'),
      birthplace: getOptionalText(form, 'birthplace'),
      phone: getOptionalText(form, 'phone'),
      guardianName: getOptionalText(form, 'guardianName'),
      guardianPhone: getOptionalText(form, 'guardianPhone'),
      emergencyContactName: getOptionalText(form, 'emergencyContactName'),
      emergencyContactPhone: getOptionalText(form, 'emergencyContactPhone'),
      position: getText(form, 'position') as Position,
      secondaryPosition: getOptionalText(form, 'secondaryPosition') as Position | undefined,
      category: (master ? getText(form, 'category') : session.category) as ClubCategory,
      jerseyNumber: getPositiveInt(form, 'jerseyNumber'),
      height: getOptionalNumber(form, 'height') ?? 0,
      weight: getOptionalNumber(form, 'weight') ?? 0,
      dominantFoot: getOptionalText(form, 'dominantFoot') as DominantFoot | undefined,
      competitiveRole: getOptionalText(form, 'competitiveRole') as CompetitiveRole | undefined,
      dateJoined: getOptionalText(form, 'dateJoined'),
      status: getText(form, 'status') as PlayerStatus,
      loadTolerance: getOptionalText(form, 'loadTolerance') as LoadTolerance | undefined,
      maxVelocityReference: getOptionalNumber(form, 'maxVelocityReference'),
      baselineWellness: getOptionalNumber(form, 'baselineWellness'),
      baselineRpe: getOptionalNumber(form, 'baselineRpe'),
      targetWeeklyLoad: getOptionalNumber(form, 'targetWeeklyLoad'),
      targetWeeklyHsr: getOptionalNumber(form, 'targetWeeklyHsr'),
      targetWeeklySprintDistance: getOptionalNumber(form, 'targetWeeklySprintDistance'),
      targetMinutes7d: getOptionalNumber(form, 'targetMinutes7d'),
      maxTrainingPercent: getOptionalNumber(form, 'maxTrainingPercent'),
      maxCompetitionMinutes: getOptionalNumber(form, 'maxCompetitionMinutes'),
      returnToPlayPhase: getOptionalText(form, 'returnToPlayPhase'),
      restrictions: getRestrictionList(form),
      medicalNotes: getOptionalText(form, 'medicalNotes'),
      allergies: getOptionalText(form, 'allergies'),
      chronicConditions: getOptionalText(form, 'chronicConditions'),
      riskAreas: getOptionalText(form, 'riskAreas'),
      photo: photoPreview || '/orsomarso-crest.jpg',
    });
    event.currentTarget.reset();
    setPhotoPreview('/orsomarso-crest.jpg');
    setMessage('Jugador agregado con ficha completa para control de carga, disponibilidad y seguimiento médico-deportivo.');
  };

  return (
    <div className="grid">
      <AppHero title="Registro de plantilla" subtitle="Alta de jugadores con ficha deportiva, médica y referencias individuales de carga." />

      <div className="toolbar card">
        <div>
          <span className="section-eyebrow">Acción principal</span>
          <h3 style={{ margin: 0 }}>Agregar jugador al plantel</h3>
          <div className="muted-line">Completa la información necesaria para individualizar la carga y la disponibilidad.</div>
        </div>
        <div className="btn-row">
          <Link className="btn secondary" href="/jugadores">Ver plantilla</Link>
          <Link className="btn secondary" href="/diario">Volver al parte diario</Link>
        </div>
      </div>

      {message ? <EmptyState icon="check" title="Registro guardado" text={message} action={<Link className="btn secondary" href="/jugadores">Revisar plantilla</Link>} /> : null}

      <form className="card grid" onSubmit={handlePlayerSubmit}>
        <SectionHeader eyebrow="Formulario" title="Ficha completa del jugador" subtitle="Datos base, perfil deportivo, referencias de carga y antecedentes relevantes." />

        <FormSection title="Identificación" subtitle="Datos personales, foto y contacto básico.">
          <div className="register-photo-box">
            <img src={photoPreview} alt="Vista previa del jugador" className="register-photo-preview" />
            <div className="field">
              <label>Foto del jugador</label>
              <input className="input" type="file" accept=".jpg,.jpeg,.png,image/png,image/jpeg" onChange={handlePhotoChange} />
              <span className="field-help">Formato sugerido: JPG o PNG, rostro visible.</span>
            </div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>Nombre completo</label><input className="input" name="name" placeholder="Nombre y apellido" required /></div>
            <div className="field"><label>Documento / ID</label><input className="input" name="documentId" placeholder="Opcional" /></div>
          </div>
          <div className="grid grid-3">
            <div className="field"><label>Fecha de nacimiento</label><input className="input" type="date" name="birthDate" required /></div>
            <div className="field"><label>Nacionalidad</label><input className="input" name="nationality" placeholder="Ej. Colombia" /></div>
            <div className="field"><label>Lugar de nacimiento</label><input className="input" name="birthplace" placeholder="Ciudad / municipio" /></div>
          </div>
          <div className="grid grid-3">
            <div className="field"><label>Teléfono jugador</label><input className="input" name="phone" placeholder="Opcional" /></div>
            <div className="field"><label>Acudiente / contacto</label><input className="input" name="guardianName" placeholder="Nombre" /></div>
            <div className="field"><label>Teléfono acudiente</label><input className="input" name="guardianPhone" placeholder="Opcional" /></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>Contacto emergencia</label><input className="input" name="emergencyContactName" placeholder="Nombre" /></div>
            <div className="field"><label>Teléfono emergencia</label><input className="input" name="emergencyContactPhone" placeholder="Opcional" /></div>
          </div>
        </FormSection>

        <FormSection title="Perfil deportivo" subtitle="Información táctica y competitiva para interpretar la carga según rol y posición.">
          <div className="grid grid-4">
            <div className="field"><label>Dorsal</label><input className="input" type="number" min="1" max="99" name="jerseyNumber" placeholder="Ej. 10" /></div>
            <div className="field"><label>Posición principal</label><select className="select" name="position" required>{positions.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div className="field"><label>Posición secundaria</label><select className="select" name="secondaryPosition"><option value="">Sin definir</option>{positions.map((p) => <option key={p}>{p}</option>)}</select></div>
            <div className="field"><label>Pie dominante</label><select className="select" name="dominantFoot"><option value="">Sin definir</option>{dominantFeet.map((p) => <option key={p}>{p}</option>)}</select></div>
          </div>
          <div className="grid grid-4">
            {master ? (
              <div className="field"><label>Categoría base</label><select className="select" name="category" required>{categories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select></div>
            ) : (
              <div className="field"><label>Categoría base</label><input className="input" name="category" value={categoryLabel(session.category)} readOnly /></div>
            )}
            <div className="field"><label>Rol competitivo</label><select className="select" name="competitiveRole"><option value="">Sin definir</option>{competitiveRoles.map((r) => <option key={r}>{r}</option>)}</select></div>
            <div className="field"><label>Fecha de ingreso</label><input className="input" type="date" name="dateJoined" /></div>
            <div className="field"><label>Estado inicial</label><select className="select" name="status" required>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>Estatura (cm)</label><input className="input" type="number" step="0.01" name="height" placeholder="Ej. 178" required /></div>
            <div className="field"><label>Peso (kg)</label><input className="input" type="number" step="0.01" name="weight" placeholder="Ej. 72.5" required /></div>
          </div>
        </FormSection>

        <FormSection title="Referencias individuales de carga" subtitle="Datos útiles para comparar al jugador contra su propio perfil y no contra promedios genéricos.">
          <div className="grid grid-4">
            <div className="field"><label>Tolerancia a carga</label><select className="select" name="loadTolerance"><option value="">Sin definir</option>{loadTolerances.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label>Vmax referencia (km/h)</label><input className="input" type="number" step="0.01" name="maxVelocityReference" placeholder="Ej. 31.8" /></div>
            <div className="field"><label>Wellness base</label><input className="input" type="number" step="0.1" min="1" max="5" name="baselineWellness" placeholder="1 a 5" /></div>
            <div className="field"><label>RPE habitual</label><input className="input" type="number" step="0.1" min="0" max="10" name="baselineRpe" placeholder="0 a 10" /></div>
          </div>
          <div className="grid grid-4">
            <div className="field"><label>Carga semanal objetivo</label><input className="input" type="number" step="1" name="targetWeeklyLoad" placeholder="UA" /></div>
            <div className="field"><label>Alta velocidad objetivo</label><input className="input" type="number" step="1" name="targetWeeklyHsr" placeholder="m/semana" /></div>
            <div className="field"><label>Sprint objetivo</label><input className="input" type="number" step="1" name="targetWeeklySprintDistance" placeholder="m/semana" /></div>
            <div className="field"><label>Minutos objetivo 7 días</label><input className="input" type="number" step="1" name="targetMinutes7d" placeholder="min" /></div>
          </div>
        </FormSection>

        <FormSection title="Disponibilidad, restricciones y antecedentes" subtitle="Campos clave para decidir si la carga debe ser completa, reducida o modificada.">
          <div className="grid grid-4">
            <div className="field"><label>% máximo de sesión</label><input className="input" type="number" min="0" max="100" step="1" name="maxTrainingPercent" placeholder="Ej. 80" /></div>
            <div className="field"><label>Minutos máximos partido</label><input className="input" type="number" min="0" max="120" step="1" name="maxCompetitionMinutes" placeholder="Ej. 45" /></div>
            <div className="field"><label>Fase de retorno</label><input className="input" name="returnToPlayPhase" placeholder="Ej. Fase 3 / campo parcial" /></div>
            <div className="field"><label>Zonas de riesgo</label><input className="input" name="riskAreas" placeholder="Ej. isquio der., aductor izq." /></div>
          </div>
          <div className="field">
            <label>Restricciones actuales</label>
            <input className="input" name="restrictions" placeholder="Separar por comas: no sprint, no contacto, no cambios de dirección" />
            <span className="field-help">Estas restricciones aparecerán en la ficha y ayudan a decidir la carga diaria.</span>
          </div>
          <div className="grid grid-3">
            <div className="field"><label>Alergias</label><input className="input" name="allergies" placeholder="Opcional" /></div>
            <div className="field"><label>Condiciones crónicas</label><input className="input" name="chronicConditions" placeholder="Opcional" /></div>
            <div className="field"><label>Nota médica/deportiva</label><input className="input" name="medicalNotes" placeholder="Observación interna" /></div>
          </div>
        </FormSection>

        <div className="toolbar">
          <div className="muted-line">Después de guardar, abre la ficha individual para actualizar restricciones, historial médico o referencias de carga.</div>
          <button className="btn" type="submit">Agregar jugador</button>
        </div>
      </form>
    </div>
  );
}
