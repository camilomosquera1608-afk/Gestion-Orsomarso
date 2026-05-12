-- V112.2 · Fuerza con microdosis y patrón de movimiento
-- Ejecutar si ya tienes creada la tabla strength_sessions.

alter table public.strength_sessions
  add column if not exists intent text default 'Activación',
  add column if not exists movement_pattern text default 'Aceleración';
