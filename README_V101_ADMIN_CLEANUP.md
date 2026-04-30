# v101 - Administración y limpieza visual

Esta versión agrega una pantalla interna de administración para usuarios, permisos y auditoría.

## Cambios principales

- Nuevo módulo `/administracion` visible para administradores.
- Gestión de perfiles: rol, categoría, nivel de acceso y estado activo.
- Auditoría visible dentro de la app.
- Textos más cortos y sobrios en login/configuración.
- Compatibilidad con `U17` y `Sub17` en perfiles.
- SQL de soporte: `SUPABASE_V101_ADMIN_AUDIT.sql`.

## Antes de desplegar

1. Ejecutar el contenido de `SUPABASE_V101_ADMIN_AUDIT.sql` en Supabase SQL Editor.
2. Ejecutar localmente:

```bash
npm install
npm run build
```

3. Subir a GitHub con commit sugerido:

```txt
Add administration panel and clean interface copy
```

4. Hacer redeploy en Vercel.

## No subir a GitHub

- `.env.local`
- `.next`
- `node_modules`
- `.vercel`
