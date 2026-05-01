# v108.1 - Wellness publico estable y responsive real

## Objetivo
Corregir el formulario Wellness en celular/tablet para que cargue jugadores por categoria, guarde correctamente en Supabase y use mejor el ancho disponible.

## Cambios
- Se reemplaza el badge confuso `Sync error` por estados propios del formulario: Conectado / Modo local / Sin jugadores.
- Se agrega RPC publica segura `submit_public_wellness` para guardar respuestas desde links publicos.
- Se mantiene fallback a upsert directo si la RPC aun no existe.
- Se mejora el layout publico de Wellness para celular y tablet.
- Se reduce el header del formulario publico.
- Se hace mas ancho el contenedor en mobile/tablet y se reducen margenes laterales.
- Se agregan estados Enviando, Exito y Error.

## SQL
Ejecutar si Wellness publico no guarda:

SUPABASE_V108_1_WELLNESS_PUBLIC_RPC.sql

## Validacion esperada
- /wellness/u20 carga solo U20.
- /wellness/u17 carga solo U17.
- /wellness/u15 carga solo U15.
- En celular no aparece el formulario estrecho.
- Enviar wellness guarda o actualiza una respuesta por jugador y fecha.
