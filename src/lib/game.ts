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
