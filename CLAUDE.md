# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the dev server (Next.js with Turbopack) at http://localhost:3000
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run lint` — run ESLint (`eslint-config-next`)
- `npm test` — run the Vitest unit tests (covers `src/lib/game.ts`); `npm run test:watch` for watch mode

## Architecture

An online, real-time variable-size Tic-Tac-Toe on Next.js 16 (App Router, Turbopack) + React 19.2 + Tailwind v4, with GSAP animations and Supabase Realtime as the backend. The host picks a board size (3–8) per room. A round fills the whole board; every 3-cell line (any of 4 directions, counting overlapping windows — a run of 4 = 2, a run of 5 = 3) tallies for its owner, with a persistent player-colored line drawn over each scored 3-in-a-row; the player with more lines wins the round. On a resolved round a GSAP win sequence plays — every scored line slowly replays, the board floats up and toward the viewer, then lands with a weighted drop and bursts the winner's confetti — and that landing drives the next round (clear board, alternating starter). The score counters track rounds won. Two browsers play the same match, joined by a shareable room code. No accounts — identity is an anonymous per-browser ID.

- `src/lib/game.ts` — pure, React-free logic: `scoredLines` (every scored 3-cell window, in all 4 directions; overlapping windows count, so each is anchored at its first cell), `countLines` (per-mark tally derived from it), `roundWinner`, `startingMark` (alternating-starter parity), `isFull`, `emptyBoard(size)`, and the `GameRow` type (incl. `size`, `round`). The only unit-tested module (`game.test.ts`).
- `src/lib/supabase.ts` — browser Supabase client from the `NEXT_PUBLIC_SUPABASE_*` env vars.
- `src/lib/playerId.ts` — get-or-create anonymous browser ID in localStorage.
- `src/lib/room.ts` — `createGame(size)` inserts a `games` row with a unique code.
- `src/app/page.tsx` — home; renders `HomeMenu` (New Game / Join by code).
- `src/app/game/[code]/page.tsx` — renders `OnlineGame` for a room code.
- `src/components/OnlineGame.tsx` — online brain: loads the row, claims a seat (1st visitor=X, 2nd=O, rest=spectator), subscribes to Postgres-change + presence events. A move writes a turn-guarded UPDATE; the move that fills the board tallies lines, sets the round result, and increments the round-winner's score. The win animation drives the reset by calling `nextRound` (clear board, round+1, alternating starter) when the board "lands"; an 8s timer is a fallback (e.g. for a throttled/backgrounded tab). Both are guarded by `round` so the reset applies once across both clients.
- `src/components/GameBoard.tsx` — presentational dynamic-size grid (`gridTemplateColumns: repeat(size, …)`), rendered gapless with single internal cell borders for a flush chessboard look. An SVG overlay draws a 0.6-opacity player-colored line over each scored 3-in-a-row (positions computed from a `ResizeObserver`-measured grid; during play new lines animate a GSAP draw-on from the just-placed mark and persist until the board clears). On a resolved round a GSAP timeline owns the lines: it replays every line, then floats the whole grid up + toward the viewer (z/lift/tilt with perspective set up front to avoid a first-frame snap) and lands with a weighted drop + elastic settle; the landing bursts confetti (winner's color, both on a draw — particles appended to a stable React-empty `confettiRef`) and fires `onWinSequenceEnd` → next round. Panel shows the round result/turn, the live per-round line tally, and rounds-won scores. The button is "Skip round" (advance the round without scoring).
- `src/components/Box.tsx` — presentational cell; `disabled` suppresses hover preview and clicks.

The `games` table is the single source of truth: each browser renders from realtime row updates, so both screens stay identical. Schema/RLS/realtime setup lives in `supabase/migrations/` (`0001_create_games.sql`, `0002_board_size_and_rounds.sql`). Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).

Player marks are rendered as `lucide-react` icons (`X` blue, `Circle`/O red), not text.

## Conventions

- `@/*` path alias maps to `./src/*` (see `tsconfig.json`).
- TypeScript strict mode is on.
- Any component using hooks, refs, or GSAP must be a client component (`"use client"`).
