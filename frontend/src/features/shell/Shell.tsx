import { Link, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { ThemeToggle } from "../../components/Theme";
import { useToast } from "../../components/Toast";
import type { User } from "../../api/types";

export function Shell({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2">
          <Link to="/dashboard" className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
            SplitPot
          </Link>
          <span className="ml-auto truncate text-sm text-slate-600 dark:text-slate-300">{user.name}</span>
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-2xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Log out"
            onClick={() => {
              void api.logout().finally(() => {
                queryClient.clear();
                window.location.assign("/");
              });
              toast("Logged out");
            }}
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
        <Outlet context={user} />
      </main>
    </div>
  );
}

export function GroupTabs({ groupId, tab }: { groupId: string; tab: string }) {
  const items = [
    ["expenses", "Expenses"],
    ["balances", "Balances"],
    ["settle", "Settle up"],
    ["members", "Members"],
  ] as const;
  return (
    <nav className="mb-4 grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900" aria-label="Group sections">
      {items.map(([id, label]) => (
        <Link
          key={id}
          to={`/groups/${groupId}?tab=${id}`}
          aria-current={tab === id ? "page" : undefined}
          className={`min-h-12 rounded-xl px-1 text-center text-sm font-semibold leading-[3rem] ${tab === id ? "bg-white text-emerald-800 shadow dark:bg-slate-800 dark:text-emerald-200" : "text-slate-600 dark:text-slate-300"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
