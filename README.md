# Orsomarso Performance App

Versión limpia: **v105 - Informes dossier premium + hotfix Administración**

Este paquete contiene solo los archivos necesarios para trabajar la aplicación en desarrollo y producción:

- `app/`
- `components/`
- `context/`
- `lib/`
- `public/`
- `scripts/`
- `supabase/`
- archivos de configuración de Next.js, TypeScript, npm y entorno

No incluye:

- `node_modules/`
- `.next/`
- cachés de compilación
- scripts Python antiguos
- notebooks
- zips de versiones anteriores
- documentos README de versiones viejas
- archivos temporales

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Verificar producción

```bash
npm run build
```

## Supabase

Para un proyecto Supabase nuevo, usar:

```text
SUPABASE_RUN_THIS.sql
```

El esquema consolidado también está en:

```text
supabase/schema.sql
```

Si ya tienes la base de datos actualizada desde las versiones anteriores, esta entrega no requiere una nueva migración obligatoria.

## Variables de entorno

Copia `.env.example` o `.env.vercel.example` a `.env.local` y completa tus variables reales de Supabase.

## Nota de estabilidad

Este paquete mantiene la línea de producción segura:

- Supabase con tablas separadas.
- Sin `app_state` legacy.
- Sin mock-data automático en producción.
- Roles y permisos activos.
- Realtime/autosave sin cambios intencionales.
- Administración restaurada para sesiones admin/master válidas.
- depploy trigger