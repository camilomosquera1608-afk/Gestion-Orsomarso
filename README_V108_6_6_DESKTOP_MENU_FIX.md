# v108.6.6 - Corrección menú PC

Esta versión corrige únicamente el menú lateral de escritorio.

## Cambios

- El sidebar de PC vuelve a ser una columna vertical estable.
- Se fuerza `flex-direction: column` solo en desktop con mouse/trackpad.
- El sidebar ya no se expande ni se monta encima del contenido.
- El contenido principal vuelve a respetar la columna del menú.
- La navegación móvil/tablet no se modifica.

## No toca

- Supabase
- SQL
- Roles
- Sesiones
- Wellness
- Microciclos
- Competencia
- Informes
- `app_state`
- Legacy

## Validación recomendada

```bash
npm install
npm run build
npm run dev
```
