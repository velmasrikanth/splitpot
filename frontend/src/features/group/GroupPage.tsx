import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Car, Ellipsis, Plus, ShoppingBag, Ticket, Utensils, Wine } from "lucide-react";
import { useState } from "react";
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../../api/client";
import type { Category, Expense, ExpensePayload, Group, User } from "../../api/types";
import { Button } from "../../components/Button";
import { Field, controlClass } from "../../components/Field";
import { ModalSheet } from "../../components/ModalSheet";
import { Skeleton } from "../../components/Skeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { useToast } from "../../components/Toast";
import { ExpenseForm } from "../expenses/ExpenseForm";
import { GroupTabs } from "../shell/Shell";
import { BalanceList } from "./BalanceList";
import { formatDay, formatMoney, todayIso } from "../../lib/money";

const categoryIcons: Record<Category, typeof Utensils> = {
  food: Utensils,
  stay: BedDouble,
  transport: Car,
  drinks: Wine,
  activities: Ticket,
  shopping: ShoppingBag,
  other: Ellipsis,
};

export function GroupPage() {
  const user = useOutletContext<User>();
  const { groupId = "" } = useParams();
  const [params] = useSearchParams();
  const tab = params.get("tab") ?? "expenses";
  const group = useQuery({ queryKey: ["group", groupId], queryFn: () => api.getGroup(groupId), enabled: Boolean(groupId) });
  const [editor, setEditor] = useState<Expense | null | "new">(null);

  if (group.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12" />
        <Skeleton className="h-28" />
      </div>
    );
  }
  if (group.isError || !group.data) {
    return <ErrorState message={group.error?.message ?? "Pot not found"} onRetry={() => void group.refetch()} />;
  }
  const current = group.data;
  const open = current.status === "open";

  return (
    <div>
      <h1 className="text-2xl font-bold">{current.name}</h1>
      <p className="text-sm capitalize text-slate-500">
        {current.type} · {current.currency} · {current.status}
      </p>
      {!open ? <p className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold dark:bg-slate-800">This pot is closed. You can still review the settlement.</p> : null}
      <div className="mt-4">
        <GroupTabs groupId={current.id} tab={tab} />
      </div>
      {tab === "balances" ? <BalancesTab group={current} /> : null}
      {tab === "settle" ? <SettleTab group={current} /> : null}
      {tab === "members" ? <MembersTab group={current} user={user} /> : null}
      {tab !== "balances" && tab !== "settle" && tab !== "members" ? (
        <ExpensesTab group={current} user={user} onEdit={setEditor} onCreate={() => setEditor("new")} />
      ) : null}
      {open && tab !== "members" ? (
        <button type="button" className="fixed bottom-5 right-5 inline-flex min-h-14 items-center gap-2 rounded-full bg-emerald-600 px-5 text-base font-semibold text-white shadow-lg" onClick={() => setEditor("new")}>
          <Plus className="h-5 w-5" aria-hidden="true" /> Add expense
        </button>
      ) : null}
      {editor !== null ? (
        <ExpenseEditor group={current} expense={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} />
      ) : null}
    </div>
  );
}

function ExpenseEditor({ group, expense, onClose }: { group: Group; expense?: Expense; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["expenses", group.id] }),
      queryClient.invalidateQueries({ queryKey: ["summary", group.id] }),
      queryClient.invalidateQueries({ queryKey: ["group", group.id] }),
    ]);
  };
  const save = useMutation({
    mutationFn: (payload: ExpensePayload) => (expense ? api.updateExpense(group.id, expense.id, payload) : api.createExpense(group.id, payload)),
    onSuccess: async () => {
      await refresh();
      toast(expense ? "Expense updated" : "Expense added");
      onClose();
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not save the expense", "error"),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteExpense(group.id, expense?.id ?? ""),
    onSuccess: async () => {
      await refresh();
      toast("Expense deleted");
      onClose();
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not delete the expense", "error"),
  });
  return (
    <ModalSheet title={expense ? "Edit expense" : "Add expense"} onClose={onClose}>
      <ExpenseForm
        currency={group.currency}
        members={group.members}
        expense={expense}
        submitting={save.isPending || remove.isPending}
        onSubmit={async (payload) => {
          await save.mutateAsync(payload);
        }}
        onDelete={expense ? async () => { await remove.mutateAsync(); } : undefined}
      />
    </ModalSheet>
  );
}

function ExpensesTab({ group, user, onEdit }: { group: Group; user: User; onEdit: (expense: Expense) => void; onCreate: () => void }) {
  const expenses = useQuery({ queryKey: ["expenses", group.id], queryFn: () => api.listExpenses(group.id) });
  if (expenses.isLoading) {
    return <Skeleton className="h-28" />;
  }
  if (expenses.isError) {
    return <ErrorState message={expenses.error.message} onRetry={() => void expenses.refetch()} />;
  }
  const rows = expenses.data ?? [];
  if (rows.length === 0) {
    return <EmptyState title="No expenses yet" body="Add the first dinner, cab, or hotel charge." />;
  }
  const names = new Map(group.members.map((member) => [member.id, member.displayName]));
  const grouped = new Map<string, Expense[]>();
  for (const expense of rows) {
    const list = grouped.get(expense.date) ?? [];
    list.push(expense);
    grouped.set(expense.date, list);
  }
  return (
    <div className="space-y-5">
      {[...grouped.entries()].map(([date, items]) => (
        <section key={date}>
          <h2 className="mb-2 text-sm font-semibold text-slate-500">{formatDay(date)}</h2>
          <ul className="space-y-2">
            {items.map((expense) => {
              const Icon = categoryIcons[expense.category];
              const payer = names.get(expense.paidByMemberId) ?? "Someone";
              const canEdit = group.status === "open" && (expense.createdBy.id === user.id || group.createdById === user.id);
              const splitLabel = expense.splitType === "equal" ? `split ${expense.splits.length} ways` : expense.splitType === "exact" ? "exact amounts" : expense.splitType === "percentage" ? "by percentage" : "by shares";
              return (
                <li key={expense.id} className="flex items-center gap-3 rounded-3xl bg-white p-3 dark:bg-slate-900">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{expense.description}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {payer} paid {formatMoney(expense.amountMinor, group.currency)} · {splitLabel}
                    </p>
                    <p className="text-xs text-slate-500">Added by {expense.createdBy.name}</p>
                  </div>
                  {canEdit ? (
                    <button type="button" className="min-h-12 rounded-2xl px-3 text-sm font-semibold text-emerald-700" onClick={() => onEdit(expense)}>
                      Edit
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function BalancesTab({ group }: { group: Group }) {
  const summary = useQuery({ queryKey: ["summary", group.id], queryFn: () => api.summary(group.id) });
  if (summary.isLoading) {
    return <Skeleton className="h-40" />;
  }
  if (summary.isError || !summary.data) {
    return <ErrorState message={summary.error?.message ?? "Could not load balances"} onRetry={() => void summary.refetch()} />;
  }
  const maxCategory = Math.max(...summary.data.categories.map((item) => item.totalMinor), 1);
  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-emerald-700 p-5 text-white">
        <p className="text-sm font-semibold text-emerald-100">Total cost</p>
        <p className="text-3xl font-bold">{formatMoney(summary.data.totalMinor, group.currency)}</p>
      </section>
      <section className="rounded-3xl bg-white p-5 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold">Balances</h2>
        <BalanceList currency={group.currency} members={summary.data.members} />
      </section>
      <section className="rounded-3xl bg-white p-5 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold">By category</h2>
        {summary.data.categories.length === 0 ? <p className="text-slate-500">No spending yet.</p> : (
          <ul className="space-y-3">
            {summary.data.categories.map((item) => (
              <li key={item.category}>
                <div className="mb-1 flex justify-between text-sm font-semibold capitalize">
                  <span>{item.category}</span>
                  <span>{formatMoney(item.totalMinor, group.currency)}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-3 rounded-full bg-teal-500" style={{ width: `${(item.totalMinor / maxCategory) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SettleTab({ group }: { group: Group }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const summary = useQuery({ queryKey: ["summary", group.id], queryFn: () => api.summary(group.id) });
  const history = useQuery({ queryKey: ["settlements", group.id], queryFn: () => api.listSettlements(group.id) });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["summary", group.id] }),
      queryClient.invalidateQueries({ queryKey: ["settlements", group.id] }),
    ]);
  };
  const pay = useMutation({
    mutationFn: (transfer: { fromMemberId: string; toMemberId: string; amountMinor: number }) =>
      api.createSettlement(group.id, { ...transfer, date: todayIso() }),
    onSuccess: async () => {
      await refresh();
      toast("Payment recorded");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not record the payment", "error"),
  });
  const undo = useMutation({
    mutationFn: (id: string) => api.deleteSettlement(group.id, id),
    onSuccess: async () => {
      await refresh();
      toast("Settlement removed");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not remove the settlement", "error"),
  });
  if (summary.isLoading || history.isLoading) {
    return <Skeleton className="h-40" />;
  }
  if (summary.isError || !summary.data) {
    return <ErrorState message={summary.error?.message ?? "Could not load settlement"} onRetry={() => void summary.refetch()} />;
  }
  const names = new Map(summary.data.members.map((member) => [member.memberId, member.displayName]));
  return (
    <div className="space-y-5">
      {summary.data.settled ? (
        <section className="rounded-3xl bg-emerald-50 p-8 text-center dark:bg-emerald-950">
          <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">All settled</h2>
          <p className="mt-2 text-emerald-900 dark:text-emerald-100">Nobody owes anything in this pot.</p>
        </section>
      ) : (
        <ul className="space-y-3">
          {summary.data.transfers.map((transfer) => (
            <li key={`${transfer.fromMemberId}-${transfer.toMemberId}-${transfer.amountMinor}`} className="rounded-3xl bg-white p-4 dark:bg-slate-900">
              <p className="text-lg font-semibold">
                {names.get(transfer.fromMemberId)} pays {names.get(transfer.toMemberId)} {formatMoney(transfer.amountMinor, group.currency)}
              </p>
              <Button className="mt-3" disabled={group.status !== "open" || pay.isPending} onClick={() => pay.mutate(transfer)}>
                Mark as paid
              </Button>
            </li>
          ))}
        </ul>
      )}
      <section>
        <h2 className="mb-2 text-lg font-semibold">History</h2>
        {(history.data ?? []).length === 0 ? <p className="text-slate-500">No payments recorded yet.</p> : (
          <ul className="space-y-2">
            {(history.data ?? []).map((settlement) => (
              <li key={settlement.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-slate-900">
                <p>
                  {names.get(settlement.fromMemberId)} paid {names.get(settlement.toMemberId)} {formatMoney(settlement.amountMinor, group.currency)}
                  <span className="block text-sm text-slate-500">{formatDay(settlement.date)}</span>
                </p>
                {group.status === "open" ? (
                  <button type="button" className="min-h-12 text-sm font-semibold text-amber-700" onClick={() => undo.mutate(settlement.id)}>
                    Undo
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MembersTab({ group, user }: { group: Group; user: User }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const link = `${window.location.origin}/join/${group.inviteCode}`;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["group", group.id] });
  const add = useMutation({
    mutationFn: () => api.addGuest(group.id, name.trim()),
    onSuccess: async () => {
      setName("");
      await refresh();
      toast("Guest added");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not add the guest", "error"),
  });
  const remove = useMutation({
    mutationFn: (memberId: string) => api.removeMember(group.id, memberId),
    onSuccess: async () => {
      await refresh();
      toast("Member removed");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not remove the member", "error"),
  });
  const status = useMutation({
    mutationFn: () => api.updateGroup(group.id, { status: group.status === "open" ? "closed" : "open" }),
    onSuccess: async () => {
      await refresh();
      toast(group.status === "open" ? "Pot closed" : "Pot reopened");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not update the pot", "error"),
  });
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-4 dark:bg-slate-900">
        <h2 className="font-semibold">Invite link</h2>
        <p className="mt-2 break-all text-sm text-slate-600 dark:text-slate-300">{link}</p>
        <Button
          className="mt-3"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(link).then(
              () => toast("Invite link copied"),
              () => toast("Could not copy the link", "error"),
            );
          }}
        >
          Copy invite link
        </Button>
      </section>
      <ul className="space-y-2">
        {group.members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 rounded-3xl bg-white p-3 dark:bg-slate-900">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              {member.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div className="flex-1">
              <p className="font-semibold">{member.displayName}</p>
              <p className="text-sm text-slate-500">{member.userId ? (member.userId === user.id ? "You" : "Account") : "Guest"}</p>
            </div>
            {group.status === "open" && member.userId !== group.createdById ? (
              <button type="button" className="min-h-12 text-sm font-semibold text-amber-700" onClick={() => remove.mutate(member.id)}>
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {group.status === "open" ? (
        <form
          className="rounded-3xl bg-white p-4 dark:bg-slate-900"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) {
              add.mutate();
            }
          }}
        >
          <Field label="Add a guest">
            <input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
          </Field>
          <Button type="submit" className="mt-3" disabled={add.isPending || name.trim().length === 0}>
            Add guest
          </Button>
        </form>
      ) : null}
      {group.createdById === user.id ? (
        <Button variant="secondary" onClick={() => status.mutate()} disabled={status.isPending}>
          {group.status === "open" ? "Close pot" : "Reopen pot"}
        </Button>
      ) : null}
    </div>
  );
}
