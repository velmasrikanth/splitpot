import { describe, expect, it } from "vitest";
import { calculateSplits, SplitError } from "./splits.js";

describe("calculateSplits", () => {
  it("splits an even amount equally", () => {
    expect(calculateSplits(4000, { type: "equal", memberIds: ["a", "b", "c", "d"] })).toEqual([
      { memberId: "a", shareMinor: 1000 },
      { memberId: "b", shareMinor: 1000 },
      { memberId: "c", shareMinor: 1000 },
      { memberId: "d", shareMinor: 1000 },
    ]);
  });

  it("gives leftover minor units to members in id order", () => {
    const lines = calculateSplits(100, { type: "equal", memberIds: ["c", "a", "b"] });
    expect(lines).toEqual([
      { memberId: "a", shareMinor: 34 },
      { memberId: "b", shareMinor: 33 },
      { memberId: "c", shareMinor: 33 },
    ]);
    expect(lines.reduce((sum, line) => sum + line.shareMinor, 0)).toBe(100);
  });

  it("splits exact amounts when they add up", () => {
    expect(
      calculateSplits(1500, {
        type: "exact",
        lines: [
          { memberId: "b", amountMinor: 1000 },
          { memberId: "c", amountMinor: 500 },
        ],
      }),
    ).toEqual([
      { memberId: "b", shareMinor: 1000 },
      { memberId: "c", shareMinor: 500 },
    ]);
  });

  it("rejects exact amounts that do not add up", () => {
    expect(() =>
      calculateSplits(1500, {
        type: "exact",
        lines: [
          { memberId: "b", amountMinor: 1000 },
          { memberId: "c", amountMinor: 400 },
        ],
      }),
    ).toThrow(SplitError);
  });

  it("splits percentages from basis points", () => {
    const lines = calculateSplits(100, {
      type: "percentage",
      lines: [
        { memberId: "b", basisPoints: 2500 },
        { memberId: "a", basisPoints: 5000 },
        { memberId: "c", basisPoints: 2500 },
      ],
    });
    expect(lines).toEqual([
      { memberId: "a", shareMinor: 50 },
      { memberId: "b", shareMinor: 25 },
      { memberId: "c", shareMinor: 25 },
    ]);
  });

  it("rejects percentages that do not add up to 100%", () => {
    expect(() =>
      calculateSplits(100, {
        type: "percentage",
        lines: [
          { memberId: "a", basisPoints: 5000 },
          { memberId: "b", basisPoints: 4000 },
        ],
      }),
    ).toThrow(/100%/);
  });

  it("splits shares such as 2:1:1", () => {
    expect(
      calculateSplits(4000, {
        type: "shares",
        lines: [
          { memberId: "c", shares: 1 },
          { memberId: "a", shares: 2 },
          { memberId: "b", shares: 1 },
        ],
      }),
    ).toEqual([
      { memberId: "a", shareMinor: 2000 },
      { memberId: "b", shareMinor: 1000 },
      { memberId: "c", shareMinor: 1000 },
    ]);
  });

  it("rejects a duplicate member", () => {
    expect(() => calculateSplits(100, { type: "equal", memberIds: ["a", "a"] })).toThrow(SplitError);
  });
});
