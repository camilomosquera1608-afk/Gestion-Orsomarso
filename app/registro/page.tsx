'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { AppHero } from '@/components/app-hero';
import { useApp } from '@/context/app-context';
import { Position, PlayerStatus } from '@/lib/types';

const positions: Position[] = ['Portero', 'Defensa central', 'Lateral', 'Mediocampista', 'Extremo', 'Delantero'];
const statuses: PlayerStatus[] = ['Disponible', 'Lesionado', 'Molestia', 'Readaptación'];

export default function RegistroPage() {
  const { addPlayer } = useApp();
  const [message, setMessage] = useState('');
  const [photoPreview, setPhotoPreview] = useState('/orsomarso-crest.jpg');

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
    addPlayer({
      id: crypto.randomUUID(),
      name: String(form.get('name')),
      age: Number(form.get('age')),
      position: String(form.get('position')) as Position,
      height: Number(form.get('height')),
      weight: Number(form.get('weight')),
      status: String(form.get('status')) as PlayerStatus,
      photo: photoPreview || '/orsomarso-crest.jpg',
    });
    event.currentTarget.reset();
    setPhotoPreview('/orsomarso-crest.jpg');
    setMessage('Jugador creado correctamente.');
  };

  return (
    <div className="grid">
      <AppHero title="Registrar jugador" />
      {message ? <div className="card"><strong>{message}</strong></div> : null}
      <form className="card grid" onSubmit={handlePlayerSubmit}>
        <h3>Crear jugador</h3>
        <div className="register-photo-box">
          <img src={photoPreview} alt="Vista previa del jugador" className="register-photo-preview" />
          <div className="field">
            <label>Foto del jugador</label>
            <input className="input" type="file" accept=".jpg,.jpeg,.png,image/png,image/jpeg" onChange={handlePhotoChange} />
          </div>
        </div>
        <input className="input" name="name" placeholder="Nombre completo" required />
        <div className="grid grid-2">
          <input className="input" type="number" name="age" placeholder="Edad" required />
          <select className="select" name="position" required>{positions.map((p) => <option key={p}>{p}</option>)}</select>
        </div>
        <div className="grid grid-2">
          <input className="input" type="number" name="height" placeholder="Estatura (cm)" required />
          <input className="input" type="number" name="weight" placeholder="Peso (kg)" required />
        </div>
        <select className="select" name="status" required>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn" type="submit">Guardar jugador</button>
      </form>
    </div>
  );
}
