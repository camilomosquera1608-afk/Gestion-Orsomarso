# v108.7 - Auditoría operativa, duplicados y estados de cierre

## Objetivo
Reforzar la estabilidad operacional antes de cargar más datos reales. Esta fase agrega control de duplicados, estados básicos de cierre para sesión/partido y protección contra wellness duplicado local.

## Cambios principales

### Estados operativos
- `TrainingSessionSummary` y `CompetitionMatchSummary` soportan estado operacional:
  - Borrador
  - En revisión
  - Cerrada
  - Reabierta
- En sesión se puede cerrar o reabrir una sesión cargada.
- En competencia se puede cerrar o reabrir un partido seleccionado.

### Duplicados y consistencia
- Se agregó revisión de duplicados en Configuración:
  - jugadores repetidos por nombre,
  - sesiones repetidas por categoría + fecha,
  - microciclos solapados por categoría,
  - partidos repetidos por categoría + fecha + rival,
  - wellness duplicado por jugador + fecha + categoría,
  - nutrición duplicada por jugador + fecha,
  - cargas internas/externas duplicadas por jugador + sesión.

### Wellness
- El formulario público evita enviar una respuesta local duplicada para el mismo jugador y fecha.

## Archivos modificados
- `lib/types.ts`
- `lib/data-quality.ts`
- `app/configuracion/page.tsx`
- `app/sesion-entrenamiento/page.tsx`
- `app/competencia/page.tsx`
- `components/wellness-public-form.tsx`
- `package.json`

## Sin cambios de base de datos obligatorios
No requiere ejecutar SQL. Los campos `status` se manejan de forma compatible; si no existen en Supabase, se mantienen como lógica local/visual hasta migración futura.

## Validación recomendada
```bash
npm install
npm run build
npm run dev
```

## Commit sugerido
```bash
git add .
git commit -m "Add operational close states and duplicate checks"
git push
```
