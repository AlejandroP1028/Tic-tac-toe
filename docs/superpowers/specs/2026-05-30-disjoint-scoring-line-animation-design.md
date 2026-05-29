# Disjoint Line Scoring + Scoring-Line Animation — Design

**Date:** 2026-05-30
**Status:** Approved (pending spec review)

## Goal

Two changes to the variable-size line-tally game:

1. **Disjoint scoring rule.** A square that is already part of a counted 3-in-a-row
   line cannot be part of another counted line — in *any* direction. This replaces
   the current overlapping-window count.
2. **Scoring-line animation.** When a move completes a 3-in-a-row, draw a line in
   the player's color across those three cells, originating from the mark just
   placed. The line **persists** for the rest of the round (lines accumulate) and
   clears when the board resets for the next round.

No database, migration, or realtime/API changes. Round resolution is unchanged
(the round still ends and is scored when the board fills); only the *counting
rule* and the *visual rendering* change.

## Counting rule (precise)

A "line" is a length-3 window of a single mark in one of the four directions
(→, ↓, ↘, ↙). Lines are counted **disjointly**: a single global pass claims
squares so none is reused.

- Run of 4 in one direction = **1** line (the leftover single square cannot form a
  second window).
- Run of 5 = **1**; run of 6 = **2**.
- A square shared by a horizontal and a vertical line (e.g. the centre of a `+`)
  is counted in only **one** of them = **1** line.
- Two genuinely separate runs (no shared squares) each count.

The pass is deterministic so both browsers, computing from the same synced board,
produce identical results.

## Where the lines live

The set of scored lines is **derived from the board**, not stored. Both the score
tally and the rendered lines come from one pure function, `scoredLines(board,
size)`. This guarantees:

- The drawn lines and the score can never disagree.
- Both clients render identical lines from the already-synced `board` (no new DB
  column, no extra realtime payload).
- Lines persist naturally (recomputed each render) and disappear the instant the
  board clears for the next round.

## Code structure

### `src/lib/game.ts`

Add the disjoint scanner and redefine the tally in terms of it:

- `export interface Line { cells: [number, number, number]; mark: Mark }`
- `scoredLines(board: Board, size: number): Line[]` — deterministic scan:
  - Iterate `row` 0..size-1, `col` 0..size-1 (row-major); for each cell, iterate
    `DIRECTIONS` in fixed order `→, ↓, ↘, ↙`.
  - For the length-`WIN_LENGTH` window anchored at `(row, col)` in that direction:
    skip if any cell is out of bounds; skip if the anchor cell is empty; skip if
    any of the 3 cells is already in the `used` set; otherwise require all 3 cells
    equal the anchor's mark. If so, push `{ cells: [i0, i1, i2], mark }` and add
    the 3 flat indices to `used`.
  - Return the collected lines (cells listed in scan order: anchor first).
- `countLines(board, size): Tally` — redefined to derive from `scoredLines`:
  count lines per mark. (Same `Tally` return type; existing callers in
  `OnlineGame` are unchanged.)
- `roundWinner`, `startingMark`, `isFull`, `emptyBoard`, `WIN_LENGTH`,
  `DIRECTIONS`, and all types stay as they are.

### `src/components/GameBoard.tsx`

Add the line overlay. No prop changes (it already receives `board` and `size`).

- Wrap the grid in a `relative` container. Add a `ref` to the grid element.
- Track grid metrics (`width`, `height`, column `gap`) in state, updated via a
  `ResizeObserver` on the grid element plus `getComputedStyle` for the gap. From
  metrics, compute each cell's pixel centre:
  `cellW = (width - (size - 1) * gap) / size` (and `cellH` analogously);
  `cx(col) = col * (cellW + gap) + cellW / 2`; `cy(row)` analogously.
- Render an absolutely-positioned `<svg>` (inset 0, `pointer-events-none`,
  `width`/`height` = grid metrics) overlaying the grid. For each line from
  `scoredLines(board, size)`, draw an `<line>` from the centre of `cells[0]` to the
  centre of `cells[2]`, stroke = blue for X / red for O, rounded caps, a few px
  wide.
- Animation on appearance: keep a `prevBoardRef`. On board change, find the cell
  that went from `null` to a mark (the just-placed cell; none on reset). Build a
  stable key per line (its sorted cell indices). Lines whose key was not present
  last render are **new**: animate a GSAP draw-on (`strokeDashoffset` full→0,
  ~0.4s), oriented to start from the just-placed cell when that cell is one of the
  line's endpoints (otherwise draw from `cells[0]`). Existing lines render
  statically. When the board clears, `scoredLines` returns `[]`, so all lines
  disappear.

### `src/components/OnlineGame.tsx`

No changes. Moves, scoring, auto-replay, and the `countLines(game.board, …)` live
tally all continue to work; the tally now reflects the disjoint count because
`countLines` was redefined.

### `src/components/Box.tsx`

Unchanged.

## Data flow (one scoring move)

1. A player places a mark; `OnlineGame.makeMove` writes the board as today.
2. Both clients receive the new `board` via realtime and re-render `GameBoard`.
3. `GameBoard` computes `scoredLines(board, size)`. Any line whose key is new since
   the previous render animates its draw-on from the placed cell; all current
   lines render (persisting).
4. The live "lines this round" tally (`countLines`) reflects the disjoint count.
5. On the board-filling move, `OnlineGame` tallies with `countLines` (disjoint),
   sets the round winner, and increments the rounds-won score — unchanged logic,
   new counting. After ~2s `nextRound` clears the board; `scoredLines` becomes
   empty and the overlay clears.

## Edge cases

- **Reset / new round:** `prevBoard` differs from the cleared board by many cells;
  the just-placed-cell detection finds no single null→mark change, so no draw-on
  fires and the (now empty) line set renders nothing. Correct.
- **A move completing two lines at once** (placed cell is the junction of a
  horizontal and a vertical run): the disjoint scan credits only one (the shared
  square is consumed by whichever direction the scan reaches first), so exactly one
  line is drawn and scored — consistent by construction.
- **Spectator / opponent view:** identical lines, because they are derived from the
  same synced board. The draw-on animation fires locally on each client as the
  board update arrives.
- **Grid not yet measured (first paint):** until the `ResizeObserver` reports
  metrics, render no overlay (or zero-size); lines appear on the next frame. No
  crash.

## Testing

Vitest over `src/lib/game.ts`:

- `scoredLines`: single horizontal/vertical/both-diagonal windows; run-of-4 → 1
  line; run-of-5 → 1; run-of-6 → 2; `+`-shape shared centre → 1; two separate runs
  → 2; empty board → `[]`; returns correct `mark` and `cells` for a known layout.
- `countLines` (derived): matches the disjoint counts — run-of-4 `{X:1}`,
  run-of-6 `{X:2}`, shared centre `{X:1}`, independent marks counted separately,
  empty → `{X:0,O:0}`.

The SVG overlay and ResizeObserver wiring are presentational and not unit-tested
(the risky core — the disjoint counting — is pure and fully covered).

## Out of scope (YAGNI)

- Persisting scored lines in the database.
- Configurable line color/width/animation timing.
- Animating or highlighting the winning round result beyond the existing GSAP
  result pop.
- Changing when a round resolves (still on board-fill).
