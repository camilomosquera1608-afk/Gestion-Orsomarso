# Fix v135.1 - Acceso visible a Informes

Correccion aplicada:

- Se agrego `Centro informes` al menu principal de escritorio y movil.
- Se agrego `Informes grupo` al menu superior usado por `AppShell`.
- La ruta `/informes` ya muestra el centro de informes.
- La ruta `/informes/grupo` ya contiene los informes grupales: grupo, valoraciones y microciclo.

Ubicacion visible en la app:

- Menu superior: Analisis -> Centro informes
- Menu superior: Analisis -> Informes grupo
- URL directa: `/informes`
- URL directa: `/informes/grupo`

No requiere SQL nuevo.
