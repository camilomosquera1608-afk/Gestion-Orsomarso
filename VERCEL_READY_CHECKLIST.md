# Vercel Ready Checklist

## Variables en Vercel

Configurar en Project Settings > Environment Variables:

```env
NEXT_PUBLIC_ENABLE_REMOTE_SYNC=true
NEXT_PUBLIC_REMOTE_SYNC_MODE=table_schema
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
NEXT_PUBLIC_ENABLE_LOCAL_DEMO_AUTH=true
```

## Validaciones

- [ ] Preview deploy abre sin errores.
- [ ] Login de categoría funciona.
- [ ] Configuración muestra Supabase remoto.
- [ ] Login remoto Supabase funciona.
- [ ] Leer Supabase no falla.
- [ ] Enviar local a Supabase no falla.
- [ ] No aparece `legacy_app_state`.
- [ ] No se usan métricas GPS fuera de U20.

## Importante

El schema de Supabase debe estar ejecutado antes del primer deploy funcional.
