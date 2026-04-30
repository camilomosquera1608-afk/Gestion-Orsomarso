# Orsomarso Performance App - v105 admin profiles fix

Paquete limpio del proyecto completo.

Incluye la correccion para que Administracion pueda listar todos los perfiles autorizados desde Supabase cuando el usuario tenga rol administrador o administrador de categoria con alcance ALL/TODO.

## Importante

Si en Administracion solo aparece un perfil aunque Supabase tenga varios registros, ejecuta en Supabase SQL Editor:

`SUPABASE_FIX_ADMIN_PROFILES_RLS.sql`

Ese archivo no borra datos. Ajusta politicas/RPC de perfiles para permitir que el administrador vea y actualice todos los perfiles.

## Limpieza del paquete

No incluye:

- node_modules
- .next
- tsconfig.tsbuildinfo
- archivos Python
- __pycache__
- notebooks
- zips anteriores
- builds temporales

## Verificacion

Preflight ejecutado correctamente.
