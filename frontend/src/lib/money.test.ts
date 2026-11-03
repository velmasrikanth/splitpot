import { describe, expect, it } from "vitest";
import { basisPointsToInput, decimalToMinor, minorToDecimal, percentToBasisPoints } from "./money";

describe("money", () => {
  it("converts minor units to a decimal string without binary fractions", () => {
    expect(minorToDecimal(240050)).toBe("2400.50");
    expect(minorToDecimal(1)).toBe("0.01");
    expect(minorToDecimal(-125000)).toBe("-1250.00");
  });

  it("parses a decimal amount into minor units", () => {
    expect(decimalToMinor("2400.5")).toBe(240050);
    expect(decimalToMinor("0.01")).toBe(1);
    expect(decimalToMinor("10.999")).toBeNull();
    expect(decimalToMinor("0")).toBeNull();
  });

  it("converts percentages to basis points", () => {
    expect(percentToBasisPoints("50")).toBe(5000);
    expect(percentToBasisPoints("33.34")).toBe(3334);
    expect(basisPointsToInput(3334)).toBe("33.34");
    expect(percentToBasisPoints("101")).toBeNull();
  });
});
