import { useState } from "react";
import { RefreshCw, Unplug, CheckCircle2, AlertTriangle, Calendar, Loader2 } from "lucide-react";
import { groupTasksWithSubtasks } from "../services/googleTasks";

function formatDueDate(dueString) {
  if (!dueString) return null;
  try {
    const date = new Date(dueString);
    return date.toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return null;
  }
}

export function TaskList({
  taskLists = [],
  tasks,
  isLoading,
  completingIds,
  error,
  needsReconnect,
  onRefresh,
  onCompleteTask,
  onReconnect,
}) {
  const [selectedListId, setSelectedListId] = useState("ALL");

  const activeListId =
    selectedListId === "ALL" || taskLists.some((list) => list.id === selectedListId)
      ? selectedListId
      : "ALL";

  const filteredTasks =
    activeListId === "ALL"
      ? tasks
      : tasks.filter((task) => task.listId === activeListId);

  const groupedTasks = groupTasksWithSubtasks(filteredTasks);

  return (
    <section aria-labelledby="tasks-heading" className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
        <div>
          <h1 id="tasks-heading" className="text-lg font-semibold tracking-tight text-slate-100">
            Openstaande Taken
          </h1>
          <p className="text-xs text-slate-400">
            Gesynchroniseerd over al je Google Tasks lijsten
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading || needsReconnect}
          className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-md border border-slate-700/80 bg-[#0d121d] px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-orange-500/40 hover:text-orange-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-orange-400" : ""}`} />
          <span>Ververs</span>
        </button>
      </div>

      {/* Filter bar per task list */}
      {!needsReconnect && taskLists.length > 0 && (
        <div
          role="group"
          aria-label="Filter op takenlijst"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            onClick={() => setSelectedListId("ALL")}
            aria-pressed={activeListId === "ALL"}
            className={`inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
              activeListId === "ALL"
                ? "border-orange-500/50 bg-orange-500/15 text-orange-200"
                : "border-slate-800 bg-[#0d121d] text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <span>Alle</span>
            <span className="text-[11px] opacity-75">{tasks.length}</span>
          </button>

          {taskLists.map((list) => {
            const count = tasks.filter((task) => task.listId === list.id).length;
            const isActive = activeListId === list.id;

            return (
              <button
                key={list.id}
                type="button"
                onClick={() => setSelectedListId(list.id)}
                aria-pressed={isActive}
                className={`inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                  isActive
                    ? "border-orange-500/50 bg-orange-500/15 text-orange-200"
                    : "border-slate-800 bg-[#0d121d] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <span>{list.title}</span>
                <span className="text-[11px] opacity-75">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Reconnect Banner when OAuth token is missing or expired (401) */}
      {needsReconnect && (
        <div
          role="status"
          className="rounded-lg border border-orange-500/35 bg-[#121622] p-5 shadow-lg shadow-black/40"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-orange-500/30 bg-orange-500/10">
                <Unplug className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Google Tasks sessie verlopen
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Vernieuw de koppeling met Google om je openstaande taken weer op te halen en af te vinken.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onReconnect}
              className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-orange-400/40 bg-orange-600 px-4 py-2.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            >
              Verbind opnieuw met Google Tasks
            </button>
          </div>
        </div>
      )}

      {/* Non-auth error message */}
      {error && !needsReconnect && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-red-500/30 bg-red-950/30 px-4 py-3 text-xs text-red-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && tasks.length === 0 && !needsReconnect && (
        <div className="space-y-2.5" aria-busy="true" aria-label="Taken laden">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded-md border border-slate-800/70 bg-[#0d111a]"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !needsReconnect && groupedTasks.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800/80 bg-[#0b0f18]/80 px-6 py-12 text-center">
          <CheckCircle2 className="mb-3 h-8 w-8 text-orange-400/70" strokeWidth={1.5} />
          <p className="text-sm font-medium text-slate-200">
            Geen openstaande taken gevonden.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Voeg taken toe in Google Tasks en druk op Ververs.
          </p>
        </div>
      )}

      {/* Task list */}
      {!needsReconnect && groupedTasks.length > 0 && (
        <ul className="space-y-2.5">
          {groupedTasks.map((task) => {
            const isCompleting = completingIds.has(task.id);
            const dueFormatted = formatDueDate(task.due);

            return (
              <li
                key={`${task.listId}-${task.id}`}
                className="rounded-md border border-slate-800/90 bg-[#0d121c]/90 transition-colors hover:border-amber-500/30"
              >
                <label className="flex min-h-[44px] cursor-pointer items-start gap-3.5 px-4 py-3.5">
                  <div className="flex h-6 items-center">
                    {isCompleting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                    ) : (
                      <input
                        type="checkbox"
                        className="ember-checkbox"
                        checked={false}
                        disabled={isCompleting}
                        onChange={() => onCompleteTask(task.listId, task.id)}
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium leading-snug text-slate-100">
                        {task.title}
                      </span>
                      {task.listTitle && (
                        <span className="shrink-0 rounded border border-slate-700/80 bg-[#131a29] px-2 py-0.5 text-[11px] font-medium text-slate-300">
                          {task.listTitle}
                        </span>
                      )}
                    </div>

                    {(task.notes || dueFormatted) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        {dueFormatted && (
                          <span className="inline-flex items-center gap-1 text-amber-300/80">
                            <Calendar className="h-3 w-3" />
                            <span>{dueFormatted}</span>
                          </span>
                        )}
                        {task.notes && (
                          <span className="line-clamp-1 text-slate-500">
                            {task.notes}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </label>

                {task.subtasks.length > 0 && (
                  <ul
                    aria-label={`Subtaken van ${task.title}`}
                    className="mb-2.5 ml-[25px] mr-3 space-y-0.5 border-l border-amber-500/20 pl-3.5"
                  >
                    {task.subtasks.map((subtask) => {
                      const isSubCompleting = completingIds.has(subtask.id);
                      const subDueFormatted = formatDueDate(subtask.due);

                      return (
                        <li key={`${subtask.listId}-${subtask.id}`} className="relative">
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute -left-3.5 top-[22px] h-px w-3 bg-amber-500/20"
                          />
                          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded px-2 py-2 transition-colors hover:bg-slate-800/40">
                            <div className="flex h-5 items-center">
                              {isSubCompleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400" />
                              ) : (
                                <input
                                  type="checkbox"
                                  className="ember-checkbox text-[13px]"
                                  checked={false}
                                  disabled={isSubCompleting}
                                  onChange={() => onCompleteTask(subtask.listId, subtask.id)}
                                />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <span className="block text-[13px] leading-snug text-slate-300">
                                {subtask.title}
                              </span>

                              {(subtask.notes || subDueFormatted) && (
                                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-400">
                                  {subDueFormatted && (
                                    <span className="inline-flex items-center gap-1 text-amber-300/80">
                                      <Calendar className="h-2.5 w-2.5" />
                                      <span>{subDueFormatted}</span>
                                    </span>
                                  )}
                                  {subtask.notes && (
                                    <span className="line-clamp-1 text-slate-500">
                                      {subtask.notes}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
