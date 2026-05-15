# v134 - Corrección real de datos compartidos

Esta versión corrige la lógica de sincronización entre apartados para evitar que un dato aparezca en una vista y falte en otra.

## Qué se corrigió

- Se agregó normalización global de datos compartidos en `normalizeSharedDataLinks`.
- Se consolidan jugadores duplicados por documento o por nombre normalizado + categoría.
- Los registros históricos asociados a IDs duplicados se remapean al jugador canónico.
- Se deduplican registros compartidos por claves naturales:
  - wellness: jugador + fecha + categoría.
  - carga interna: sesión/jugador o jugador/fecha/categoría/sesión.
  - GPS/carga externa: sesión/jugador/módulo o jugador/fecha/categoría/sesión/módulo.
  - competencia: partido/jugador o fecha/rival/jugador.
  - valoraciones: jugador + fecha + categoría.
- El estado del wellness en la pantalla de Wellness ahora usa la fecha activa para tabla, alertas y pendientes. La tendencia sigue usando el periodo.
- Inicio, Parte diario, Microciclo, Alertas operativas y Ranking usan IDs relacionados de jugador para evitar inconsistencias.
- La app normaliza datos al cargar desde Supabase/localStorage y después de cada mutación antes de guardar.

## Resultado esperado

Si un jugador reporta wellness en la fecha activa, debe verse coherentemente en:

- Inicio.
- Centro de wellness.
- Parte diario.
- Disponibilidad.
- Alertas.
- Reportes de jugador.
- Microciclo y carga, cuando corresponda.

Si un jugador no reportó wellness hoy pero sí tiene registros anteriores, la app lo muestra como `Sin registro hoy` y no mezcla ese dato con el promedio histórico como si fuera de la fecha activa.

## Validación local

- `npm run preflight`: OK.
- `npx tsc --noEmit`: OK.
- `npm run build`: inició correctamente, pero el entorno de generación agotó tiempo durante `Creating an optimized production build` sin mostrar errores de código.
