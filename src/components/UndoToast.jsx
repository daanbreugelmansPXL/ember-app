import { CheckCircle2, Trash2, Undo2, X } from "lucide-react";

export function UndoToast({ toast, onUndo, onConfirmParent, onDismiss }) {
  if (!toast) return null;

  const isParentPrompt = toast.type === "parentPrompt";
  const isDelete = toast.type === "delete";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-5 z-50 mx-auto flex max-w-lg flex-wrap items-center justify-between gap-2.5 rounded-lg border border-orange-500/40 bg-[#0d121d]/95 px-4 py-3 text-xs text-slate-100 shadow-2xl shadow-black/80 backdrop-blur-md"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {isDelete ? (
          <Trash2 className="h-4 w-4 shrink-0 text-amber-400" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-orange-400" />
        )}
        <span className="font-medium text-slate-100">{toast.message}</span>
      </div>

      <div className="flex items-center gap-2">
        {isParentPrompt && (
          <button
            type="button"
            onClick={onConfirmParent}
            className="inline-flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded border border-orange-400/50 bg-orange-600 px-2.5 py-1 text-[11px] font-semibold text-slate-950 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            <span>Complete Parent</span>
          </button>
        )}

        <button
          type="button"
          onClick={onUndo}
          className="inline-flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded border border-slate-700/80 bg-[#121826] px-2.5 py-1 text-[11px] font-semibold text-orange-300 transition-colors hover:border-orange-500/50 hover:text-orange-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        >
          <Undo2 className="h-3.5 w-3.5" />
          <span>Undo</span>
          <kbd className="hidden rounded border border-slate-700 bg-black/30 px-1 py-0.5 font-mono text-[9px] text-slate-400 lg:inline-block">
            Ctrl+Z
          </kbd>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
