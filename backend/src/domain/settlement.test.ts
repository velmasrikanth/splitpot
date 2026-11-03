import { describe, expect, it } from "vitest";
import { netBalances } from "./balances.js";
import { calculateSplits } from "./splits.js";
import { applyTransfers, suggestTransfers } from "./settlement.js";

const members = ["a", "b", "c", "d"];

function expense(
  amountMinor: number,
  paidByMemberId: string,
  request: Parameters<typeof calculateSplits>[1],
) {
  const splits = calculateSplits(amountMinor, request);
  return { amountMinor, paidByMemberId, splits };
}

describe("suggestTransfers", () => {
  it("settles the acceptance trip of A, B, C, and D", () => {
    const expenses = [
      expense(4000, "a", { type: "equal", memberIds: ["a", "b", "c", "d"] }),
      expense(1500, "b", { type: "equal", memberIds: ["b", "c"] }),
      expense(600, "c", { type: "equal", memberIds: ["a", "c", "d"] }),
    ];
    const balances = netBalances(members, expenses, []);
    expect(balances.reduce((sum, balance) => sum + balance.netMinor, 0)).toBe(0);
    expect(balances).toEqual([
      { memberId: "a", netMinor: 2800 },
      { memberId: "b", netMinor: -250 },
      { memberId: "c", netMinor: -1350 },
      { memberId: "d", netMinor: -1200 },
    ]);

    const transfers = suggestTransfers(balances);
    expect(transfers).toEqual([
      { fromMemberId: "c", toMemberId: "a", amountMinor: 1350 },
      { fromMemberId: "d", toMemberId: "a", amountMinor: 1200 },
      { fromMemberId: "b", toMemberId: "a", amountMinor: 250 },
    ]);
    expect(applyTransfers(balances, transfers).every((balance) => balance.netMinor === 0)).toBe(true);
  });

  it("returns no transfers when everyone is already settled", () => {
    expect(
      suggestTransfers([
        { memberId: "a", netMinor: 0 },
        { memberId: "b", netMinor: 0 },
      ]),
    ).toEqual([]);
  });

  it("has one debtor pay the person who covered everything", () => {
    expect(
      suggestTransfers([
        { memberId: "a", netMinor: 500 },
        { memberId: "b", netMinor: -500 },
        { memberId: "c", netMinor: 0 },
      ]),
    ).toEqual([{ fromMemberId: "b", toMemberId: "a", amountMinor: 500 }]);
  });

  it("matches the largest creditor with the largest debtor on each pass", () => {
    expect(
      suggestTransfers([
        { memberId: "a", netMinor: 100 },
        { memberId: "b", netMinor: 50 },
        { memberId: "c", netMinor: -80 },
        { memberId: "d", netMinor: -70 },
      ]),
    ).toEqual([
      { fromMemberId: "c", toMemberId: "a", amountMinor: 80 },
      { fromMemberId: "d", toMemberId: "b", amountMinor: 50 },
      { fromMemberId: "d", toMemberId: "a", amountMinor: 20 },
    ]);
  });

  it("breaks equal amounts by member id", () => {
    expect(
      suggestTransfers([
        { memberId: "b", netMinor: 100 },
        { memberId: "a", netMinor: 100 },
        { memberId: "d", netMinor: -100 },
        { memberId: "c", netMinor: -100 },
      ]),
    ).toEqual([
      { fromMemberId: "c", toMemberId: "a", amountMinor: 100 },
      { fromMemberId: "d", toMemberId: "b", amountMinor: 100 },
    ]);
  });

  it("settles ten members after an uneven split with a remainder", () => {
    const memberIds = Array.from({ length: 12 }, (_, index) => `m${String(index).padStart(2, "0")}`);
    const splits = calculateSplits(1000, { type: "equal", memberIds });
    expect(splits.reduce((sum, line) => sum + line.shareMinor, 0)).toBe(1000);
    const balances = netBalances(memberIds, [{ amountMinor: 1000, paidByMemberId: "m00", splits }], []);
    expect(balances.reduce((sum, balance) => sum + balance.netMinor, 0)).toBe(0);
    const transfers = suggestTransfers(balances);
    expect(applyTransfers(balances, transfers).every((balance) => balance.netMinor === 0)).toBe(true);
    expect(transfers.length).toBeGreaterThanOrEqual(10);
  });

  it("rejects balances that do not sum to zero", () => {
    expect(() => suggestTransfers([{ memberId: "a", netMinor: 10 }, { memberId: "b", netMinor: -5 }])).toThrow(
      /do not sum to zero/,
    );
  });
});
