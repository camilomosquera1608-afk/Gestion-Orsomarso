# FIX V138 - Motor unificado de carga, riesgo y decision diaria

## Objetivo

Esta version corrige la arquitectura de prediccion de carga/riesgo para que el Centro de carga, Riesgo, Plan diario, perfil del jugador y reportes usen una lectura coherente de la carga efectiva.

## Cambios principales

1. Se agrego `lib/load-risk-engine.ts` como motor central.
2. Se separan las familias de carga:
   - carga interna efectiva: sRPE x duracion;
   - volumen externo: minutos, distancia, Player Load;
   - carga neuromuscular: aceleraciones, desaceleraciones, sprint, RHIE;
   - exposicion a alta velocidad/sprint.
3. Se evita duplicar carga cuando una misma sesion existe como carga interna y GPS externo.
4. La competencia entra en la carga efectiva con RPE 8 por defecto si no hay RPE registrado.
5. ACWR se calcula por variable:
   - carga interna efectiva;
   - minutos;
   - HSR;
   - sprint;
   - aceleraciones/deceleraciones;
   - carga neuromuscular;
   - distancia;
   - Player Load.
6. El ACWR principal queda desacoplado:
   - agudo: ultimos 7 dias, incluido el dia de referencia;
   - cronico: promedio semanal de los 28 dias previos;
   - tambien se expone EWMA 7/28 como indicador complementario.
7. Monotonia y strain usan los 7 dias completos, incluyendo dias de carga cero.
8. Se agrego confianza del dato:
   - dias con carga en 28d;
   - semanas cronicas disponibles;
   - adherencia wellness;
   - dias con GPS/carga externa.
9. El sistema ya no entrega un verde fuerte cuando hay historial insuficiente: baja confianza fuerza control preventivo.
10. Se agregan dominios de riesgo trazables:
   - fatiga/recuperacion;
   - sobrecarga;
   - subexposicion;
   - musculo-tendinoso;
   - calidad del dato.
11. Se refuerza la readaptacion: velocidad/sprint o carga neuromuscular alta sin progresion dispara alerta especifica.
12. Se agregaron pruebas automaticas del motor en `scripts/load-risk-engine.test.ts`.

## Comandos validados

```bash
npm run preflight
npx tsc --noEmit --pretty false
npm run test:load-risk
```

`npm run build` inicio correctamente, pero el entorno de ejecucion corto el proceso durante `Creating an optimized production build ...` sin mostrar errores previos de TypeScript.

## Nota metodologica

La app debe interpretarse como sistema de monitoreo y soporte a la decision del staff, no como diagnostico medico ni prediccion absoluta de lesion.
