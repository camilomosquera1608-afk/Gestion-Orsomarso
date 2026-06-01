# Continuación del refactor — Gestion Orsomarso

## Ya implementado en esta sesión

- `lib/dates.ts` — fechas unificadas
- `lib/wellness-metrics.ts` — puntuación canónica de wellness
- `lib/load-metrics.ts` — carga interna/externa y `getPlayerDayLoad`
- `lib/utils.ts` — reexporta métricas canónicas (compatibilidad)
- `lib/player-decision.ts` — `buildPlayerDecisionContext()` (perfil + predictivo + científico)
- `lib/domain-validation.ts` — Zod + reglas de duplicados (wellness, carga interna/externa)
- Validación en `context/app-context.tsx` para wellness/cargas + mensaje `writeValidationMessage`
- `daily-plan.ts`, `jugadores/[id]`, `casa-hogar`, `sport-science`, `load-risk-engine` actualizados
- Tests Jest: `lib/__tests__/wellness-metrics.test.ts`, `lib/__tests__/load-metrics.test.ts`

## Completado en refactor v135.2

- `lib/domain-commands.ts` — upsertWellness, upsertInternalLoad, saveTrainingSessionBundle, competencia, microciclos
- `context/app-context.tsx` — orquesta comandos; validación competencia/microciclos; `syncMergeConflicts`
- `lib/report-snapshot.ts` — DTO PDF alineado con `buildPlayerDecisionContext`
- Pantallas: carga, riesgo, informes/jugador-periodo; `getCanonicalPlayers` en home, jugadores, ranking
- `lib/sync-merge-policies.ts` + UI administración
- `app/api/wyscout` + scouting-store vía proxy; scouting-internacional sin Tailwind huérfano
- CI `.github/workflows/ci.yml`; README v135.2; SQL en `sql/archive/`

## Pendiente (opcional)

```
Continúa el refactor de lógica del proyecto Orsomarso Performance App en:
C:\Users\orsom\OneDrive\Desktop\Gestion Orsomarso

Contexto: ya existen lib/dates.ts, wellness-metrics.ts, load-metrics.ts, player-decision.ts, domain-validation.ts. utils.ts reexporta métricas. app-context valida wellness/cargas internas/externas y expone writeValidationMessage.

Objetivo: completar el plan sin romper producción.

1) Arquitectura de escritura
- Crear lib/domain-commands.ts con upsertWellness, upsertInternalLoad, saveTrainingSessionBundle, etc.
- Mover lógica de app-context a comandos; context solo orquesta y persiste.
- Extender domain-validation a competencia, microciclos (usar assertNoDuplicateMatch/assertNoOverlappingMicrocycle en context, no solo en páginas).

2) Decisión unificada en todas las pantallas
- Reemplazar llamadas directas a computePlayerLoadRiskProfile / computePredictiveRisk / computePlayerScientificLoadDecision por buildPlayerDecisionContext en: app/carga, app/riesgo, app/plan-diario, informes/jugador-periodo, lib/daily-plan (ya parcial).
- Crear lib/report-snapshot.ts para informes PDF con el mismo DTO.

3) Métricas y duplicados
- Auditar sport-science.wellnessAverage (ya delega a wellness-metrics).
- Unificar listados con getCanonicalPlayers en home, jugadores, ranking.
- Documentar category (ficha) vs actingCategory (actividad) en access-control y filtros.

4) Sync
- Documentar políticas merge local/remoto por entidad en comentarios + UI de conflictos en administración.
- Opcional: updatedAt en registros críticos.

5) Scouting internacional
- Integrar scouting-store con AppData o API; quitar Tailwind huérfano o añadir Tailwind.
- Proxy Wyscout en app/api/wyscout.

6) Calidad
- Convertir scripts/load-risk-engine.test.ts a Jest o excluirlo del testMatch.
- CI: npm run build && npm test && npm run test:load-risk
- Actualizar README a v135+ y limpiar SQL sueltos en raíz.

Verifica con: npm run build && npm test
No commitear secretos ni .env.local.
```
