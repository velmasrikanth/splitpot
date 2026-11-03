import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Category, Expense, ExpensePayload, Member, SplitType } from "../../api/types";
import { Button } from "../../components/Button";
import { Field, controlClass } from "../../components/Field";
import { basisPointsToInput, decimalToMinor, formatMoney, minorToDecimal, percentToBasisPoints, todayIso } from "../../lib/money";
import { calculateSplits, equalBasisPoints, SplitError } from "../../lib/splits";

const categories: Category[] = ["food", "stay", "transport", "drinks", "activities", "shopping", "other"];
const splitTypes: { id: SplitType; label: string }[] = [
  { id: "equal", label: "Equal" },
  { id: "exact", label: "Exact" },
  { id: "percentage", label: "%" },
  { id: "shares", label: "Shares" },
];

const formSchema = z.object({
  amount: z.string().trim().min(1, "Enter an amount"),
  description: z.string().trim().min(1, "Add a description").max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  category: z.enum(["food", "stay", "transport", "drinks", "activities", "shopping", "other"]),
  paidByMemberId: z.string().min(1, "Choose who paid"),
  splitType: z.enum(["equal", "exact", "percentage", "shares"]),
  memberIds: z.array(z.string()).min(1, "Choose who shares this"),
  exact: z.record(z.string()),
  percentage: z.record(z.string()),
  shares: z.record(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

type Preview = {
  lines: { memberId: string; shareMinor: number }[];
  message: string | null;
  remainingLabel: string | null;
};

function preview(values: FormValues, currency: string): Preview {
  const amountMinor = decimalToMinor(values.amount);
  if (amountMinor === null) {
    return { lines: [], message: "Enter an amount greater than 0", remainingLabel: null };
  }
  if (values.memberIds.length === 0) {
    return { lines: [], message: "Choose who shares this", remainingLabel: null };
  }
  try {
    if (values.splitType === "equal") {
      return { lines: calculateSplits(amountMinor, { type: "equal", memberIds: values.memberIds }), message: null, remainingLabel: null };
    }
    if (values.splitType === "exact") {
      const lines = values.memberIds.map((memberId) => ({ memberId, amountMinor: decimalToMinor(values.exact[memberId] ?? "") }));
      const parsed = lines.map((line) => line.amountMinor).filter((value): value is number => value !== null);
      const sum = parsed.reduce((total, value) => total + value, 0);
      const remaining = amountMinor - sum;
      if (parsed.length !== lines.length || remaining !== 0) {
        return { lines: [], message: "Exact amounts must add up to the total", remainingLabel: `Remaining ${formatMoney(remaining, currency)}` };
      }
      return {
        lines: calculateSplits(amountMinor, { type: "exact", lines: lines.map((line) => ({ memberId: line.memberId, amountMinor: line.amountMinor ?? 0 })) }),
        message: null,
        remainingLabel: `Remaining ${formatMoney(0, currency)}`,
      };
    }
    if (values.splitType === "percentage") {
      const lines = values.memberIds.map((memberId) => ({ memberId, basisPoints: percentToBasisPoints(values.percentage[memberId] ?? "") }));
      const parsed = lines.map((line) => line.basisPoints).filter((value): value is number => value !== null);
      const sum = parsed.reduce((total, value) => total + value, 0);
      const remaining = 10_000 - sum;
      if (parsed.length !== lines.length || sum !== 10_000) {
        return { lines: [], message: "Percentages must add up to 100%", remainingLabel: `Remaining ${basisPointsToInput(Math.max(remaining, 0))}%` };
      }
      return {
        lines: calculateSplits(amountMinor, { type: "percentage", lines: lines.map((line) => ({ memberId: line.memberId, basisPoints: line.basisPoints ?? 0 })) }),
        message: null,
        remainingLabel: "Remaining 0%",
      };
    }
    const lines = values.memberIds.map((memberId) => ({ memberId, shares: Number(values.shares[memberId] ?? "") }));
    if (lines.some((line) => !Number.isInteger(line.shares) || line.shares <= 0)) {
      return { lines: [], message: "Each share must be a positive whole number", remainingLabel: null };
    }
    return { lines: calculateSplits(amountMinor, { type: "shares", lines }), message: null, remainingLabel: null };
  } catch (error) {
    return { lines: [], message: error instanceof SplitError ? error.message : "Check the split", remainingLabel: null };
  }
}

function toPayload(values: FormValues): ExpensePayload {
  const amountMinor = decimalToMinor(values.amount);
  if (amountMinor === null) {
    throw new Error("Enter an amount greater than 0");
  }
  const common = {
    description: values.description.trim(),
    amountMinor,
    date: values.date,
    category: values.category,
    paidByMemberId: values.paidByMemberId,
  };
  if (values.splitType === "equal") {
    return { ...common, splitType: "equal", memberIds: values.memberIds };
  }
  if (values.splitType === "exact") {
    return {
      ...common,
      splitType: "exact",
      lines: values.memberIds.map((memberId) => ({ memberId, amountMinor: decimalToMinor(values.exact[memberId] ?? "") ?? 0 })),
    };
  }
  if (values.splitType === "percentage") {
    return {
      ...common,
      splitType: "percentage",
      lines: values.memberIds.map((memberId) => ({ memberId, basisPoints: percentToBasisPoints(values.percentage[memberId] ?? "") ?? 0 })),
    };
  }
  return {
    ...common,
    splitType: "shares",
    lines: values.memberIds.map((memberId) => ({ memberId, shares: Number(values.shares[memberId] ?? "0") })),
  };
}

function initialValues(members: Member[], expense?: Expense): FormValues {
  const memberIds = expense ? expense.splits.map((split) => split.memberId) : members.map((member) => member.id);
  const exact: Record<string, string> = {};
  const percentage: Record<string, string> = {};
  const shares: Record<string, string> = {};
  if (expense?.splitType === "exact") {
    for (const split of expense.splits) {
      exact[split.memberId] = minorToDecimal(split.shareMinor);
    }
  }
  if (expense?.splitType === "percentage" && expense.amountMinor > 0) {
    for (const split of expense.splits) {
      percentage[split.memberId] = basisPointsToInput(Math.round((split.shareMinor * 10_000) / expense.amountMinor));
    }
  } else {
    const even = memberIds.length > 0 ? equalBasisPoints(memberIds) : {};
    for (const memberId of memberIds) {
      percentage[memberId] = basisPointsToInput(even[memberId] ?? 0);
    }
  }
  for (const memberId of memberIds) {
    shares[memberId] = shares[memberId] ?? "1";
  }
  return {
    amount: expense ? minorToDecimal(expense.amountMinor) : "",
    description: expense?.description ?? "",
    date: expense?.date ?? todayIso(),
    category: expense?.category ?? "food",
    paidByMemberId: expense?.paidByMemberId ?? members[0]?.id ?? "",
    splitType: expense?.splitType ?? "equal",
    memberIds,
    exact,
    percentage,
    shares,
  };
}

export function ExpenseForm({
  currency,
  members,
  expense,
  submitting,
  onSubmit,
  onDelete,
}: {
  currency: string;
  members: Member[];
  expense?: Expense;
  submitting: boolean;
  onSubmit: (payload: ExpensePayload) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues(members, expense),
  });
  const values = form.watch();
  const live = useMemo(() => preview(values, currency), [values, currency]);
  const names = new Map(members.map((member) => [member.id, member.displayName]));

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(async (data) => {
        const next = preview(data, currency);
        if (next.message || next.lines.length === 0) {
          form.setError("root", { message: next.message ?? "Check the split" });
          return;
        }
        await onSubmit(toPayload(data));
      })}
    >
      <Field label="Amount" error={form.formState.errors.amount?.message}>
        <input className={`${controlClass} text-3xl font-semibold`} inputMode="decimal" autoFocus {...form.register("amount")} />
      </Field>
      <Field label="Description" error={form.formState.errors.description?.message}>
        <input className={controlClass} {...form.register("description")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" error={form.formState.errors.date?.message}>
          <input className={controlClass} type="date" {...form.register("date")} />
        </Field>
        <Field label="Category">
          <select className={controlClass} {...form.register("category")}>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Paid by">
        <select className={controlClass} {...form.register("paidByMemberId")}>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </select>
      </Field>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">Split between</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {members.map((member) => {
            const checked = values.memberIds.includes(member.id);
            return (
              <label key={member.id} className="flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 px-3 dark:border-slate-700">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-emerald-600"
                  checked={checked}
                  onChange={() => {
                    const memberIds = checked ? values.memberIds.filter((id) => id !== member.id) : [...values.memberIds, member.id];
                    form.setValue("memberIds", memberIds, { shouldValidate: true });
                    if (!values.percentage[member.id] && memberIds.length > 0) {
                      const even = equalBasisPoints(memberIds);
                      const percentage = { ...values.percentage };
                      for (const id of memberIds) {
                        percentage[id] = basisPointsToInput(even[id] ?? 0);
                      }
                      form.setValue("percentage", percentage);
                    }
                    if (!values.shares[member.id]) {
                      form.setValue("shares", { ...values.shares, [member.id]: "1" });
                    }
                  }}
                />
                <span>{member.displayName}</span>
              </label>
            );
          })}
        </div>
        {form.formState.errors.memberIds ? <p className="mt-1 text-sm text-amber-700">{form.formState.errors.memberIds.message}</p> : null}
      </fieldset>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Split type">
        {splitTypes.map((split) => (
          <button
            key={split.id}
            type="button"
            aria-pressed={values.splitType === split.id}
            className={`min-h-12 rounded-2xl text-sm font-semibold ${values.splitType === split.id ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"}`}
            onClick={() => form.setValue("splitType", split.id)}
          >
            {split.label}
          </button>
        ))}
      </div>
      {values.splitType === "exact"
        ? values.memberIds.map((memberId) => (
            <Field key={memberId} label={`Exact amount for ${names.get(memberId) ?? "member"}`}>
              <input
                className={controlClass}
                inputMode="decimal"
                value={values.exact[memberId] ?? ""}
                onChange={(event) => form.setValue("exact", { ...values.exact, [memberId]: event.target.value })}
              />
            </Field>
          ))
        : null}
      {values.splitType === "percentage"
        ? values.memberIds.map((memberId) => (
            <Field key={memberId} label={`Percentage for ${names.get(memberId) ?? "member"}`}>
              <input
                className={controlClass}
                inputMode="decimal"
                value={values.percentage[memberId] ?? ""}
                onChange={(event) => form.setValue("percentage", { ...values.percentage, [memberId]: event.target.value })}
              />
            </Field>
          ))
        : null}
      {values.splitType === "shares"
        ? values.memberIds.map((memberId) => (
            <Field key={memberId} label={`Shares for ${names.get(memberId) ?? "member"}`}>
              <input
                className={controlClass}
                inputMode="numeric"
                value={values.shares[memberId] ?? "1"}
                onChange={(event) => form.setValue("shares", { ...values.shares, [memberId]: event.target.value })}
              />
            </Field>
          ))
        : null}
      <div className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-950" aria-live="polite">
        {live.remainingLabel ? <p data-testid="remaining">{live.remainingLabel}</p> : null}
        {live.message ? <p className="font-semibold text-amber-700 dark:text-amber-300">{live.message}</p> : null}
        {live.lines.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {live.lines.map((line) => (
              <li key={line.memberId}>
                {names.get(line.memberId)} · {minorToDecimal(line.shareMinor)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {form.formState.errors.root ? <p className="text-sm text-amber-700">{form.formState.errors.root.message}</p> : null}
      <Button type="submit" className="w-full" disabled={submitting || Boolean(live.message)}>
        {expense ? "Save expense" : "Add expense"}
      </Button>
      {onDelete ? (
        <Button variant="danger" className="w-full" disabled={submitting} onClick={() => void onDelete()}>
          Delete expense
        </Button>
      ) : null}
    </form>
  );
}
