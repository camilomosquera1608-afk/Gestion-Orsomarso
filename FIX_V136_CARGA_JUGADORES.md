# Fix v136 - Lógica de carga de jugadores

## Qué se corrigió

- La carga diaria del jugador ya no descarta automáticamente la competencia cuando también existe carga interna de entrenamiento el mismo día.
- Se evita duplicar la carga cuando una sesión guarda los dos registros normales de la app: `daily_external_loads` y `daily_internal_loads` para el mismo jugador/sesión.
- El Centro de carga ahora suma correctamente:
  - carga interna de sesión (`RPE x duración`),
  - carga GPS o externa cuando no existe par interno,
  - competencia derivada desde `competitionRecords` o registros externos de competencia.
- Los minutos del ranking ya no dependen solo de carga externa/GPS; si una categoría o sincronización tiene únicamente carga interna, también se muestran sus minutos.
- El RPE promedio se calcula con los registros efectivos, sin duplicar la misma sesión interna/externa.

## Archivos modificados

- `lib/utils.ts`
- `lib/strategic-helpers.ts`

## Validación

- `npm run preflight`: OK.
- `npx tsc --noEmit --pretty false`: OK.
- `npm run build`: iniciado, pero el entorno de ejecución cortó el proceso por tiempo durante `Creating an optimized production build ...` sin mostrar errores previos de TypeScript.
