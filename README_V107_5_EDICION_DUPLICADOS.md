# v107.5 - Edición operativa y prevención de duplicados

## Objetivo

Reforzar la lógica operativa antes de cargar datos reales: sesiones editables, microciclos editables sin solapamientos, competencia con edición de partido y jugadores, punto seguro por categoría activa y guardas contra duplicados.

## Cambios principales

### Sesiones
- La app detecta una sesión existente por categoría y fecha.
- El botón cambia a `Actualizar sesión` cuando ya existe sesión para esa categoría y fecha.
- No permite crear más de una sesión por categoría en la misma fecha.
- Protege contra doble clic con estado `Guardando...`.

### Microciclos
- Se puede editar nombre, semana y rango de fechas del microciclo activo.
- Bloquea microciclos con mismo nombre por categoría.
- Bloquea rangos de fechas solapados por categoría.
- Mantiene microciclos independientes por categoría.

### Competencia
- El botón `Editar partido y jugadores` carga datos generales del partido para editar.
- Se mantiene la edición individual por jugador: minutos, rol, goles, asistencias, tarjetas y estado médico.
- No permite duplicar partidos por categoría, fecha y rival.
- No permite cargar dos veces el mismo jugador en el mismo partido.
- Protege contra doble clic con `Guardando...`.
- Los minutos se mantienen únicamente por jugador, no como KPI general.

### Punto seguro
- En Configuración, el punto seguro toma automáticamente la categoría activa del filtro global.
- Si el filtro está en `Todas`, conserva la categoría del alcance del usuario o U20 como respaldo.

### Supabase
- Se agrega `SUPABASE_V107_5_OPERATIONAL_GUARDS.sql` con índices únicos opcionales.
- Ejecutar ese SQL solo si ya no existen duplicados en la base.

## Archivos modificados

- app/sesion-entrenamiento/page.tsx
- app/microciclo/page.tsx
- app/competencia/page.tsx
- app/configuracion/page.tsx
- context/app-context.tsx
- lib/operational-validation.ts
- supabase/schema.sql
- SUPABASE_RUN_THIS.sql
- SUPABASE_V107_5_OPERATIONAL_GUARDS.sql
- package.json

## Validación local

Ejecutar:

```bash
npm install
npm run dev
npm run build
```

También se ejecutó:

```bash
node scripts/preflight-check.mjs
```

Resultado: Preflight OK.
