# v103 - Mobile premium y PDFs institucionales

## Objetivo

Mejorar la experiencia responsive/mobile y la presentación visual de los informes PDF sin tocar la arquitectura productiva de Supabase, autosave, realtime, roles, auditoría ni reglas de categoría.

## Cambios incluidos

- Navegación móvil inferior con accesos principales y respeto por rol admin.
- Sidebar oculto en tablet/móvil para evitar que tape formularios.
- Ajustes globales de grids, cards, tablas, formularios, inputs y botones para mobile/tablet.
- Mejoras de usabilidad táctil: inputs más altos, foco visible y botones cómodos.
- Tablas con scroll horizontal contenido para evitar overflow de página.
- Sesiones con cards y grillas más estables en móvil.
- Sistema PDF más sobrio: encabezados institucionales, KPIs compactos, tablas limpias y estilos A4.
- Helpers de seguridad visual para PDFs: `getPdfSafeText`, `formatPdfValue`, `formatPdfDate`, `hasPdfValue` y `sanitizeReportData`.
- PDF de sesión más limpio: título institucional, fechas formateadas, resumen ejecutivo más corto y objetivo/observación solo si existen.
- PDF individual con valores nutricionales y físicos más seguros para evitar `undefined`, `null` o `NaN`.

## Archivos principales modificados

- `components/app-shell.tsx`
- `components/sidebar.tsx`
- `components/report-ui.tsx`
- `components/session-report.tsx`
- `components/player-report.tsx`
- `lib/report-utils.ts`
- `app/globals.css`
- `package.json`

## Validación recomendada

```bash
npm install
npm run dev
npm run build
```

Revisar manualmente:

- iPhone/Android pequeño.
- iPhone/Android grande.
- iPad vertical y horizontal.
- PDF de sesión.
- PDF de valoraciones.
- PDF individual.
- PDF de competencia.

## Nota

Esta fase no agrega migraciones nuevas de Supabase. No modifica tablas, permisos, autosave, realtime, perfiles U17/ALL ni la regla GPS solo U20.
