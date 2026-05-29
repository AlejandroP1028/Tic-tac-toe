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
