# v107.3 - Competencia editable, permisos e informes limpios

## Cambios

- Competencia: el flujo de edición deja claro que el botón permite editar datos generales del partido y los datos individuales de jugadores desde la planilla.
- Competencia: se quitó el KPI de minutos acumulados/globales. Los minutos solo se muestran por jugador.
- Informes de competencia: se eliminó "Minutos total" del resumen y de la portada.
- Informes: se limpió el texto ejecutivo para priorizar jugadores, titulares, suplentes, goles, asistencias e incidencias.
- Jugadores: se agregó permiso centralizado para eliminar jugadores.
- Solo admin ALL con acceso full puede eliminar jugadores.
- category_admin puede editar su categoría, pero no eliminar jugadores por seguridad.

## Archivos principales

- app/competencia/page.tsx
- app/jugadores/page.tsx
- components/competition-report.tsx
- context/app-context.tsx
- lib/access-control.ts
- lib/competition-report.ts
- package.json

## Validación

Ejecutar:

```bash
npm install
npm run dev
npm run build
```
