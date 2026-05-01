# v108.2 - Mobile completo y fecha activa automática

## Objetivo
Mejorar la experiencia en celular/tablet y asegurar que cada ingreso a la aplicación use por defecto la fecha actual del dispositivo.

## Cambios

### Fecha activa automática
- La app ya no inicia con una fecha fija antigua.
- Al abrir la aplicación, la fecha activa se establece automáticamente al día actual.
- El reset de filtros también vuelve a la fecha actual.
- La detección de microciclo se hace con la fecha actual y la categoría activa.

### Mobile / tablet
- Se reduce la duplicación visual del encabezado contextual en celular.
- Se compactan hero, cards, filtros, inputs y selectores.
- Se mejora el ancho útil en móvil para evitar que la app se vea estrecha.
- Se mantiene padding inferior seguro para que la navegación no tape botones.

### Acceso a todos los apartados en móvil
- La barra inferior mantiene 4 accesos rápidos: Inicio, Jugadores, Valoraciones y Sesión.
- Se agrega botón “Más”.
- “Más” abre un panel móvil con todos los módulos disponibles según permisos:
  - Panel ejecutivo
  - Diario
  - Microciclo
  - Disponibilidad
  - Carga
  - Wellness
  - Alertas
  - Registro
  - Competencia
  - Informes
  - Ranking
  - Configuración
  - Administración, si el usuario tiene permiso

## Archivos modificados
- `context/app-context.tsx`
- `components/sidebar.tsx`
- `app/globals.css`
- `package.json`

## No toca
- Supabase
- SQL
- Roles
- Autosave
- Realtime
- Wellness público
- GPS U20
- Sesiones
- Competencia
- Informes PDF
- app_state
- Legacy

## Validación
- `node scripts/preflight-check.mjs` ejecutado correctamente.
- Ejecutar en PC:

```bash
npm install
npm run build
```
