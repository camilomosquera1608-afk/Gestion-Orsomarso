# v107.6 - Botones operativos y edición completa

## Cambios

- Agrega historial de sesiones cargadas con botón **Editar sesión**.
- Permite cargar una sesión existente al formulario para corregir datos generales y participación de jugadores.
- Agrega botón **Eliminar microciclo** con confirmación.
- Al eliminar microciclo se conservan sesiones y cargas asociadas; solo se quita la asociación al microciclo eliminado.
- Refuerza el botón **Editar partido y jugadores** para activar edición completa:
  - datos generales del partido,
  - jugadores cargados,
  - minutos por jugador,
  - titular/suplente,
  - goles/asistencias,
  - datos de portero,
  - tarjetas,
  - estado médico,
  - observaciones.
- Agrega edición rápida de jugadores cargados en la planilla de competencia.
- Mantiene los minutos únicamente por jugador, no como KPI global.

## No toca

- Supabase schema obligatorio.
- Autosave.
- Realtime.
- Roles.
- Auditoría.
- GPS U20.
- Wellness público.
- Backups.
- app_state.

## Validación

Ejecutado:

```bash
node scripts/preflight-check.mjs
```

Resultado: Preflight OK.

En PC ejecutar:

```bash
npm install
npm run dev
npm run build
```
