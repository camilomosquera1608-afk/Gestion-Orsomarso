# v108.4 - Corrección de lógica operativa sesión/microciclo/carga

## Objetivo
Centralizar la lectura operativa de sesión para que Sesión, Microciclo, Carga, Dashboard e Informe no calculen estados con reglas diferentes.

## Cambios principales
- Nuevo helper `lib/session-derived.ts` con funciones para detectar sesión por fecha/categoría, planilla asociada, resumen de carga y estado diario.
- Sesión ahora carga siempre la sesión existente para fecha + categoría antes de sugerir un número nuevo.
- El número de sesión guardado se respeta y no se sobrescribe al editar.
- Microciclo ahora muestra actividad real: sesión, jugadores registrados, MIN, RPE, completitud y acción contextual.
- La carga interna se deriva primero desde sesión con `MIN x RPE`; los registros antiguos de carga interna quedan como respaldo.
- El botón contextual de Sesión ya no muestra “Limpiar aviso” como acción principal cuando se está editando.
- El mensaje para usuario maestro/admin se vuelve coherente con permisos de edición.

## Reglas protegidas
- No se toca app_state.
- No se activa legacy.
- No se agregan migraciones SQL nuevas.
- No se cambia Supabase, roles, permisos, Wellness público ni GPS solo U20.

## Validación
- Preflight ejecutado correctamente.
- npm install / npm run build no pudieron validarse en este entorno por timeout de instalación de dependencias.

## Prueba recomendada
1. Entrar a Sesión con U20 y fecha 30/04/2026.
2. Verificar que aparece Sesión 67 si ya existe guardada.
3. Abrir Microciclo y revisar que 30/04 ya no diga “Sin actividad” si tiene jugadores cargados.
4. Editar minutos/RPE y verificar que Carga y Dashboard actualicen los valores derivados.
