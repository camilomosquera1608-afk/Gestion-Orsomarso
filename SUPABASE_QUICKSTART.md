# Supabase quickstart - 8 minute checklist

## 1. Create a new Supabase project

Do not reuse the old project.

## 2. Run schema

Open **SQL Editor** and run this file:

```txt
supabase/migrations/202604290001_secure_initial_schema.sql
```

## 3. Confirm tables

Check that these tables exist:

- players
- microcycles
- daily_wellness
- daily_internal_loads
- daily_external_loads
- training_sessions
- session_players
- competition_matches
- competition_players
- nutrition_records
- cmj_records
- neuromuscular_records
- fms_records
- medical_notes
- report_exports
- audit_events

## 4. Confirm RLS

Every table must show **RLS enabled**.

## 5. Do not enable production sync yet

For now keep:

```env
NEXT_PUBLIC_ENABLE_REMOTE_SYNC=false
NEXT_PUBLIC_REMOTE_SYNC_MODE=disabled
```

The schema is ready, but the app should stay local until the table-based Supabase adapter is tested.

## 6. GPS rule

GPS/external-load data only applies to `Sub20`.

The database enforces this on `daily_external_loads` with:

```sql
constraint external_loads_u20_only check (category = 'Sub20')
```

## 7. Never create this policy

Do not create public anonymous write policies such as:

```sql
using (true)
with check (true)
```

for anon users.
