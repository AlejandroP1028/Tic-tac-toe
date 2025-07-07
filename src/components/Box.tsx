"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Circle } from "lucide-react";
import gsap from "gsap";

interface BoxProps {
  turn: "X" | "O";
  value: string | null;
  onClick: () => void;
}

const Box: React.FC<BoxProps> = ({ value, onClick, turn }) => {
  const finalRef = useRef<SVGSVGElement | null>(null); // for click animation
  const previewRef = useRef<SVGSVGElement | null>(null); // for hover preview
  const [hover, setHover] = useState(false);
  const prevValue = useRef<string | null>(null);

  /** pop‑in animation when value is set */
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
    if (!hover || value) return null;
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
      className="aspect-square w-full flex items-center justify-center border border-gray-400 rounded-xl hover:bg-gray-100 select-none"
    >
      {previewIcon()}
      {placedIcon()}
    </button>
  );
};

export default Box;
