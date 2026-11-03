import type { SummaryMember } from "../../api/types";
import { formatMoney } from "../../lib/money";

export function BalanceList({ currency, members }: { currency: string; members: SummaryMember[] }) {
  const max = Math.max(...members.map((member) => Math.abs(member.netMinor)), 1);
  return (
    <ul className="space-y-4">
      {members.map((member) => {
        const tone = member.netMinor > 0 ? "positive" : member.netMinor < 0 ? "negative" : "zero";
        const label = tone === "positive" ? "gets back" : tone === "negative" ? "owes" : "settled";
        return (
          <li key={member.memberId} data-tone={tone}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="font-semibold">{member.displayName}</span>
              <span className={tone === "positive" ? "text-emerald-700 dark:text-emerald-300" : tone === "negative" ? "text-amber-700 dark:text-amber-300" : "text-slate-500"}>
                {label} {formatMoney(Math.abs(member.netMinor), currency)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
              <div
                className={`h-full rounded-full ${tone === "negative" ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${(Math.abs(member.netMinor) / max) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Paid {formatMoney(member.paidMinor, currency)} · share {formatMoney(member.shareMinor, currency)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
