# Prompt para ChatGPT y Claude - Análisis y Recomendaciones de Mejoras

---

## Contexto General

Soy desarrollador de una aplicación web de gestión de rendimiento deportivo para un club de fútbol profesional (Orsomarso FC). La aplicación está diseñada para entrenadores, preparadores físicos y staff médico para monitorear carga de entrenamiento, wellness, disponibilidad de jugadores y rendimiento en competición.

## Descripción de la Aplicación

**Nombre:** Orsomarso Performance App
**Tipo:** Aplicación web de gestión de rendimiento deportivo
**Usuarios:** Entrenadores, preparadores físicos, staff médico, analistas de rendimiento
**Categorías:** Sub15, Sub17, Sub20

## Stack Tecnológico

- **Frontend:** Next.js 15.0.7, React 18, TypeScript (strict mode)
- **UI:** TailwindCSS, Lucide-react icons, shadcn/ui components
- **Estado:** React Context (app-context), TanStack Query para caché
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Validación:** Zod schemas
- **Testing:** Jest (unit tests)
- **Despliegue:** Vercel

## Funcionalidades Principales

### 1. Gestión de Jugadores
- Perfiles completos con datos biométricos, posición, categoría
- Historial de lesiones y restricciones
- Movimientos entre categorías (subir/bajar)
- Estado de disponibilidad (disponible, lesionado, readaptación)
- Fotos y documentos

### 2. Carga de Entrenamiento
- **Carga Interna:** RPE, duración de sesiones, microciclos
- **Carga Externa (GPS):** Distancia total, HSR, sprints, aceleraciones, velocidad máxima, player load
- **Carga Diaria:** Registro de carga por jugador y sesión
- **ACWR (Acute:Chronic Workload Ratio):** Dinámico y específico por posición
- **Fatiga Acumulada:** 7d, 14d, 21d
- **Monotonía y Strain:** Métricas de variabilidad de carga

### 3. Wellness y Respuesta Subjetiva
- **Registro diario:** Sueño, fatiga, estrés, dolor muscular, ánimo (escala 1-5)
- **Body Map:** Registro de molestias corporales por región
- **Adherencia:** Seguimiento de completitud de registros
- **Formulario público:** Para que jugadores reporten wellness desde móvil

### 4. Gestión de Competencia
- **Partidos:** Registro de partidos, oponente, resultado
- **Estadísticas de jugadores:** Goles, asistencias, tarjetas, minutos
- **GPS en competencia:** Métricas físicas durante partidos
- **Métricas de porteros:** Goles concedidos, atajadas, cruces defendidos
- **Alineaciones:** Formación y jugadores titulares/suplentes
- **Importación CSV:** Carga masiva de datos GPS de competencia

### 5. Evaluaciones Técnicas
- **FMS (Functional Movement Screen):** Evaluación de movilidad
- **CMJ (Counter Movement Jump):** Evaluación de fuerza explosiva
- **Evaluaciones personalizadas:** Sistema flexible de evaluaciones técnicas
- **Reportes de evaluación:** PDF con resultados y tendencias

### 6. Session Planner (Planificación de Sesiones)
- **Microciclos:** Planificación semanal de sesiones
- **Tipos de sesión:** MD-5, MD-4, MD-3, MD-2, MD-1, MD, MD+1, MD+2, Recovery
- **Objetivos y observaciones:** Descripción de cada sesión
- **Ajustes individuales:** Modificaciones por jugador

### 7. Motor de Riesgo de Carga
- **ACWR dinámico:** Cálculo en tiempo real basado en posición
- **Alertas predictivas:** Riesgo de lesión basado en carga
- **Decisiones diarias:** Recomendaciones de carga (No campo, Carga reducida, etc.)
- **Dominios de riesgo:** Fatiga, sobrecarga, subexposición, músculo-tendinoso, calidad de dato

### 8. Motor de Predicción
- **Modelo ensemble:** Combinación de regresión, random forest, weighted
- **Features temporales:** Fase de temporada, fase de microciclo
- **Predicción de rendimiento:** Basado en carga histórica y wellness

### 9. Logic Insights (Alertas Contextuales)
- **Insights contextuales:** Basados en día de semana y microciclo
- **Alertas proactivas:** Wellness trend, ACWR antes de competición
- **Alertas de inconsistencias:** Datos faltantes o anómalos

### 10. Ayudas al Usuario
- **Daily Load Assistant:** Recomendaciones de carga diaria basadas en ACWR, wellness y fatiga acumulada
- **Session Planner:** Generación de planes semanales de sesiones
- **Return to Play Manager:** Gestión de retornos a competencia tras lesión

### 11. Reportes y Análisis
- **Reportes de jugador:** PDF con rendimiento, carga, wellness
- **Reportes de equipo:** Análisis comparativo entre jugadores
- **Reportes semanales:** Resumen de carga y rendimiento
- **KPIs:** Tarjetas con métricas clave
- **Gráficos:** Visualizaciones de tendencias (usando Recharts)

### 12. Gestión de Datos
- **Sincronización Supabase:** Modo table_schema y legacy_app_state
- **Backups locales:** Snapshots de estado de aplicación
- **Importación CSV:** Carga masiva de datos
- **Exportación CSV:** Descarga de datos para análisis

## Módulos de la Aplicación

### Páginas Principales
- **Dashboard (`/`):** Vista general con KPIs y alertas
- **Carga (`/carga`):** Centro de carga con ACWR, riesgo y decisiones
- **Wellness (`/wellness`):** Registro y análisis de wellness
- **Disponibilidad (`/disponibilidad`):** Estado médico y restricciones
- **Riesgo (`/riesgo`):** Alertas predictivas detalladas
- **Competencia (`/competencia`):** Gestión de partidos y estadísticas
- **Microciclo (`/microciclo`):** Planificación de sesiones
- **Jugadores (`/jugadores`):** Gestión de perfiles
- **Informes (`/informes`):** Generación de reportes
- **Valoraciones (`/valoraciones`):** Evaluaciones técnicas

## Problemas Actuales de UX

### 1. Paneles de Entrada de Datos
- **Formularios estáticos:** Sin validación en tiempo real ni feedback visual
- **Sin autocompletado inteligente:** No hay sugerencias basadas en datos históricos
- **Sin atajos de teclado:** Todo requiere clicks manuales
- **Sin modo de edición rápida:** Cada campo requiere navegación manual
- **Sin plantillas:** No hay configuraciones predefinidas para sesiones típicas
- **Sin vista previa:** No hay resumen antes de guardar
- **Sin historial:** No se pueden ver cambios recientes ni deshacer

### 2. Flujo de Trabajo
- **Múltiples clics para acciones simples:** Navegación repetitiva
- **Sin vista de contexto:** Difícil ver el estado general mientras se edita
- **Sin modo batch:** No se pueden editar múltiples jugadores a la vez
- **Sin confirmación inteligente:** Guardado sin revisión de cambios

### 3. Experiencia Móvil
- **Formularios no optimizados para móvil:** Difícil usar en dispositivos pequeños
- **Sin gestures táctiles:** No hay soporte para gestos intuitivos
- **Sin entrada por voz:** No hay dictado para campos de texto

## Objetivo del Análisis

Quiero que analices la aplicación y recomiendes mejoras específicas para:

1. **Mejorar la experiencia de entrada de datos:** Hacer que los paneles de entrada sean más dinámicos, rápidos e intuitivos
2. **Optimizar el flujo de trabajo:** Reducir clics y navegación innecesaria
3. **Mejorar la experiencia móvil:** Hacer la aplicación más usable en dispositivos móviles
4. **Agregar funcionalidades que mejoren la productividad:** Atajos, plantillas, autocompletado, etc.
5. **Mejorar la visualización de datos:** Hacer que la información sea más clara y accionable

## Preguntas Específicas

1. ¿Qué patrones de UI/UX recomiendas para formularios de entrada de datos en aplicaciones de gestión deportiva?
2. ¿Cómo podemos hacer que la entrada de datos sea más rápida sin sacrificar la precisión?
3. ¿Qué funcionalidades de autocompletado inteligente serían más útiles?
4. ¿Cómo podemos mejorar la experiencia móvil para entrenadores que usan la aplicación en el campo?
5. ¿Qué atajos de teclado y gestos recomiendas?
6. ¿Cómo podemos implementar un sistema de plantillas para sesiones típicas?
7. ¿Qué tipo de validación en tiempo real sería más útil?
8. ¿Cómo podemos mejorar la visualización de alertas y decisiones diarias?
9. ¿Qué funcionalidades de batch editing recomiendas?
10. ¿Cómo podemos implementar un sistema de historial de cambios y deshacer?

## Contexto Adicional

- **Usuarios:** Entrenadores con poco tiempo, necesitan rapidez y simplicidad
- **Uso:** Principalmente en escritorio, pero creciente uso móvil en campo
- **Frecuencia:** Uso diario para registro de wellness y carga
- **Volumen de datos:** ~50 jugadores, ~3 sesiones/semana, ~1 partido/semana
- **Prioridad:** Rapidez de entrada de datos > funcionalidades avanzadas

Por favor, proporciona recomendaciones específicas, priorizadas y con ejemplos de implementación donde sea posible.
