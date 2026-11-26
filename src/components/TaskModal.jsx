import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Clock, Flag, RotateCcw, Trash2, X } from "lucide-react";
import {
  CATEGORIES,
  SIZE_DURATIONS,
  TASK_SIZES,
  TIME_BLOCKS,
  TIME_BLOCK_ORDER,
  addDaysToDateString,
  formatDurationLabel,
  getTaskDuration,
  getTodayDateString,
} from "../utils/schedule";

export function TaskModal({
  editingTask,
  parentTask,
  allTasks,
  onClose,
  onSave,
  onDelete,
  isSaving,
}) {
  const isEditing = Boolean(editingTask);
  const titleInputRef = useRef(null);

  const [title, setTitle] = useState(() => editingTask?.title || "");
  const [category, setCategory] = useState(
    () => editingTask?.category || parentTask?.category || "Studie"
  );
  const [size, setSize] = useState(() => editingTask?.size || "M");
  const [workDate, setWorkDate] = useState(() => editingTask?.workDate || "");
  const [timeBlock, setTimeBlock] = useState(() => editingTask?.timeBlock || "");
  const [deadline, setDeadline] = useState(() => editingTask?.deadline || "");
  const [durationOverride, setDurationOverride] = useState(
    () => editingTask?.durationOverride ?? null
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  const todayStr = useMemo(() => getTodayDateString(), []);
  const tomorrowStr = useMemo(() => addDaysToDateString(todayStr, 1), [todayStr]);

  const handleSizeChange = (nextSize) => {
    setSize(nextSize);
    setDurationOverride(null);
  };

  const handleWorkDateChange = (nextDate) => {
    setWorkDate(nextDate);
    if (nextDate && !timeBlock) {
      setTimeBlock("voormiddag");
    }
    if (!nextDate) {
      setTimeBlock("");
    }
    setDurationOverride(null);
  };

  const handleTimeBlockChange = (nextBlockId) => {
    if (timeBlock === nextBlockId) {
      setTimeBlock("");
      setWorkDate("");
    } else {
      setTimeBlock(nextBlockId);
      if (!workDate) {
        setWorkDate(todayStr);
      }
    }
    setDurationOverride(null);
  };

  const clearWorkMoment = () => {
    setWorkDate("");
    setTimeBlock("");
    setDurationOverride(null);
  };

  const blockUsage = useMemo(() => {
    if (!workDate || !timeBlock) return null;
    const block = TIME_BLOCKS[timeBlock];
    if (!block) return null;

    const existingMinutes = allTasks
      .filter(
        (t) =>
          t.id !== editingTask?.id &&
          t.workDate === workDate &&
          t.timeBlock === timeBlock
      )
      .reduce((sum, t) => sum + getTaskDuration(t), 0);

    const currentTaskMinutes =
      typeof durationOverride === "number" && durationOverride >= 15
        ? durationOverride
        : SIZE_DURATIONS[size];

    const totalAfter = existingMinutes + currentTaskMinutes;
    return {
      block,
      existingMinutes,
      currentTaskMinutes,
      totalAfter,
      overflows: totalAfter > block.durationMin,
    };
  }, [allTasks, durationOverride, editingTask?.id, size, timeBlock, workDate]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setValidationError("Vul een titel in voor deze taak.");
      titleInputRef.current?.focus();
      return;
    }

    setValidationError("");
    onSave({
      title: trimmed,
      category,
      size,
      workDate: workDate && timeBlock ? workDate : null,
      timeBlock: workDate && timeBlock ? timeBlock : null,
      deadline: deadline || null,
      durationOverride,
      parentId: editingTask ? editingTask.parentId : parentTask?.id || null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-amber-500/25 bg-[#0c1018] p-5 shadow-2xl shadow-black/80 sm:p-6"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3.5">
          <div>
            <h2
              id="task-modal-title"
              className="text-base font-semibold tracking-tight text-slate-100"
            >
              {isEditing
                ? "Taak bewerken"
                : parentTask
                  ? "Nieuwe subtaak"
                  : "Nieuwe taak"}
            </h2>
            {parentTask && !isEditing && (
              <p className="mt-0.5 text-xs text-amber-300/80">
                Subtaak onder: <span className="font-medium">{parentTask.title}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Sluiten"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-slate-800 bg-[#101622] text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* Title */}
          <div>
            <label
              htmlFor="task-title-input"
              className="block text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Titel
            </label>
            <input
              ref={titleInputRef}
              id="task-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bijv. Hoofdstuk 4 samenvatten"
              maxLength={140}
              className="mt-1.5 w-full rounded-md border border-slate-700/80 bg-[#080b11] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-orange-500/70 focus:outline-none focus:ring-1 focus:ring-orange-500/40"
            />
            {validationError && (
              <p className="mt-1.5 text-xs text-red-400">{validationError}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <span className="block text-xs font-medium uppercase tracking-wider text-slate-400">
              Categorie
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    aria-pressed={active}
                    className={`min-h-[34px] cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                      active
                        ? "border-orange-500/60 bg-orange-500/15 text-orange-200"
                        : "border-slate-800 bg-[#101622] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Size */}
          <div>
            <div className="flex items-center justify-between">
              <span className="block text-xs font-medium uppercase tracking-wider text-slate-400">
                Grootte &amp; Duur
              </span>
              {typeof durationOverride === "number" && (
                <button
                  type="button"
                  onClick={() => setDurationOverride(null)}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Auto-fit ({durationOverride}m) resetten</span>
                </button>
              )}
            </div>

            <div className="mt-1.5 grid grid-cols-5 gap-2">
              {TASK_SIZES.map((sz) => {
                const active = size === sz;
                const mins = SIZE_DURATIONS[sz];
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => handleSizeChange(sz)}
                    aria-pressed={active}
                    className={`flex min-h-[42px] cursor-pointer flex-col items-center justify-center rounded-md border px-2 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                      active
                        ? "border-orange-500/60 bg-orange-500/15 text-orange-200"
                        : "border-slate-800 bg-[#101622] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-xs font-bold">{sz}</span>
                    <span className="text-[10px] opacity-75">
                      {formatDurationLabel(mins)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Werkmoment (Work Date + Time Block) */}
          <div className="rounded-md border border-slate-800/90 bg-[#090d15] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-300">
                <Clock className="h-3.5 w-3.5 text-orange-400" />
                <span>Werkmoment (optioneel)</span>
              </span>
              {(workDate || timeBlock) && (
                <button
                  type="button"
                  onClick={clearWorkMoment}
                  className="cursor-pointer text-[11px] font-medium text-slate-400 hover:text-orange-300"
                >
                  Wissen
                </button>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="Werkdag"
                value={workDate}
                onChange={(e) => handleWorkDateChange(e.target.value)}
                className="min-h-[36px] flex-1 rounded-md border border-slate-700/80 bg-[#080b11] px-3 py-1.5 text-xs text-slate-100 focus:border-orange-500/70 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleWorkDateChange(todayStr)}
                className={`min-h-[36px] cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  workDate === todayStr
                    ? "border-orange-500/50 bg-orange-500/15 text-orange-200"
                    : "border-slate-800 bg-[#101622] text-slate-300 hover:border-slate-700"
                }`}
              >
                Vandaag
              </button>
              <button
                type="button"
                onClick={() => handleWorkDateChange(tomorrowStr)}
                className={`min-h-[36px] cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  workDate === tomorrowStr
                    ? "border-orange-500/50 bg-orange-500/15 text-orange-200"
                    : "border-slate-800 bg-[#101622] text-slate-300 hover:border-slate-700"
                }`}
              >
                Morgen
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {TIME_BLOCK_ORDER.map((blockId) => {
                const block = TIME_BLOCKS[blockId];
                const active = timeBlock === blockId;
                return (
                  <button
                    key={blockId}
                    type="button"
                    onClick={() => handleTimeBlockChange(blockId)}
                    aria-pressed={active}
                    className={`flex min-h-[42px] cursor-pointer flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                      active
                        ? "border-orange-500/60 bg-orange-500/15 text-orange-200"
                        : "border-slate-800 bg-[#101622] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-xs font-semibold">{block.label}</span>
                    <span className="text-[10px] opacity-75">
                      {block.rangeLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {blockUsage && (
              <div
                className={`mt-2.5 flex items-center justify-between rounded border px-2.5 py-1.5 text-[11px] ${
                  blockUsage.overflows
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    : "border-slate-800 bg-[#0c111b] text-slate-400"
                }`}
              >
                <span>
                  {blockUsage.block.label}: {blockUsage.totalAfter} /{" "}
                  {blockUsage.block.durationMin} min gebruikt
                </span>
                {blockUsage.overflows && (
                  <span className="font-semibold text-amber-300">
                    Past niet direct
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Harde Deadline */}
          <div className="rounded-md border border-slate-800/90 bg-[#090d15] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-300">
                <Flag className="h-3.5 w-3.5 text-red-400" />
                <span>Harde deadline (optioneel)</span>
              </span>
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline("")}
                  className="cursor-pointer text-[11px] font-medium text-slate-400 hover:text-orange-300"
                >
                  Wissen
                </button>
              )}
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                type="date"
                aria-label="Harde deadline"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="min-h-[36px] flex-1 rounded-md border border-slate-700/80 bg-[#080b11] px-3 py-1.5 text-xs text-slate-100 focus:border-orange-500/70 focus:outline-none"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Wordt in Google Agenda gesynchroniseerd als hele-dag event [DL].
            </p>
          </div>

          {/* Footer actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
            {isEditing ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDelete(editingTask)}
                    disabled={isSaving}
                    className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-md border border-red-500/50 bg-red-600/20 px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-600/35 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Bevestig verwijderen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isSaving}
                    className="min-h-[38px] cursor-pointer rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Annuleer
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isSaving}
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-md border border-slate-800 bg-[#101622] px-3 py-1.5 text-xs font-medium text-red-300/90 transition-colors hover:border-red-500/40 hover:bg-red-950/30 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Verwijderen</span>
                </button>
              )
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="min-h-[40px] cursor-pointer rounded-md border border-slate-700/80 bg-[#101622] px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100 disabled:opacity-50"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-[40px] cursor-pointer rounded-md border border-orange-400/40 bg-orange-600 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? "Opslaan..."
                  : isEditing
                    ? "Wijzigingen opslaan"
                    : "Taak aanmaken"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
