# v97 Checklist

## Cambios principales

- Login principal con Supabase Auth.
- Selector de área de trabajo en login: U15, U17, U20 o Dirección.
- Modo demo local escondido y opcional.
- Configuración ya no pide correo/contraseña de Supabase.
- Configuración muestra usuario actual, sincronización, respaldos y cierre de sesión.
- Recuperación de contraseña sigue en `/reset-password`.
- Cerrar sesión cierra Supabase y la sesión local de la app.

## Variables recomendadas en Vercel

```env
NEXT_PUBLIC_ENABLE_REMOTE_SYNC=true
NEXT_PUBLIC_REMOTE_SYNC_MODE=table_schema
NEXT_PUBLIC_SUPABASE_URL=https://vhswajlfpnkinwddcdoq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_PUBLISHABLE_KEY
NEXT_PUBLIC_ENABLE_LOCAL_DEMO_AUTH=false
```

## Pruebas rápidas

1. Abrir `/login`.
2. Entrar con correo y contraseña de Supabase.
3. Elegir U20.
4. Entrar a Configuración.
5. Probar Leer Supabase.
6. Probar Enviar a Supabase.
7. Cerrar sesión.
8. Probar Recuperar contraseña.
