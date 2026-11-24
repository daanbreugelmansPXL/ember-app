import { Flame, ShieldCheck, ArrowRight, AlertCircle } from "lucide-react";

export function LoginScreen({ onLogin, isLoggingIn, error }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#07090e] px-4 py-12">
      {/* Subtle campfire radial ambiance */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(234,88,12,0.16),_transparent_55%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-orange-600/5 blur-3xl"
      />

      <section className="relative w-full max-w-md rounded-lg border border-amber-500/20 bg-[#0c1018]/90 p-8 shadow-2xl shadow-black/70 backdrop-blur-md">
        {/* Top metallic hairline accent */}
        <div
          aria-hidden="true"
          className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"
        />

        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10 shadow-inner shadow-orange-500/10">
            <Flame className="h-7 w-7 text-orange-400" strokeWidth={1.75} />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400/80">
            Fase 1 · Skelet &amp; Sync
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-100">
            EMBER
          </h1>
          <p className="mt-2.5 max-w-xs text-sm leading-relaxed text-slate-400">
            Steek het vuur aan. Elke voltooide taak telt. Verbind je Google-account om je quests te synchroniseren.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-md border border-red-500/30 bg-red-950/30 px-3.5 py-3 text-left text-xs text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-8 space-y-4">
          <button
            type="button"
            onClick={onLogin}
            disabled={isLoggingIn}
            className="group flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-orange-400/40 bg-orange-600 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-orange-950/40 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{isLoggingIn ? "Verbinden..." : "Inloggen met Google"}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
            <span>Alleen toegang tot je Google Tasks lijst</span>
          </div>
        </div>
      </section>
    </main>
  );
}
