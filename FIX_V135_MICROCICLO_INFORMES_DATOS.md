# v135 — Microciclo, datos compartidos e informes grupales

## Qué corrige

- Sesiones: la vista de sesión y el historial ahora se acotan al microciclo activo por categoría, fecha de inicio/fin y número de sesión.
- Microciclo: el calendario y timeline solo muestran sesiones que pertenecen al rango y categoría del microciclo activo.
- Eliminación de sesión: al borrar una sesión desde microciclo o sesión se eliminan cargas internas, cargas externas/GPS y vínculos directos de competencia si existían. No se elimina wellness diario ni perfil del jugador.
- Datos compartidos: se normalizan vínculos de jugadores, sesiones, cargas y microciclos para reducir registros huérfanos y casos donde un dato aparece en un módulo y falta en otro.
- Informes sin GPS: los reportes individuales ahora muestran una sección profesional cuando la categoría no usa GPS y basan la lectura en wellness, carga interna, RPE, competencia, valoraciones y disponibilidad.
- Nuevo apartado: `/informes/grupo` con informe de grupo, informe de valoraciones e informe de microciclo, exportable usando imprimir/guardar PDF del navegador.
- Llenado práctico: en sesión se agregaron presets rápidos para Base 70/4, Recuperación 35/3 y No participa, además de aplicación global a seleccionados.

## Validación realizada

- `npm ci` OK.
- `npm run preflight` OK.
- `npx tsc --noEmit --pretty false` OK.
- `npm run build` inició la optimización de Next.js, pero el entorno lo cortó por tiempo en `Creating an optimized production build ...` sin mostrar errores de código antes del corte.

## SQL

No requiere SQL nuevo.
