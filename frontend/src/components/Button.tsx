import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const styles: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
  danger: "bg-amber-600 text-white hover:bg-amber-700",
};

export function Button({ variant = "primary", className = "", type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-4 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
