import {
  CalendarOff,
  CheckCircle2,
  Flame,
  Layers,
  ListTodo,
  LogOut,
  Plus,
  Settings,
  Shield,
  Sparkles,
} from "lucide-react";
import { DEFAULT_USER_SETTINGS } from "../services/userSettings";

export function Sidebar({
  user,
  profile,
  categories = DEFAULT_USER_SETTINGS.categories,
  activeView,
  onSelectView,
  selectedCategory,
  onSelectCategory,
  activeTasks,
  unscheduledCount,
  completedTodayCount,
  isCompletedPulsing,
  onOpenCreate,
  onOpenSettings,
  onLogout,
}) {
  const displayName = profile?.displayName || user?.displayName || "Adventurer";
  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;

  return (
    <aside
      aria-label="Workspace navigation"
      className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[272px] lg:shrink-0 lg:flex-col lg:justify-between lg:border-r lg:border-slate-800/80 lg:bg-[#0a0e16]/95 lg:p-5"
    >
      <div className="space-y-6 overflow-y-auto pr-0.5">
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-orange-500/35 bg-orange-500/10 shadow-inner shadow-orange-500/10">
            <Flame className="h-5 w-5 text-orange-400" strokeWidth={1.85} />
          </div>
          <div className="min-w-0">
            <span className="block text-base font-bold tracking-wider text-slate-100">
              EMBER
            </span>
            <span className="block truncate text-xs text-slate-400">
              {displayName}
            </span>
          </div>
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onOpenCreate}
          className="flex min-h-[42px] w-full cursor-pointer items-center justify-between rounded-md border border-orange-400/40 bg-orange-600 px-3.5 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-orange-950/30 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        >
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>New Task</span>
          </span>
          <kbd className="rounded border border-slate-950/25 bg-slate-950/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-950/85">
            N
          </kbd>
        </button>

        {/* Views */}
        <div>
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Views
          </p>
          <nav className="mt-2 space-y-1" aria-label="Task views">
            <button
              type="button"
              onClick={() => onSelectView("active")}
              aria-current={activeView === "active" ? "page" : undefined}
              className={`flex min-h-[38px] w-full cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                activeView === "active"
                  ? "border-orange-500/45 bg-orange-500/15 text-orange-200"
                  : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-[#0f1522] hover:text-slate-200"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                <span>Active Tasks</span>
              </span>
              <span className="rounded bg-black/30 px-1.5 py-0.5 text-[11px] tabular-nums">
                {activeTasks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView("unscheduled")}
              aria-current={activeView === "unscheduled" ? "page" : undefined}
              className={`flex min-h-[38px] w-full cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                activeView === "unscheduled"
                  ? "border-orange-500/45 bg-orange-500/15 text-orange-200"
                  : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-[#0f1522] hover:text-slate-200"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <CalendarOff className="h-4 w-4" />
                <span>Unscheduled</span>
              </span>
              <span className="rounded bg-black/30 px-1.5 py-0.5 text-[11px] tabular-nums">
                {unscheduledCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView("completed")}
              aria-current={activeView === "completed" ? "page" : undefined}
              className={`flex min-h-[38px] w-full cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                activeView === "completed"
                  ? "border-orange-500/45 bg-orange-500/15 text-orange-200"
                  : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-[#0f1522] hover:text-slate-200"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Completed Today</span>
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] tabular-nums transition-colors ${
                  isCompletedPulsing
                    ? "ember-badge-pulse bg-orange-500/35 font-semibold text-orange-200"
                    : "bg-black/30"
                }`}
              >
                {completedTodayCount}
              </span>
            </button>
          </nav>
        </div>

        {/* Category Filters */}
        <div>
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Categories
          </p>
          <div
            role="group"
            aria-label="Filter by category"
            className="mt-2 space-y-1"
          >
            <button
              type="button"
              onClick={() => onSelectCategory("ALL")}
              aria-pressed={selectedCategory === "ALL"}
              className={`flex min-h-[36px] w-full cursor-pointer items-center justify-between rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                selectedCategory === "ALL"
                  ? "border-amber-500/40 bg-[#121927] text-amber-200"
                  : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-[#0f1522] hover:text-slate-200"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 opacity-80" />
                <span>All</span>
              </span>
              <span className="text-[11px] opacity-75 tabular-nums">
                {activeTasks.length}
              </span>
            </button>

            {categories.map((category) => {
              const count = activeTasks.filter(
                (t) => t.category === category
              ).length;
              const isActive = selectedCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onSelectCategory(category)}
                  aria-pressed={isActive}
                  className={`flex min-h-[36px] w-full cursor-pointer items-center justify-between rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                    isActive
                      ? "border-amber-500/40 bg-[#121927] text-amber-200"
                      : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-[#0f1522] hover:text-slate-200"
                  }`}
                >
                  <span>{category}</span>
                  <span className="text-[11px] opacity-75 tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reserved Player Stats & Sign Out */}
      <div className="mt-6 space-y-3 border-t border-slate-800/80 pt-4">
        <div className="rounded-md border border-amber-500/20 bg-[#0d121d] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Player Card
            </span>
            <span className="text-[10px] text-amber-400/75">Phase 1</span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-1.5 rounded border border-amber-500/25 bg-[#101622] px-2 py-1.5 text-xs font-semibold text-amber-300">
              <Shield className="h-3.5 w-3.5 text-amber-400" />
              <span>LVL {level}</span>
            </div>
            <div className="flex flex-1 items-center gap-1.5 rounded border border-slate-700/80 bg-[#101622] px-2 py-1.5 text-xs font-medium text-slate-200">
              <Sparkles className="h-3.5 w-3.5 text-orange-400" />
              <span>{xp} XP</span>
            </div>
          </div>

          <p className="mt-2 text-[10px] text-slate-500">
            Progression unlocks in Phase 2
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="flex min-h-[38px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-800 bg-[#101622] px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-amber-500/40 hover:bg-slate-800/80 hover:text-orange-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Settings</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-[38px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-800 bg-[#101622] px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800/80 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
