import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export function StatusToast({ toast, onDismiss }) {
  if (!toast || !toast.message) return null;

  const isError = toast.type === "error";
  const isSuccess = toast.type === "success";

  const containerStyle = isError
    ? "border-red-500/45 bg-[#160c10]/95 text-red-100"
    : isSuccess
      ? "border-emerald-500/40 bg-[#0b1512]/95 text-emerald-100"
      : "border-orange-500/40 bg-[#0d121d]/95 text-slate-100";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-4 bottom-5 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs shadow-2xl shadow-black/80 backdrop-blur-md sm:left-auto sm:right-5 sm:mx-0 ${containerStyle}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {isError ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
        ) : isSuccess ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        ) : (
          <Info className="h-4 w-4 shrink-0 text-orange-400" />
        )}
        <span className="font-medium leading-snug">{toast.message}</span>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss status message"
        className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-slate-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
