"use client";

import React, { useEffect, useState, useRef } from "react";
import Box from "./Box";
import gsap from "gsap";
import { X, Circle } from "lucide-react";
const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const BoxParent = () => {
  const [boxes, setBoxes] = useState<string[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const turnRef = useRef<HTMLSpanElement>(null);
  const scoreXRef = useRef<HTMLSpanElement>(null);
  const scoreORef = useRef<HTMLSpanElement>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const resultRef = useRef<HTMLHeadingElement>(null);

  const playResultAnimation = (element: HTMLHeadingElement) => {
    gsap.killTweensOf(element);

    const tl = gsap.timeline();
    tl.fromTo(
      element,
      { scale: 0.6, opacity: 0, rotate: -15 },
      {
        scale: 1.15,
        opacity: 1,
        rotate: 0,
        duration: 0.5,
        ease: "back.out(1.8)",
      }
    ).to(element, {
      scale: 1,
      duration: 0.3,
      ease: "power1.out",
    });
  };

  useEffect(() => {
    for (const [a, b, c] of lines) {
      if (boxes[a] && boxes[a] === boxes[b] && boxes[a] === boxes[c]) {
        setWinner(boxes[a]);
        setScores((prev) => ({
          ...prev,
          [boxes[a] as "X" | "O"]: prev[boxes[a] as "X" | "O"] + 1,
        }));
        return;
      }
    }

    if (!winner && boxes.every(Boolean)) setWinner("Draw");
  }, [boxes, winner]);

  // slide‑out old turn, slide‑in new turn
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
    if (winner && resultRef.current) {
      playResultAnimation(resultRef.current);
    }
  }, [winner]);

  // bump the relevant counter when scores change
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

  const handleClick = (idx: number) => {
    if (boxes[idx] || winner) return;
    const next = [...boxes];
    next[idx] = turn;
    setBoxes(next);
    setTurn(turn === "X" ? "O" : "X");
  };

  const resetBoard = () => {
    setBoxes(Array(9).fill(null));
    setWinner(null);
    setTurn("X");

    requestAnimationFrame(() => {
      if (resultRef.current) {
        playResultAnimation(resultRef.current);
      }
    });
  };

  return (
    <div className="flex flex-col md:flex-row justify-center items-center gap-8 bg-white/50 md:border md:border-gray-300 p-6 md:p-8 rounded-xl md:shadow-md w-full max-w-3xl mx-auto">
      <div className="w-full max-w-sm grid grid-cols-3 gap-4">
        {boxes.map((val, idx) => (
          <Box
            key={idx}
            value={val}
            turn={turn}
            onClick={() => handleClick(idx)}
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
              <span className="text-yellow-600">It’s a draw!</span>
            ) : (
              <span
                className={winner === "X" ? "text-blue-600" : "text-red-600"}
              >
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
          onClick={resetBoard}
          className=" bg-gray-100 w-fit self-center text-black px-4 py-2 rounded hover:bg-gray-200 transition"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default BoxParent;
