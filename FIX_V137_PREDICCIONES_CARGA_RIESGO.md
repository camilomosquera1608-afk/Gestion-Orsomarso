# FIX V137 - Predicciones de carga y riesgo

Se ajusto la logica cientifica de carga para que las predicciones usen una carga efectiva consistente en todos los modulos de riesgo, disponibilidad, ACWR, monotonia/strain y decision diaria.

## Formula base

- Carga interna de sesion: `duracion_min * RPE`.
- Carga de competencia sin RPE individual: `minutos_jugados * 8` como estimacion conservadora.
- Carga efectiva diaria: carga interna + cargas externas que no duplican la misma sesion + competencia externa o, si no hay GPS/externa de competencia, planilla de competencia.

## ACWR

- Carga aguda: suma de los ultimos 7 dias, incluyendo entrenamiento y competencia.
- Carga cronica semanal: promedio de las 4 semanas previas completas.
- Ratio: `aguda_7d / cronica_semanal`.
- Zonas:
  - 0.80 a 1.30: zona objetivo.
  - < 0.80: sub-carga / subexposicion.
  - 1.31 a 1.50: precaucion.
  - > 1.50: riesgo alto.

## Monotonia y strain

- Monotonia: `media de cargas diarias de 7 dias / desviacion estandar de cargas diarias`.
- Strain: `carga semanal total * monotonia`.
- La prediccion ahora usa dias sin carga como ceros, porque son parte de la distribucion real del microciclo.

## Riesgo predictivo

El score de riesgo combina:

- ACWR alto o bajo.
- Monotonia/strain semanal.
- Wellness bajo del dia o caida frente a linea base.
- Racha negativa de wellness.
- Dolor alto en regiones clave.
- Retorno abrupto a HSR/sprint tras ausencia.
- Readaptacion con carga neuromuscular alta sin progresion documentada.

## Archivos ajustados

- `lib/utils.ts`
- `lib/predictive-risk.ts`
- `lib/scientific-load.ts`
- `lib/sport-science.ts`
- `lib/strategic-helpers.ts`
- `lib/logic-insights.ts`
- `app/riesgo/page.tsx`
