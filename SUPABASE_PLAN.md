# Plan Supabase seguro

## Objetivo

Reemplazar el modelo legacy de `app_state` por tablas separadas con RLS.

## No usar en producción

- Una sola fila JSON con todo el estado.
- Políticas `using (true)` para escritura.
- Escritura anónima pública.
- Service role key en frontend.

## Tablas recomendadas

- `profiles`
- `players`
- `microcycles`
- `daily_wellness`
- `daily_internal_loads`
- `daily_external_loads`
- `training_sessions`
- `training_session_players`
- `competition_matches`
- `competition_match_players`
- `nutrition_records`
- `cmj_records`
- `fms_records`
- `neuromuscular_records`
- `medical_notes`
- `report_exports`
- `audit_log`

## Roles recomendados

- `master`
- `sub15_staff`
- `sub17_staff`
- `sub20_staff`
- `medical_staff`
- `read_only`

## Políticas generales

- Cada tabla con RLS activo.
- Lectura filtrada por categoría o rol.
- Escritura solo para usuarios autenticados.
- U15/U17 no gestionan GPS.
- U20 puede gestionar GPS/carga externa.
- Auditoría para cambios críticos.

## GPS

Crear validaciones de aplicación y, si aplica, restricciones en base de datos para que métricas GPS solo se usen con categoría U20.
