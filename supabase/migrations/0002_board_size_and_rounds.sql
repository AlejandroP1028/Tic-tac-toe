-- Variable board sizes + line-tally rounds.
-- Run this in the Supabase SQL Editor (after 0001_create_games.sql).

alter table public.games
  add column if not exists size  integer not null default 3,
  add column if not exists round integer not null default 1;
