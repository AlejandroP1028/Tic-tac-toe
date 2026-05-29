# Variable Board Sizes + Line-Tally Rounds — Design

**Date:** 2026-05-30
**Status:** Approved (pending spec review)

## Goal

Generalize the online Tic-Tac-Toe from a fixed 3×3 single-win game into a
variable-size, continuous line-tally game:

- The host picks a board size (3×3 up to 8×8) when creating a room.
- Players alternate placing marks until the **entire board is full** (a *round*).
- Every 3-in-a-row scores; when the board fills, the player with more 3-in-a-rows
  wins the round, the result is shown briefly, then the board auto-clears and the
  next round begins with the starting player **alternating** each round.
- The X/O score counters track **rounds won**.

This model applies uniformly to all sizes, including 3×3.

## Rules (precise)

- **Win length** is fixed at **3** for all board sizes.
- A "line" is any run of the same mark in a length-3 sliding window, in any of the
  four directions: horizontal (→), vertical (↓), diagonal down-right (↘), diagonal
  down-left (↙).
- **Overlapping windows count separately.** A run of 4 in one direction = 2 points;
  a run of 5 = 3 points; etc.
- A **round** ends when every cell is filled. The player with the greater line
  tally wins the round (`score += 1`). Equal tallies = a draw, no score change.
- After a round ends, the result displays for ~2 seconds, then the board clears and
  the next round starts.
- The **starting player alternates** by round: round 1 → X starts, round 2 → O,
  round 3 → X, … Within a round, turns alternate normally (X→O→X…).
- Scores (rounds won) persist across rounds.

## Coordination across the two browsers

Chosen approach: **last-mover computes the round result; the auto-reset is
timer-fired but guarded by the round counter.**

1. The move that fills the final cell computes both players' line tallies via
   `countLines`, sets `winner` to the round result, and increments the winner's
   `score_x`/`score_o` — all in one guarded `UPDATE ... WHERE code=? AND turn=me`.
   The existing turn guard prevents any double-count.
2. When `winner` is set (round over), each **seated** client starts a ~2s timer.
   On fire it issues the reset: `board = emptyBoard(size)`, `winner = null`,
   `round = round + 1`, `turn = startingMark(round + 1)`, guarded by
   `.eq("round", currentRound)`. Postgres serializes the writes, so the reset
   applies exactly once even if both timers fire or the last mover disconnected.

This keeps the existing no-server, client-trust model (permissive anon RLS,
client-computed moves) — the same accepted trade-off documented in the original
multiplayer spec.

## Data model

Extend the existing `games` table via a new migration
`supabase/migrations/0002_board_size_and_rounds.sql`:

| column     | change                                                              |
| ---------- | ------------------------------------------------------------------- |
| `size`     | **new** `int not null default 3` — board dimension (3–8)            |
| `round`    | **new** `int not null default 1` — current round; starter parity    |
| `board`    | existing `jsonb` — now holds `size*size` cells                      |
| `winner`   | existing — **reused** as the transient round result (X/O/Draw/null) |
| `score_x`  | existing — now counts **rounds won** by X                           |
| `score_o`  | existing — now counts **rounds won** by O                           |
| `turn`, `player_x`, `player_o`, timestamps | unchanged                           |

Migration content:

```sql
alter table public.games
  add column if not exists size  integer not null default 3,
  add column if not exists round integer not null default 1;
```

(The `winner` check constraint already allows `'X' | 'O' | 'Draw'`; no change. The
`board` default of nine nulls is irrelevant because `createGame` always writes a
correctly sized board.)

## Code structure

### `src/lib/game.ts` (rewrite — still the only unit-tested module)

Remove the hardcoded 3×3 `LINES` and the single-winner `checkWinner`. Add:

- `WIN_LENGTH = 3`.
- types `Mark`, `Cell`, `Board` (unchanged); `Tally = { X: number; O: number }`.
- `emptyBoard(size: number): Board` → `Array(size * size).fill(null)`.
- `isFull(board: Board): boolean`.
- `countLines(board: Board, size: number): Tally` — for each of the 4 directions,
  slide a length-3 window over every valid start cell; if all 3 cells share a
  non-null mark, increment that mark's tally. Returns `{ X, O }`.
- `roundWinner(tally: Tally): Mark | "Draw"` — `X`/`O`/`Draw` by comparison.
- `startingMark(round: number): Mark` — `round % 2 === 1 ? "X" : "O"`.
- `GameRow` interface gains `size: number` and `round: number`.

### `src/lib/room.ts`

`createGame(size: number): Promise<string>` — inserts `board: emptyBoard(size)`,
`turn: "X"`, `size`, `round: 1` (plus `code`). Validates `3 <= size <= 8` before
insert; throws on out-of-range.

### `src/components/HomeMenu.tsx`

Add a labeled number input/stepper (min 3, max 8, default 3) above "New Game".
`handleCreate` passes the chosen size to `createGame(size)`.

### `src/components/OnlineGame.tsx`

- `makeMove(idx)`: block when `game.winner` is set (round over, awaiting replay),
  when `game.turn !== myMark`, or the cell is filled. On a valid move:
  - compute `nextBoard`; if `isFull(nextBoard)`, compute
    `tally = countLines(nextBoard, size)` and `winner = roundWinner(tally)`,
    increment `score_x`/`score_o` for the round winner (none on Draw), and write
    `{ board, winner, score_x?, score_o? }` guarded by `.eq("turn", myMark)`.
  - else write `{ board, turn: other(myMark), winner: null }`.
- New effect: when `game.winner` is set and `myMark` is non-null, start a ~2000ms
  timer that calls `replay()`; clear it on cleanup / dependency change.
- `replay()`: `update({ board: emptyBoard(size), winner: null, round: round + 1,
  turn: startingMark(round + 1) }).eq("code", code).eq("round", round)`.
- Live round tally for display: `countLines(game.board, game.size)`.
- `disabled` for the board: `!myMark || !!game.winner || game.turn !== myMark ||
  !opponentPresent`.

### `src/components/GameBoard.tsx`

- Accept `size: number` and a `roundTally: { X: number; O: number }` (live tally),
  plus a `round: number` for display.
- Render the grid with `style={{ gridTemplateColumns: \`repeat(${size}, 1fr)\` }}`
  instead of the fixed `grid-cols-3`; tighten the gap for larger boards.
- Header: when `winner` set → "X wins the round!" / "O wins the round!" /
  "Round draw!" (with the existing GSAP result animation); else "Turn: X/O".
- Show a live **"This round: X n · O n"** line (from `roundTally`) and the
  **rounds-won** scores (`score_x`/`score_o`), keeping the score-bump animation.
- Reset button → **"Skip round"**: clears the board and advances the round
  (alternating starter) **without** awarding a score. Implemented in `OnlineGame`
  as a `replay()`-style write (no score change).

### `src/components/Box.tsx`

Unchanged. Icons already scale to the cell via `w-2/3 h-2/3`, so they shrink with
the dynamic grid.

## Data flow (one round)

1. Players alternate moves; each move writes the row, both clients re-render from
   the realtime update. The live tally line updates as windows form.
2. The move filling the last cell computes the round winner, increments that
   player's rounds-won score, and sets `winner`.
3. Both seated clients see `winner` set; a ~2s timer fires `replay()`, guarded by
   `round` so exactly one reset lands.
4. The board clears, `round` increments, the next starter is set, and play resumes.

## Error / edge handling

- **Out-of-range size** on create → `createGame` throws; `HomeMenu` shows its
  existing error message. The input is also clamped to 3–8 in the UI.
- **Last mover disconnects after filling the board** → the other seated client's
  timer still fires `replay()`; the round-guarded write succeeds once.
- **Both replay timers fire** → Postgres serializes; the second write matches no
  row (`round` already advanced) and is a harmless no-op.
- **Spectators** never start replay timers and cannot move (board disabled).
- **Reconnect** → existing re-fetch-on-subscribe self-heals current board/round.

## Testing

Vitest over `src/lib/game.ts`:

- `emptyBoard(size)` returns `size*size` nulls for sizes 3 and 5.
- `countLines`: a single horizontal/vertical/diagonal (both diagonals) window;
  an overlapping run of 4 → 2, run of 5 → 3; mixed marks counted independently;
  empty board → `{X:0, O:0}`; a full 3×3 with a known layout → expected tallies.
- `roundWinner`: X-majority → "X", O-majority → "O", equal → "Draw".
- `startingMark`: round 1 → "X", round 2 → "O", round 3 → "X".
- `isFull`: full vs partial board.

No tests for the Supabase/React wiring (kept lean; the risky core is the line
counting, which is pure and fully covered).

## Out of scope (YAGNI)

- Configurable win-length (fixed at 3).
- Highlighting the scored lines on the board.
- Board sizes larger than 8 or smaller than 3.
- Changing the size of an existing room mid-play.
- Accounts, persistent stats, leaderboards.
