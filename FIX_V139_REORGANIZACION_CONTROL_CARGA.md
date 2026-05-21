# FIX V139 - Reorganizacion de seguimiento y control de cargas

## Objetivo
Reducir la cantidad de apartados visibles y convertir el seguimiento de carga/riesgo en un tablero operativo central para el staff.

## Cambios principales

### 1. Nuevo enfoque de navegacion
La navegacion principal queda agrupada en menos bloques:

- Inicio
- Planificacion
- Control de carga
- Jugadores
- Informes
- Sistema

Se quitaron del menu principal entradas duplicadas o secundarias como:

- Plan duplicado
- Alimentacion
- Rendimiento equipo
- Reporte jugador
- Ranking

Las rutas no se eliminaron fisicamente para no romper enlaces antiguos; quedaron ocultas del menu principal o accesibles como subsecciones.

### 2. Control de carga como modulo central
`app/carga/page.tsx` ahora funciona como tablero unificado de:

- carga acumulada
- minutos
- RPE
- ACWR promedio
- riesgo alto/moderado
- jugadores que requieren ajuste de plan
- confianza del dato
- decision diaria por jugador
- dominios de riesgo
- seguimiento GPS/HSR/sprint
- calidad de registros

### 3. Submodulos desde Control de carga
Desde el nuevo tablero se puede entrar a:

- Resumen
- Wellness
- Disponibilidad
- Riesgo detallado
- Calidad del dato

Esto permite mantener la profundidad del sistema sin saturar el menu principal.

### 4. Decisiones trazables
La tabla operativa por jugador muestra:

- decision diaria
- porcentaje recomendado
- riesgo
- carga efectiva del dia
- ACWR
- wellness
- confianza del dato
- motivo principal

## Validaciones ejecutadas

- `npm run preflight`: OK
- `npx tsc --noEmit --pretty false`: OK
- `npm run test:load-risk`: OK

`npm run build` inicio correctamente, pero el entorno corto el proceso por tiempo durante `Creating an optimized production build ...`.
