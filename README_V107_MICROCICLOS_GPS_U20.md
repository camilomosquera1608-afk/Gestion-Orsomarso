# v107 - Microciclos por categoria + GPS Catapult U20 base

Esta version separa la planificacion por categoria y agrega una base operativa para datos GPS Catapult solo en U20.

## Cambios principales

### Microciclos por categoria
- Cada microciclo ahora tiene `category`.
- U20, U17 y U15 pueden tener microciclos diferentes en la misma fecha.
- El selector de microciclo muestra solo los microciclos de la categoria activa.
- Diario, Sesion, Carga y Dashboard detectan el microciclo usando fecha + categoria.
- Al crear microciclo se asigna automaticamente a la categoria activa.

### GPS Catapult U20
- GPS sigue restringido a U20.
- U17/U15 no muestran bloque GPS.
- La sesion U20 permite cargar campos base de Catapult:
  - distancia total,
  - velocidad maxima,
  - Player Load,
  - alta velocidad,
  - distancia sprint,
  - ACC,
  - DCC,
  - sprints,
  - RHIE,
  - IMA.
- Centro de carga muestra dashboard Catapult U20 con KPIs y ranking.

### Supabase
Ejecutar primero el archivo recomendado:

`SUPABASE_RUN_THIS.sql`

Ese archivo incluye el refuerzo de administracion/permisos v106 y la migracion v107 de microciclos + GPS.

Si ya ejecutaste v106 y solo quieres aplicar esta fase, puedes ejecutar:

`SUPABASE_V107_MICROCYCLES_GPS.sql`

Los SQL no borran datos. La migracion v107 agrega columnas nuevas y deja los microciclos antiguos como Sub20 para compatibilidad.

## Validacion
- `node scripts/preflight-check.mjs` OK.
- `npm install` no pudo completarse en este entorno por timeout; validar localmente con:

```bash
npm install
npm run dev
npm run build
```

## Commit sugerido

```bash
git add .
git commit -m "Add category microcycles and U20 Catapult GPS dashboard"
git push
```
