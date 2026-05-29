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
