import { Flame, LogOut, Sparkles, Shield } from "lucide-react";

export function Header({ user, profile, onLogout }) {
  const displayName = profile?.displayName || user?.displayName || "Avonturier";
  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-[#0a0e16]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-orange-500/35 bg-orange-500/10">
            <Flame className="h-5 w-5 text-orange-400" strokeWidth={1.85} />
          </div>
          <div>
            <span className="block text-base font-bold tracking-wider text-slate-100">
              EMBER
            </span>
            <span className="block text-[11px] leading-none text-slate-400">
              {displayName}
            </span>
          </div>
        </div>

        {/* Stats & Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-[#101622] px-2.5 py-1.5 text-xs font-semibold text-amber-300">
            <Shield className="h-3.5 w-3.5 text-amber-400" />
            <span>LVL {level}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#101622] px-2.5 py-1.5 text-xs font-medium text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-orange-400" />
            <span>{xp} XP</span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            aria-label="Uitloggen"
            className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#101622] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-800/80 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Uitloggen</span>
          </button>
        </div>
      </div>
    </header>
  );
}
