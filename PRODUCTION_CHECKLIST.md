# Production safety checklist

## Current status

- App remains local-safe by default.
- Supabase legacy `app_state` sync is blocked unless explicitly enabled.
- New Supabase table schema is available in `supabase/migrations`.

## Before GitHub

- `.env.local` is not committed.
- No real Supabase keys are in the repo.
- No PDF exports with player data are committed.
- No JSON backups with real data are committed.
- Run `npm run preflight`.

## Before Supabase

- Create a NEW Supabase project.
- Run `supabase/migrations/202604290001_secure_initial_schema.sql`.
- Confirm RLS is enabled on all tables.
- Confirm no anonymous write policy exists.
- Keep remote sync disabled until the table adapter is tested.

## Before Vercel

- Add environment variables only in Vercel dashboard.
- Keep remote sync disabled for first preview deploy.
- Run preview deployment first.
- Test with demo data.

## Required environment for safe preview

```env
NEXT_PUBLIC_ENABLE_REMOTE_SYNC=false
NEXT_PUBLIC_REMOTE_SYNC_MODE=disabled
```

## Later, after adapter testing

Only after Supabase Auth + table sync are ready:

```env
NEXT_PUBLIC_ENABLE_REMOTE_SYNC=true
NEXT_PUBLIC_REMOTE_SYNC_MODE=table_schema
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```
