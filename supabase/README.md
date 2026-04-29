# Supabase setup - Orsomarso Performance App

Use this folder only with a NEW Supabase project.

## Fast setup

1. Open Supabase Dashboard.
2. Create a new project.
3. Go to SQL Editor.
4. Paste and run:

```sql
supabase/migrations/202604290001_secure_initial_schema.sql
```

## Security defaults

- RLS is enabled on every table.
- Only authenticated users can read/write.
- No public `using (true)` anonymous write policies are included.
- GPS/external-load table is restricted to `category = 'Sub20'`.
- The legacy `app_state` JSON table is not created.

## Important

This migration prepares Supabase safely. The app should remain in local mode until the table-based adapter and Supabase Auth flow are tested.

Do not enable legacy remote sync in production.
