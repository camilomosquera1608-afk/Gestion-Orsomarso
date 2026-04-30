# v102 - Nutrición profesional, auditoría compacta e informes limpios

## Enfoque
- Rediseño del módulo de Nutrición dentro de Valoraciones.
- Auditoría visual compacta en Administración.
- Informes PDF más limpios e institucionales.

## Supabase
Ejecutar antes de desplegar:

```sql
SUPABASE_V102_NUTRITION_PROFESSIONAL.sql
```

La migración agrega columnas nuevas a `nutrition_records` sin borrar datos existentes.

## Verificación sugerida
```bash
npm install
npm run build
```
