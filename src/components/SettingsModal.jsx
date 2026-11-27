import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Sliders,
  Tag,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import {
  DEFAULT_USER_SETTINGS,
  timeToMinutes,
} from "../services/userSettings";

function makeLocalId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function SettingsModal({
  settings,
  calendarConnected,
  isCheckingCalendar,
  onConnectCalendar,
  onDisconnectCalendar,
  onFetchCalendars,
  onSave,
  onClose,
  isSaving,
}) {
  const initialSettings = settings || DEFAULT_USER_SETTINGS;

  const [activeStart, setActiveStart] = useState(
    () => initialSettings.activeStart || "09:00"
  );
  const [activeEnd, setActiveEnd] = useState(
    () => initialSettings.activeEnd || "22:00"
  );
  const [maxFocusHours, setMaxFocusHours] = useState(() =>
    String(
      Math.round(((initialSettings.maxFocusCapMinutes ?? 300) / 60) * 10) / 10
    )
  );
  const [restBlocks, setRestBlocks] = useState(() =>
    (initialSettings.restBlocks || []).map((block) => ({ ...block }))
  );
  const [onlineKeywordsText, setOnlineKeywordsText] = useState(() =>
    (initialSettings.onlineKeywords || []).join(", ")
  );
  const [calendarRules, setCalendarRules] = useState(() => {
    const next = {};
    for (const [id, rule] of Object.entries(
      initialSettings.calendarRules || {}
    )) {
      next[id] = {
        enabled: Boolean(rule?.enabled),
        keywordFilter: rule?.keywordFilter || "",
        travelMinutes: Number(rule?.travelMinutes) || 0,
      };
    }
    return next;
  });

  const [categoryItems, setCategoryItems] = useState(() =>
    (initialSettings.categories || DEFAULT_USER_SETTINGS.categories).map(
      (cat, idx) => ({
        id: `cat-${idx}-${cat}`,
        originalName: cat,
        name: cat,
      })
    )
  );
  const [newCategoryName, setNewCategoryName] = useState("");

  const [calendars, setCalendars] = useState([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [calendarsError, setCalendarsError] = useState("");
  const [connectionActionBusy, setConnectionActionBusy] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [validationError, setValidationError] = useState("");

  const loadCalendars = useCallback(async () => {
    if (!calendarConnected || !onFetchCalendars) return;
    setIsLoadingCalendars(true);
    setCalendarsError("");
    try {
      const list = await onFetchCalendars();
      const safeList = Array.isArray(list) ? list : [];
      setCalendars(safeList);

      // If the user has no saved rules yet, pre-enable their primary calendar in the draft
      setCalendarRules((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const primaryCal = safeList.find((c) => c.primary);
        if (!primaryCal) return prev;
        return {
          [primaryCal.id]: {
            enabled: true,
            keywordFilter: "",
            travelMinutes: 0,
          },
        };
      });
    } catch (err) {
      setCalendarsError(
        err?.message || "Could not load your Google Calendar list."
      );
    } finally {
      setIsLoadingCalendars(false);
    }
  }, [calendarConnected, onFetchCalendars]);

  useEffect(() => {
    if (calendarConnected) {
      loadCalendars();
    } else {
      setCalendars([]);
      setCalendarsError("");
    }
  }, [calendarConnected, loadCalendars]);

  const handleConnectClick = async () => {
    setConnectionError("");
    setConnectionActionBusy(true);
    try {
      await onConnectCalendar();
    } catch (err) {
      setConnectionError(
        err?.message || "Failed to start Google Calendar connection."
      );
      setConnectionActionBusy(false);
    }
  };

  const handleDisconnectClick = async () => {
    setConnectionError("");
    setConnectionActionBusy(true);
    try {
      await onDisconnectCalendar();
      setCalendars([]);
    } catch (err) {
      setConnectionError(
        err?.message || "Failed to disconnect Google Calendar."
      );
    } finally {
      setConnectionActionBusy(false);
    }
  };

  const updateCalendarRule = (calendarId, patch) => {
    setCalendarRules((prev) => {
      const current = prev[calendarId] || {
        enabled: false,
        keywordFilter: "",
        travelMinutes: 0,
      };
      return {
        ...prev,
        [calendarId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const handleAddRestBlock = () => {
    setRestBlocks((prev) => [
      ...prev,
      {
        id: makeLocalId("rest"),
        label: "Break",
        start: "18:00",
        end: "19:00",
      },
    ]);
  };

  const handleUpdateRestBlock = (id, field, value) => {
    setRestBlocks((prev) =>
      prev.map((block) =>
        block.id === id ? { ...block, [field]: value } : block
      )
    );
  };

  const handleRemoveRestBlock = (id) => {
    setRestBlocks((prev) => prev.filter((block) => block.id !== id));
  };

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const duplicate = categoryItems.some(
      (item) => item.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setValidationError(`Category "${trimmed}" already exists.`);
      return;
    }
    setValidationError("");
    setCategoryItems((prev) => [
      ...prev,
      {
        id: makeLocalId("cat"),
        originalName: null,
        name: trimmed,
      },
    ]);
    setNewCategoryName("");
  };

  const handleRenameCategory = (id, nextName) => {
    setCategoryItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name: nextName } : item))
    );
  };

  const handleDeleteCategory = (id) => {
    if (categoryItems.length <= 1) return;
    setCategoryItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSaving || connectionActionBusy) return;

    const startMin = timeToMinutes(activeStart);
    const endMin = timeToMinutes(activeEnd);
    if (startMin === null || endMin === null || endMin <= startMin) {
      setValidationError("Active end time must be later than active start time.");
      return;
    }

    const parsedHours = Number(maxFocusHours);
    if (!Number.isFinite(parsedHours) || parsedHours < 0.5 || parsedHours > 16) {
      setValidationError(
        "Max focus cap must be between 0.5 and 16 hours per day."
      );
      return;
    }
    const maxFocusCapMinutes = Math.round(parsedHours * 60);

    for (const block of restBlocks) {
      const bStart = timeToMinutes(block.start);
      const bEnd = timeToMinutes(block.end);
      if (bStart === null || bEnd === null || bEnd <= bStart) {
        setValidationError(
          `Rest block "${block.label || "Untitled"}" must end after it starts.`
        );
        return;
      }
    }

    const cleanedCategories = [];
    const seenCats = new Set();
    const categoryRenames = {};

    for (const item of categoryItems) {
      const trimmed = item.name.trim();
      if (!trimmed) {
        setValidationError("Category names cannot be empty.");
        return;
      }
      const lower = trimmed.toLowerCase();
      if (seenCats.has(lower)) {
        setValidationError(`Duplicate category name: "${trimmed}".`);
        return;
      }
      seenCats.add(lower);
      cleanedCategories.push(trimmed);

      if (item.originalName && item.originalName !== trimmed) {
        categoryRenames[item.originalName] = trimmed;
      }
    }

    if (cleanedCategories.length === 0) {
      setValidationError("At least one category is required.");
      return;
    }

    const cleanedKeywords = onlineKeywordsText
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    const cleanedRestBlocks = restBlocks.map((block) => ({
      id: block.id || makeLocalId("rest"),
      label: block.label.trim() || "Rest",
      start: block.start,
      end: block.end,
    }));

    const cleanedCalendarRules = {};
    for (const [calId, rule] of Object.entries(calendarRules)) {
      const travel = Math.max(
        0,
        Math.min(240, Math.round(Number(rule.travelMinutes) || 0))
      );
      cleanedCalendarRules[calId] = {
        enabled: Boolean(rule.enabled),
        keywordFilter:
          typeof rule.keywordFilter === "string"
            ? rule.keywordFilter.trim()
            : "",
        travelMinutes: travel,
      };
    }

    setValidationError("");
    onSave(
      {
        ...initialSettings,
        activeStart,
        activeEnd,
        maxFocusCapMinutes,
        restBlocks: cleanedRestBlocks,
        onlineKeywords: cleanedKeywords,
        categories: cleanedCategories,
        calendarRules: cleanedCalendarRules,
      },
      categoryRenames
    );
  };

  const parsedHoursPreview = Number(maxFocusHours);
  const minutesPreview = Number.isFinite(parsedHoursPreview)
    ? Math.round(parsedHoursPreview * 60)
    : initialSettings.maxFocusCapMinutes ?? 300;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSaving && !connectionActionBusy) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-amber-500/25 bg-[#0c1018] shadow-2xl shadow-black/80"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent"
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-orange-500/30 bg-orange-500/10">
              <Sliders className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <h2
                id="settings-modal-title"
                className="text-base font-semibold tracking-tight text-slate-100"
              >
                Account Settings
              </h2>
              <p className="text-[11px] text-slate-400">
                Calendar sync, availability windows, rest blocks and categories
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || connectionActionBusy}
            aria-label="Close settings"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-slate-800 bg-[#101622] text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            {/* 1. Google Calendar Connection */}
            <section className="rounded-md border border-slate-800/90 bg-[#090d15] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-orange-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                      Google Calendar Connection
                    </h3>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {isCheckingCalendar ? (
                      <span className="inline-flex items-center gap-1.5 rounded border border-slate-700/80 bg-[#101622] px-2.5 py-1 text-[11px] font-medium text-slate-300">
                        <Loader2 className="h-3 w-3 animate-spin text-orange-400" />
                        <span>Checking status...</span>
                      </span>
                    ) : calendarConnected ? (
                      <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Connected</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                        <Unplug className="h-3.5 w-3.5" />
                        <span>Not connected</span>
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500">
                      Managed via background OAuth token refresh
                    </span>
                  </div>
                </div>

                {calendarConnected ? (
                  <button
                    type="button"
                    onClick={handleDisconnectClick}
                    disabled={connectionActionBusy || isSaving}
                    className="inline-flex min-h-[38px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-red-500/35 bg-red-950/25 px-3.5 py-2 text-xs font-medium text-red-200 transition-colors hover:border-red-500/60 hover:bg-red-950/45 disabled:opacity-50"
                  >
                    {connectionActionBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unplug className="h-3.5 w-3.5" />
                    )}
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectClick}
                    disabled={connectionActionBusy || isSaving || isCheckingCalendar}
                    className="inline-flex min-h-[38px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-orange-400/40 bg-orange-600 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-orange-500 disabled:opacity-50"
                  >
                    {connectionActionBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Calendar className="h-3.5 w-3.5" />
                    )}
                    <span>Connect Google Calendar</span>
                  </button>
                )}
              </div>

              {connectionError && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-200"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                  <span>{connectionError}</span>
                </div>
              )}
            </section>

            {/* 2. Calendars & Travel Time */}
            <section className="rounded-md border border-slate-800/90 bg-[#090d15] p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Calendars &amp; Travel Time
                  </h3>
                </div>

                {calendarConnected && (
                  <button
                    type="button"
                    onClick={loadCalendars}
                    disabled={isLoadingCalendars}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-700/80 bg-[#101622] px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isLoadingCalendars ? "animate-spin" : ""}`}
                    />
                    <span>Refresh</span>
                  </button>
                )}
              </div>

              {!calendarConnected ? (
                <p className="mt-2.5 text-xs text-slate-500">
                  Connect Google Calendar above to choose which calendars count as busy and configure keyword filters or travel buffers.
                </p>
              ) : isLoadingCalendars && calendars.length === 0 ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                  <span>Loading your calendars...</span>
                </div>
              ) : calendarsError ? (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-200"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                  <span>{calendarsError}</span>
                </div>
              ) : calendars.length === 0 ? (
                <p className="mt-2.5 text-xs text-slate-500">
                  No calendars found on this Google account.
                </p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {calendars.map((cal) => {
                    const rule = calendarRules[cal.id] || {
                      enabled: false,
                      keywordFilter: "",
                      travelMinutes: 0,
                    };
                    const toggleId = `cal-toggle-${cal.id}`;
                    const kwId = `cal-kw-${cal.id}`;
                    const travelId = `cal-travel-${cal.id}`;

                    return (
                      <div
                        key={cal.id}
                        className="rounded-md border border-slate-800/80 bg-[#0b1019] p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/15"
                              style={{
                                backgroundColor:
                                  cal.backgroundColor || "#f97316",
                              }}
                            />
                            <span className="truncate text-xs font-medium text-slate-100">
                              {cal.summary}
                            </span>
                            {cal.primary && (
                              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                                Primary
                              </span>
                            )}
                          </div>

                          <label
                            htmlFor={toggleId}
                            className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300"
                          >
                            <input
                              id={toggleId}
                              type="checkbox"
                              className="ember-checkbox text-[13px]"
                              checked={Boolean(rule.enabled)}
                              onChange={(e) =>
                                updateCalendarRule(cal.id, {
                                  enabled: e.target.checked,
                                })
                              }
                            />
                            <span>Count as busy</span>
                          </label>
                        </div>

                        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor={kwId}
                              className="block text-[10px] font-medium uppercase tracking-wider text-slate-400"
                            >
                              Keyword filter
                            </label>
                            <input
                              id={kwId}
                              type="text"
                              value={rule.keywordFilter}
                              onChange={(e) =>
                                updateCalendarRule(cal.id, {
                                  keywordFilter: e.target.value,
                                })
                              }
                              placeholder="Optional (e.g. Daan)"
                              className="mt-1 w-full rounded border border-slate-700/80 bg-[#080b11] px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-orange-500/70 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={travelId}
                              className="block text-[10px] font-medium uppercase tracking-wider text-slate-400"
                            >
                              Travel time (min before &amp; after)
                            </label>
                            <input
                              id={travelId}
                              type="number"
                              min={0}
                              max={240}
                              step={5}
                              value={rule.travelMinutes}
                              onChange={(e) =>
                                updateCalendarRule(cal.id, {
                                  travelMinutes:
                                    e.target.value === ""
                                      ? 0
                                      : Math.max(0, Number(e.target.value)),
                                })
                              }
                              className="mt-1 w-full rounded border border-slate-700/80 bg-[#080b11] px-2.5 py-1.5 text-xs text-slate-100 focus:border-orange-500/70 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 3. Availability & Rest Blocks */}
            <section className="space-y-4 rounded-md border border-slate-800/90 bg-[#090d15] p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Availability &amp; Rest Blocks
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="settings-active-start"
                    className="block text-[11px] font-medium uppercase tracking-wider text-slate-400"
                  >
                    Active start
                  </label>
                  <input
                    id="settings-active-start"
                    type="time"
                    value={activeStart}
                    onChange={(e) => setActiveStart(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-700/80 bg-[#080b11] px-3 py-2 text-xs text-slate-100 focus:border-orange-500/70 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="settings-active-end"
                    className="block text-[11px] font-medium uppercase tracking-wider text-slate-400"
                  >
                    Active end
                  </label>
                  <input
                    id="settings-active-end"
                    type="time"
                    value={activeEnd}
                    onChange={(e) => setActiveEnd(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-700/80 bg-[#080b11] px-3 py-2 text-xs text-slate-100 focus:border-orange-500/70 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="settings-focus-cap"
                    className="block text-[11px] font-medium uppercase tracking-wider text-slate-400"
                  >
                    Max focus cap (h / day)
                  </label>
                  <input
                    id="settings-focus-cap"
                    type="number"
                    min={0.5}
                    max={16}
                    step={0.5}
                    value={maxFocusHours}
                    onChange={(e) => setMaxFocusHours(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-slate-700/80 bg-[#080b11] px-3 py-2 text-xs text-slate-100 focus:border-orange-500/70 focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    Cap: {minutesPreview} min / day
                  </p>
                </div>
              </div>

              {/* Rest Blocks */}
              <div className="border-t border-slate-800/70 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Fixed rest blocks
                  </span>
                  <button
                    type="button"
                    onClick={handleAddRestBlock}
                    className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-700/80 bg-[#101622] px-2.5 py-1 text-[11px] font-medium text-amber-300 transition-colors hover:border-amber-500/40 hover:bg-slate-800"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Rest Block</span>
                  </button>
                </div>

                {restBlocks.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    No fixed rest blocks configured.
                  </p>
                ) : (
                  <div className="mt-2.5 space-y-2">
                    {restBlocks.map((block) => (
                      <div
                        key={block.id}
                        className="flex flex-wrap items-center gap-2 rounded border border-slate-800/80 bg-[#0b1019] p-2 sm:flex-nowrap"
                      >
                        <input
                          type="text"
                          aria-label="Rest block label"
                          value={block.label}
                          onChange={(e) =>
                            handleUpdateRestBlock(
                              block.id,
                              "label",
                              e.target.value
                            )
                          }
                          placeholder="Label (e.g. Lunch)"
                          className="min-w-[120px] flex-1 rounded border border-slate-700/80 bg-[#080b11] px-2.5 py-1.5 text-xs text-slate-100 focus:border-orange-500/70 focus:outline-none"
                        />
                        <input
                          type="time"
                          aria-label="Rest block start"
                          value={block.start}
                          onChange={(e) =>
                            handleUpdateRestBlock(
                              block.id,
                              "start",
                              e.target.value
                            )
                          }
                          className="rounded border border-slate-700/80 bg-[#080b11] px-2 py-1.5 text-xs text-slate-100 focus:border-orange-500/70 focus:outline-none"
                        />
                        <span className="text-xs text-slate-500">to</span>
                        <input
                          type="time"
                          aria-label="Rest block end"
                          value={block.end}
                          onChange={(e) =>
                            handleUpdateRestBlock(
                              block.id,
                              "end",
                              e.target.value
                            )
                          }
                          className="rounded border border-slate-700/80 bg-[#080b11] px-2 py-1.5 text-xs text-slate-100 focus:border-orange-500/70 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveRestBlock(block.id)}
                          aria-label={`Remove ${block.label || "rest block"}`}
                          className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded border border-transparent text-slate-500 transition-colors hover:border-red-500/30 hover:bg-red-950/30 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Online Keywords */}
              <div className="border-t border-slate-800/70 pt-3">
                <label
                  htmlFor="settings-online-keywords"
                  className="block text-[11px] font-medium uppercase tracking-wider text-slate-400"
                >
                  Online keywords (0 min travel)
                </label>
                <input
                  id="settings-online-keywords"
                  type="text"
                  value={onlineKeywordsText}
                  onChange={(e) => setOnlineKeywordsText(e.target.value)}
                  placeholder="online, teams, zoom, remote"
                  className="mt-1.5 w-full rounded-md border border-slate-700/80 bg-[#080b11] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-orange-500/70 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Comma-separated. Events matching any keyword in title or location skip travel buffers.
                </p>
              </div>
            </section>

            {/* 4. Categories / Skills */}
            <section className="rounded-md border border-slate-800/90 bg-[#090d15] p-4">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-orange-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Categories / Skills
                </h3>
              </div>

              <div className="mt-3 space-y-2">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      aria-label={`Category ${item.name}`}
                      value={item.name}
                      onChange={(e) =>
                        handleRenameCategory(item.id, e.target.value)
                      }
                      maxLength={40}
                      className="flex-1 rounded-md border border-slate-700/80 bg-[#080b11] px-3 py-1.5 text-xs text-slate-100 focus:border-orange-500/70 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(item.id)}
                      disabled={categoryItems.length <= 1}
                      aria-label={`Delete ${item.name}`}
                      title={
                        categoryItems.length <= 1
                          ? "At least one category is required"
                          : `Delete ${item.name}`
                      }
                      className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded border border-slate-800 bg-[#101622] text-slate-500 transition-colors hover:border-red-500/35 hover:bg-red-950/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  aria-label="New category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                  placeholder="Add category..."
                  maxLength={40}
                  className="flex-1 rounded-md border border-slate-700/80 bg-[#080b11] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-orange-500/70 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#101622] px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:border-amber-500/40 hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </section>

            {validationError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-red-500/35 bg-red-950/30 px-3.5 py-2.5 text-xs text-red-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-800/80 bg-[#0a0e16] px-5 py-3.5 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || connectionActionBusy}
              className="min-h-[38px] cursor-pointer rounded-md border border-slate-700/80 bg-[#101622] px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || connectionActionBusy}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-md border border-orange-400/40 bg-orange-600 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isSaving ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
