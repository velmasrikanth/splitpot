import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../../api/client";
import { Skeleton } from "../../components/Skeleton";
import { ErrorState } from "../../components/States";
import { useToast } from "../../components/Toast";

export function JoinPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  const started = useRef(false);
  const join = useMutation({
    mutationFn: () => api.joinGroup(code),
    onSuccess: async (group) => {
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast(`Joined ${group.name}`);
      navigate(`/groups/${group.id}?tab=expenses`);
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not join", "error"),
  });

  useEffect(() => {
    if (!me.data || started.current || code.length < 4) {
      return;
    }
    started.current = true;
    join.mutate();
  }, [code, join, me.data]);

  if (me.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <Skeleton className="h-40 w-full max-w-md" />
      </main>
    );
  }
  if (!me.data) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center dark:bg-slate-900">
          <h1 className="text-2xl font-bold">You are invited</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Log in or create an account to join this pot.</p>
          <div className="mt-5 grid gap-3">
            <Link className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-600 font-semibold text-white" to={`/login?next=/join/${code}`}>
              Log in
            </Link>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-100 font-semibold dark:bg-slate-800" to={`/signup?next=/join/${code}`}>
              Sign up
            </Link>
          </div>
        </section>
      </main>
    );
  }
  if (join.isError) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <ErrorState message={join.error.message} />
      </main>
    );
  }
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <p className="text-lg font-semibold">Joining the pot…</p>
    </main>
  );
}
