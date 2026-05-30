import { describe, it, expect } from "vitest";
import {
  scoredLines,
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

describe("scoredLines", () => {
  it("finds a single horizontal line with correct cells and mark", () => {
    const board: Board = ["X", "X", "X", null, null, null, null, null, null];
    const lines = scoredLines(board, 3);
    expect(lines).toHaveLength(1);
    expect(lines[0].mark).toBe("X");
    expect([...lines[0].cells].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it("finds a single vertical line", () => {
    const board: Board = ["O", null, null, "O", null, null, "O", null, null];
    const lines = scoredLines(board, 3);
    expect(lines).toHaveLength(1);
    expect(lines[0].mark).toBe("O");
    expect([...lines[0].cells].sort((a, b) => a - b)).toEqual([0, 3, 6]);
  });

  it("finds the down-right diagonal", () => {
    const board: Board = ["X", null, null, null, "X", null, null, null, "X"];
    expect(scoredLines(board, 3)).toHaveLength(1);
  });

  it("finds the down-left diagonal", () => {
    const board: Board = [null, null, "X", null, "X", null, "X", null, null];
    expect(scoredLines(board, 3)).toHaveLength(1);
  });

  it("counts overlapping windows in a run of 4 as 2", () => {
    const board: Board = [
      "X", "X", "X", "X",
      null, null, null, null,
      null, null, null, null,
      null, null, null, null,
    ];
    expect(scoredLines(board, 4)).toHaveLength(2);
  });

  it("counts a run of 5 as 3 windows", () => {
    const board: Board = Array(25).fill(null);
    for (let i = 0; i < 5; i++) board[i] = "X";
    expect(scoredLines(board, 5)).toHaveLength(3);
  });

  it("counts a run of 6 as 4 windows", () => {
    const board: Board = Array(36).fill(null);
    for (let i = 0; i < 6; i++) board[i] = "X";
    expect(scoredLines(board, 6)).toHaveLength(4);
  });

  it("counts a shared centre (+ shape) as two windows", () => {
    const board: Board = [null, "X", null, "X", "X", "X", null, "X", null];
    expect(scoredLines(board, 3)).toHaveLength(2);
  });

  it("counts two separate runs as two lines", () => {
    const board: Board = Array(25).fill(null);
    board[0] = board[1] = board[2] = "X";
    board[10] = board[11] = board[12] = "X";
    expect(scoredLines(board, 5)).toHaveLength(2);
  });

  it("returns [] for an empty board", () => {
    expect(scoredLines(emptyBoard(4), 4)).toEqual([]);
  });
});

describe("countLines (derived, overlapping windows)", () => {
  it("counts overlapping windows in a run of 4 as 2", () => {
    const board: Board = [
      "X", "X", "X", "X",
      null, null, null, null,
      null, null, null, null,
      null, null, null, null,
    ];
    expect(countLines(board, 4)).toEqual({ X: 2, O: 0 });
  });

  it("run of 6 counts as 4 windows", () => {
    const board: Board = Array(36).fill(null);
    for (let i = 0; i < 6; i++) board[i] = "X";
    expect(countLines(board, 6)).toEqual({ X: 4, O: 0 });
  });

  it("shared centre (+ shape) counts as 2", () => {
    const board: Board = [null, "X", null, "X", "X", "X", null, "X", null];
    expect(countLines(board, 3)).toEqual({ X: 2, O: 0 });
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
