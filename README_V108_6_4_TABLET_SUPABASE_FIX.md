# v108.6.4 - Corrección Supabase en tablet/celular

## Cambios
- Evita falsos errores permanentes de Supabase cuando la tablet/celular vuelve desde segundo plano, cambia de red o recupera foco.
- Si falla una lectura remota, conserva la cache local y reintenta sincronizar después.
- Si existe sesión local del staff pero el token de Supabase expiró, vuelve a Login para renovar sesión en vez de mostrar `Sync error`.
- No requiere SQL.

## Archivos modificados
- `context/app-context.tsx`
- `components/app-shell.tsx`
- `package.json`
