-- V110.7 - Escudo rival para informe de competencia
alter table if exists public.competition_matches
  add column if not exists opponent_logo text;

comment on column public.competition_matches.opponent_logo is 'Imagen base64 o URL del escudo rival usada en el informe de competencia.';
