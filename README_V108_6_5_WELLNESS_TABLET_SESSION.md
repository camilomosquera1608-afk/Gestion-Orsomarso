# v108.6.5 - Wellness envio, menú tablet/celular y acciones de sesión

## Cambios
- Corrige el formulario público de Wellness: la validación ahora revisa solo las 5 respuestas y ya no falla por campos extra del payload.
- Refuerza la navegación táctil para que tablets/iPad usen el mismo menú inferior y panel "Más" que celular.
- Mantiene sidebar normal en desktop con mouse/trackpad.
- Refuerza estilos de botones de calendario del microciclo para "Planificar", "Editar sesión" y "Eliminar sesión".

## No requiere SQL
No hay migraciones nuevas en esta versión.

## Validación recomendada
```bash
npm install
npm run build
npm run dev
```

Probar:
- /wellness/u20, /wellness/u17, /wellness/u15: completar 5 respuestas y enviar.
- Tablet/iPad: confirmar que aparece barra inferior con "Más".
- Microciclo: Planificar abre sesión con fecha/categoría; Editar sesión abre la sesión guardada; Eliminar sesión solicita confirmación.
