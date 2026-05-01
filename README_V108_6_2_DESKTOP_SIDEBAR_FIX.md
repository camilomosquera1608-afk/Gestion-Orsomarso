# v108.6.2 - Corrección sidebar desktop

Esta corrección arregla el problema donde el sidebar en PC aparecía parcialmente colapsado/duplicado y se montaba sobre el contenido.

## Cambios

- El sidebar desktop vuelve a ser una columna vertical fija de 302px.
- Se evita que `.premium-sidebar` use `display:flex` en desktop.
- El contenido principal vuelve a ocupar la segunda columna del grid.
- La navegación móvil queda oculta en desktop.
- En tablet se mantiene navegación móvil organizada.

## Archivos modificados

- `app/globals.css`
- `package.json`
- `CLEAN_PACKAGE_MANIFEST.md`
- `README_V108_6_2_DESKTOP_SIDEBAR_FIX.md`

No se tocó Supabase, SQL, roles, sesiones, competencia, wellness ni lógica de datos.
