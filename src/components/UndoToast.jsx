import { CheckCircle2, Undo2, X } from "lucide-react";

export function UndoToast({ toast, onUndo, onDismiss }) {
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-5 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-orange-500/40 bg-[#0d121d]/95 px-4 py-3 text-xs text-slate-100 shadow-2xl shadow-black/80 backdrop-blur-md"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-orange-400" />
        <span className="truncate font-medium">
          {toast.message} —{" "}
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex cursor-pointer items-center gap-1 font-semibold text-orange-300 underline decoration-orange-400/50 underline-offset-2 hover:text-orange-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span>Ongedaan maken</span>
          </button>
        </span>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Melding sluiten"
        className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
