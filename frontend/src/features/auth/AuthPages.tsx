import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { ApiError, api } from "../../api/client";
import { Button } from "../../components/Button";
import { Field, controlClass } from "../../components/Field";
import { ThemeToggle } from "../../components/Theme";
import { useToast } from "../../components/Toast";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(200),
  password: z.string().min(1, "Enter your password").max(200),
});

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email").max(200),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/dashboard";
}

export function LandingPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  if (me.data) {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl dark:bg-slate-900">
        <div className="mb-4 flex justify-end">
          <ThemeToggle />
        </div>
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">SplitPot</p>
        <h1 className="mt-2 text-3xl font-bold">Split the party without the awkward maths</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Track who paid, who shared, and who settles up after a trip or a night out.</p>
        <div className="mt-6 grid gap-3">
          <Link to="/signup" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-600 font-semibold text-white">
            Create an account
          </Link>
          <Link to="/login" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-slate-100">
            Log in
          </Link>
        </div>
      </section>
    </main>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const mutation = useMutation({
    mutationFn: api.login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate(safeNext(params.get("next")));
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not log in", "error"),
  });
  return (
    <AuthCard title="Welcome back" footer={<Link to="/signup">Need an account? Sign up</Link>}>
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <input className={controlClass} type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Field label="Password" error={form.formState.errors.password?.message}>
          <input className={controlClass} type="password" autoComplete="current-password" {...form.register("password")} />
        </Field>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof signupSchema>>({ resolver: zodResolver(signupSchema), defaultValues: { name: "", email: "", password: "" } });
  const mutation = useMutation({
    mutationFn: api.signup,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast("Account created");
      navigate(safeNext(params.get("next")));
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not sign up", "error"),
  });
  return (
    <AuthCard title="Create your account" footer={<Link to="/login">Already have an account? Log in</Link>}>
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Field label="Name" error={form.formState.errors.name?.message}>
          <input className={controlClass} autoComplete="name" {...form.register("name")} />
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <input className={controlClass} type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Field label="Password" error={form.formState.errors.password?.message}>
          <input className={controlClass} type="password" autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          Sign up
        </Button>
      </form>
    </AuthCard>
  );
}

function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl dark:bg-slate-900">
        <div className="mb-2 flex justify-end">
          <ThemeToggle />
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="mt-6">{children}</div>
        <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-300">{footer}</p>
      </section>
    </main>
  );
}
