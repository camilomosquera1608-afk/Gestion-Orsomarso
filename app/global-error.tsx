'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[Orsomarso] Error global capturado:', error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f1f5f9', color: '#0f172a' }}>
          <section style={{ width: 'min(720px, 100%)', background: '#fff', border: '1px solid #dbe4ef', borderRadius: 24, padding: 28, boxShadow: '0 24px 70px rgba(15, 23, 42, 0.12)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '.08em' }}>Recuperación automática</div>
            <h1 style={{ margin: '8px 0 10px', fontSize: 28 }}>La aplicación tuvo un problema al cargar</h1>
            <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
              Tus datos locales no se borraron. Intenta recargar. Esta versión evita que un registro incompleto de Supabase o caché tumbe toda la página.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 22 }}>
              <button type="button" onClick={reset} style={{ border: 0, borderRadius: 14, background: '#1d4ed8', color: '#fff', padding: '12px 18px', fontWeight: 800, cursor: 'pointer' }}>Reintentar</button>
              <button type="button" onClick={() => { window.location.href = '/'; }} style={{ border: '1px solid #cbd5e1', borderRadius: 14, background: '#fff', color: '#0f172a', padding: '12px 18px', fontWeight: 800, cursor: 'pointer' }}>Ir al inicio</button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
