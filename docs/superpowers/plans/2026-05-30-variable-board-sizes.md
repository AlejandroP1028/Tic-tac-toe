# Variable Board Sizes + Line-Tally Rounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the fixed 3×3 single-win online game into a variable-size (3–8) line-tally game where players fill the whole board each round, every 3-in-a-row scores, the player with more lines wins the round, and the board auto-replays with an alternating starter.

**Architecture:** A round fills the `size×size` board. The move that fills the last cell tallies both players' 3-cell windows (`countLines`), sets the round result, and increments the round-winner's score in one turn-guarded UPDATE. A ~2s timer then clears the board and advances the round (alternating starter), guarded by the `round` counter so it applies exactly once across both clients. Pure logic lives in `src/lib/game.ts` (Vitest-covered).

**Tech Stack:** Next.js 16 (App Router), React 19.2, TypeScript, Tailwind v4, GSAP, Supabase Realtime, Vitest.

---

## IMPORTANT: coupled-refactor sequencing

This refactor changes `src/lib/game.ts` (removes `checkWinner`/`LINES`, changes `emptyBoard` to take a `size`) and all its consumers. **Repo-wide `npx tsc --noEmit` will report errors in not-yet-migrated files (OnlineGame, room, HomeMenu) until Task 6 is complete.** That is expected. Per-task verification is listed explicitly in each task; the authoritative full `tsc` + `lint` happen in Task 6 and the full `build` + tests in Task 7. Do not be alarmed by type errors in a file that a *later* task owns.

## File structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/0002_board_size_and_rounds.sql` (create) | Add `size`, `round` columns. |
| `src/lib/game.ts` (rewrite) | Pure logic: `countLines`, `roundWinner`, `startingMark`, `isFull`, `emptyBoard(size)`, types incl. extended `GameRow`. |
| `src/lib/game.test.ts` (rewrite) | Vitest coverage for the new logic. |
| `src/lib/room.ts` (modify) | `createGame(size)` with validation. |
| `src/components/GameBoard.tsx` (rewrite) | Dynamic grid, live round tally, rounds-won, "Skip round". |
| `src/components/OnlineGame.tsx` (rewrite) | size/round-aware moves, fill-tally scoring, auto-replay, `nextRound`. |
| `src/components/HomeMenu.tsx` (modify) | Board-size picker. |
| `src/components/Box.tsx` | Unchanged. |
| `CLAUDE.md`, `README.md` (modify) | Document the new gameplay. |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/0002_board_size_and_rounds.sql`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/0002_board_size_and_rounds.sql`:
```sql
-- Variable board sizes + line-tally rounds.
-- Run this in the Supabase SQL Editor (after 0001_create_games.sql).

alter table public.games
  add column if not exists size  integer not null default 3,
  add column if not exists round integer not null default 1;
```

- [ ] **Step 2: Verify the file**

Run (Bash): `cat supabase/migrations/0002_board_size_and_rounds.sql`
Expected: the SQL above. (The migration is run against Supabase by the human before the Task 7 manual test; `next build` does not need it.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_board_size_and_rounds.sql
git commit -m "feat: add size and round columns migration"
```

---

## Task 2: Pure game logic (TDD)

**Files:**
- Rewrite: `src/lib/game.test.ts`
- Rewrite: `src/lib/game.ts`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/lib/game.test.ts` with:
```ts
import { describe, it, expect } from "vitest";
import {
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

describe("countLines", () => {
  it("counts a single horizontal window", () => {
    const board: Board = ["X", "X", "X", null, null, null, null, null, null];
    expect(countLines(board, 3)).toEqual({ X: 1, O: 0 });
  });

  it("counts a single vertical window", () => {
    const board: Board = ["O", null, null, "O", null, null, "O", null, null];
    expect(countLines(board, 3)).toEqual({ X: 0, O: 1 });
  });

  it("counts the down-right diagonal", () => {
    const board: Board = ["X", null, null, null, "X", null, null, null, "X"];
    expect(countLines(board, 3)).toEqual({ X: 1, O: 0 });
  });

  it("counts the down-left diagonal", () => {
    const board: Board = [null, null, "X", null, "X", null, "X", null, null];
    expect(countLines(board, 3)).toEqual({ X: 1, O: 0 });
  });

  it("counts overlapping windows in a run of 4 as 2", () => {
    const board: Board = [
      "X", "X", "X", "X",
      null, null, null, null,
      null, null, null, null,
      null, null, null, null,
    ];
    expect(countLines(board, 4)).toEqual({ X: 2, O: 0 });
  });

  it("counts a run of 5 as 3 windows", () => {
    const board: Board = Array(25).fill(null);
    board[0] = board[1] = board[2] = board[3] = board[4] = "X";
    expect(countLines(board, 5)).toEqual({ X: 3, O: 0 });
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
Expected: FAIL — `countLines`, `roundWinner`, `startingMark`, `isFull` are not exported (and `checkWinner`/`LINES` no longer exist).

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `src/lib/game.ts` with:
```ts
export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Board = Cell[];
export type Winner = Mark | "Draw" | null;
export type Tally = { X: number; O: number };

export const WIN_LENGTH = 3;

// [dRow, dCol] for the 4 line directions: →, ↓, ↘, ↙
const DIRECTIONS: readonly [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function emptyBoard(size: number): Board {
  return Array(size * size).fill(null);
}

export function isFull(board: Board): boolean {
  return board.every(Boolean);
}

/**
 * Counts every length-WIN_LENGTH window of a single mark, in all 4 directions.
 * Each window is anchored at its first cell, so overlapping runs count multiple
 * times (a run of 4 in one direction = 2 windows).
 */
export function countLines(board: Board, size: number): Tally {
  const tally: Tally = { X: 0, O: 0 };
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
        let win = true;
        for (let k = 1; k < WIN_LENGTH; k++) {
          if (board[(row + dr * k) * size + (col + dc * k)] !== mark) {
            win = false;
            break;
          }
        }
        if (win) tally[mark]++;
      }
    }
  }
  return tally;
}

export function roundWinner(tally: Tally): Mark | "Draw" {
  if (tally.X > tally.O) return "X";
  if (tally.O > tally.X) return "O";
  return "Draw";
}

export function startingMark(round: number): Mark {
  return round % 2 === 1 ? "X" : "O";
}

/** Shape of a row in the Supabase `games` table. */
export interface GameRow {
  code: string;
  board: Board;
  turn: Mark;
  winner: Winner;
  score_x: number;
  score_o: number;
  player_x: string | null;
  player_o: string | null;
  size: number;
  round: number;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all `game.test.ts` assertions green. (Do NOT run repo-wide `npx tsc --noEmit` yet; consumers are updated in later tasks.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/game.ts src/lib/game.test.ts
git commit -m "feat: line-tally game logic for variable board sizes"
```

---

## Task 3: Room creation with size

**Files:**
- Modify: `src/lib/room.ts`

- [ ] **Step 1: Update createGame**

Replace the entire contents of `src/lib/room.ts` with:
```ts
import { supabase } from "./supabase";
import { emptyBoard } from "./game";

// Unambiguous alphabet (no 0/O/1/I) for codes that are easy to share aloud.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 4): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/**
 * Inserts a fresh game row of the given board size and returns its code.
 * Retries on the rare code collision (Postgres unique-violation 23505).
 */
export async function createGame(size: number): Promise<string> {
  if (!Number.isInteger(size) || size < 3 || size > 8) {
    throw new Error("Board size must be an integer between 3 and 8.");
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await supabase.from("games").insert({
      code,
      board: emptyBoard(size),
      turn: "X",
      size,
      round: 1,
    });
    if (!error) return code;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique room code; please try again.");
}
```

- [ ] **Step 2: Verify the file**

Run (Bash): `cat src/lib/room.ts`
Expected: matches the content above. (Repo-wide `tsc` is still expected to be red because `HomeMenu` still calls `createGame()` with no argument — fixed in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/room.ts
git commit -m "feat: createGame takes a board size"
```

---

## Task 4: Presentational GameBoard (dynamic grid + tallies)

**Files:**
- Rewrite: `src/components/GameBoard.tsx`

- [ ] **Step 1: Rewrite GameBoard**

Replace the entire contents of `src/components/GameBoard.tsx` with:
```tsx
"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { X, Circle } from "lucide-react";
import Box from "./Box";
import type { Board, Mark, Winner } from "@/lib/game";

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

  // Hover preview shows the player's own mark (spectators are disabled anyway).
  const previewMark: Mark = myMark ?? turn;

  return (
    <div className="flex flex-col md:flex-row justify-center items-center gap-8 bg-white/50 md:border md:border-gray-300 p-6 md:p-8 rounded-xl md:shadow-md w-full max-w-3xl mx-auto">
      <div
        className="w-full max-w-md grid gap-2 md:gap-3"
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

- [ ] **Step 2: Verify the file**

Run (Bash): `cat src/components/GameBoard.tsx`
Expected: matches the content above. (Repo-wide `tsc` still red until OnlineGame and HomeMenu are updated.)

- [ ] **Step 3: Commit**

```bash
git add src/components/GameBoard.tsx
git commit -m "feat: dynamic-size board with live line tally and rounds-won"
```

---

## Task 5: OnlineGame (size/round-aware moves + auto-replay)

**Files:**
- Rewrite: `src/components/OnlineGame.tsx`

- [ ] **Step 1: Rewrite OnlineGame**

Replace the entire contents of `src/components/OnlineGame.tsx` with:
```tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/playerId";
import {
  countLines,
  emptyBoard,
  isFull,
  roundWinner,
  startingMark,
  type GameRow,
  type Mark,
} from "@/lib/game";
import GameBoard from "./GameBoard";

const OnlineGame: React.FC<{ code: string }> = ({ code }) => {
  const [game, setGame] = useState<GameRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [myMark, setMyMark] = useState<Mark | null>(null);
  const [opponentPresent, setOpponentPresent] = useState(false);

  // Resolve our seat (claiming X or O if free), then load the row.
  useEffect(() => {
    const playerId = getPlayerId();
    let cancelled = false;

    const init = async () => {
      const { data: row, error } = await supabase
        .from("games")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (cancelled) return;
      if (error || !row) {
        setNotFound(true);
        return;
      }

      let current = row as GameRow;

      if (current.player_x === playerId) setMyMark("X");
      else if (current.player_o === playerId) setMyMark("O");
      else if (!current.player_x) {
        const { data } = await supabase
          .from("games")
          .update({ player_x: playerId })
          .eq("code", code)
          .is("player_x", null)
          .select()
          .maybeSingle();
        if (data) {
          current = data as GameRow;
          setMyMark("X");
        }
      }

      if (
        !cancelled &&
        current.player_x !== playerId &&
        current.player_o !== playerId &&
        !current.player_o
      ) {
        const { data } = await supabase
          .from("games")
          .update({ player_o: playerId })
          .eq("code", code)
          .is("player_o", null)
          .select()
          .maybeSingle();
        if (data) {
          current = data as GameRow;
          setMyMark("O");
        }
      }

      if (!cancelled) setGame(current);
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Subscribe to row changes + presence.
  useEffect(() => {
    const playerId = getPlayerId();
    const channel = supabase
      .channel(`game:${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `code=eq.${code}` },
        (payload) => setGame(payload.new as GameRow)
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ playerId: string }>();
        const present = Object.values(state)
          .flat()
          .some((p) => p.playerId !== playerId);
        setOpponentPresent(present);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ playerId });
          // Re-fetch on (re)connect so a missed change event self-heals.
          const { data } = await supabase
            .from("games")
            .select("*")
            .eq("code", code)
            .maybeSingle();
          if (data) setGame(data as GameRow);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  const makeMove = async (idx: number) => {
    if (!game || !myMark) return;
    if (game.winner || game.turn !== myMark || game.board[idx]) return;

    const board = [...game.board];
    board[idx] = myMark;

    let update: Partial<GameRow>;
    if (isFull(board)) {
      const tally = countLines(board, game.size);
      const winner = roundWinner(tally);
      update = { board, winner };
      if (winner === "X") update.score_x = game.score_x + 1;
      if (winner === "O") update.score_o = game.score_o + 1;
    } else {
      update = { board, turn: myMark === "X" ? "O" : "X", winner: null };
    }

    // turn guard: the DB rejects the write if it is no longer our turn,
    // which also prevents any double score increment on the filling move.
    const { data } = await supabase
      .from("games")
      .update(update)
      .eq("code", code)
      .eq("turn", myMark)
      .select()
      .maybeSingle();
    if (data) setGame(data as GameRow);
  };

  // Clear the board and start the next round (alternating starter), keeping
  // scores. Guarded by `round` so it applies exactly once across both clients.
  const nextRound = useCallback(async () => {
    if (!game || !myMark) return;
    const next = game.round + 1;
    const { data } = await supabase
      .from("games")
      .update({
        board: emptyBoard(game.size),
        winner: null,
        round: next,
        turn: startingMark(next),
      })
      .eq("code", code)
      .eq("round", game.round)
      .select()
      .maybeSingle();
    if (data) setGame(data as GameRow);
  }, [game, myMark, code]);

  // Auto-replay ~2s after a round ends (board full). Only seated players run the
  // timer; the round guard in nextRound makes the reset idempotent.
  useEffect(() => {
    if (!game?.winner || !myMark) return;
    const timer = setTimeout(() => {
      nextRound();
    }, 2000);
    return () => clearTimeout(timer);
  }, [game?.winner, myMark, nextRound]);

  if (notFound) {
    return (
      <div className="w-screen h-screen flex flex-col justify-center items-center space-y-4">
        <h1 className="text-3xl font-medium">Room &ldquo;{code}&rdquo; not found</h1>
        <Link href="/" className="text-blue-600 underline">
          Back to home
        </Link>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="w-screen h-screen flex justify-center items-center">
        <p className="text-xl text-gray-500">Loading room&hellip;</p>
      </div>
    );
  }

  const status = !opponentPresent
    ? "Waiting for opponent…"
    : myMark
    ? "Opponent connected"
    : "Spectating";

  const disabled =
    !myMark || !!game.winner || game.turn !== myMark || !opponentPresent;

  const roundTally = countLines(game.board, game.size);

  return (
    <div className="w-screen min-h-screen flex flex-col justify-center items-center space-y-8 py-10">
      <div className="flex flex-col items-center space-y-2">
        <h1 className="text-3xl font-medium">Room {code}</h1>
        <p className="text-sm text-gray-500">
          {myMark ? `You are ${myMark}` : "Spectator"} &middot; {game.size}×{game.size} board &middot; share this code to invite a friend
        </p>
      </div>
      <GameBoard
        board={game.board}
        size={game.size}
        turn={game.turn}
        winner={game.winner}
        round={game.round}
        scores={{ X: game.score_x, O: game.score_o }}
        roundTally={roundTally}
        myMark={myMark}
        disabled={disabled}
        status={status}
        onCellClick={makeMove}
        onReset={nextRound}
      />
    </div>
  );
};

export default OnlineGame;
```

- [ ] **Step 2: Verify the file**

Run (Bash): `cat src/components/OnlineGame.tsx`
Expected: matches the content above. (Repo-wide `tsc` still red until HomeMenu is updated in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add src/components/OnlineGame.tsx
git commit -m "feat: size/round-aware moves, fill-tally scoring, auto-replay"
```

---

## Task 6: Home menu size picker (closes the refactor)

**Files:**
- Modify: `src/components/HomeMenu.tsx`

- [ ] **Step 1: Add the size picker**

Replace the entire contents of `src/components/HomeMenu.tsx` with:
```tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createGame } from "@/lib/room";

const HomeMenu: React.FC = () => {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [size, setSize] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const newCode = await createGame(size);
      router.push(`/game/${newCode}`);
    } catch {
      setError("Could not create a game. Please try again.");
      setBusy(false);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed) router.push(`/game/${trimmed}`);
  };

  return (
    <div className="flex flex-col items-center space-y-6 w-full max-w-sm">
      <div className="flex items-center justify-between w-full gap-3">
        <label htmlFor="size" className="text-lg">
          Board size
        </label>
        <div className="flex items-center gap-2">
          <input
            id="size"
            type="number"
            min={3}
            max={8}
            value={size}
            onChange={(e) =>
              setSize(Math.min(8, Math.max(3, Number(e.target.value) || 3)))
            }
            className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-center"
          />
          <span className="text-gray-500">
            {size}×{size}
          </span>
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={busy}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg hover:bg-blue-700 transition disabled:opacity-50 w-full"
      >
        {busy ? "Creating…" : "New Game"}
      </button>

      <div className="flex items-center w-full gap-3 text-gray-400">
        <hr className="flex-1 border-gray-300" />
        <span className="text-sm">or</span>
        <hr className="flex-1 border-gray-300" />
      </div>

      <form onSubmit={handleJoin} className="flex w-full gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter room code"
          maxLength={4}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          className="bg-gray-100 text-black px-5 py-3 rounded-lg hover:bg-gray-200 transition"
        >
          Join
        </button>
      </form>

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
};

export default HomeMenu;
```

- [ ] **Step 2: Full type-check and lint (now green)**

Run: `npx tsc --noEmit`
Expected: no errors (all consumers now migrated).

Run: `npm run lint`
Expected: no ESLint warnings or errors.

Run: `npm test`
Expected: PASS (all `game.test.ts` assertions).

- [ ] **Step 3: Commit**

```bash
git add src/components/HomeMenu.tsx
git commit -m "feat: board-size picker on the home menu"
```

---

## Task 7: Build, docs, and manual verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build completes with no type or lint errors; routes `/` and `/game/[code]` listed.

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`, replace the architecture intro paragraph (the sentence beginning "An online, real-time Tic-Tac-Toe game on Next.js 16…") with:
```
An online, real-time variable-size Tic-Tac-Toe on Next.js 16 (App Router, Turbopack) + React 19.2 + Tailwind v4, with GSAP animations and Supabase Realtime as the backend. The host picks a board size (3–8) per room. A round fills the whole board; every 3-cell line (any of 4 directions, overlaps count) tallies for its owner; the player with more lines wins the round, the board auto-replays after ~2s with an alternating starter, and the score counters track rounds won.
```

Then replace the `src/lib/game.ts` bullet with:
```
- `src/lib/game.ts` — pure, React-free logic: `countLines` (counts 3-cell windows per mark), `roundWinner`, `startingMark` (alternating-starter parity), `isFull`, `emptyBoard(size)`, and the `GameRow` type (incl. `size`, `round`). The only unit-tested module (`game.test.ts`).
```

And replace the `src/components/OnlineGame.tsx` and `src/components/GameBoard.tsx` bullets with:
```
- `src/components/OnlineGame.tsx` — online brain: loads the row, claims a seat, subscribes to Postgres-change + presence events. A move writes a turn-guarded UPDATE; the move that fills the board tallies lines, sets the round result, and increments the round-winner's score. A ~2s timer then calls `nextRound` (clear board, round+1, alternating starter), guarded by `round` so it applies once across both clients.
- `src/components/GameBoard.tsx` — presentational dynamic-size grid (`gridTemplateColumns: repeat(size, …)`) + panel showing the round result/turn, the live per-round line tally, and rounds-won scores. The button is "Skip round" (advance the round without scoring).
```

Then, in the line that mentions the migration, append `0002_board_size_and_rounds.sql`:
```
Schema/RLS/realtime setup lives in `supabase/migrations/` (`0001_create_games.sql`, `0002_board_size_and_rounds.sql`).
```

- [ ] **Step 3: Update README**

In `README.md`, in the "Environment" section step 1, change it to mention both migrations:
```
1. Create a Supabase project and run the SQL files in `supabase/migrations/` in order (`0001_create_games.sql`, then `0002_board_size_and_rounds.sql`) in the SQL Editor.
```

- [ ] **Step 4: Manual end-to-end verification**

First, run `supabase/migrations/0002_board_size_and_rounds.sql` in the Supabase SQL Editor (adds `size`, `round`). Then run `npm run dev` and:
1. On the home page, set **Board size = 5**, click **New Game** → you land on `/game/XXXX` showing a 5×5 grid and "5×5 board".
2. Join from a second browser profile/incognito (distinct player ID) → second tab is "You are O"; both show "Opponent connected".
3. Take turns. Confirm the **"lines this round"** tally for X/O increases as 3-in-a-rows form, and that a run of 4 in one direction bumps the tally by 2.
4. Keep playing until the board is completely full → a "X/O wins the round!" (or "Round draw!") result animates, the matching **Rounds won** counter increments in both windows, and after ~2s the board **auto-clears** to a fresh 5×5.
5. Confirm the starter alternated: round 2 begins with **O** to move (turn indicator shows O).
6. Mid-round, click **Skip round** → board clears, round advances, starter alternates, no score change.
7. Create a **3×3** game in a separate room and confirm the same fill-the-board / tally / replay flow works at the smallest size.

Expected: all behaviors pass. (Two tabs in the same profile share a player ID and both become X — use separate profiles/incognito.)

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: document variable board sizes and line-tally rounds"
```

---

## Notes for the implementer

- **Coupled refactor:** as stated up top, do not run repo-wide `npx tsc --noEmit` for Tasks 2–5 — it will show errors in files later tasks own. The full type-check is Task 6, Step 2.
- **No double scoring:** the score increment happens only on the board-filling move, inside the `.eq("turn", myMark)` guarded UPDATE. The turn never flips on that move, but the round is over (board full) so no further move is possible until `nextRound` resets it.
- **Replay idempotency:** `nextRound` is guarded by `.eq("round", game.round)`. If both clients' timers fire, Postgres serializes them; the second matches no row and is a harmless no-op.
- **Spectators** cannot move (board disabled) and `nextRound` early-returns when `myMark` is null, so they neither skip nor drive auto-replay.
