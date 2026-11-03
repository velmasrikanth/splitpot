import { useEffect, type ReactNode } from "react";

export function ModalSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" className="absolute inset-0 bg-slate-950/50" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="sheet-title" className="text-xl font-semibold">
            {title}
          </h2>
          <button type="button" className="min-h-12 rounded-2xl px-3 text-sm font-semibold text-slate-600 dark:text-slate-300" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
