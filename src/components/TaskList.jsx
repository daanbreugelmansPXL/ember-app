import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Flag,
  ListPlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import {
  CATEGORIES,
  TIME_BLOCKS,
  formatShortDate,
  getTaskDuration,
  groupTasksWithSubtasks,
} from "../utils/schedule";

function TaskItemRow({
  task,
  isSubtask,
  slot,
  isBusy,
  swapSourceId,
  confirmDeleteId,
  subtaskProgress,
  onToggleComplete,
  onStartSwap,
  onExecuteSwap,
  onCancelSwap,
  onOpenAddSubtask,
  onOpenEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}) {
  const isScheduled = Boolean(task.workDate && task.timeBlock && slot);
  const block = task.timeBlock ? TIME_BLOCKS[task.timeBlock] : null;
  const durationMin = getTaskDuration(task);
  const hasOverride = typeof task.durationOverride === "number";

  const isSwapSource = swapSourceId === task.id;
  const isSwapTarget =
    Boolean(swapSourceId) && !isSwapSource && !task.completed && isScheduled;
  const isDeletingConfirm = confirmDeleteId === task.id;
  const checkboxId = `ember-task-cb-${task.id}`;

  const cardHighlight = isSwapSource
    ? "border-orange-500/80 bg-orange-500/10 ring-1 ring-orange-500/40"
    : isSwapTarget
      ? "border-amber-500/50 bg-[#121826] hover:border-orange-400"
      : isSubtask
        ? "border-transparent hover:bg-slate-800/40"
        : "border-slate-800/90 bg-[#0d121c]/90 hover:border-amber-500/30";

  return (
    <div
      className={`flex items-start justify-between gap-2.5 rounded-md border transition-colors ${
        isSubtask ? "px-2.5 py-2" : "px-3.5 py-3 sm:px-4"
      } ${cardHighlight}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className={`flex items-center ${isSubtask ? "h-5" : "h-6"}`}>
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
          ) : (
            <input
              id={checkboxId}
              type="checkbox"
              className={`ember-checkbox ${isSubtask ? "text-[13px]" : ""}`}
              checked={task.completed}
              disabled={isBusy}
              onChange={() => onToggleComplete(task)}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <label
              htmlFor={checkboxId}
              className={`cursor-pointer font-medium leading-snug ${
                isSubtask ? "text-[13px]" : "text-sm"
              } ${
                task.completed
                  ? "text-slate-500 line-through"
                  : "text-slate-100"
              }`}
            >
              {task.title}
            </label>

            <span className="inline-flex items-center rounded border border-slate-700/80 bg-[#131a29] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-300/90">
              {task.size}
              {hasOverride ? ` · ${durationMin}m` : ""}
            </span>

            <span className="inline-flex items-center rounded border border-slate-800 bg-[#101622] px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
              {task.category}
            </span>

            {subtaskProgress && (
              <span className="inline-flex items-center rounded border border-slate-800 bg-[#0a0f18] px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                {subtaskProgress.done}/{subtaskProgress.total}
              </span>
            )}
          </div>

          {(isScheduled || task.deadline) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
              {isScheduled && block && (
                <span className="inline-flex items-center gap-1 rounded border border-orange-500/25 bg-orange-500/10 px-1.5 py-0.5 text-orange-200/90">
                  <Clock className="h-3 w-3 text-orange-400" />
                  <span>
                    {formatShortDate(task.workDate)} · {block.label} ·{" "}
                    {slot.startLabel}–{slot.endLabel}
                  </span>
                </span>
              )}

              {task.deadline && (
                <span className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-950/35 px-1.5 py-0.5 text-red-200/90">
                  <Flag className="h-3 w-3 text-red-400" />
                  <span>[DL] {formatShortDate(task.deadline)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 items-center gap-1">
        {isSwapTarget && (
          <button
            type="button"
            onClick={() => onExecuteSwap(task.id)}
            disabled={isBusy}
            className="inline-flex min-h-[32px] cursor-pointer items-center gap-1 rounded border border-orange-400/50 bg-orange-600 px-2.5 py-1 text-[11px] font-semibold text-slate-950 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            <ArrowLeftRight className="h-3 w-3" />
            <span>Wissel</span>
          </button>
        )}

        {!task.completed && isScheduled && !isSwapTarget && (
          <button
            type="button"
            onClick={() =>
              isSwapSource ? onCancelSwap() : onStartSwap(task.id)
            }
            disabled={isBusy}
            title={isSwapSource ? "Swap annuleren" : "Wissel met andere taak"}
            aria-label={
              isSwapSource ? "Swap annuleren" : `Swap ${task.title}`
            }
            className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
              isSwapSource
                ? "border-orange-500 bg-orange-500/20 text-orange-300"
                : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800/80 hover:text-orange-300"
            }`}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </button>
        )}

        {!task.completed && !isSubtask && (
          <button
            type="button"
            onClick={() => onOpenAddSubtask(task)}
            disabled={isBusy}
            title="Subtaak toevoegen"
            aria-label={`Subtaak toevoegen aan ${task.title}`}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-transparent text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-800/80 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            <ListPlus className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenEdit(task)}
          disabled={isBusy}
          title="Taak bewerken"
          aria-label={`Bewerk ${task.title}`}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-transparent text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-800/80 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        {isDeletingConfirm ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onConfirmDelete(task)}
              disabled={isBusy}
              className="inline-flex h-8 cursor-pointer items-center rounded border border-red-500/50 bg-red-600/25 px-2 text-[11px] font-semibold text-red-200 hover:bg-red-600/40"
            >
              Wis
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              disabled={isBusy}
              aria-label="Verwijderen annuleren"
              className="inline-flex h-8 w-7 cursor-pointer items-center justify-center rounded border border-slate-700 text-slate-400 hover:text-slate-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onRequestDelete(task.id)}
            disabled={isBusy}
            title="Taak verwijderen"
            aria-label={`Verwijder ${task.title}`}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-transparent text-slate-500 transition-colors hover:border-red-500/30 hover:bg-red-950/30 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function TaskList({
  tasks,
  scheduleMap,
  isLoading,
  busyTaskIds,
  error,
  calendarNeedsReconnect,
  calendarError,
  onDismissCalendarError,
  onReconnectCalendar,
  swapSourceId,
  onStartSwap,
  onExecuteSwap,
  onCancelSwap,
  onOpenCreate,
  onOpenAddSubtask,
  onOpenEdit,
  onToggleComplete,
  onDeleteTask,
}) {
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [showCompleted, setShowCompleted] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const openTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  const filteredOpenTasks =
    selectedCategory === "ALL"
      ? openTasks
      : openTasks.filter((t) => t.category === selectedCategory);

  const filteredCompletedTasks =
    selectedCategory === "ALL"
      ? completedTasks
      : completedTasks.filter((t) => t.category === selectedCategory);

  const groupedOpenTasks = groupTasksWithSubtasks(filteredOpenTasks);
  const groupedCompletedTasks = groupTasksWithSubtasks(filteredCompletedTasks);

  const swapSourceTask = swapSourceId
    ? tasks.find((t) => t.id === swapSourceId)
    : null;

  const subtaskCountByParent = new Map();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const entry = subtaskCountByParent.get(t.parentId) || { total: 0, done: 0 };
    entry.total += 1;
    if (t.completed) entry.done += 1;
    subtaskCountByParent.set(t.parentId, entry);
  }

  const handleConfirmDelete = (task) => {
    setConfirmDeleteId(null);
    onDeleteTask(task);
  };

  return (
    <section aria-labelledby="tasks-heading" className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div>
          <h1
            id="tasks-heading"
            className="text-lg font-semibold tracking-tight text-slate-100"
          >
            Openstaande Taken
          </h1>
          <p className="text-xs text-slate-400">
            Opgeslagen in Ember · One-way sync met Google Agenda
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreate}
          className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-md border border-orange-400/40 bg-orange-600 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-orange-950/30 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        >
          <Plus className="h-4 w-4" />
          <span>Nieuwe taak</span>
        </button>
      </div>

      {/* Non-blocking Google Calendar reconnect banner */}
      {calendarNeedsReconnect && (
        <div
          role="status"
          className="rounded-lg border border-orange-500/35 bg-[#121622] p-4 shadow-lg shadow-black/40"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-orange-500/30 bg-orange-500/10">
                <Unplug className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-slate-100 sm:text-sm">
                  Google Agenda niet gekoppeld
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                  Je taken werken gewoon door in Firestore. Verbind opnieuw om werkmomenten en deadlines te synchroniseren.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onReconnectCalendar}
              className="inline-flex min-h-[40px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-orange-400/40 bg-orange-600 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            >
              Verbind opnieuw met Google Agenda
            </button>
          </div>
        </div>
      )}

      {/* Non-auth Calendar sync notice */}
      {calendarError && !calendarNeedsReconnect && (
        <div
          role="alert"
          className="flex items-start justify-between gap-2.5 rounded-md border border-amber-500/35 bg-amber-950/25 px-3.5 py-2.5 text-xs text-amber-200"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>{calendarError}</span>
          </div>
          <button
            type="button"
            onClick={onDismissCalendarError}
            aria-label="Melding sluiten"
            className="cursor-pointer text-amber-300/80 hover:text-amber-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Swap mode banner */}
      {swapSourceTask && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-orange-500/50 bg-orange-500/10 px-4 py-2.5 text-xs text-orange-100"
        >
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 shrink-0 text-orange-400" />
            <span>
              Swap-modus actief: kies een andere geplande taak om te wisselen met{" "}
              <strong className="text-orange-200">{swapSourceTask.title}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelSwap}
            className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded border border-orange-400/40 bg-[#101622] px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-orange-400"
          >
            <X className="h-3 w-3" />
            <span>Annuleren</span>
          </button>
        </div>
      )}

      {/* Category filter bar */}
      <div
        role="group"
        aria-label="Filter op categorie"
        className="flex flex-wrap items-center gap-2"
      >
        <button
          type="button"
          onClick={() => setSelectedCategory("ALL")}
          aria-pressed={selectedCategory === "ALL"}
          className={`inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
            selectedCategory === "ALL"
              ? "border-orange-500/50 bg-orange-500/15 text-orange-200"
              : "border-slate-800 bg-[#0d121d] text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <span>Alle</span>
          <span className="text-[11px] opacity-75">{openTasks.length}</span>
        </button>

        {CATEGORIES.map((category) => {
          const count = openTasks.filter((t) => t.category === category).length;
          const isActive = selectedCategory === category;

          return (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              aria-pressed={isActive}
              className={`inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                isActive
                  ? "border-orange-500/50 bg-orange-500/15 text-orange-200"
                  : "border-slate-800 bg-[#0d121d] text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <span>{category}</span>
              <span className="text-[11px] opacity-75">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Firestore error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-red-500/30 bg-red-950/30 px-4 py-3 text-xs text-red-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && tasks.length === 0 && (
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
      {!isLoading && groupedOpenTasks.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800/80 bg-[#0b0f18]/80 px-6 py-12 text-center">
          <CheckCircle2
            className="mb-3 h-8 w-8 text-orange-400/70"
            strokeWidth={1.5}
          />
          <p className="text-sm font-medium text-slate-200">
            {selectedCategory === "ALL"
              ? "Geen openstaande taken."
              : `Geen openstaande taken in ${selectedCategory}.`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Maak een nieuwe taak aan en plan desgewenst een dagdeel of deadline.
          </p>
        </div>
      )}

      {/* Open task list */}
      {groupedOpenTasks.length > 0 && (
        <ul className="space-y-2.5">
          {groupedOpenTasks.map((task) => {
            const slot = scheduleMap.get(task.id) || null;
            const subtaskProgress = subtaskCountByParent.get(task.id) || null;

            return (
              <li key={task.id} className="space-y-1">
                <TaskItemRow
                  task={task}
                  isSubtask={false}
                  slot={slot}
                  isBusy={busyTaskIds.has(task.id)}
                  swapSourceId={swapSourceId}
                  confirmDeleteId={confirmDeleteId}
                  subtaskProgress={subtaskProgress}
                  onToggleComplete={onToggleComplete}
                  onStartSwap={onStartSwap}
                  onExecuteSwap={onExecuteSwap}
                  onCancelSwap={onCancelSwap}
                  onOpenAddSubtask={onOpenAddSubtask}
                  onOpenEdit={onOpenEdit}
                  onRequestDelete={(id) => setConfirmDeleteId(id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onConfirmDelete={handleConfirmDelete}
                />

                {task.subtasks.length > 0 && (
                  <ul
                    aria-label={`Subtaken van ${task.title}`}
                    className="ml-[24px] mr-1 space-y-1 border-l border-amber-500/20 pl-3.5"
                  >
                    {task.subtasks.map((subtask) => {
                      const subSlot = scheduleMap.get(subtask.id) || null;
                      return (
                        <li key={subtask.id} className="relative">
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute -left-3.5 top-[20px] h-px w-3 bg-amber-500/20"
                          />
                          <TaskItemRow
                            task={subtask}
                            isSubtask={true}
                            slot={subSlot}
                            isBusy={busyTaskIds.has(subtask.id)}
                            swapSourceId={swapSourceId}
                            confirmDeleteId={confirmDeleteId}
                            subtaskProgress={null}
                            onToggleComplete={onToggleComplete}
                            onStartSwap={onStartSwap}
                            onExecuteSwap={onExecuteSwap}
                            onCancelSwap={onCancelSwap}
                            onOpenAddSubtask={onOpenAddSubtask}
                            onOpenEdit={onOpenEdit}
                            onRequestDelete={(id) => setConfirmDeleteId(id)}
                            onCancelDelete={() => setConfirmDeleteId(null)}
                            onConfirmDelete={handleConfirmDelete}
                          />
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

      {/* Collapsible completed tasks */}
      {groupedCompletedTasks.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowCompleted((prev) => !prev)}
            aria-expanded={showCompleted}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
          >
            {showCompleted ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span>Voltooide taken ({filteredCompletedTasks.length})</span>
          </button>

          {showCompleted && (
            <ul className="mt-2.5 space-y-2 opacity-80">
              {groupedCompletedTasks.map((task) => {
                const slot = scheduleMap.get(task.id) || null;
                return (
                  <li key={task.id} className="space-y-1">
                    <TaskItemRow
                      task={task}
                      isSubtask={false}
                      slot={slot}
                      isBusy={busyTaskIds.has(task.id)}
                      swapSourceId={swapSourceId}
                      confirmDeleteId={confirmDeleteId}
                      subtaskProgress={null}
                      onToggleComplete={onToggleComplete}
                      onStartSwap={onStartSwap}
                      onExecuteSwap={onExecuteSwap}
                      onCancelSwap={onCancelSwap}
                      onOpenAddSubtask={onOpenAddSubtask}
                      onOpenEdit={onOpenEdit}
                      onRequestDelete={(id) => setConfirmDeleteId(id)}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                      onConfirmDelete={handleConfirmDelete}
                    />

                    {task.subtasks.length > 0 && (
                      <ul
                        aria-label={`Voltooide subtaken van ${task.title}`}
                        className="ml-[24px] mr-1 space-y-1 border-l border-amber-500/15 pl-3.5"
                      >
                        {task.subtasks.map((subtask) => (
                          <li key={subtask.id} className="relative">
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute -left-3.5 top-[20px] h-px w-3 bg-amber-500/15"
                            />
                            <TaskItemRow
                              task={subtask}
                              isSubtask={true}
                              slot={scheduleMap.get(subtask.id) || null}
                              isBusy={busyTaskIds.has(subtask.id)}
                              swapSourceId={swapSourceId}
                              confirmDeleteId={confirmDeleteId}
                              subtaskProgress={null}
                              onToggleComplete={onToggleComplete}
                              onStartSwap={onStartSwap}
                              onExecuteSwap={onExecuteSwap}
                              onCancelSwap={onCancelSwap}
                              onOpenAddSubtask={onOpenAddSubtask}
                              onOpenEdit={onOpenEdit}
                              onRequestDelete={(id) => setConfirmDeleteId(id)}
                              onCancelDelete={() => setConfirmDeleteId(null)}
                              onConfirmDelete={handleConfirmDelete}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
