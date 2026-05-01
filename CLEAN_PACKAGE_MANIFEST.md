# Paquete limpio Orsomarso v108.6.6

Incluye el proyecto completo limpio para reemplazar la carpeta de trabajo.

## Incluye

- `app/`
- `components/`
- `context/`
- `lib/`
- `public/`
- `scripts/`
- `supabase/`
- configuración Next/TypeScript
- SQL existentes del proyecto
- documentación vigente

## No incluye

- `node_modules/`
- `.next/`
- cachés
- zips anteriores
- notebooks
- archivos Python temporales
- builds generados

## Corrección principal

v108.6.6 corrige únicamente el menú de PC:

- Sidebar vertical estable en desktop.
- El contenido principal respeta el ancho del menú.
- No cambia la navegación móvil/tablet.
- No toca lógica de datos ni Supabase.
