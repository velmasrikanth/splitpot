import { useCallback, useEffect, useState } from "react";

type CheckState =
  | { kind: "loading" }
  | { kind: "ok"; body: string }
  | { kind: "error"; message: string };

const initialChecks = {
  health: { kind: "loading" } as CheckState,
  ready: { kind: "loading" } as CheckState,
};

async function loadCheck(path: string): Promise<CheckState> {
  try {
    const response = await fetch(path, { headers: { Accept: "application/json" } });
    const body = await response.text();
    if (!response.ok) {
      return { kind: "error", message: `${response.status} ${body}` };
    }
    return { kind: "ok", body };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return { kind: "error", message };
  }
}

function StatusCard({ title, path, state }: { title: string; path: string; state: CheckState }) {
  const label = state.kind === "loading" ? "Checking" : state.kind === "ok" ? "OK" : "Unavailable";
  return (
    <li className="status">
      <header>
        <h2>{title}</h2>
        <span className={`badge ${state.kind}`}>{label}</span>
      </header>
      <pre aria-live="polite">
        {state.kind === "loading" ? `Calling ${path}...` : state.kind === "ok" ? state.body : state.message}
      </pre>
    </li>
  );
}

export function App() {
  const [checks, setChecks] = useState(initialChecks);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setChecks(initialChecks);
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const [health, ready] = await Promise.all([loadCheck("/health"), loadCheck("/ready")]);
      if (!controller.signal.aborted) {
        setChecks({ health, ready });
      }
    })();
    return () => controller.abort();
  }, [tick]);

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">SplitPot</p>
        <h1>The stack is up</h1>
        <p className="lede">
          This page calls the backend through the Vite dev server. Health is liveness. Ready checks PostgreSQL.
        </p>
        <ul className="status-list">
          <StatusCard title="GET /health" path="/health" state={checks.health} />
          <StatusCard title="GET /ready" path="/ready" state={checks.ready} />
        </ul>
        <button className="retry" type="button" onClick={refresh}>
          Check again
        </button>
      </section>
    </main>
  );
}
