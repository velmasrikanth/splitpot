import type { ReactNode } from "react";

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      {children}
      {error ? <span className="block text-sm text-amber-700 dark:text-amber-300">{error}</span> : null}
      {hint && !error ? <span className="block text-sm text-slate-500 dark:text-slate-400">{hint}</span> : null}
    </label>
  );
}

export const controlClass =
  "min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-emerald-900";
