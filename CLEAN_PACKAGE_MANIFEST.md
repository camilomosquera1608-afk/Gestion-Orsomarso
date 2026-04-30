# Paquete limpio v107.4

Este ZIP contiene el proyecto completo listo para usar como carpeta de trabajo.

Incluye:
- app/
- components/
- context/
- lib/
- public/
- scripts/
- supabase/
- package.json
- tsconfig.json
- next.config.ts
- next-env.d.ts
- .env.example
- .env.vercel.example
- .gitignore
- README.md
- README_V107_4_WELLNESS_CATEGORIAS.md
- SUPABASE_RUN_THIS.sql
- SUPABASE_V107_MICROCYCLES_GPS.sql
- SUPABASE_V107_4_PUBLIC_WELLNESS.sql

No incluye:
- node_modules/
- .next/
- archivos Python
- notebooks
- zips historicos
- cache temporal
- builds locales

## Cambios v107.4

- Links publicos de Wellness por categoria: `/wellness/u20`, `/wellness/u17`, `/wellness/u15`.
- Configuracion muestra links copiables por categoria.
- El formulario Wellness carga jugadores por categoria.
- El formulario Wellness mobile usa una columna y selects compactos.
- SQL seguro para permitir lectura publica de jugadores y registro publico de Wellness.
- No se toca Supabase deportivo salvo politicas RLS especificas de Wellness.
