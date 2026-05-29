# Online Multiplayer Tic-Tac-Toe — Design

**Date:** 2026-05-30
**Status:** Approved (pending spec review)

## Goal

Turn the current single-device, hotseat Tic-Tac-Toe into a real-time online game
where two players on different devices play the same match over the internet.
Players connect via a shareable room code/link. No accounts — identity is
anonymous and per-browser. The existing local hotseat mode is **replaced**, not
kept.

## Stack additions

- **Realtime backend:** Supabase (Postgres + Realtime). No separate server to run;
  works alongside the existing Vercel deployment.
- **New dependency:** `@supabase/supabase-js`.
- **Test framework:** Vitest (new), used only to cover the pure game logic.
- **New env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Data model

One table, `games`. The row is the single source of truth for a match.

| column        | type          | notes                                            |
| ------------- | ------------- | ------------------------------------------------ |
| `code`        | text, PK      | short room code (e.g. `AB3K`), appears in the URL |
| `board`       | jsonb         | array of 9, each `null` / `"X"` / `"O"`          |
| `turn`        | text          | `"X"` or `"O"`, default `"X"`                     |
| `winner`      | text, null    | `"X"` / `"O"` / `"Draw"` / null                  |
| `score_x`     | int           | default 0, survives board resets                 |
| `score_o`     | int           | default 0, survives board resets                 |
| `player_x`    | text, null    | anonymous browser ID that claimed the X seat     |
| `player_o`    | text, null    | anonymous browser ID that claimed the O seat     |
| `created_at`  | timestamptz   | default now()                                    |
| `updated_at`  | timestamptz   | bumped on every write                            |

**RLS:** enabled with permissive policies for the `anon` role (select / insert /
update). This is an accepted trade-off: the game has no login, so there is no
identity to scope rows to. A determined user could tamper with another room's
row. Acceptable for a casual game; documented here so it is a conscious choice,
not an oversight.

**Realtime:** the `games` table is added to the `supabase_realtime` publication
so clients receive Postgres-change events. Realtime **Presence** on the per-room
channel is used to detect whether the opponent is currently connected.

## Code structure

### New library modules (`src/lib/`)

- **`supabase.ts`** — creates and exports the browser Supabase client from the two
  public env vars.
- **`game.ts`** — pure, React-free game logic extracted from today's `BoxParent`:
  - `LINES` — the 8 winning index triples.
  - `type Mark = "X" | "O"`, `type Cell = Mark | null`, `type Board = Cell[]`.
  - `checkWinner(board): Mark | "Draw" | null`.
  - `emptyBoard()` helper.
  This module is the unit covered by Vitest.
- **`playerId.ts`** — `getPlayerId()`: returns a stable random ID for this browser,
  creating and persisting it in `localStorage` on first call.

### Routes (App Router)

- **`src/app/page.tsx`** — home screen:
  - "New Game" button → generates a unique `code`, inserts a `games` row, then
    routes to `/game/<code>`.
  - "Join with code" input → routes to `/game/<code>`.
- **`src/app/game/[code]/page.tsx`** — reads `code` from the route params and
  renders `<OnlineGame code={code} />`.

### Components (`src/components/`)

- **`OnlineGame.tsx`** (`"use client"`) — the online "brain". Responsibilities:
  1. **Load** the game row for `code` (handle "room not found").
  2. **Claim a seat:** conditional update — first visitor whose ID is not yet a
     player takes X (`set player_x = me where player_x is null`), the next takes O.
     A third visitor (both seats taken, not theirs) is a **spectator**.
  3. **Subscribe** to Postgres changes on this row and update local state from
     every event.
  4. **Presence:** join a per-room channel keyed by `code`; surface
     "Waiting for opponent…" vs "Opponent connected".
  5. **Make a move:** on cell click, compute the next board + winner + scores via
     `game.ts`, then write the row with a guard:
     `update ... where code = ? and turn = myMark and board[idx] is null`.
     The guard makes the database reject out-of-turn / occupied-cell writes, so
     the two clients cannot race into an inconsistent state.
  6. **Reset:** writes a cleared board + `winner = null`, keeping the scores.
- **`GameBoard.tsx`** (`"use client"`) — presentational board + score/turn panel
  extracted from today's `BoxParent`. Driven entirely by props: `board`, `turn`,
  `winner`, `scores`, `myMark`, `disabled`, `onCellClick`, `onReset`,
  `opponentConnected`. Keeps the existing GSAP animations (turn slide-in, score
  bump, result pop). Cells are disabled when it is not the player's turn, when the
  player is a spectator, or while the opponent is absent.
- **`Box.tsx`** — unchanged; already a pure presentational cell.

## Data flow (one move)

1. Player X clicks an empty cell. `OnlineGame` checks locally that it is X's turn
   and the cell is empty (fast feedback), computes `nextBoard`, `winner`, updated
   scores via `game.ts`.
2. `OnlineGame` issues the guarded `UPDATE` to Supabase.
3. Supabase persists the row and broadcasts the change to **both** subscribed
   clients (including the mover).
4. Each client renders the new row state. GSAP animations fire on the changes.

Because every client renders from the broadcast row (not from optimistic local
state alone), both screens stay identical.

## Seat / role rules

- First browser ID to claim → **X**, second → **O**.
- A returning player (same `localStorage` ID) re-occupies their seat on refresh.
- Extra visitors are **spectators**: they see the live board but cannot move.
- The board is interactive for a player only when: they hold a seat, it is their
  mark's turn, no winner yet, and the opponent is present.

## Error / edge handling

- **Room not found** → friendly message + link back home.
- **Opponent leaves** (presence drop) → show "Opponent disconnected", disable the
  board until they return.
- **Both seats full** and you are neither → spectator view.
- **Realtime drop/reconnect** → on reconnect, re-fetch the row so state is correct
  even if a change event was missed.
- **Code collision on create** → regenerate the code and retry the insert.

## Testing

- **Vitest** added as a dev dependency with a `test` script.
- Coverage targets the pure `game.ts`:
  - `checkWinner` for each of the 8 winning lines, for both marks.
  - draw detection on a full board with no winner.
  - `null` (game continues) for partial boards.
- No tests for Supabase/React wiring in this iteration (kept lean; the risky core
  is the win logic, which is pure and fully covered).

## Out of scope (YAGNI)

- Accounts / auth, persistent stats, leaderboards.
- Random/public matchmaking queue.
- Server-authoritative move validation (Postgres RPC). The DB `WHERE`-guard is the
  chosen level of authority.
- Keeping the local hotseat mode.
- Chat, rematch lobby, spectator count.
