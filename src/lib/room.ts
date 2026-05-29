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
