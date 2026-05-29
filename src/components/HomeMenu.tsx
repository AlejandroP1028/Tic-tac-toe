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
