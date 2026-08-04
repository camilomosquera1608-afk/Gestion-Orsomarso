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

## Solución de problemas

### Error: "Timeout de conexión" al iniciar sesión
**Causa:** Supabase tiene problemas de rendimiento o está sobrecargado.
**Solución:**
1. Usa el modo demo local (credenciales abajo del formulario de login)
2. Credenciales demo:
   - U15: `Sub15Local` / `local-sub15`
   - U17: `Sub17Local` / `local-sub17`
   - U20: `Sub20Local` / `local-sub20`
   - Dirección: `MaestroLocal` / `local-maestro`

### Error: "QuotaExceededError" en localStorage
**Causa:** localStorage está lleno.
**Solución:** El sistema ahora hace fallback automático a sessionStorage y limpia storage cuando está lleno.

### La aplicación no se actualiza en GitHub/Vercel
**Solución:**
1. Verifica que los commits están en GitHub: `git log --oneline -5`
2. Haz push manual: `git push origin main`
3. Redeploy en Vercel desde el dashboard
4. O espera a que Vercel detecte el nuevo commit

### Supabase marca error de recursos agotados
**Causa:** Demasiadas llamadas simultáneas a Supabase.
**Solución implementada:**
- Polling reducido de 2s a 30s
- Timeouts de sincronización aumentados a 120s
- Priorización de datos locales sobre remotos
- Sistema de fallback automático a modo local

### La aplicación se queda en "cargando"
**Causa:** Error en validación de sesión o conexión con Supabase.
**Solución:** El sistema ahora tiene manejo de errores robusto que permite continuar con sesión local si Supabase falla.

## Configuración de Vercel

El proyecto incluye `vercel.json` para optimizar el despliegue:
- Región: iad1 (Virginia)
- Headers de seguridad configurados
- Compresión activada
- Optimización de paquetes

## Configuración de GitHub Actions

CI/CD automatizado en `.github/workflows/ci.yml`:
- Ejecuta lint, build, test y load-risk tests
- Se activa en push a main/master y pull requests
- Node.js 20 con caché de npm

## Seguridad

Headers de seguridad configurados en `next.config.ts`:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Cache-Control: no-store, no-cache, must-revalidate

## Optimizaciones de rendimiento

- Compresión gzip activada
- Minificación con SWC
- Optimización de imports de lucide-react y framer-motion
- React Strict Mode activado
- Polling optimizado para reducir carga en Supabase
