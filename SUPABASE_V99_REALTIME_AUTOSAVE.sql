-- Orsomarso Performance App - v99 realtime autosave
-- Run this after v98 roles/audit SQL in the same Supabase project.
-- It enables Postgres changes for the app tables so every user receives updates.
-- It is safe to run multiple times.

begin;

do $$
declare
  t text;
begin
  foreach t in array array[
    'players',
    'microcycles',
    'daily_wellness',
    'daily_internal_loads',
    'daily_external_loads',
    'training_sessions',
    'session_players',
    'competition_matches',
    'competition_players',
    'nutrition_records',
    'cmj_records',
    'neuromuscular_records',
    'fms_records',
    'medical_notes',
    'report_exports',
    'audit_logs'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I replica identity full', t);

      if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
         and not exists (
           select 1
           from pg_publication_tables
           where pubname = 'supabase_realtime'
             and schemaname = 'public'
             and tablename = t
         ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end if;
  end loop;
end $$;

commit;
