create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "app_state_read_all" on public.app_state;
create policy "app_state_read_all"
on public.app_state
for select
using (true);

drop policy if exists "app_state_write_all" on public.app_state;
create policy "app_state_write_all"
on public.app_state
for all
using (true)
with check (true);

insert into public.app_state (id, payload)
values ('orsomarso-primary', '{}'::jsonb)
on conflict (id) do nothing;
