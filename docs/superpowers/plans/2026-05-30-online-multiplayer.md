# Online Multiplayer Tic-Tac-Toe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-device hotseat game with real-time online play between two browsers, connected by a shareable room code, backed by Supabase Realtime.

**Architecture:** Each match is one row in a Supabase `games` table that is the single source of truth. Both browsers subscribe to Postgres-change events on their row; a move is a guarded `UPDATE`. Pure game logic is extracted into `src/lib/game.ts` (covered by Vitest); a thin `OnlineGame` client component handles loading, seat-claiming, realtime, and presence, and feeds a presentational `GameBoard`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind v4, GSAP, `@supabase/supabase-js`, Vitest.

**Prerequisite (already done):** The `games` table exists in Supabase (`supabase/migrations/0001_create_games.sql`) and `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/lib/game.ts` (create) | Pure game logic + shared types. No React. |
| `src/lib/game.test.ts` (create) | Vitest coverage for `game.ts`. |
| `src/lib/supabase.ts` (create) | Browser Supabase client singleton. |
| `src/lib/playerId.ts` (create) | Per-browser anonymous ID in `localStorage`. |
| `src/lib/room.ts` (create) | `createGame()` — insert a row with a unique code. |
| `src/components/Box.tsx` (modify) | Add a `disabled` prop. |
| `src/components/GameBoard.tsx` (create) | Presentational board + score/turn/status panel (ported from `BoxParent`). |
| `src/components/OnlineGame.tsx` (create) | Online brain: load, claim seat, realtime, presence, move, reset. |
| `src/components/HomeMenu.tsx` (create) | "New Game" + "Join with code" UI. |
| `src/app/page.tsx` (modify) | Home page renders `HomeMenu`. |
| `src/app/game/[code]/page.tsx` (create) | Route that renders `OnlineGame`. |
| `src/components/BoxParent.tsx` (delete) | Replaced by `GameBoard` + `OnlineGame`. |
| `vitest.config.ts` (create) | Vitest config. |
| `package.json` (modify) | Deps + `test` scripts. |

---

## Task 1: Add dependencies and Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install @supabase/supabase-js
npm install -D vitest
```
Expected: both install without errors; `package.json` gains the entries.

- [ ] **Step 2: Add test scripts**

In `package.json`, add to the `"scripts"` object:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create the Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run: `npm test`
Expected: Vitest runs and reports "No test files found" (exit is fine) — confirms config loads.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add supabase-js and vitest"
```

---

## Task 2: Pure game logic (TDD)

**Files:**
- Create: `src/lib/game.test.ts`
- Create: `src/lib/game.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/game.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { checkWinner, emptyBoard, LINES, type Board } from "./game";

describe("emptyBoard", () => {
  it("returns 9 null cells", () => {
    expect(emptyBoard()).toEqual(Array(9).fill(null));
  });
});

describe("checkWinner", () => {
  it("returns null for an empty board", () => {
    expect(checkWinner(emptyBoard())).toBeNull();
  });

  it("returns null for an in-progress board with no line", () => {
    const board: Board = ["X", "O", "X", null, "O", null, null, null, null];
    expect(checkWinner(board)).toBeNull();
  });

  it("detects a win on every line for X and O", () => {
    for (const [a, b, c] of LINES) {
      for (const mark of ["X", "O"] as const) {
        const board: Board = emptyBoard();
        board[a] = board[b] = board[c] = mark;
        expect(checkWinner(board)).toBe(mark);
      }
    }
  });

  it("returns 'Draw' for a full board with no winner", () => {
    const board: Board = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    expect(checkWinner(board)).toBe("Draw");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./game"` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/game.ts`:
```ts
export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Board = Cell[];
export type Winner = Mark | "Draw" | null;

export const LINES: readonly [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function emptyBoard(): Board {
  return Array(9).fill(null);
}

export function checkWinner(board: Board): Winner {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Mark;
    }
  }
  if (board.every(Boolean)) return "Draw";
  return null;
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
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all assertions in `game.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game.ts src/lib/game.test.ts
git commit -m "feat: add pure game logic with tests"
```

---

## Task 3: Supabase client

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create the client**

Create `src/lib/supabase.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env.local and fill in your Supabase values."
  );
}

export const supabase = createClient(url, anonKey);
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add supabase browser client"
```

---

## Task 4: Anonymous player ID

**Files:**
- Create: `src/lib/playerId.ts`

- [ ] **Step 1: Create the helper**

Create `src/lib/playerId.ts`:
```ts
const STORAGE_KEY = "ttt-player-id";

/**
 * Returns a stable random ID for this browser, creating and persisting it in
 * localStorage on first use. Returns "" during SSR (no window).
 */
export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/playerId.ts
git commit -m "feat: add anonymous per-browser player id"
```

---

## Task 5: Room creation

**Files:**
- Create: `src/lib/room.ts`

- [ ] **Step 1: Create the helper**

Create `src/lib/room.ts`:
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
 * Inserts a fresh game row and returns its code. Retries on the rare code
 * collision (Postgres unique-violation 23505).
 */
export async function createGame(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await supabase.from("games").insert({
      code,
      board: emptyBoard(),
      turn: "X",
    });
    if (!error) return code;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique room code; please try again.");
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/room.ts
git commit -m "feat: add createGame room helper"
```

---

## Task 6: Presentational GameBoard (and Box `disabled`)

**Files:**
- Modify: `src/components/Box.tsx`
- Create: `src/components/GameBoard.tsx`

- [ ] **Step 1: Add a `disabled` prop to Box**

Replace the entire contents of `src/components/Box.tsx` with:
```tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Circle } from "lucide-react";
import gsap from "gsap";

interface BoxProps {
  turn: "X" | "O";
  value: string | null;
  disabled?: boolean;
  onClick: () => void;
}

const Box: React.FC<BoxProps> = ({ value, onClick, turn, disabled }) => {
  const finalRef = useRef<SVGSVGElement | null>(null); // for click animation
  const previewRef = useRef<SVGSVGElement | null>(null); // for hover preview
  const [hover, setHover] = useState(false);
  const prevValue = useRef<string | null>(null);

  /** pop-in animation when value is set */
  useEffect(() => {
    if (value && value !== prevValue.current && finalRef.current) {
      gsap.fromTo(
        finalRef.current,
        { scale: 0.3, opacity: 0.2 },
        { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" }
      );
      prevValue.current = value;
    }
  }, [value]);

  const previewIcon = () => {
    if (!hover || value || disabled) return null;
    return turn === "X" ? (
      <X
        ref={previewRef}
        className="w-2/3 h-2/3 scale-30 text-blue-600 opacity-30 pointer-events-none"
      />
    ) : (
      <Circle
        ref={previewRef}
        className="w-2/3 h-2/3 scale-30 text-red-600 opacity-30 pointer-events-none"
      />
    );
  };

  const placedIcon = () => {
    if (value === "X")
      return <X ref={finalRef} className="w-2/3 h-2/3 text-blue-600" />;
    if (value === "O")
      return <Circle ref={finalRef} className="w-2/3 h-2/3 text-red-600" />;
    return null;
  };

  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      disabled={disabled}
      className="aspect-square w-full flex items-center justify-center border border-gray-400 rounded-xl hover:bg-gray-100 select-none disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      {previewIcon()}
      {placedIcon()}
    </button>
  );
};

export default Box;
```

- [ ] **Step 2: Create the presentational GameBoard**

Create `src/components/GameBoard.tsx`:
```tsx
"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { X, Circle } from "lucide-react";
import Box from "./Box";
import type { Board, Mark, Winner } from "@/lib/game";

interface GameBoardProps {
  board: Board;
  turn: Mark;
  winner: Winner;
  scores: { X: number; O: number };
  myMark: Mark | null; // null = spectator
  disabled: boolean;
  status: string;
  onCellClick: (idx: number) => void;
  onReset: () => void;
}

const GameBoard: React.FC<GameBoardProps> = ({
  board,
  turn,
  winner,
  scores,
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
      <div className="w-full max-w-sm grid grid-cols-3 gap-4">
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
          className={`text-2xl md:text-4xl text-center rounded-md flex h-28 items-center justify-center p-4 transition-all
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
              <span className="text-yellow-600">It&rsquo;s a draw!</span>
            ) : (
              <span className={winner === "X" ? "text-blue-600" : "text-red-600"}>
                {winner} wins!
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

        <section className="space-y-4">
          <h2 className="text-3xl">Scores: </h2>
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
          Reset
        </button>
      </div>
    </div>
  );
};

export default GameBoard;
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Box.tsx src/components/GameBoard.tsx
git commit -m "feat: add presentational GameBoard, Box disabled prop"
```

---

## Task 7: OnlineGame brain

**Files:**
- Create: `src/components/OnlineGame.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/OnlineGame.tsx`:
```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/playerId";
import { checkWinner, emptyBoard, type GameRow, type Mark } from "@/lib/game";
import GameBoard from "./GameBoard";

const OnlineGame: React.FC<{ code: string }> = ({ code }) => {
  const [game, setGame] = useState<GameRow | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [myMark, setMyMark] = useState<Mark | null>(null);
  const [opponentPresent, setOpponentPresent] = useState(false);
  const playerIdRef = useRef<string>("");

  // Resolve our seat (claiming X or O if free), then load the row.
  useEffect(() => {
    const playerId = getPlayerId();
    playerIdRef.current = playerId;
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

      // Already seated?
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

      // If X claim failed or was taken, try O.
      if (!cancelled && myMarkUnset(current, playerId) && !current.player_o) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Subscribe to row changes + presence.
  useEffect(() => {
    const playerId = playerIdRef.current;
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
    const winner = checkWinner(board);

    const update: Partial<GameRow> = {
      board,
      turn: myMark === "X" ? "O" : "X",
      winner,
    };
    if (winner === "X") update.score_x = game.score_x + 1;
    if (winner === "O") update.score_o = game.score_o + 1;

    // turn guard: the DB rejects the write if it is no longer our turn.
    const { data } = await supabase
      .from("games")
      .update(update)
      .eq("code", code)
      .eq("turn", myMark)
      .select()
      .maybeSingle();
    if (data) setGame(data as GameRow);
  };

  const resetBoard = async () => {
    if (!game) return;
    const { data } = await supabase
      .from("games")
      .update({ board: emptyBoard(), turn: "X", winner: null })
      .eq("code", code)
      .select()
      .maybeSingle();
    if (data) setGame(data as GameRow);
  };

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

  return (
    <div className="w-screen min-h-screen flex flex-col justify-center items-center space-y-8 py-10">
      <div className="flex flex-col items-center space-y-2">
        <h1 className="text-3xl font-medium">Room {code}</h1>
        <p className="text-sm text-gray-500">
          {myMark ? `You are ${myMark}` : "Spectator"} &middot; share this code to invite a friend
        </p>
      </div>
      <GameBoard
        board={game.board}
        turn={game.turn}
        winner={game.winner}
        scores={{ X: game.score_x, O: game.score_o }}
        myMark={myMark}
        disabled={disabled}
        status={status}
        onCellClick={makeMove}
        onReset={resetBoard}
      />
    </div>
  );
};

/** Helper: have we NOT claimed/own a seat on this row? */
function myMarkUnset(row: GameRow, playerId: string): boolean {
  return row.player_x !== playerId && row.player_o !== playerId;
}

export default OnlineGame;
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/OnlineGame.tsx
git commit -m "feat: add OnlineGame realtime brain"
```

---

## Task 8: Home menu

**Files:**
- Create: `src/components/HomeMenu.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create the HomeMenu component**

Create `src/components/HomeMenu.tsx`:
```tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createGame } from "@/lib/room";

const HomeMenu: React.FC = () => {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const newCode = await createGame();
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

- [ ] **Step 2: Update the home page**

Replace the entire contents of `src/app/page.tsx` with:
```tsx
import React from "react";
import HomeMenu from "@/components/HomeMenu";
import { SiNextdotjs, SiGreensock } from "react-icons/si";

const page = () => {
  return (
    <div className="w-screen h-screen flex flex-col justify-center items-center space-y-10">
      <h1 className="text-4xl font-medium">Alejandro&apos;s Tic-Tac-Toe</h1>
      <HomeMenu />
      <div className="text-lg flex flex-col items-center">
        <h4 className="font-semibold">Built with:</h4>
        <div className="flex flex-row gap-4 items-center mt-4">
          <div className="flex flex-row gap-2 items-center">
            {" "}
            <SiNextdotjs className="w-8 h-8 text-black" title="Next.js" />
          </div>
          <div className="flex flex-row gap-2 items-center">
            {" "}
            <SiGreensock className="w-8 h-8 text-black" title="GSAP" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default page;
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/HomeMenu.tsx src/app/page.tsx
git commit -m "feat: add home menu (new game / join)"
```

---

## Task 9: Game route and remove BoxParent

**Files:**
- Create: `src/app/game/[code]/page.tsx`
- Delete: `src/components/BoxParent.tsx`

- [ ] **Step 1: Create the route**

Create `src/app/game/[code]/page.tsx`:
```tsx
import OnlineGame from "@/components/OnlineGame";

export default async function GamePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <OnlineGame code={code.toUpperCase()} />;
}
```

- [ ] **Step 2: Delete the obsolete component**

Run: `git rm src/components/BoxParent.tsx`
Expected: file removed from the working tree and staged.

- [ ] **Step 3: Verify nothing else imports BoxParent**

Run (PowerShell): `Select-String -Path src -Pattern "BoxParent" -Recurse`
Expected: no matches.

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: build completes with no type or lint errors; routes `/` and `/game/[code]` are listed.

- [ ] **Step 5: Commit**

```bash
git add src/app/game
git commit -m "feat: add game route, remove hotseat BoxParent"
```

---

## Task 10: Docs and manual verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Update CLAUDE.md architecture section**

In `CLAUDE.md`, replace the **Architecture** and **Commands** sections to reflect the new structure. Use this content:

For **Commands**, add a line under the existing list:
```
- `npm test` — run the Vitest unit tests (covers `src/lib/game.ts`); `npm run test:watch` for watch mode
```
Replace the "There is no test suite configured." line with the above.

Replace the **Architecture** section body with:
```
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
```

- [ ] **Step 2: Update README setup notes**

In `README.md`, after the "Getting Started" intro, add a short section:
```
## Environment

This app needs a Supabase project for real-time multiplayer.

1. Create a Supabase project and run `supabase/migrations/0001_create_games.sql` in the SQL Editor.
2. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. `npm run dev`.
```

- [ ] **Step 3: Manual end-to-end verification**

Run: `npm run dev`, then:
1. Open `http://localhost:3000`, click **New Game** — you should land on `/game/XXXX` showing "You are X" and "Waiting for opponent…"; the board is disabled.
2. Copy the room code, open a second browser **in a different profile or incognito window** (so it gets a distinct player ID), and join via the code. The second tab should show "You are O"; both should now show "Opponent connected".
3. Take turns clicking — moves appear in **both** windows; only the player whose turn it is can click.
4. Win a line — "X wins!"/"O wins!" animates, the score increments in both windows.
5. Click **Reset** — board clears in both windows, scores persist.
6. Refresh one window — it rejoins its same seat and shows the current board.

Expected: all six behaviors pass. (Two tabs in the *same* profile share a player ID and will both be "X" — use separate profiles/incognito.)

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: document online multiplayer setup and architecture"
```

---

## Notes for the implementer

- **Same-browser caveat:** the anonymous ID is per-browser-profile. Testing two seats requires two profiles/incognito; two tabs in one profile both claim X.
- **Move authority is the turn guard only.** The `.eq("turn", myMark)` on the UPDATE is sufficient because the turn flips on every move, so a player cannot move twice in a row. There is intentionally no server-side cell-occupancy check (see spec, "Out of scope").
- **Presence requires the realtime subscription to be live.** If `opponentPresent` never flips true, confirm the table is in the `supabase_realtime` publication (the migration handles this) and that Realtime is enabled for the project.
