# Plan Vercel seguro

## Antes de crear el proyecto

- Repositorio GitHub limpio.
- `.env.local` fuera del repo.
- Supabase seguro creado y probado.
- `npm run build` validado localmente.

## Variables

Agregar solo variables públicas necesarias:

```env
NEXT_PUBLIC_ENABLE_REMOTE_SYNC=true
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

No agregar `SUPABASE_SERVICE_ROLE_KEY` en frontend.

## Flujo recomendado

1. Crear proyecto Vercel desde GitHub.
2. Desplegar preview.
3. Validar login, lectura y escritura con datos de prueba.
4. Validar informes.
5. Validar que U15/U17 no vean GPS.
6. Recién después promover a producción.

## Rollback

Mantener versiones etiquetadas:

- `v91-secure-production-prep`
- `v92-supabase-schema-secure`
- `v93-supabase-integration`
- `v94-vercel-preview`
