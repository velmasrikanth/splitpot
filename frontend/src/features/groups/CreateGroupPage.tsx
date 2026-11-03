import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ApiError, api } from "../../api/client";
import type { Group } from "../../api/types";
import { Button } from "../../components/Button";
import { Field, controlClass } from "../../components/Field";
import { useToast } from "../../components/Toast";

const schema = z.object({
  name: z.string().trim().min(1, "Name the pot").max(80),
  type: z.enum(["party", "trip"]),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]),
  startDate: z.string(),
  endDate: z.string(),
});

export function CreateGroupPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [created, setCreated] = useState<Group | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", type: "trip", currency: "INR", startDate: "", endDate: "" },
  });
  const mutation = useMutation({
    mutationFn: api.createGroup,
    onSuccess: (group) => {
      setCreated(group);
      toast("Pot created");
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not create the pot", "error"),
  });

  if (created) {
    const link = `${window.location.origin}/join/${created.inviteCode}`;
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
        <h1 className="text-2xl font-bold">{created.name} is ready</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Share this invite so people with an account can join.</p>
        <p className="mt-4 break-all rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-950">{link}</p>
        <div className="mt-4 grid gap-3">
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(link).then(
                () => toast("Invite link copied"),
                () => toast("Could not copy the link", "error"),
              );
            }}
          >
            Copy invite link
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/groups/${created.id}?tab=members`)}>
            Open the pot
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-2xl font-bold">New pot</h1>
      <form
        className="mt-4 space-y-4 rounded-3xl bg-white p-5 dark:bg-slate-900"
        onSubmit={form.handleSubmit((values) => {
          if (values.startDate && values.endDate && values.endDate < values.startDate) {
            form.setError("endDate", { message: "End date must be on or after the start date" });
            return;
          }
          mutation.mutate({
            name: values.name,
            type: values.type,
            currency: values.currency,
            startDate: values.startDate || null,
            endDate: values.endDate || null,
          });
        })}
      >
        <Field label="Name" error={form.formState.errors.name?.message}>
          <input className={controlClass} {...form.register("name")} />
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold">Type</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["party", "trip"] as const).map((type) => (
              <button key={type} type="button" aria-pressed={form.watch("type") === type} className={`min-h-12 rounded-2xl font-semibold capitalize ${form.watch("type") === type ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`} onClick={() => form.setValue("type", type)}>
                {type}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Currency">
          <select className={controlClass} {...form.register("currency")}>
            {["INR", "USD", "EUR", "GBP"].map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" hint="Optional">
            <input className={controlClass} type="date" {...form.register("startDate")} />
          </Field>
          <Field label="End date" hint="Optional" error={form.formState.errors.endDate?.message}>
            <input className={controlClass} type="date" {...form.register("endDate")} />
          </Field>
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          Create pot
        </Button>
        <p className="text-center text-sm">
          <Link to="/dashboard" className="text-slate-500">
            Cancel
          </Link>
        </p>
      </form>
    </section>
  );
}
