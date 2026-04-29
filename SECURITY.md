# Seguridad

## Estado actual

Esta versión está preparada para subirse a GitHub sin claves reales y con Supabase apagado por defecto.

## No subir nunca

- `.env`, `.env.local`, `.env.production`, `.env*.local`
- `SUPABASE_SERVICE_ROLE_KEY`
- tokens privados
- backups JSON reales
- PDFs con datos reales de jugadores
- exports de producción
- credenciales reales del staff

## Autenticación actual

La app incluye credenciales locales de demostración para pruebas. No son seguridad real. En producción se debe implementar:

- Supabase Auth.
- Roles por categoría.
- RLS por tabla.
- Políticas por rol y categoría.
- Auditoría de escrituras.

## Supabase

No usar el modelo legacy de una sola fila `app_state` en producción. Ese modelo fue útil para prototipo, pero es frágil y puede causar sobrescrituras completas.

La producción debe usar tablas separadas y RLS.

## GPS

Las métricas GPS y carga externa solo aplican para categoría U20. El resto de categorías no deben ver, requerir, calcular ni reportar GPS.
