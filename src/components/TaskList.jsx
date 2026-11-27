import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarOff,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CornerDownRight,
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
  TIME_BLOCKS,
  compareTasksForDisplay,
  formatShortDate,
  groupTasksWithSubtasks,
} from "../utils/schedule";
import { DEFAULT_USER_SETTINGS } from "../services/userSettings";

function TaskItemRow({
  task,
  isSubtask,
  parentTitle,
  slot,
  isBusy,
  isHighlighted,
  isJumpable,
  swapSourceId,
  confirmDeleteId,
  subtaskProgress,
  hasRenderedSubtasks,
  isSubtasksCollapsed,
  onToggleSubtasksCollapse,
  onJumpToTask,
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

  const isSwapSource = swapSourceId === task.id;
  const isSwapTarget =
    Boolean(swapSourceId) && !isSwapSource && !task.completed && isScheduled;
  const isDeletingConfirm = confirmDeleteId === task.id;
  const checkboxId = `ember-task-cb-${task.id}`;

  const cardHighlight = isHighlighted
    ? "ember-jump-highlight bg-orange-500/10"
    : isSwapSource
      ? "border-orange-500/80 bg-orange-500/10 ring-1 ring-orange-500/40"
      : isSwapTarget
        ? "border-amber-500/50 bg-[#121826] hover:border-orange-400"
        : isSubtask
          ? "border-transparent hover:bg-slate-800/40"
          : "border-slate-800/90 bg-[#0d121c]/90 hover:border-amber-500/30";

  const showNotes =
    Boolean(task.notes) && (!hasRenderedSubtasks || !isSubtasksCollapsed);

  return (
    <div
      id={`ember-task-card-${task.id}`}
      onClick={isJumpable ? () => onJumpToTask(task) : undefined}
      className={`flex flex-col gap-2 rounded-md border transition-colors sm:flex-row sm:items-start sm:justify-between sm:gap-3 ${
        isSubtask ? "px-2.5 py-2" : "px-3.5 py-3 sm:px-4"
      } ${cardHighlight} ${isSubtask && task.completed ? "opacity-65" : ""} ${
        isJumpable ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        {/* Collapse toggle on the LEFT front of parent row */}
        {!isSubtask && hasRenderedSubtasks && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSubtasksCollapse(task.id);
            }}
            aria-expanded={!isSubtasksCollapsed}
            aria-label={
              isSubtasksCollapsed ? "Expand subtasks" : "Collapse subtasks"
            }
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            {isSubtasksCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        <div
          className={`flex items-center ${isSubtask ? "h-5" : "h-6"}`}
          onClick={(e) => e.stopPropagation()}
        >
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
          {parentTitle && (
            <div className="mb-0.5 flex items-center gap-1 text-[11px] text-slate-500">
              <CornerDownRight className="h-3 w-3 shrink-0" />
              <span className="truncate">{parentTitle}</span>
            </div>
          )}

          {/* Title + 2 minimalist badges (Size + optional Hard Deadline) */}
          <div className="flex flex-wrap items-center gap-2">
            {isJumpable ? (
              <span
                className={`font-medium leading-snug ${
                  isSubtask ? "text-[13px]" : "text-sm"
                } text-slate-100`}
              >
                {task.title}
              </span>
            ) : (
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
            )}

            <span className="inline-flex items-center rounded border border-slate-700/70 bg-[#121826] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300/90">
              {task.size}
            </span>

            {task.deadline && (
              <span className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-950/35 px-1.5 py-0.5 text-[10px] font-medium text-red-200/90">
                <Flag className="h-2.5 w-2.5 text-red-400" />
                <span>! {formatShortDate(task.deadline)}</span>
              </span>
            )}

            {subtaskProgress && (
              <span className="text-[11px] tabular-nums text-slate-500">
                {subtaskProgress.done}/{subtaskProgress.total}
              </span>
            )}
          </div>

          {/* Single calm metadata line */}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400">
            <span>{task.category}</span>
            {isScheduled && block ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-500" />
                  <span>
                    {formatShortDate(task.workDate)} · {block.label} ·{" "}
                    {slot.startLabel}–{slot.endLabel}
                  </span>
                </span>
              </>
            ) : !task.completed ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-500">Unscheduled</span>
              </>
            ) : null}
          </div>

          {/* Notes */}
          {showNotes && (
            <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-slate-400/80">
              {task.notes}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div
        className="flex shrink-0 items-center justify-end gap-1 pl-7 sm:pl-0"
        onClick={(e) => e.stopPropagation()}
      >
        {isSwapTarget && (
          <button
            type="button"
            onClick={() => onExecuteSwap(task.id)}
            disabled={isBusy}
            className="inline-flex min-h-[32px] cursor-pointer items-center gap-1 rounded border border-orange-400/50 bg-orange-600 px-2.5 py-1 text-[11px] font-semibold text-slate-950 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            <ArrowLeftRight className="h-3 w-3" />
            <span>Swap</span>
          </button>
        )}

        {!task.completed && isScheduled && !isSwapTarget && (
          <button
            type="button"
            onClick={() =>
              isSwapSource ? onCancelSwap() : onStartSwap(task.id)
            }
            disabled={isBusy}
            title={isSwapSource ? "Cancel swap" : "Swap with another task"}
            aria-label={isSwapSource ? "Cancel swap" : `Swap ${task.title}`}
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
            title="Add subtask"
            aria-label={`Add subtask to ${task.title}`}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-transparent text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-800/80 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            <ListPlus className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenEdit(task)}
          disabled={isBusy}
          title="Edit task"
          aria-label={`Edit ${task.title}`}
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
              Confirm
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              disabled={isBusy}
              aria-label="Cancel delete"
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
            title="Delete task"
            aria-label={`Delete ${task.title}`}
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
  allTasks,
  activeTasks,
  unscheduledTasks,
  completedTodayTasks,
  categories = DEFAULT_USER_SETTINGS.categories,
  activeView,
  onSelectView,
  selectedCategory,
  onSelectCategory,
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
  collapsedParentIds,
  onToggleSubtasksCollapse,
  highlightedTaskId,
  isCompletedPulsing,
  onJumpToTask,
  onOpenCreate,
  onOpenAddSubtask,
  onOpenEdit,
  onToggleComplete,
  onDeleteTask,
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const taskById = useMemo(
    () => new Map(allTasks.map((t) => [t.id, t])),
    [allTasks]
  );

  // In Active Tasks: keep completed subtasks visible inside open parents
  const groupedActiveTasks = useMemo(() => {
    const openRootIds = new Set(
      activeTasks
        .filter((t) => {
          if (t.parentId) return false;
          return selectedCategory === "ALL" || t.category === selectedCategory;
        })
        .map((t) => t.id)
    );

    const visibleItems = allTasks.filter((t) => {
      if (!t.parentId) {
        return !t.completed && openRootIds.has(t.id);
      }
      const parent = taskById.get(t.parentId);
      if (parent && !parent.completed) {
        if (selectedCategory === "ALL") return true;
        return openRootIds.has(parent.id) || (!t.completed && t.category === selectedCategory);
      }
      // Orphaned subtask or subtask whose parent is already completed
      return (
        !t.completed &&
        (selectedCategory === "ALL" || t.category === selectedCategory)
      );
    });

    return groupTasksWithSubtasks(visibleItems);
  }, [activeTasks, allTasks, selectedCategory, taskById]);

  const filteredUnscheduledTasks = useMemo(() => {
    const list =
      selectedCategory === "ALL"
        ? unscheduledTasks
        : unscheduledTasks.filter((t) => t.category === selectedCategory);
    return [...list].sort(compareTasksForDisplay);
  }, [selectedCategory, unscheduledTasks]);

  const groupedCompletedTasks = useMemo(() => {
    const list =
      selectedCategory === "ALL"
        ? completedTodayTasks
        : completedTodayTasks.filter((t) => t.category === selectedCategory);
    return groupTasksWithSubtasks(list);
  }, [completedTodayTasks, selectedCategory]);

  const swapSourceTask = swapSourceId ? taskById.get(swapSourceId) : null;

  const subtaskCountByParent = useMemo(() => {
    const map = new Map();
    for (const t of allTasks) {
      if (!t.parentId) continue;
      const entry = map.get(t.parentId) || { total: 0, done: 0 };
      entry.total += 1;
      if (t.completed) entry.done += 1;
      map.set(t.parentId, entry);
    }
    return map;
  }, [allTasks]);

  const handleConfirmDelete = (task) => {
    setConfirmDeleteId(null);
    onDeleteTask(task);
  };

  const mobileCountSource =
    activeView === "completed"
      ? completedTodayTasks
      : activeView === "unscheduled"
        ? unscheduledTasks
        : activeTasks;

  const viewTitle =
    activeView === "completed"
      ? "Completed Today"
      : activeView === "unscheduled"
        ? "Unscheduled"
        : "Active Tasks";
  const viewSubtitle =
    activeView === "completed"
      ? "Finished today · Auto-cleans after 48 hours"
      : activeView === "unscheduled"
        ? "Tasks without a work block · Click a task to jump to context"
        : "Stored in Ember · One-way sync to Google Calendar";

  const isEmpty =
    activeView === "active"
      ? groupedActiveTasks.length === 0
      : activeView === "unscheduled"
        ? filteredUnscheduledTasks.length === 0
        : groupedCompletedTasks.length === 0;

  return (
    <section aria-labelledby="tasks-heading" className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1
              id="tasks-heading"
              className="text-lg font-semibold tracking-tight text-slate-100 sm:text-xl"
            >
              {viewTitle}
            </h1>
            {selectedCategory !== "ALL" && (
              <span className="rounded border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                {selectedCategory}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{viewSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={onOpenCreate}
          className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-md border border-orange-400/40 bg-orange-600 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-orange-950/30 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 lg:hidden"
        >
          <Plus className="h-4 w-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Mobile View Switcher & Category Filter Bar */}
      <div className="space-y-3 lg:hidden">
        <div
          role="tablist"
          aria-label="Task views"
          className="grid grid-cols-3 gap-1.5 rounded-md border border-slate-800 bg-[#0b0f18] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "active"}
            onClick={() => onSelectView("active")}
            className={`min-h-[36px] cursor-pointer rounded px-2 py-1.5 text-xs font-medium transition-colors ${
              activeView === "active"
                ? "bg-orange-500/20 text-orange-200"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Active ({activeTasks.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "unscheduled"}
            onClick={() => onSelectView("unscheduled")}
            className={`min-h-[36px] cursor-pointer rounded px-2 py-1.5 text-xs font-medium transition-colors ${
              activeView === "unscheduled"
                ? "bg-orange-500/20 text-orange-200"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Unscheduled ({unscheduledTasks.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "completed"}
            onClick={() => onSelectView("completed")}
            className={`min-h-[36px] cursor-pointer rounded px-2 py-1.5 text-xs font-medium transition-colors ${
              activeView === "completed"
                ? "bg-orange-500/20 text-orange-200"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Done{" "}
            <span
              className={`inline-block rounded px-1 tabular-nums ${
                isCompletedPulsing
                  ? "ember-badge-pulse bg-orange-500/35 text-orange-200"
                  : ""
              }`}
            >
              {completedTodayTasks.length}
            </span>
          </button>
        </div>

        <div
          role="group"
          aria-label="Filter by category"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            onClick={() => onSelectCategory("ALL")}
            aria-pressed={selectedCategory === "ALL"}
            className={`inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === "ALL"
                ? "border-orange-500/50 bg-orange-500/15 text-orange-200"
                : "border-slate-800 bg-[#0d121d] text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <span>All</span>
            <span className="text-[11px] opacity-75">
              {mobileCountSource.length}
            </span>
          </button>

          {categories.map((category) => {
            const count = mobileCountSource.filter(
              (t) => t.category === category
            ).length;
            const isActive = selectedCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => onSelectCategory(category)}
                aria-pressed={isActive}
                className={`inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
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
                  Google Calendar not connected
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                  Your tasks continue working in Firestore. Connect Google Calendar to sync deadlines and calculate focus availability.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onReconnectCalendar}
              className="inline-flex min-h-[40px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-orange-400/40 bg-orange-600 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            >
              Connect Google Calendar
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
            aria-label="Dismiss error"
            className="cursor-pointer text-amber-300/80 hover:text-amber-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Swap mode banner */}
      {swapSourceTask && activeView === "active" && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-orange-500/50 bg-orange-500/10 px-4 py-2.5 text-xs text-orange-100"
        >
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 shrink-0 text-orange-400" />
            <span>
              Swap mode active: pick another scheduled task to swap with{" "}
              <strong className="text-orange-200">{swapSourceTask.title}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelSwap}
            className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded border border-orange-400/40 bg-[#101622] px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-orange-400"
          >
            <X className="h-3 w-3" />
            <span>Cancel</span>
          </button>
        </div>
      )}

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
      {isLoading && allTasks.length === 0 && (
        <div className="space-y-2.5" aria-busy="true" aria-label="Loading tasks">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded-md border border-slate-800/70 bg-[#0d111a]"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && isEmpty && !error && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800/80 bg-[#0b0f18]/80 px-6 py-12 text-center">
          {activeView === "unscheduled" ? (
            <CalendarOff
              className="mb-3 h-8 w-8 text-orange-400/70"
              strokeWidth={1.5}
            />
          ) : (
            <CheckCircle2
              className="mb-3 h-8 w-8 text-orange-400/70"
              strokeWidth={1.5}
            />
          )}
          <p className="text-sm font-medium text-slate-200">
            {activeView === "completed"
              ? "No tasks completed today."
              : activeView === "unscheduled"
                ? "No unscheduled tasks."
                : selectedCategory === "ALL"
                  ? "No active tasks yet."
                  : `No active tasks in ${selectedCategory}.`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {activeView === "completed"
              ? "Tasks you check off today will appear here."
              : activeView === "unscheduled"
                ? "Every open task currently has a scheduled work block."
                : "Create a new task and optionally assign a work block or hard deadline."}
          </p>
        </div>
      )}

      {/* Unscheduled flat list with Jump-to-Context */}
      {activeView === "unscheduled" && filteredUnscheduledTasks.length > 0 && (
        <ul className="space-y-2.5">
          {filteredUnscheduledTasks.map((task) => {
            const parentTitle = task.parentId
              ? taskById.get(task.parentId)?.title || null
              : null;

            return (
              <li key={task.id}>
                <TaskItemRow
                  task={task}
                  isSubtask={false}
                  parentTitle={parentTitle}
                  slot={null}
                  isBusy={busyTaskIds.has(task.id)}
                  isHighlighted={false}
                  isJumpable={true}
                  swapSourceId={null}
                  confirmDeleteId={confirmDeleteId}
                  subtaskProgress={
                    !task.parentId ? subtaskCountByParent.get(task.id) || null : null
                  }
                  hasRenderedSubtasks={false}
                  isSubtasksCollapsed={false}
                  onToggleSubtasksCollapse={onToggleSubtasksCollapse}
                  onJumpToTask={onJumpToTask}
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

      {/* Active Tasks & Completed Today grouped lists */}
      {activeView !== "unscheduled" &&
        (activeView === "active"
          ? groupedActiveTasks
          : groupedCompletedTasks
        ).length > 0 && (
          <ul className="space-y-2.5">
            {(activeView === "active"
              ? groupedActiveTasks
              : groupedCompletedTasks
            ).map((task) => {
              const slot = scheduleMap.get(task.id) || null;
              const subtaskProgress =
                subtaskCountByParent.get(task.id) || null;
              const hasRenderedSubtasks = task.subtasks.length > 0;
              const isSubtasksCollapsed = collapsedParentIds.has(task.id);

              return (
                <li key={task.id} className="space-y-1">
                  <TaskItemRow
                    task={task}
                    isSubtask={false}
                    parentTitle={null}
                    slot={slot}
                    isBusy={busyTaskIds.has(task.id)}
                    isHighlighted={highlightedTaskId === task.id}
                    isJumpable={false}
                    swapSourceId={swapSourceId}
                    confirmDeleteId={confirmDeleteId}
                    subtaskProgress={subtaskProgress}
                    hasRenderedSubtasks={hasRenderedSubtasks}
                    isSubtasksCollapsed={isSubtasksCollapsed}
                    onToggleSubtasksCollapse={onToggleSubtasksCollapse}
                    onJumpToTask={onJumpToTask}
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

                  {hasRenderedSubtasks && !isSubtasksCollapsed && (
                    <ul
                      aria-label={`Subtasks of ${task.title}`}
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
                              parentTitle={null}
                              slot={subSlot}
                              isBusy={busyTaskIds.has(subtask.id)}
                              isHighlighted={highlightedTaskId === subtask.id}
                              isJumpable={false}
                              swapSourceId={swapSourceId}
                              confirmDeleteId={confirmDeleteId}
                              subtaskProgress={null}
                              hasRenderedSubtasks={false}
                              isSubtasksCollapsed={false}
                              onToggleSubtasksCollapse={onToggleSubtasksCollapse}
                              onJumpToTask={onJumpToTask}
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
    </section>
  );
}
