-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)
-- after creating a free project at https://supabase.com.
--
-- This rewrites the schema to support multiple rounds per room with a
-- shared win-count scoreboard, so re-running it drops the old tables
-- (fine for a dev project; existing test rooms are lost).

create extension if not exists pgcrypto;

drop table if exists hints cascade;
drop table if exists guesses cascade;
drop table if exists round_state cascade;
drop table if exists rounds cascade;
drop table if exists players cascade;
drop table if exists rooms cascade;

create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  word_length int not null default 5,
  max_guesses int not null default 6,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  is_host boolean not null default false,
  joined_at timestamptz not null default now()
);

-- Server-only: holds the actual secret word for each round. Never exposed
-- to the browser (no RLS policy for anon/authenticated at all).
create table rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  round_number int not null,
  word text not null,
  created_at timestamptz not null default now(),
  unique (room_id, round_number)
);

-- Public mirror of round status/winner, readable by everyone in the room so
-- realtime can announce "round finished" instantly. `word` stays null while
-- the round is active and is filled in by the server only at finish time,
-- so nothing here ever leaks the secret early.
create table round_state (
  round_id uuid primary key references rounds(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  round_number int not null,
  status text not null default 'active' check (status in ('active', 'finished')),
  winner_player_id uuid references players(id) on delete set null,
  word text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table guesses (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  attempt_number int not null,
  guess text not null,
  result jsonb not null,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  unique (round_id, player_id, attempt_number)
);

-- Server-only: one hint per player per round (never exposed via RLS — the
-- API route that creates it also returns it directly to just that player).
create table hints (
  round_id uuid not null references rounds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  position int not null,
  letter text not null,
  created_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

-- Row Level Security: the server (service role key) bypasses RLS and does
-- all writes. `rooms` and `rounds` have no anon policy at all, so the
-- secret word is never readable by the browser. `players`, `round_state`
-- and `guesses` are readable by anyone, since none of them hold the word.
alter table rooms enable row level security;
alter table players enable row level security;
alter table rounds enable row level security;
alter table round_state enable row level security;
alter table guesses enable row level security;
alter table hints enable row level security;

create policy "players are readable" on players for select using (true);
create policy "round_state is readable" on round_state for select using (true);
create policy "guesses are readable" on guesses for select using (true);

-- Enable realtime so the browser gets live inserts/updates.
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table round_state;
alter publication supabase_realtime add table guesses;
