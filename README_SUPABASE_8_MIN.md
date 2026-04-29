# Subida rápida a Supabase

1. Crea un proyecto nuevo en Supabase.
2. Abre **SQL Editor**.
3. Copia y ejecuta todo el archivo:

```txt
SUPABASE_RUN_THIS.sql
```

4. Verifica que todas las tablas tengan RLS activado.
5. Mantén la app en modo local por ahora:

```env
NEXT_PUBLIC_ENABLE_REMOTE_SYNC=false
NEXT_PUBLIC_REMOTE_SYNC_MODE=disabled
```

Este paquete deja Supabase listo con tablas seguras. La conexión de escritura real debe activarse solo después de probar el adaptador de tablas.
