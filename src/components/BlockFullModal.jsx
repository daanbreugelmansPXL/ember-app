import { AlertTriangle, Clock, Sparkles } from "lucide-react";

export function BlockFullModal({
  overflowResults,
  canAutoFit,
  mode,
  isBusy,
  onChooseOther,
  onConfirmAutoFit,
}) {
  if (!overflowResults || overflowResults.length === 0) return null;

  const primaryBlock = overflowResults[0].block;
  const headingText =
    overflowResults.length === 1
      ? `${primaryBlock.label} zit vol. Wat wil je doen?`
      : `${overflowResults.map((r) => r.block.label).join(" en ")} zitten vol. Wat wil je doen?`;

  const changedAdjustments = overflowResults.flatMap((res) =>
    (res.adjustments || []).filter((adj) => adj.oldDuration !== adj.newDuration)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-full-title"
    >
      <div className="relative w-full max-w-md rounded-lg border border-amber-500/35 bg-[#0c1018] p-5 shadow-2xl shadow-black/80 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"
        />

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-amber-500/35 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h2
              id="block-full-title"
              className="text-base font-semibold text-slate-100"
            >
              {headingText}
            </h2>
            <div className="mt-1.5 space-y-1 text-xs text-slate-400">
              {overflowResults.map((res) => (
                <p key={res.block.id} className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  <span>
                    {res.block.label} ({res.block.rangeLabel}): nodig{" "}
                    <strong className="text-slate-200">{res.totalRequired} min</strong>{" "}
                    · beschikbaar{" "}
                    <strong className="text-slate-200">{res.availableMin} min</strong>
                  </span>
                </p>
              ))}
            </div>
          </div>
        </div>

        {canAutoFit ? (
          <div className="mt-4 rounded-md border border-slate-800 bg-[#080c14] p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-amber-300/90">
              Voorstel Auto-fit (stappen van 15 min)
            </p>
            <ul className="mt-2 space-y-1.5 text-xs">
              {changedAdjustments.map((adj) => (
                <li
                  key={adj.taskId}
                  className="flex items-center justify-between gap-2 text-slate-300"
                >
                  <span className="truncate">{adj.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-orange-300">
                    {adj.oldDuration}m -&gt; {adj.newDuration}m
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-950/25 p-3 text-xs leading-relaxed text-red-200">
            Zelfs als elke openstaande taak naar het minimum van 15 min wordt
            teruggebracht, past dit niet binnen het dagdeel.
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onChooseOther}
            disabled={isBusy}
            className="min-h-[40px] cursor-pointer rounded-md border border-slate-700/80 bg-[#101622] px-4 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 disabled:opacity-50"
          >
            {mode === "swap" ? "Annuleren" : "Ander dagdeel kiezen"}
          </button>

          {canAutoFit && (
            <button
              type="button"
              onClick={onConfirmAutoFit}
              disabled={isBusy}
              className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-orange-400/40 bg-orange-600 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isBusy ? "Toepassen..." : "Passend maken (Auto-fit)"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
