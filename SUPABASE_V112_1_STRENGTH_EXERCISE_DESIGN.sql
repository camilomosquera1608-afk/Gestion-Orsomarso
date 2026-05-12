-- V112.1 · Diseño de sesión de fuerza
-- Ejecutar si ya tienes creada la tabla strength_sessions y quieres guardar ejercicios planificados.

alter table public.strength_sessions
  add column if not exists exercises jsonb default '[]'::jsonb;

-- V112.2 · Microdosis de fuerza y patrón de movimiento
alter table public.strength_sessions
  add column if not exists intent text default 'Activación',
  add column if not exists movement_pattern text default 'Aceleración';
