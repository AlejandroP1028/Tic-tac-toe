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
