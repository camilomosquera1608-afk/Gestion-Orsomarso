# V133 - Corrección de coherencia entre apartados

Esta versión corrige incoherencias donde un mismo jugador podía aparecer con wellness calculado en una vista y como "Sin registro" en otra.

## Qué se corrigió

- Se unificó la identidad del jugador por documento o por nombre normalizado + categoría.
- Se deduplican jugadores repetidos al leer plantilla visible.
- Wellness se resuelve por identidad equivalente, no solo por `playerId` exacto.
- Carga, competencia, reportes y disponibilidad ahora suman registros asociados a IDs duplicados del mismo jugador.
- El dashboard ejecutivo y la ficha individual también usan la misma lógica.
- El diagnóstico de configuración ahora alerta si hay jugadores duplicados por identidad.

## Recomendación operativa

Después de desplegar, revisa Configuración > Datos compartidos entre apartados. Si aparece alerta de jugadores duplicados, la app ya los unifica para lectura, pero conviene limpiar la plantilla en Supabase para dejar una sola ficha por jugador.
