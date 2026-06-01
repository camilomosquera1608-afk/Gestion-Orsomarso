# Orsomarso Performance App

Versión: **v135.3** — domain-commands ampliado, decisión unificada en helpers, scouting UI alineada

Este paquete contiene los archivos necesarios para desarrollo y producción:

- `app/` — rutas Next.js (incluye `app/api/wyscout` proxy)
- `components/`, `context/`, `lib/`, `stores/`
- `public/`, `scripts/`, `supabase/`
- configuración Next.js, TypeScript y npm

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`

## Verificar (CI local)

```bash
npm run build
npm test
npm run test:load-risk
```

## Supabase

Esquema consolidado:

- `supabase/schema.sql`
- `supabase/sql/RUN_THIS_IN_SUPABASE.sql`

Migraciones históricas por versión: `sql/archive/` (scripts `SUPABASE_V*.sql`).

## Variables de entorno

Copia `.env.example` a `.env.local` (no commitear secretos).

- Supabase: URL y claves de servicio según `.env.example`
- Wyscout (opcional, solo servidor): `WYSCOUT_API_KEY` en `.env.local`
  - Con clave: `POST /api/wyscout` proxy hacia la API real (`lib/wyscout-api.ts`)
  - Sin clave: respuesta mock para desarrollo; la UI de scouting sigue operativa
  - Jugadores externos: persistencia local vía `stores/scouting-store` (Zustand + `localStorage`), independiente de `AppData`/Supabase por ahora

## Arquitectura de dominio (v135+)

- `lib/domain-commands.ts` — escrituras puras (wellness, cargas externas/internas, sesiones, competencia, evaluaciones CMJ/nutrición/neuro/FMS)
- `lib/domain-validation.ts` — Zod y duplicados
- `lib/player-decision.ts` — `buildPlayerDecisionContext` (perfil + predictivo + científico)
- `lib/report-snapshot.ts` — mismo DTO para informes PDF
- `lib/sync-merge-policies.ts` — políticas local/remoto documentadas
- `category` (ficha) vs `actingCategory` (actividad) — ver comentarios en `lib/access-control.ts`

## Nota de estabilidad

- Supabase con tablas separadas (sin `app_state` legacy)
- Sin mock-data automático en producción
- Roles y permisos activos
- Administración: panel de fusión sync y conflictos locales
