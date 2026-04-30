# v106 - Estabilidad, permisos y diagnostico del sistema

Esta version se enfoca en estabilidad operativa, permisos y diagnostico de Administracion.

## Cambios principales

- Se centraliza la lectura de permisos en `lib/access-control.ts`.
- Se normalizan roles antiguos y actuales: `admin`, `administracion`, `category_admin`, `categoria_admin`, `solo_lectura`.
- Se normalizan alcances: `ALL`, `TODO`, `Todas`, `Sub15`, `Sub17`, `Sub20`.
- Se corrige Administracion para mostrar diagnostico de sesion, permisos, Supabase, perfiles y datos.
- Se agrega aviso si Administracion solo lee 1 perfil aunque el admin deberia ver todos.
- Se agrega SQL seguro `SUPABASE_V106_STABILITY_ADMIN.sql` para reforzar RPC/RLS de perfiles.

## SQL requerido

Ejecutar en Supabase SQL Editor:

```sql
SUPABASE_V106_STABILITY_ADMIN.sql
```

No borra datos. No toca tablas deportivas. No usa `app_state`.

## Validacion sugerida

```bash
npm install
npm run dev
npm run build
```

Revisar en Administracion:

- Que aparezca el modulo Administracion.
- Que el usuario admin vea todos los perfiles.
- Que el diagnostico muestre rol, alcance y permiso correctos.
- Que usuarios `solo_lectura` no puedan editar.
- Que `category_admin` solo opere segun su alcance.
