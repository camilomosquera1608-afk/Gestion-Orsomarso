# v107.4 - Wellness por categoria y links publicos

Esta fase corrige el flujo publico de Wellness para que cada categoria tenga un link independiente y cargue solo sus jugadores.

## Links publicos

- `/wellness/u20`
- `/wellness/u17`
- `/wellness/u15`

Tambien se mantiene `/wellness-jugadores` como formulario publico general.

## Cambios

- Nuevo componente `components/wellness-public-form.tsx`.
- Nueva ruta publica `app/wellness/[category]/page.tsx`.
- Configuracion ahora muestra links copiables por categoria.
- El formulario filtra jugadores por categoria.
- El formulario mobile queda en una sola columna.
- Los selects usan textos cortos para evitar cortes en iPhone.
- Se agrega SQL `SUPABASE_V107_4_PUBLIC_WELLNESS.sql` para permitir lectura publica de jugadores e insercion/actualizacion de wellness.

## Supabase

Si los links no cargan jugadores, ejecutar en Supabase SQL Editor:

`SUPABASE_V107_4_PUBLIC_WELLNESS.sql`

No borra datos y no abre eliminacion publica.

## Validacion

- `node scripts/preflight-check.mjs` -> OK.
- No se validó `npm run build` en este entorno porque no hay `node_modules` instalados.
