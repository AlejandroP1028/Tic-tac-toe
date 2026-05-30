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

  // Cell-centre geometry (only meaningful once measured).
  const gap = metrics?.gap ?? 0;
  const cellW = metrics ? (metrics.w - (size - 1) * gap) / size : 0;
  const cellH = metrics ? (metrics.h - (size - 1) * gap) / size : 0;
  const cx = (idx: number) => (idx % size) * (cellW + gap) + cellW / 2;
  const cy = (idx: number) => Math.floor(idx / size) * (cellH + gap) + cellH / 2;
  const strokeW = Math.max(3, Math.min(cellW, cellH) * 0.15);

  // Animate newly appeared lines (draw-on), then remember current keys + board.
  useEffect(() => {
    // Find the just-placed cell (null -> mark) to orient the draw-on animation.
    // Reading the ref here (in an effect) keeps render pure.
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

    const prevKeys = prevLineKeysRef.current;
    for (const line of lines) {
      const key = lineKey(line);
      if (!prevKeys.has(key)) {
        const el = lineEls.current.get(key);
        if (el) {
          const len = el.getTotalLength();
          // The line is drawn anchor (cells[0]) -> cells[2]. A positive dash
          // offset draws from the anchor end; a negative one from the far end.
          // Originate the draw at the just-placed mark when it is an endpoint.
          const fromFarEnd = placed === line.cells[2];
          gsap.fromTo(
            el,
            { strokeDasharray: len, strokeDashoffset: fromFarEnd ? -len : len },
            { strokeDashoffset: 0, duration: 0.4, ease: "power2.out" }
          );
        }
      }
    }
    prevLineKeysRef.current = new Set(lines.map(lineKey));
    prevBoardRef.current = board;
  }, [board, lines]);

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
              return (
                <line
                  key={key}
                  ref={(el) => {
                    if (el) lineEls.current.set(key, el);
                    else lineEls.current.delete(key);
                  }}
                  x1={cx(a)}
                  y1={cy(a)}
                  x2={cx(c)}
                  y2={cy(c)}
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
