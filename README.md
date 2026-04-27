# Orsomarso SC Performance Hub - versión actualizada v8

## Cambios incluidos

- un solo link de wellness para todos los jugadores
- selección de nombre dentro del mismo formulario
- semáforo visual por cada variable de wellness
- control de microciclo activo editable
- control de número de sesión editable
- tipos de sesión configurados:
  - cdef · Recuperación
  - cdEf · Ejecución
  - cdeF · Condición física
  - Cdef · Comunicación
- módulo de sesión de entrenamiento con HSR, RHIE, ACC, DCC y MIN
- registrar jugador conserva solo el alta de jugadores

## Cómo ejecutar

```bash
npm install
npm run dev
```

Luego abrir en el navegador:

```text
http://localhost:3000
```


## Versión v10
- Edición y eliminación de registros en Valoraciones, Competencia y Sesión de entrenamiento.
- Exportación CSV en Valoraciones, Competencia y Sesión de entrenamiento.


## Versión v11
- Sesión de entrenamiento con selección de jugadores participantes.
- Registro por jugador de MIN, RPE, carga interna, HSR, RHIE, ACC y DCC.
- Cambio rápido de estado del jugador y registro básico de lesión/molestia.


## Versión v12
- Panel de disponibilidad diaria.
- Sesión con objetivo y observación del staff.
- Alertas automáticas en inicio y sesión.
- Línea temporal consolidada por jugador.
- Se mantiene exportación CSV. PDF aún no incluido.


## Versión v13 · Supabase compartido
- Conexión opcional a Supabase con almacenamiento compartido.
- Wellness enviado por jugadores visible en el panel del staff al sincronizar.
- Estado del backend y sincronización visibles en Configuración e Inicio.
- Esquema SQL incluido en `supabase/schema.sql`.
- Variables de entorno ejemplo en `.env.example`.

### Activar Supabase
1. Crea un proyecto en Supabase.
2. Ejecuta `supabase/schema.sql` en el SQL Editor.
3. Crea `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Ejecuta:
   ```bash
   npm install
   npm run dev
   ```

### Nota
La sincronización remota usa una fila compartida (`app_state`) con el estado completo de la app en JSONB para simplificar el uso inmediato entre dispositivos.


## Versión v14
- Login del staff con usuario `Orsomarso` y contraseña `Divisiones2026`.
- Wellness mejorado con sincronización inmediata a Supabase.
- Botón `Actualizar datos` en Inicio para refresco manual del panel.


## Versión v15
- El formulario de wellness inicia en 0 para todas las variables.
- Se agregaron archivos `.bat` para abrir la app del staff y el formulario de jugadores.
- Se incluyó una nota con el formato del link remoto para staff al publicar la app.


## Versión v17
- Nuevo apartado **Informes** con dashboard interactivo por jugador.
- En Nutrición se agregó **sumatoria de pliegues**.
- Informes incluye wellness, carga, HSR/RHIE/ACC, CMJ, nutrición y competencia en un solo dashboard.


## Versión v18
- Informes ahora incluye botón **Exportar PDF** con formato ejecutivo.
- Se agregó el escudo del club al informe.
- Nutrición ahora incluye **sumatoria de pliegues** en formularios, tablas y gráficos.


## Versión v19
- El informe ejecutivo ahora muestra: foto, nombre, edad, posición, nutrición, perfil neuromuscular, FMS y competencia.
- Se eliminaron las notas descriptivas del encabezado para una interfaz más limpia.


## Version v20
- Informe reorganizado en dos apartados: Valoraciones y Competencia.
- Se elimino el texto "Informe ejecutivo individual".
- Se quitaron los KPI de wellness, carga interna y HSR del informe.
- Se agrego una foto con fallback al escudo si la imagen del jugador no esta cargada.
- Encabezados mas limpios en toda la app.


## Version v21
- Carga de fotos desde PC en JPG/PNG al crear jugador y al editar su perfil.
- 51 microciclos creados para seleccion manual.
- Informe con fondo azul claro, portada institucional y secciones mas grandes.
- Titulos de seccion visibles por pagina en Valoraciones y Competencia.
- Interfaz mas limpia sin textos explicativos extensos.


## Version v24
- Wellness rediseñado con formato de encuesta premium y nuevas preguntas.
- Sesión de entrenamiento rediseñada con bloques visuales por jugador.


## Version v25
- El microciclo ahora se escribe manualmente desde los filtros del dashboard.
- Los filtros de posición y estado muestran siempre todas las opciones disponibles.


## Version v26
- Corregido el error de compilacion en la pagina de sesion de entrenamiento para despliegue en Vercel.


## Version v27
- Mejoras responsive para móvil y tablet.
- Los campos numéricos de carga y sesión ahora aparecen vacíos hasta que se diligencian.
- RPE sesión ahora se registra aparte de la plantilla por jugador.


## Version v29
- Mejora fuerte de responsive para celulares y tablets.
- Sidebar más limpia y horizontal en tablet/móvil.
- Cards, filtros, tablas y formularios optimizados para pantallas pequeñas.
- Next.js actualizado a 15.0.7.


## Version v30
- Sesion y competencia ahora usan solo MIN, RPE individual, ACC, DCC, SPRINTS, RHIE e IMA.
- Se removio la vista de carga interna en sesion.
- Jugadores con alta estabilidad: evita duplicados por nombre/id al crear y mantiene orden.
- Responsive mas limpio para celular e iPad.
- Next.js 15.0.7.


## Version v32
- Corregido build de microciclo para campos opcionales hsr/rhie.
