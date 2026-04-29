'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppHero } from '@/components/app-hero';
import { EmptyState, SectionHeader } from '@/components/pro-ui';
import { getSupabaseUserEmail, hasSupabaseConfig, tableSchemaSyncEnabled, updateSupabasePassword } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    void getSupabaseUserEmail().then(setUserEmail);
  }, []);

  const handleUpdatePassword = async () => {
    setMessage('');

    if (password.trim().length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Las contraseñas no coinciden.');
      return;
    }

    const result = await updateSupabasePassword(password);
    if (!result.ok) {
      setMessage(`No se pudo actualizar la contraseña: ${result.reason}`);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setMessage('Contraseña actualizada. Ya puedes iniciar sesión remota desde Configuración.');
  };

  return (
    <div className="grid">
      <AppHero title="Recuperar contraseña" subtitle="Actualiza el acceso remoto de Supabase." />

      <div className="card">
        <SectionHeader eyebrow="Supabase" title="Nueva contraseña" subtitle={userEmail ? `Sesión de recuperación: ${userEmail}` : 'Abre esta pantalla desde el enlace enviado por Supabase.'} />

        {!hasSupabaseConfig || !tableSchemaSyncEnabled ? (
          <EmptyState title="Supabase desactivado" text="Activa table_schema en .env.local para usar recuperación de contraseña." />
        ) : (
          <div className="grid grid-2">
            <label className="field">Nueva contraseña
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" />
            </label>
            <label className="field">Confirmar contraseña
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repite la contraseña" />
            </label>
            <div className="btn-row">
              <button type="button" className="btn" onClick={handleUpdatePassword}>Actualizar contraseña</button>
              <Link className="btn secondary" href="/configuracion">Ir a Configuración</Link>
            </div>
          </div>
        )}

        {message && <div className="empty" style={{ marginTop: 12 }}>{message}</div>}
      </div>

      <div className="card">
        <SectionHeader eyebrow="Configuración requerida" title="URLs permitidas en Supabase" />
        <div className="mini-stat-card">
          <strong>Local</strong>
          <div className="muted-line">http://localhost:3000/reset-password</div>
        </div>
        <div className="mini-stat-card" style={{ marginTop: 10 }}>
          <strong>Producción</strong>
          <div className="muted-line">https://tu-dominio.vercel.app/reset-password</div>
        </div>
      </div>
    </div>
  );
}
