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
    setMessage('Contraseña actualizada. Ya puedes iniciar sesión.');
  };

  return (
    <div className="grid">
      <AppHero title="Recuperar contraseña" subtitle="Crea una nueva contraseña de acceso." />

      <div className="card">
        <SectionHeader eyebrow="Acceso" title="Nueva contraseña" subtitle={userEmail ? `Cuenta: ${userEmail}` : 'Abre esta pantalla desde el correo de recuperación.'} />

        {!hasSupabaseConfig || !tableSchemaSyncEnabled ? (
          <EmptyState title="Supabase desactivado" text="Revisa las variables de entorno." />
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
              <Link className="btn secondary" href="/login">Ir a login</Link>
            </div>
          </div>
        )}

        {message && <div className="empty" style={{ marginTop: 12 }}>{message}</div>}
      </div>
    </div>
  );
}
