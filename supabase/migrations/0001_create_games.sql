-- Online multiplayer Tic-Tac-Toe: games table
-- Run this in the Supabase SQL Editor (or via the Supabase CLI).

create table if not exists public.games (
  code        text primary key,
  board       jsonb       not null default '[null,null,null,null,null,null,null,null,null]'::jsonb,
  turn        text        not null default 'X' check (turn in ('X','O')),
  winner      text        check (winner in ('X','O','Draw')),
  score_x     integer     not null default 0,
  score_o     integer     not null default 0,
  player_x    text,
  player_o    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Bump updated_at on every write.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

-- Row Level Security.
-- No accounts exist in this app, so there is no identity to scope rows to.
-- These permissive anon policies are a conscious trade-off for a casual game
-- (see the design spec). Anyone with a room code can read/write that room.
alter table public.games enable row level security;

drop policy if exists "anon can read games"   on public.games;
drop policy if exists "anon can create games" on public.games;
drop policy if exists "anon can update games" on public.games;

create policy "anon can read games"
  on public.games for select to anon using (true);

create policy "anon can create games"
  on public.games for insert to anon with check (true);

create policy "anon can update games"
  on public.games for update to anon using (true) with check (true);

-- Realtime: broadcast row changes to subscribed clients.
alter publication supabase_realtime add table public.games;
