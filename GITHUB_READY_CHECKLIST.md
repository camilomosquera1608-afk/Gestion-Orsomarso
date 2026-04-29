# GitHub Ready Checklist

## Obligatorio antes de subir

- [ ] `.env.local` no aparece en `git status`.
- [ ] No hay PDFs reales con datos de jugadores.
- [ ] No hay backups JSON reales.
- [ ] No hay claves privadas ni service role keys.
- [ ] `npm run preflight` pasa.
- [ ] `npm run build` pasa localmente.
- [ ] README y documentación están incluidos.

## Comandos sugeridos

```bash
git init
git add .
git status
npm run preflight
npm run build
git commit -m "Prepare secure Supabase table sync deployment"
```
