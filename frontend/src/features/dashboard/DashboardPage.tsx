import { useQuery, useQueries } from "@tanstack/react-query";
import { Luggage, PartyPopper, Plus } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../../api/client";
import type { User } from "../../api/types";
import { Skeleton } from "../../components/Skeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { formatMoney } from "../../lib/money";

export function DashboardPage() {
  const user = useOutletContext<User>();
  const groups = useQuery({ queryKey: ["groups"], queryFn: api.listGroups });
  const summaries = useQueries({
    queries: (groups.data ?? []).map((group) => ({
      queryKey: ["summary", group.id],
      queryFn: () => api.summary(group.id),
    })),
  });

  if (groups.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    );
  }
  if (groups.isError) {
    return <ErrorState message={groups.error.message} onRetry={() => void groups.refetch()} />;
  }
  const rows = groups.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Your pots</h1>
          <p className="text-slate-600 dark:text-slate-300">Parties and trips you share.</p>
        </div>
        <Link to="/groups/new" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-emerald-600 px-4 font-semibold text-white">
          <Plus className="h-5 w-5" aria-hidden="true" /> New
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No pots yet" body="Start a dinner, a weekend, or a longer trip and invite the group." action={<Link to="/groups/new" className="font-semibold text-emerald-700">Create a pot</Link>} />
      ) : (
        <ul className="space-y-3">
          {rows.map((group, index) => {
            const summary = summaries[index]?.data;
            const mine = summary?.members.find((member) => group.members.find((item) => item.id === member.memberId)?.userId === user.id);
            const Icon = group.type === "trip" ? Luggage : PartyPopper;
            const tone = !mine || mine.netMinor === 0 ? "text-slate-500" : mine.netMinor > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300";
            const balance = !mine ? "Balance loading" : mine.netMinor === 0 ? "You are settled" : mine.netMinor > 0 ? `You get back ${formatMoney(mine.netMinor, group.currency)}` : `You owe ${formatMoney(Math.abs(mine.netMinor), group.currency)}`;
            return (
              <li key={group.id}>
                <Link to={`/groups/${group.id}?tab=expenses`} className="block rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold">{group.name}</h2>
                      <p className="text-sm capitalize text-slate-500">{group.type} · {group.status}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex -space-x-2" aria-label={`${group.members.length} members`}>
                      {group.members.slice(0, 4).map((member) => (
                        <span key={member.id} className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-bold dark:border-slate-900 dark:bg-slate-700">
                          {member.displayName.slice(0, 1).toUpperCase()}
                        </span>
                      ))}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Total spent</p>
                      <p className="font-semibold">{summary ? formatMoney(summary.totalMinor, group.currency) : "…"}</p>
                      <p className={`text-sm font-semibold ${tone}`}>{balance}</p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
