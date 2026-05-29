import { describe, it, expect } from "vitest";
import {
  countLines,
  roundWinner,
  startingMark,
  isFull,
  emptyBoard,
  type Board,
} from "./game";

describe("emptyBoard", () => {
  it("returns size*size nulls", () => {
    expect(emptyBoard(3)).toEqual(Array(9).fill(null));
    expect(emptyBoard(5)).toEqual(Array(25).fill(null));
  });
});

describe("isFull", () => {
  it("is true with no nulls, false otherwise", () => {
    expect(isFull(["X", "O", "X"])).toBe(true);
    expect(isFull(["X", null, "X"])).toBe(false);
  });
});

describe("countLines", () => {
  it("counts a single horizontal window", () => {
    const board: Board = ["X", "X", "X", null, null, null, null, null, null];
    expect(countLines(board, 3)).toEqual({ X: 1, O: 0 });
  });

  it("counts a single vertical window", () => {
    const board: Board = ["O", null, null, "O", null, null, "O", null, null];
    expect(countLines(board, 3)).toEqual({ X: 0, O: 1 });
  });

  it("counts the down-right diagonal", () => {
    const board: Board = ["X", null, null, null, "X", null, null, null, "X"];
    expect(countLines(board, 3)).toEqual({ X: 1, O: 0 });
  });

  it("counts the down-left diagonal", () => {
    const board: Board = [null, null, "X", null, "X", null, "X", null, null];
    expect(countLines(board, 3)).toEqual({ X: 1, O: 0 });
  });

  it("counts overlapping windows in a run of 4 as 2", () => {
    const board: Board = [
      "X", "X", "X", "X",
      null, null, null, null,
      null, null, null, null,
      null, null, null, null,
    ];
    expect(countLines(board, 4)).toEqual({ X: 2, O: 0 });
  });

  it("counts a run of 5 as 3 windows", () => {
    const board: Board = Array(25).fill(null);
    board[0] = board[1] = board[2] = board[3] = board[4] = "X";
    expect(countLines(board, 5)).toEqual({ X: 3, O: 0 });
  });

  it("counts marks independently", () => {
    const board: Board = ["X", "X", "X", null, null, null, "O", "O", "O"];
    expect(countLines(board, 3)).toEqual({ X: 1, O: 1 });
  });

  it("returns zero for an empty board", () => {
    expect(countLines(emptyBoard(4), 4)).toEqual({ X: 0, O: 0 });
  });
});

describe("roundWinner", () => {
  it("returns X when X has more lines", () => {
    expect(roundWinner({ X: 3, O: 1 })).toBe("X");
  });
  it("returns O when O has more lines", () => {
    expect(roundWinner({ X: 0, O: 2 })).toBe("O");
  });
  it("returns Draw when equal", () => {
    expect(roundWinner({ X: 2, O: 2 })).toBe("Draw");
  });
});

describe("startingMark", () => {
  it("alternates X, O, X by round", () => {
    expect(startingMark(1)).toBe("X");
    expect(startingMark(2)).toBe("O");
    expect(startingMark(3)).toBe("X");
  });
});
