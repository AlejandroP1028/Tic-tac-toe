# Disjoint Line Scoring + Scoring-Line Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 3-in-a-row scoring disjoint (no square is part of more than one counted line, in any direction) and draw a persistent, player-colored line over each scored 3-in-a-row, animating its appearance from the just-placed mark.

**Architecture:** A new pure `scoredLines(board, size)` does a single deterministic scan with a global `used` set; `countLines` is redefined to count those lines, so the score and the drawn lines always agree. `GameBoard` renders an SVG overlay (positioned via a measured grid) drawing one line per scored window; newly appeared lines animate a GSAP draw-on and then persist until the board clears. No DB/API/migration changes.

**Tech Stack:** Next.js 16, React 19.2, TypeScript, Tailwind v4, GSAP, Vitest.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/lib/game.ts` (modify) | Add `Line` type + `scoredLines`; redefine `countLines` to derive from it. |
| `src/lib/game.test.ts` (modify) | Update counts to disjoint; add `scoredLines` tests. |
| `src/components/GameBoard.tsx` (rewrite) | SVG line overlay over a measured grid, with draw-on animation. |
| `CLAUDE.md` (modify) | Update the rule description; mention the scoring-line animation. |

`OnlineGame.tsx`, `room.ts`, `Box.tsx`, the DB, and round resolution are unchanged.

---

## Task 1: Disjoint scoring logic (TDD)

**Files:**
- Modify: `src/lib/game.test.ts`
- Modify: `src/lib/game.ts`

- [ ] **Step 1: Replace the test file**

Replace the entire contents of `src/lib/game.test.ts` with:
```ts
import { describe, it, expect } from "vitest";
import {
  scoredLines,
  countLines,
  roundWinner,
  startingMark,
  isFull,
  emptyBoard,
  type Board,
} from "./game";

describe("emptyBoard", () => {
  it("returns size*size nulls", () => {
    expect(emptyBoard(3)).toEqual(Array(9).fill(null));
    expect(emptyBoard(5)).toEqual(Array(25).fill(null));
  });
});

describe("isFull", () => {
  it("is true with no nulls, false otherwise", () => {
    expect(isFull(["X", "O", "X"])).toBe(true);
    expect(isFull(["X", null, "X"])).toBe(false);
  });
});

describe("scoredLines", () => {
  it("finds a single horizontal line with correct cells and mark", () => {
    const board: Board = ["X", "X", "X", null, null, null, null, null, null];
    const lines = scoredLines(board, 3);
    expect(lines).toHaveLength(1);
    expect(lines[0].mark).toBe("X");
    expect([...lines[0].cells].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it("finds a single vertical line", () => {
    const board: Board = ["O", null, null, "O", null, null, "O", null, null];
    const lines = scoredLines(board, 3);
    expect(lines).toHaveLength(1);
    expect(lines[0].mark).toBe("O");
    expect([...lines[0].cells].sort((a, b) => a - b)).toEqual([0, 3, 6]);
  });

  it("finds the down-right diagonal", () => {
    const board: Board = ["X", null, null, null, "X", null, null, null, "X"];
    expect(scoredLines(board, 3)).toHaveLength(1);
  });

  it("finds the down-left diagonal", () => {
    const board: Board = [null, null, "X", null, "X", null, "X", null, null];
    expect(scoredLines(board, 3)).toHaveLength(1);
  });

  it("counts a run of 4 as one disjoint line", () => {
    const board: Board = [
      "X", "X", "X", "X",
      null, null, null, null,
      null, null, null, null,
      null, null, null, null,
    ];
    expect(scoredLines(board, 4)).toHaveLength(1);
  });

  it("counts a run of 6 as two disjoint lines", () => {
    const board: Board = Array(36).fill(null);
    for (let i = 0; i < 6; i++) board[i] = "X";
    expect(scoredLines(board, 6)).toHaveLength(2);
  });

  it("counts a shared centre (+ shape) as one line", () => {
    // size 3: middle row (3,4,5) and middle column (1,4,7) are X, sharing cell 4.
    const board: Board = [null, "X", null, "X", "X", "X", null, "X", null];
    expect(scoredLines(board, 3)).toHaveLength(1);
  });

  it("counts two separate runs as two lines", () => {
    const board: Board = Array(25).fill(null);
    board[0] = board[1] = board[2] = "X";
    board[10] = board[11] = board[12] = "X";
    expect(scoredLines(board, 5)).toHaveLength(2);
  });

  it("returns [] for an empty board", () => {
    expect(scoredLines(emptyBoard(4), 4)).toEqual([]);
  });
});

describe("countLines (derived, disjoint)", () => {
  it("run of 4 counts as 1", () => {
    const board: Board = [
      "X", "X", "X", "X",
      null, null, null, null,
      null, null, null, null,
      null, null, null, null,
    ];
    expect(countLines(board, 4)).toEqual({ X: 1, O: 0 });
  });

  it("run of 6 counts as 2", () => {
    const board: Board = Array(36).fill(null);
    for (let i = 0; i < 6; i++) board[i] = "X";
    expect(countLines(board, 6)).toEqual({ X: 2, O: 0 });
  });

  it("shared centre counts as 1", () => {
    const board: Board = [null, "X", null, "X", "X", "X", null, "X", null];
    expect(countLines(board, 3)).toEqual({ X: 1, O: 0 });
  });

  it("counts marks independently", () => {
    const board: Board = ["X", "X", "X", null, null, null, "O", "O", "O"];
    expect(countLines(board, 3)).toEqual({ X: 1, O: 1 });
  });

  it("returns zero for an empty board", () => {
    expect(countLines(emptyBoard(4), 4)).toEqual({ X: 0, O: 0 });
  });
});

describe("roundWinner", () => {
  it("returns X when X has more lines", () => {
    expect(roundWinner({ X: 3, O: 1 })).toBe("X");
  });
  it("returns O when O has more lines", () => {
    expect(roundWinner({ X: 0, O: 2 })).toBe("O");
  });
  it("returns Draw when equal", () => {
    expect(roundWinner({ X: 2, O: 2 })).toBe("Draw");
  });
});

describe("startingMark", () => {
  it("alternates X, O, X by round", () => {
    expect(startingMark(1)).toBe("X");
    expect(startingMark(2)).toBe("O");
    expect(startingMark(3)).toBe("X");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `scoredLines` is not exported yet, and the disjoint `countLines` counts don't match the current overlapping implementation.

- [ ] **Step 3: Update game.ts**

In `src/lib/game.ts`, add the `Line` interface and `scoredLines`, and redefine `countLines`. Replace the existing `countLines` function with the two functions below (keep everything else — types, `WIN_LENGTH`, `DIRECTIONS`, `emptyBoard`, `isFull`, `roundWinner`, `startingMark`, `GameRow` — as is).

First, add this interface right after the `Tally` type (near the top, after `export type Tally = ...`):
```ts
export interface Line {
  cells: [number, number, number];
  mark: Mark;
}
```

Then replace the entire existing `countLines` function with:
```ts
/**
 * Returns the disjoint set of scored 3-in-a-row lines on the board. A single
 * global pass claims squares (the `used` set), so no square belongs to more than
 * one counted line, in any direction. Cells are listed anchor-first.
 */
export function scoredLines(board: Board, size: number): Line[] {
  const lines: Line[] = [];
  const used = new Set<number>();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const mark = board[row * size + col];
      if (!mark) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const endRow = row + dr * (WIN_LENGTH - 1);
        const endCol = col + dc * (WIN_LENGTH - 1);
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) {
          continue;
        }
        const cells: number[] = [];
        let ok = true;
        for (let k = 0; k < WIN_LENGTH; k++) {
          const idx = (row + dr * k) * size + (col + dc * k);
          if (board[idx] !== mark || used.has(idx)) {
            ok = false;
            break;
          }
          cells.push(idx);
        }
        if (ok) {
          for (const idx of cells) used.add(idx);
          lines.push({ cells: [cells[0], cells[1], cells[2]], mark });
        }
      }
    }
  }
  return lines;
}

export function countLines(board: Board, size: number): Tally {
  const tally: Tally = { X: 0, O: 0 };
  for (const line of scoredLines(board, size)) {
    tally[line.mark]++;
  }
  return tally;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — report the count (should be all green).

- [ ] **Step 5: Type-check (still green — countLines signature unchanged)**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/game.ts src/lib/game.test.ts
git commit -m "feat: disjoint line scoring (no square reused)"
```

---

## Task 2: Scoring-line overlay in GameBoard

**Files:**
- Rewrite: `src/components/GameBoard.tsx`

- [ ] **Step 1: Rewrite GameBoard**

Replace the entire contents of `src/components/GameBoard.tsx` with:
```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { X, Circle } from "lucide-react";
import Box from "./Box";
import { scoredLines, type Board, type Line, type Mark, type Winner } from "@/lib/game";

interface GameBoardProps {
  board: Board;
  size: number;
  turn: Mark;
  winner: Winner;
  round: number;
  scores: { X: number; O: number }; // rounds won
  roundTally: { X: number; O: number }; // live lines this round
  myMark: Mark | null; // null = spectator
  disabled: boolean;
  status: string;
  onCellClick: (idx: number) => void;
  onReset: () => void; // "skip round"
}

const lineKey = (line: Line) => [...line.cells].sort((a, b) => a - b).join("-");

const GameBoard: React.FC<GameBoardProps> = ({
  board,
  size,
  turn,
  winner,
  round,
  scores,
  roundTally,
  myMark,
  disabled,
  status,
  onCellClick,
  onReset,
}) => {
  const turnRef = useRef<HTMLSpanElement>(null);
  const scoreXRef = useRef<HTMLSpanElement>(null);
  const scoreORef = useRef<HTMLSpanElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<{
    w: number;
    h: number;
    gap: number;
  } | null>(null);
  const prevBoardRef = useRef<Board>(board);
  const prevLineKeysRef = useRef<Set<string>>(new Set());
  const lineEls = useRef<Map<string, SVGLineElement>>(new Map());

  const playResultAnimation = (element: HTMLHeadingElement) => {
    gsap.killTweensOf(element);
    const tl = gsap.timeline();
    tl.fromTo(
      element,
      { scale: 0.6, opacity: 0, rotate: -15 },
      { scale: 1.15, opacity: 1, rotate: 0, duration: 0.5, ease: "back.out(1.8)" }
    ).to(element, { scale: 1, duration: 0.3, ease: "power1.out" });
  };

  useEffect(() => {
    if (turnRef.current) {
      gsap.fromTo(
        turnRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }
      );
    }
  }, [turn]);

  useEffect(() => {
    if (winner && resultRef.current) playResultAnimation(resultRef.current);
  }, [winner]);

  useEffect(() => {
    if (scoreXRef.current) {
      gsap.fromTo(
        scoreXRef.current,
        { scale: 1.8 },
        { scale: 1, duration: 1.5, ease: "elastic.out(1, 0.4)" }
      );
    }
  }, [scores.X]);

  useEffect(() => {
    if (scoreORef.current) {
      gsap.fromTo(
        scoreORef.current,
        { scale: 1.8 },
        { scale: 1, duration: 1.5, ease: "elastic.out(1, 0.4)" }
      );
    }
  }, [scores.O]);

  // Measure the grid so the line overlay maps to exact cell centres.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
      setMetrics({ w: rect.width, h: rect.height, gap });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  // Hover preview shows the player's own mark (spectators are disabled anyway).
  const previewMark: Mark = myMark ?? turn;

  // Scored lines are derived from the board, so both clients render identically.
  const lines = scoredLines(board, size);

  // Find the just-placed cell (null -> mark) to orient the draw-on animation.
  let placed = -1;
  const prevBoard = prevBoardRef.current;
  if (prevBoard.length === board.length) {
    for (let i = 0; i < board.length; i++) {
      if (!prevBoard[i] && board[i]) {
        placed = i;
        break;
      }
    }
  }

  // Cell-centre geometry (only meaningful once measured).
  const gap = metrics?.gap ?? 0;
  const cellW = metrics ? (metrics.w - (size - 1) * gap) / size : 0;
  const cellH = metrics ? (metrics.h - (size - 1) * gap) / size : 0;
  const cx = (idx: number) => (idx % size) * (cellW + gap) + cellW / 2;
  const cy = (idx: number) => Math.floor(idx / size) * (cellH + gap) + cellH / 2;
  const strokeW = Math.max(3, Math.min(cellW, cellH) * 0.15);

  // Animate newly appeared lines (draw-on), then remember current keys + board.
  useEffect(() => {
    const prevKeys = prevLineKeysRef.current;
    for (const line of lines) {
      const key = lineKey(line);
      if (!prevKeys.has(key)) {
        const el = lineEls.current.get(key);
        if (el) {
          const len = el.getTotalLength();
          gsap.fromTo(
            el,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration: 0.4, ease: "power2.out" }
          );
        }
      }
    }
    prevLineKeysRef.current = new Set(lines.map(lineKey));
    prevBoardRef.current = board;
  });

  return (
    <div className="flex flex-col md:flex-row justify-center items-center gap-8 bg-white/50 md:border md:border-gray-300 p-6 md:p-8 rounded-xl md:shadow-md w-full max-w-3xl mx-auto">
      <div
        ref={gridRef}
        className="relative w-full max-w-md grid gap-2 md:gap-3"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {board.map((val, idx) => (
          <Box
            key={idx}
            value={val}
            turn={previewMark}
            disabled={disabled}
            onClick={() => onCellClick(idx)}
          />
        ))}
        {metrics && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={metrics.w}
            height={metrics.h}
          >
            {lines.map((line) => {
              const key = lineKey(line);
              const [a, , c] = line.cells;
              const start = placed === c ? c : a;
              const end = start === a ? c : a;
              return (
                <line
                  key={key}
                  ref={(el) => {
                    if (el) lineEls.current.set(key, el);
                    else lineEls.current.delete(key);
                  }}
                  x1={cx(start)}
                  y1={cy(start)}
                  x2={cx(end)}
                  y2={cy(end)}
                  stroke={line.mark === "X" ? "#2563eb" : "#dc2626"}
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
        )}
      </div>

      {/* Right Panel */}
      <div className="w-full md:w-[300px] flex flex-col justify-between space-y-6">
        <h1
          ref={resultRef}
          className={`text-2xl md:text-3xl text-center rounded-md flex h-28 items-center justify-center p-4 transition-all
  ${
    winner
      ? winner === "Draw"
        ? "bg-amber-100"
        : winner === "X"
        ? "bg-blue-100"
        : "bg-red-100"
      : turn === "X"
      ? "bg-blue-100"
      : "bg-red-100"
  }`}
        >
          {winner ? (
            winner === "Draw" ? (
              <span className="text-yellow-600">Round draw!</span>
            ) : (
              <span className={winner === "X" ? "text-blue-600" : "text-red-600"}>
                {winner} wins the round!
              </span>
            )
          ) : (
            <span className="flex items-center gap-2">
              Turn:
              <span ref={turnRef} key={turn}>
                {turn === "X" ? (
                  <X className="w-10 h-10 text-blue-600" />
                ) : (
                  <Circle className="w-10 h-10 text-red-600" />
                )}
              </span>
            </span>
          )}
        </h1>

        <p className="text-center text-sm text-gray-500 min-h-5">{status}</p>

        <section className="space-y-2">
          <h2 className="text-xl">Round {round} — lines this round</h2>
          <div className="flex flex-row gap-6 text-lg font-medium">
            <span className="text-blue-600">X: {roundTally.X}</span>
            <span className="text-red-600">O: {roundTally.O}</span>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl">Rounds won</h2>
          <div className="space-y-2 flex flex-row space-x-4 w-full">
            <div className="flex text-2xl items-center justify-between bg-blue-50 w-full text-blue-600 p-8 rounded">
              <span>X: </span>
              <span ref={scoreXRef} className="font-bold ml-4">
                {" "}
                {scores.X}
              </span>
            </div>
            <div className="flex text-2xl  items-center justify-between bg-red-50 w-full text-red-600 p-8 rounded">
              <span>O:</span>
              <span ref={scoreORef} className="font-bold ml-4">
                {" "}
                {scores.O}
              </span>
            </div>
          </div>
        </section>

        <button
          onClick={onReset}
          className=" bg-gray-100 w-fit self-center text-black px-4 py-2 rounded hover:bg-gray-200 transition"
        >
          Skip round
        </button>
      </div>
    </div>
  );
};

export default GameBoard;
```

- [ ] **Step 2: Type-check, lint, test**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no ESLint warnings or errors.

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/GameBoard.tsx
git commit -m "feat: persistent scoring-line overlay with draw-on animation"
```

---

## Task 3: Build, docs, manual verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build completes with no type or lint errors; routes `/` and `/game/[code]` listed.

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`, in the architecture intro paragraph, change the phrase
`every 3-cell line (any of 4 directions, overlaps count) tallies for its owner`
to:
```
every 3-cell line (any of 4 directions, counted disjointly so no square is reused) tallies for its owner, with a persistent player-colored line drawn over each scored 3-in-a-row
```

Then update the `src/lib/game.ts` bullet to mention `scoredLines`:
```
- `src/lib/game.ts` — pure, React-free logic: `scoredLines` (the disjoint set of scored 3-cell lines — no square reused), `countLines` (per-mark tally derived from it), `roundWinner`, `startingMark`, `isFull`, `emptyBoard(size)`, and the `GameRow` type (incl. `size`, `round`). The only unit-tested module (`game.test.ts`).
```

Then update the `src/components/GameBoard.tsx` bullet:
```
- `src/components/GameBoard.tsx` — presentational dynamic-size grid + an SVG overlay that draws a player-colored line over each scored 3-in-a-row (positions computed from a `ResizeObserver`-measured grid; new lines animate a GSAP draw-on from the just-placed mark and persist until the board clears). Panel shows the round result/turn, live per-round line tally, and rounds-won scores; the button is "Skip round".
```

- [ ] **Step 3: Commit docs**

```bash
git add CLAUDE.md
git commit -m "docs: document disjoint scoring and the scoring-line animation"
```

- [ ] **Step 4: Manual end-to-end verification**

Run `npm run dev` and (the DB needs no changes for this feature):
1. Create a 5×5 game; join from a second browser profile/incognito.
2. Make a 3-in-a-row → a colored line (blue for X, red for O) draws across the three
   cells, starting from the mark you just placed, in BOTH windows.
3. Confirm the line **persists** as you keep playing, and that more scored lines
   accumulate.
4. Make a run of 4 in a single direction → confirm only **one** line is drawn and
   the "lines this round" tally increased by **1** (not 2). A run of 6 → 2 lines.
5. Form a `+` (a horizontal and vertical 3-line sharing one centre cell) → confirm
   only **one** line is drawn/counted.
6. Fill the board → the round resolves on the disjoint counts, scores update, and
   after ~2s the board clears and all lines disappear.
7. Resize the window / check on a narrow viewport → lines stay aligned to the cells.

Expected: all behaviors pass. (Two tabs in the same profile share a player ID and
both become X — use separate profiles/incognito.)

---

## Notes for the implementer

- **No coupled refactor this time:** `countLines` keeps its `(board, size) => Tally`
  signature, so `OnlineGame` is untouched and the repo type-checks after every task.
- **Lines derive from the board:** never store them. Both clients compute identical
  lines from the synced `board`; they persist because they are recomputed each
  render and vanish when the board clears.
- **`scoredLines` order matters and is intentional:** the row-major, fixed-direction
  scan with a global `used` set is what makes overlaps and shared squares count once.
  Do not "optimize" it into per-direction passes.
- **SVG must be absolutely positioned** inside the `relative` grid so it does not
  become a grid item and shift the layout; `pointer-events-none` lets clicks reach
  the cells underneath.
