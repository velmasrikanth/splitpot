import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Member } from "../../api/types";
import { ExpenseForm } from "./ExpenseForm";

const members: Member[] = [
  { id: "a", userId: "u1", displayName: "Anu", createdAt: "" },
  { id: "b", userId: "u2", displayName: "Ravi", createdAt: "" },
];

function renderForm() {
  return render(<ExpenseForm currency="INR" members={members} submitting={false} onSubmit={vi.fn()} />);
}

describe("ExpenseForm split validation", () => {
  it("previews an equal split", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Amount"), "100");
    expect(screen.getByText("Anu · 50.00")).toBeInTheDocument();
    expect(screen.getByText("Ravi · 50.00")).toBeInTheDocument();
  });

  it("shows the remaining amount when exact shares do not add up", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Amount"), "100");
    await user.click(screen.getByRole("button", { name: "Exact" }));
    await user.type(screen.getByLabelText("Exact amount for Anu"), "40");
    await user.type(screen.getByLabelText("Exact amount for Ravi"), "50");
    expect(screen.getByTestId("remaining")).toHaveTextContent(/Remaining/);
    expect(screen.getByText("Exact amounts must add up to the total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add expense" })).toBeDisabled();
  });

  it("clears the remaining amount when exact shares add up", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Amount"), "100");
    await user.click(screen.getByRole("button", { name: "Exact" }));
    await user.type(screen.getByLabelText("Exact amount for Anu"), "60");
    await user.type(screen.getByLabelText("Exact amount for Ravi"), "40");
    expect(screen.getByTestId("remaining")).toHaveTextContent("Remaining");
    expect(screen.queryByText("Exact amounts must add up to the total")).not.toBeInTheDocument();
    expect(screen.getByText("Anu · 60.00")).toBeInTheDocument();
    expect(screen.getByText("Ravi · 40.00")).toBeInTheDocument();
  });

  it("shows the remaining percentage", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Amount"), "100");
    await user.click(screen.getByRole("button", { name: "%" }));
    const anu = screen.getByLabelText("Percentage for Anu");
    const ravi = screen.getByLabelText("Percentage for Ravi");
    await user.clear(anu);
    await user.type(anu, "60");
    await user.clear(ravi);
    await user.type(ravi, "30");
    expect(screen.getByTestId("remaining")).toHaveTextContent("Remaining 10%");
    expect(screen.getByText("Percentages must add up to 100%")).toBeInTheDocument();
  });
});
