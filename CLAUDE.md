# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the dev server (Next.js with Turbopack) at http://localhost:3000
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run lint` — run ESLint (`eslint-config-next`)
- `npm test` — run the Vitest unit tests (covers `src/lib/game.ts`); `npm run test:watch` for watch mode

## Architecture

An online, real-time Tic-Tac-Toe game on Next.js 15 (App Router) + React 19 + Tailwind v4, with GSAP animations and Supabase Realtime as the backend. Two browsers play the same match, joined by a shareable room code. No accounts — identity is an anonymous per-browser ID.

- `src/lib/game.ts` — pure, React-free game logic (`LINES`, `checkWinner`, `emptyBoard`, types incl. `GameRow`). The only unit-tested module (`game.test.ts`).
- `src/lib/supabase.ts` — browser Supabase client from the `NEXT_PUBLIC_SUPABASE_*` env vars.
- `src/lib/playerId.ts` — get-or-create anonymous browser ID in localStorage.
- `src/lib/room.ts` — `createGame()` inserts a `games` row with a unique code.
- `src/app/page.tsx` — home; renders `HomeMenu` (New Game / Join by code).
- `src/app/game/[code]/page.tsx` — renders `OnlineGame` for a room code.
- `src/components/OnlineGame.tsx` — online brain: loads the row, claims a seat (1st visitor=X, 2nd=O, rest=spectator), subscribes to Postgres-change + presence events, writes moves with a turn-guarded UPDATE, resets keeping scores.
- `src/components/GameBoard.tsx` — presentational board + score/turn/status panel (props-driven), keeps the GSAP animations.
- `src/components/Box.tsx` — presentational cell; `disabled` suppresses hover preview and clicks.

The `games` table is the single source of truth: each browser renders from realtime row updates, so both screens stay identical. Schema/RLS/realtime setup lives in `supabase/migrations/0001_create_games.sql`. Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).

Player marks are rendered as `lucide-react` icons (`X` blue, `Circle`/O red), not text.

## Conventions

- `@/*` path alias maps to `./src/*` (see `tsconfig.json`).
- TypeScript strict mode is on.
- Any component using hooks, refs, or GSAP must be a client component (`"use client"`).
