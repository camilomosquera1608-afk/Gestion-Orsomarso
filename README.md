# Orsomarso Performance App

Plataforma local para control deportivo de Orsomarso SC: plantel, microciclos, sesiones, competencia, disponibilidad, carga, wellness, valoraciones e informes.

**Versión base:** v91 - Secure Production Prep  
**Estado:** lista para subir a GitHub como base segura. Supabase y Vercel siguen desactivados.

## Principios de esta versión

- La app funciona en modo local por defecto.
- No se conecta a Supabase automáticamente.
- No incluye claves reales, tokens ni datos privados.
- No usa datos GPS fuera de la categoría U20.
- Los informes usan plantillas de reporte, no capturas de interfaz.
- La autenticación actual es solo una puerta local de demostración; producción debe usar Supabase Auth y RLS.

## Requisitos

- Node.js 20 o superior recomendado.
- npm.

## Instalación local

```bash
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Acceso local de prueba

Estos accesos son placeholders para desarrollo local. No son seguridad de producción.

| Rol | Usuario | Contraseña |
|---|---|---|
| U15 | Sub15Local | local-sub15 |
| U17 | Sub17Local | local-sub17 |
| U20 | Sub20Local | local-sub20 |
| Maestro | MaestroLocal | local-maestro |

Antes de producción se debe reemplazar esta puerta local por Supabase Auth.

## Variables de entorno

Copia `.env.example` a `.env.local` solo en desarrollo local.

```env
NEXT_PUBLIC_ENABLE_REMOTE_SYNC=false
NEXT_PUBLIC_REMOTE_SYNC_MODE=disabled
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ENABLE_LOCAL_DEMO_AUTH=true
```

No actives Supabase en v91. La conexión segura se hará después de crear el esquema por tablas, RLS y políticas.

## Scripts

```bash
npm run dev        # Desarrollo local
npm run build      # Build de producción
npm run start      # Iniciar build generado
npm run preflight  # Revisión básica antes de subir a GitHub
```

## Revisión antes de GitHub

Ejecuta:

```bash
npm run preflight
```

También revisa manualmente:

```bash
git status
git diff --cached
```

No subir:

- `.env`, `.env.local`, `.env.production`
- backups JSON reales
- exports con datos reales
- PDFs con información real
- claves de Supabase
- service role keys
- tokens
- datos privados de jugadores

## Ruta de producción recomendada

1. **v91:** preparar repositorio seguro. Estado actual.
2. **v92:** crear nuevo Supabase con tablas separadas, RLS y políticas seguras.
3. **v93:** adaptar la app a Supabase por tablas, sin `app_state` gigante.
4. **v94:** desplegar preview en Vercel con variables limpias.
5. **v95:** validar producción, respaldos y acceso por roles.

## Documentación incluida

- `SECURITY.md`: criterios de seguridad.
- `DEPLOYMENT.md`: pasos para GitHub, Supabase y Vercel.
- `SUPABASE_PLAN.md`: diseño recomendado para la nueva línea Supabase.
- `VERCEL_PLAN.md`: plan de despliegue seguro en Vercel.
- `PRODUCTION_CHECKLIST.md`: checklist final.

## v93 - Supabase table sync

La conexion remota segura usa `NEXT_PUBLIC_REMOTE_SYNC_MODE=table_schema` y requiere Supabase Auth. No uses `legacy_app_state` en produccion.

Pasos rapidos:

1. Ejecuta `SUPABASE_RUN_THIS.sql` en un proyecto nuevo.
2. Crea un usuario en Supabase Auth.
3. Copia `.env.example` a `.env.local` y configura `table_schema`.
4. Reinicia la app.
5. En Configuracion, inicia sesion remota y usa `Enviar local a Supabase`.

La app sigue guardando respaldo local antes de sincronizar.
