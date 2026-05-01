# v108.6.3 - Menu estable, botones de microciclo y edición de sesión

## Cambios incluidos

- Repara definitivamente el layout del sidebar en escritorio.
- Mantiene la navegación móvil/tablet separada del menú desktop.
- Evita que el botón Cerrar sesión se monte sobre los módulos del menú.
- El calendario del microciclo ahora tiene acciones reales:
  - Planificar abre la sesión con fecha y categoría seleccionadas.
  - Editar sesión abre la sesión guardada correspondiente.
  - Eliminar sesión permite borrar la sesión desde el día del microciclo.
- La pantalla de sesión lee parámetros URL: fecha, categoría y sessionId.
- Al abrir una sesión desde microciclo, se carga la sesión existente y su planilla.

## Archivos modificados

- app/globals.css
- app/sesion-entrenamiento/page.tsx
- app/microciclo/page.tsx
- components/pro-ui.tsx
- lib/operational-helpers.ts
- package.json

## Validación

- `node scripts/preflight-check.mjs` ejecutado correctamente.
- No se ejecutó `npm run build` porque el entorno no tiene `node_modules`.

## Notas

No incluye migraciones SQL nuevas. No toca Supabase, roles, wellness, competencia, informes ni lógica legacy.
