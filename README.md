<img src="public/logo.svg" alt="Wyrdle" height="48">

Wyrdle is a multiplayer word-guessing game. One player creates a game and
gets a 6-character game key; others join with that key and race to guess
the same secret word.

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql)
   — it creates the `rooms`, `players`, `rounds`, `round_state`, and `guesses`
   tables and turns on realtime for `players`/`round_state`/`guesses`. If
   you've run an older version of this file before, re-running it drops and
   recreates everything (fine for a dev project; it only loses test rooms).
3. Copy `.env.local.example` to `.env.local` and fill in your project's URL
   and keys (Project Settings → API in the Supabase dashboard):

   ```bash
   cp .env.local.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by the
     browser for realtime updates and reading players/guesses.
   - `SUPABASE_SERVICE_ROLE_KEY` — used only server-side (API routes) to read
     and write the secret word; never exposed to the browser.

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open two browser windows at [http://localhost:3000](http://localhost:3000)
   to try it with "multiple players."

## How it works

- **Create a game** → `POST /api/rooms` picks a random word, generates a game
  key, and makes you the host.
- **Join a game** → `POST /api/rooms/[code]/join` with the game key adds you
  as a player in that room.
- **Guess** → `POST /api/rooms/[code]/guess` scores your guess server-side
  (the secret word is never sent to the browser until you finish) and stores
  it in Supabase.
- Everyone in the room sees live guess counts and standings via Supabase
  Realtime — no custom WebSocket server needed.
- Each player has their own board and guesses independently within a round,
  but the **round ends for everyone the instant any player solves it** (or
  everyone runs out of guesses) — this is pushed live via the `round_state`
  table, which starts each round with `word` set to `null` and only fills it
  in (for every client to see) the moment the round actually finishes.
- The host can start a new round ("Play again") with a fresh word; win counts
  accumulate across rounds in the same room and drive the leaderboard
  ranking.

## Deploying

Push to GitHub and import the repo on [Vercel](https://vercel.com/new) (free
tier works). Add the same three environment variables from `.env.local` in
the Vercel project settings.
