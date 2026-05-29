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
