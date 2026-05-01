# v108.6.1 - Roles de administrador con control total

Esta versión corrige la lógica de permisos antes de ejecutar v108.6.

## Cambios principales

- Todo usuario con rol `admin`, `administración`, `administrador`, `master`, `maestro`, `super_admin` u `owner` queda normalizado como administrador general.
- Todo administrador general recibe automáticamente:
  - alcance `ALL`,
  - acceso `full`,
  - lectura de todas las categorías,
  - edición completa,
  - acceso a Administración,
  - permiso para operar y eliminar dentro de la app.
- Los administradores ya no quedan limitados si Supabase trae `TODO`, `U20`, scope vacío o `access_level` antiguo.
- Los administradores ahora ven la planilla y acciones operativas que antes podían quedar ocultas por condiciones tipo `master`.

## Correcciones operativas

- En Competencia, el administrador puede editar partido y jugadores.
- En Competencia, el administrador puede editar/eliminar registros de jugadores del partido.
- En Competencia, el administrador puede eliminar partidos.
- En Ficha de jugador, el administrador puede editar datos del jugador y novedades físicas.
- En Jugadores, el administrador puede eliminar jugadores visibles.

## No se tocó

- Supabase SQL.
- Sesión única por día.
- Wellness público.
- GPS U20.
- Microciclos.
- Informes.
- app_state.
- Legacy.

## Validación

Se ejecutó:

```bash
node scripts/preflight-check.mjs
```

Resultado: `Preflight OK`.

En el PC ejecutar:

```bash
npm install
npm run build
```
