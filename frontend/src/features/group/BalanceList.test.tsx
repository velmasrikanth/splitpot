import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BalanceList } from "./BalanceList";

describe("BalanceList", () => {
  it("marks who gets money back and who owes", () => {
    render(
      <BalanceList
        currency="INR"
        members={[
          { memberId: "a", displayName: "Anu", paidMinor: 400000, shareMinor: 120000, netMinor: 280000 },
          { memberId: "b", displayName: "Ravi", paidMinor: 0, shareMinor: 25000, netMinor: -25000 },
        ]}
      />,
    );
    const anu = screen.getByText("Anu").closest("li");
    const ravi = screen.getByText("Ravi").closest("li");
    expect(anu).toHaveAttribute("data-tone", "positive");
    expect(anu).toHaveTextContent("gets back");
    expect(anu?.querySelector("div.h-full")).toHaveClass("bg-emerald-500");
    expect(ravi).toHaveAttribute("data-tone", "negative");
    expect(ravi).toHaveTextContent("owes");
    expect(ravi?.querySelector("div.h-full")).toHaveClass("bg-amber-500");
  });
});
