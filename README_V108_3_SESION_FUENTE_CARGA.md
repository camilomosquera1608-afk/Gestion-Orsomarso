# v108.3 - Sesión como fuente de carga y edición completa

## Objetivo

Refuerza la lógica operativa para que la sesión de entrenamiento sea la fuente principal de carga diaria.

## Cambios

- Editar sesión carga y guarda también la planilla de jugadores.
- Al editar, los registros de jugadores se actualizan por `sessionId` y jugador, evitando duplicados.
- La carga interna se deriva de `MIN x RPE` desde los valores guardados en sesión.
- El módulo Carga prioriza datos de sesión (`externalLoads`) y usa `internalLoads` solo como respaldo para registros antiguos.
- Si un jugador se quita de la sesión, se elimina también su carga interna asociada a esa sesión.
- Validaciones de planilla:
  - MIN entre 0 y 240.
  - RPE entre 0 y 10.
  - GPS no negativo.
  - Si participación es No participa, MIN y RPE deben ser 0.

## Archivos modificados

- `app/sesion-entrenamiento/page.tsx`
- `context/app-context.tsx`
- `lib/strategic-helpers.ts`
- `package.json`

## No toca

- Supabase SQL.
- Roles.
- Wellness público.
- Competencia.
- PDFs.
- `app_state`.
- Legacy.

## Validación

Se ejecutó `node scripts/preflight-check.mjs` correctamente.

En ambiente local ejecutar:

```bash
npm install
npm run build
```
