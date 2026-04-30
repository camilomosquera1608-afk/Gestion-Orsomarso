# v107.1 - Backup seguro y validación antes de carga real U20

Esta fase refuerza la estabilidad antes de cargar datos reales de U20.

## Cambios

- Se agregó checklist de calidad de datos U20 en Configuración.
- Se agregó acción explícita `Crear punto seguro U20`.
- Se reforzó la metadata de backups locales con microciclos, sesiones, partidos y registros GPS.
- La restauración de backups ahora pide confirmación y crea una copia del estado actual antes de restaurar.
- Administración muestra diagnósticos con totales más completos.

## Flujo recomendado antes de cargar U20

1. Copia tu `.env.local`.
2. Ejecuta `npm install`.
3. Ejecuta `npm run dev`.
4. Entra a Configuración.
5. Pulsa `Crear punto seguro U20`.
6. Pulsa `Descargar JSON completo`.
7. Revisa el checklist U20.
8. Carga 5 jugadores U20 de prueba.
9. Refresca y confirma que persisten.
10. Luego carga el resto.

## Validación local

```bash
npm install
npm run dev
npm run build
```

No se agregan migraciones nuevas de Supabase en esta fase.
