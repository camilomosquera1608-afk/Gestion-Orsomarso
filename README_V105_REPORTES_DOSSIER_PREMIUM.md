# v105 - Informes premium tipo dossier deportivo

Esta fase mejora la salida visual de los informes PDF de Orsomarso Performance App con una capa institucional tipo dossier deportivo, usando unicamente la informacion real existente en la aplicacion.

## Cambios principales

- Se agrego una portada premium reutilizable para informes PDF.
- Se reforzo el sistema visual compartido de reportes en `components/report-ui.tsx`.
- Se aplicaron portadas y KPIs ejecutivos a:
  - Informe de sesion.
  - Informe individual de jugador.
  - Informe de competencia / postpartido.
  - Informe de valoraciones.
- Se mejoraron los estilos print para A4 vertical.
- Se reforzo `print-color-adjust` para conservar identidad visual en PDF.
- Se mantuvieron reglas de seguridad: no se inventan datos, no se muestran metricas que no existan y no se tocan tablas ni sincronizacion.

## Datos no inventados

Los informes no agregan xG, mapas de calor, radares, redes de pase ni comparativas externas si la app no tiene esos datos. Las nuevas portadas y KPIs usan valores ya calculados o disponibles en los reportes existentes.

## Archivos modificados

- `components/report-ui.tsx`
- `components/session-report.tsx`
- `components/player-report.tsx`
- `components/competition-report.tsx`
- `components/evaluations-report.tsx`
- `lib/report-utils.ts`
- `app/globals.css`
- `package.json`

## Validacion

- `node scripts/preflight-check.mjs` ejecutado correctamente.
- No se agregaron migraciones de Supabase.
- No se modificaron roles, permisos, autosave, realtime, localStorage, auditoria ni reglas U17/ALL/GPS U20.

Antes de desplegar, ejecutar localmente:

```bash
npm install
npm run dev
npm run build
```

Commit sugerido:

```bash
git add .
git commit -m "Create premium dossier-style PDF reports"
git push
```
