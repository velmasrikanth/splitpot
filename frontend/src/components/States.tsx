import type { ReactNode } from "react";
import { Button } from "./Button";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-slate-600 dark:text-slate-300">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8 text-center dark:border-amber-900 dark:bg-amber-950" role="alert">
      <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">Something went wrong</h2>
      <p className="mt-2 text-amber-800 dark:text-amber-200">{message}</p>
      {onRetry ? (
        <Button className="mt-5" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
