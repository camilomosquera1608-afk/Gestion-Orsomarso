# Plan de despliegue seguro

## 1. GitHub

1. Ejecutar `npm run preflight`.
2. Confirmar que `.env.local` no aparece en `git status`.
3. Confirmar que no hay PDFs, JSON reales ni backups.
4. Crear repositorio privado o controlado.
5. Subir rama inicial.

```bash
git init
git add .
git status
git commit -m "v91 secure production prep"
```

## 2. Supabase

No conectar esta v91 todavía a Supabase productivo.

Primero crear v92:

- proyecto nuevo de Supabase,
- tablas separadas,
- RLS activo,
- políticas seguras,
- datos de prueba,
- backups.

No reutilizar la tabla legacy `app_state` para producción.

## 3. Vercel

Vercel debe conectarse después de validar Supabase seguro.

Variables futuras en Vercel:

```env
NEXT_PUBLIC_ENABLE_REMOTE_SYNC=true
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

No agregar service role key en variables públicas.

## 4. Validación final

- `npm run build` compila.
- Supabase tiene RLS activo.
- No hay escritura pública anónima peligrosa.
- Preview de Vercel funciona con datos de prueba.
- Backups/exportación local verificados.
