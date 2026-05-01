# v108 - Dashboard vivo, perfil 360 y permisos admin

## Objetivo
Mejorar la experiencia premium de la app con un dashboard vivo interactivo y ajustar permisos para que los usuarios administradores puedan eliminar jugadores dentro de su alcance.

## Cambios principales
- Rediseño del Panel ejecutivo como Dashboard vivo.
- Filtros por categoría/fecha existentes conectados a métricas operativas.
- Bloque GPS/Catapult visible solo para U20.
- Bloque para U17/U15 basado en minutos, RPE, carga interna y wellness.
- Lista de jugadores prioritarios con alertas.
- Panel de Perfil 360 dentro del dashboard.
- Calidad de datos visible desde el dashboard.
- Accesos rápidos a Sesión, Carga, Wellness, Alertas e Informes.
- Permisos de eliminación de jugadores para administradores generales y administradores de categoría dentro de su alcance.

## Seguridad
No se tocaron Supabase, SQL, autosave, realtime, wellness público, microciclos ni GPS.

## Validación
Ejecutar:

```bash
npm install
npm run build
```
