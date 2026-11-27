import {
  SIZE_DURATIONS,
  addDaysToDateString,
  formatMinutes,
} from "./schedule.js";

const DEFAULT_TIME_ZONE = "Europe/Brussels";
const TIME_PATTERN = /^(?:([01]\d|2[0-3]):([0-5]\d)|24:00)$/;
const formatterCache = new Map();

function getZonedFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
    );
  }
  return formatterCache.get(timeZone);
}

function pad2(num) {
  return String(num).padStart(2, "0");
}

export function parseTimeToMinutes(timeStr) {
  if (typeof timeStr !== "string" || !TIME_PATTERN.test(timeStr)) return null;
  if (timeStr === "24:00") return 1440;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

export function ceilToQuarterHour(exactMinutes) {
  if (!Number.isFinite(exactMinutes)) return 0;
  return Math.ceil(exactMinutes / 15) * 15;
}

export function getZonedDateParts(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const parts = getZonedFormatter(timeZone).formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = Number(part.value);
    }
  }
  const dateStr = `${map.year}-${pad2(map.month)}-${pad2(map.day)}`;
  const exactMinutes = map.hour * 60 + map.minute + map.second / 60;
  return {
    dateStr,
    hours: map.hour,
    minutes: map.minute,
    seconds: map.second,
    exactMinutes,
  };
}

function getZoneOffsetMinutes(utcMs, timeZone = DEFAULT_TIME_ZONE) {
  const parts = getZonedFormatter(timeZone).formatToParts(new Date(utcMs));
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = Number(part.value);
    }
  }
  const asUtcMs = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour,
    map.minute,
    map.second
  );
  return Math.round((asUtcMs - utcMs) / 60000);
}

export function zonedLocalToUtcMs(
  dateStr,
  minutesFromMidnight,
  timeZone = DEFAULT_TIME_ZONE
) {
  const dayOffset = Math.floor(minutesFromMidnight / 1440);
  const effectiveDate =
    dayOffset !== 0 ? addDaysToDateString(dateStr, dayOffset) : dateStr;
  const mins = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;

  const [y, m, d] = effectiveDate.split("-").map(Number);
  const localAsUtcMs = Date.UTC(y, m - 1, d, hours, minutes, 0);
  const firstOffset = getZoneOffsetMinutes(localAsUtcMs, timeZone);
  const refinedUtcMs = localAsUtcMs - firstOffset * 60000;
  const exactOffset = getZoneOffsetMinutes(refinedUtcMs, timeZone);
  return localAsUtcMs - exactOffset * 60000;
}

export function isOnlineEvent(event, onlineKeywords = []) {
  if (!event || !Array.isArray(onlineKeywords) || onlineKeywords.length === 0) {
    return false;
  }
  const haystack = `${event.summary || ""} ${event.location || ""}`.toLowerCase();
  if (!haystack.trim()) return false;

  for (const rawKw of onlineKeywords) {
    if (typeof rawKw !== "string") continue;
    const kw = rawKw.trim().toLowerCase();
    if (kw && haystack.includes(kw)) {
      return true;
    }
  }
  return false;
}

export function mergeIntervals(intervals) {
  if (!Array.isArray(intervals) || intervals.length === 0) return [];

  const valid = intervals
    .filter(
      (item) =>
        item &&
        Number.isFinite(item.startMin) &&
        Number.isFinite(item.endMin) &&
        item.endMin > item.startMin
    )
    .map((item) => ({ startMin: item.startMin, endMin: item.endMin }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  if (valid.length === 0) return [];

  const merged = [valid[0]];
  for (let i = 1; i < valid.length; i++) {
    const current = valid[i];
    const last = merged[merged.length - 1];
    if (current.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, current.endMin);
    } else {
      merged.push(current);
    }
  }
  return merged;
}

function deductDurationFromFreeSlots(freeSlots, durationMinutes) {
  if (!durationMinutes || durationMinutes <= 0 || freeSlots.length === 0) {
    return freeSlots;
  }

  let remainingToDeduct = durationMinutes;
  const updated = [];

  for (const slot of freeSlots) {
    if (remainingToDeduct <= 0) {
      updated.push(slot);
      continue;
    }

    if (slot.durationMinutes <= remainingToDeduct) {
      remainingToDeduct -= slot.durationMinutes;
      continue;
    }

    const nextStartMin = slot.startMin + remainingToDeduct;
    remainingToDeduct = 0;
    updated.push({
      startMin: nextStartMin,
      endMin: slot.endMin,
      startLabel: formatMinutes(nextStartMin),
      endLabel: slot.endLabel,
      durationMinutes: slot.endMin - nextStartMin,
    });
  }

  return updated;
}

function resolveIntervalMinutes(block) {
  if (!block || typeof block !== "object") return null;
  const startMin =
    typeof block.startMin === "number"
      ? block.startMin
      : parseTimeToMinutes(block.start);
  const endMin =
    typeof block.endMin === "number"
      ? block.endMin
      : parseTimeToMinutes(block.end);
  if (
    startMin === null ||
    endMin === null ||
    !Number.isFinite(startMin) ||
    !Number.isFinite(endMin) ||
    endMin <= startMin
  ) {
    return null;
  }
  return { startMin, endMin };
}

export function computeDailyAvailability({
  events = [],
  settings = {},
  simulatedBlock = null,
  simulatedBlocks = [],
  now = new Date(),
  days = 14,
  timeZone = DEFAULT_TIME_ZONE,
} = {}) {
  const activeStartMin = parseTimeToMinutes(settings.activeStart) ?? 540;
  const activeEndMin = parseTimeToMinutes(settings.activeEnd) ?? 1320;
  const rawCap = Number(settings.maxFocusCapMinutes);
  const maxFocusCapMinutes = Number.isFinite(rawCap)
    ? Math.max(0, Math.round(rawCap))
    : 300;

  const restBlocks = Array.isArray(settings.restBlocks) ? settings.restBlocks : [];
  const quickBusyBlocks = Array.isArray(settings.quickBusyBlocks)
    ? settings.quickBusyBlocks
    : [];
  const onlineKeywords = Array.isArray(settings.onlineKeywords)
    ? settings.onlineKeywords
    : [];
  const calendarRules =
    settings.calendarRules && typeof settings.calendarRules === "object"
      ? settings.calendarRules
      : {};

  const simList = [
    ...(Array.isArray(simulatedBlocks) ? simulatedBlocks : []),
    ...(simulatedBlock ? [simulatedBlock] : []),
  ];

  const { dateStr: todayStr, exactMinutes: nowExactMinutes } = getZonedDateParts(
    now,
    timeZone
  );

  const eventSpans = [];
  for (const ev of events) {
    if (!ev) continue;
    const startMs = Date.parse(ev.startDateTime || ev.start?.dateTime);
    const endMs = Date.parse(ev.endDateTime || ev.end?.dateTime);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      continue;
    }

    const rawTravel =
      ev.travelMinutes ?? calendarRules[ev.calendarId]?.travelMinutes ?? 0;
    const travelMin = isOnlineEvent(ev, onlineKeywords)
      ? 0
      : Math.max(0, Math.round(Number(rawTravel) || 0));

    eventSpans.push({
      effectiveStartMs: startMs - travelMin * 60000,
      effectiveEndMs: endMs + travelMin * 60000,
    });
  }

  const dailyResults = [];

  for (let i = 0; i < days; i++) {
    const dateStr = addDaysToDateString(todayStr, i);
    const windowStartMin =
      i === 0
        ? Math.max(activeStartMin, ceilToQuarterHour(nowExactMinutes))
        : activeStartMin;
    const windowEndMin = activeEndMin;

    if (windowEndMin <= windowStartMin) {
      dailyResults.push({
        date: dateStr,
        isToday: i === 0,
        windowStartMin,
        windowEndMin,
        busyIntervals: [],
        freeSlots: [],
        rawFreeMinutes: 0,
        usableFocusMinutes: 0,
      });
      continue;
    }

    const dayStartMs = zonedLocalToUtcMs(dateStr, 0, timeZone);
    const dayEndMs = zonedLocalToUtcMs(
      addDaysToDateString(dateStr, 1),
      0,
      timeZone
    );

    const rawBusy = [];

    for (const span of eventSpans) {
      if (span.effectiveEndMs <= dayStartMs || span.effectiveStartMs >= dayEndMs) {
        continue;
      }
      const clippedStartMs = Math.max(span.effectiveStartMs, dayStartMs);
      const clippedEndMs = Math.min(span.effectiveEndMs, dayEndMs);
      const startMin = Math.floor((clippedStartMs - dayStartMs) / 60000);
      const endMin = Math.ceil((clippedEndMs - dayStartMs) / 60000);
      rawBusy.push({ startMin, endMin });
    }

    for (const rest of restBlocks) {
      const interval = resolveIntervalMinutes(rest);
      if (interval) rawBusy.push(interval);
    }

    for (const quick of quickBusyBlocks) {
      if (quick?.date !== dateStr) continue;
      const interval = resolveIntervalMinutes(quick);
      if (interval) rawBusy.push(interval);
    }

    let durationOnlySimMinutes = 0;
    for (const sim of simList) {
      if (!sim || sim.date !== dateStr) continue;
      const interval = resolveIntervalMinutes(sim);
      if (interval) {
        rawBusy.push(interval);
      } else if (
        typeof sim.durationMinutes === "number" &&
        Number.isFinite(sim.durationMinutes) &&
        sim.durationMinutes > 0
      ) {
        durationOnlySimMinutes += Math.round(sim.durationMinutes);
      }
    }

    const clippedBusy = rawBusy
      .map((interval) => ({
        startMin: Math.max(windowStartMin, interval.startMin),
        endMin: Math.min(windowEndMin, interval.endMin),
      }))
      .filter((interval) => interval.endMin > interval.startMin);

    const busyIntervals = mergeIntervals(clippedBusy);

    let freeSlots = [];
    let cursor = windowStartMin;
    for (const busy of busyIntervals) {
      if (busy.startMin > cursor) {
        freeSlots.push({
          startMin: cursor,
          endMin: busy.startMin,
          startLabel: formatMinutes(cursor),
          endLabel: formatMinutes(busy.startMin),
          durationMinutes: busy.startMin - cursor,
        });
      }
      cursor = Math.max(cursor, busy.endMin);
    }
    if (cursor < windowEndMin) {
      freeSlots.push({
        startMin: cursor,
        endMin: windowEndMin,
        startLabel: formatMinutes(cursor),
        endLabel: formatMinutes(windowEndMin),
        durationMinutes: windowEndMin - cursor,
      });
    }

    if (durationOnlySimMinutes > 0) {
      freeSlots = deductDurationFromFreeSlots(freeSlots, durationOnlySimMinutes);
    }

    const rawFreeMinutes = freeSlots.reduce(
      (sum, slot) => sum + slot.durationMinutes,
      0
    );
    const usableFocusMinutes = Math.min(rawFreeMinutes, maxFocusCapMinutes);

    dailyResults.push({
      date: dateStr,
      isToday: i === 0,
      windowStartMin,
      windowEndMin,
      busyIntervals,
      freeSlots,
      rawFreeMinutes,
      usableFocusMinutes,
    });
  }

  return dailyResults;
}

export function getCountableOpenTasks(tasks = []) {
  const taskById = new Map();
  const openSubtaskCountByParent = new Map();

  for (const task of tasks) {
    if (!task) continue;
    taskById.set(task.id, task);
    if (!task.completed && task.parentId) {
      openSubtaskCountByParent.set(
        task.parentId,
        (openSubtaskCountByParent.get(task.parentId) || 0) + 1
      );
    }
  }

  const countable = [];
  for (const task of tasks) {
    if (!task || task.completed) continue;

    // Anti double-counting rule: if an open parent has open subtasks, count only the open subtasks.
    if (!task.parentId && (openSubtaskCountByParent.get(task.id) || 0) > 0) {
      continue;
    }

    const durationMinutes = SIZE_DURATIONS[task.size] ?? 60;
    const parentTask = task.parentId ? taskById.get(task.parentId) : null;
    const effectiveDeadline =
      task.deadline || (parentTask && !parentTask.completed ? parentTask.deadline || null : null);

    countable.push({
      task,
      durationMinutes,
      effectiveDeadline,
    });
  }

  return countable;
}

function computeBaselineDailyFocusCap(settings = {}) {
  const activeStartMin = parseTimeToMinutes(settings.activeStart) ?? 540;
  const activeEndMin = parseTimeToMinutes(settings.activeEnd) ?? 1320;
  if (activeEndMin <= activeStartMin) return 0;

  const rawCap = Number(settings.maxFocusCapMinutes);
  const maxFocusCapMinutes = Number.isFinite(rawCap)
    ? Math.max(0, Math.round(rawCap))
    : 300;

  const restBlocks = Array.isArray(settings.restBlocks) ? settings.restBlocks : [];
  const clippedRest = restBlocks
    .map(resolveIntervalMinutes)
    .filter(Boolean)
    .map((b) => ({
      startMin: Math.max(activeStartMin, b.startMin),
      endMin: Math.min(activeEndMin, b.endMin),
    }))
    .filter((b) => b.endMin > b.startMin);

  const mergedRest = mergeIntervals(clippedRest);
  const totalRestMinutes = mergedRest.reduce(
    (sum, b) => sum + (b.endMin - b.startMin),
    0
  );
  const rawActiveMinutes = Math.max(0, activeEndMin - activeStartMin - totalRestMinutes);
  return Math.min(rawActiveMinutes, maxFocusCapMinutes);
}

function diffDays(startDateStr, endDateStr) {
  const [sy, sm, sd] = startDateStr.split("-").map(Number);
  const [ey, em, ed] = endDateStr.split("-").map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  return Math.round((endUtc - startUtc) / 86400000);
}

function classifyBufferStatus({
  isOverdue,
  bufferMinutes,
  cumulativeRequiredMinutes,
  availableFocusMinutes,
}) {
  if (isOverdue || bufferMinutes < 0) return "Critical";
  if (cumulativeRequiredMinutes === 0) return "Safe";

  const utilizationRatio =
    availableFocusMinutes > 0
      ? cumulativeRequiredMinutes / availableFocusMinutes
      : Infinity;

  if (utilizationRatio >= 0.75 || bufferMinutes <= 60) {
    return "Tight";
  }
  return "Safe";
}

export function computeDeadlineWorkloads(
  tasks = [],
  dailyAvailability = [],
  settings = {},
  todayStr
) {
  const countable = getCountableOpenTasks(tasks);
  const tasksByDeadline = new Map();
  let noDeadlineWorkMinutes = 0;
  let totalOpenWorkMinutes = 0;

  for (const entry of countable) {
    totalOpenWorkMinutes += entry.durationMinutes;
    if (!entry.effectiveDeadline) {
      noDeadlineWorkMinutes += entry.durationMinutes;
      continue;
    }
    if (!tasksByDeadline.has(entry.effectiveDeadline)) {
      tasksByDeadline.set(entry.effectiveDeadline, []);
    }
    tasksByDeadline.get(entry.effectiveDeadline).push(entry);
  }

  const sortedDeadlines = Array.from(tasksByDeadline.keys()).sort();
  const lastRadarDate =
    dailyAvailability.length > 0
      ? dailyAvailability[dailyAvailability.length - 1].date
      : todayStr;
  const baselineDailyCap = computeBaselineDailyFocusCap(settings);

  let cumulativeRequiredMinutes = 0;
  const deadlines = [];

  for (const deadlineDate of sortedDeadlines) {
    const entries = tasksByDeadline.get(deadlineDate) || [];
    const requiredOnDateMinutes = entries.reduce(
      (sum, entry) => sum + entry.durationMinutes,
      0
    );
    cumulativeRequiredMinutes += requiredOnDateMinutes;

    const isOverdue = Boolean(todayStr && deadlineDate < todayStr);
    const beyondHorizon = Boolean(lastRadarDate && deadlineDate > lastRadarDate);

    let availableFocusMinutes = 0;
    if (!isOverdue) {
      for (const day of dailyAvailability) {
        if (day.date <= deadlineDate) {
          availableFocusMinutes += day.usableFocusMinutes;
        }
      }
      if (beyondHorizon && lastRadarDate) {
        const extraDays = Math.max(0, diffDays(lastRadarDate, deadlineDate));
        availableFocusMinutes += extraDays * baselineDailyCap;
      }
    }

    const bufferMinutes = availableFocusMinutes - cumulativeRequiredMinutes;
    const utilizationRatio =
      availableFocusMinutes > 0
        ? cumulativeRequiredMinutes / availableFocusMinutes
        : cumulativeRequiredMinutes > 0
          ? Infinity
          : 0;

    const status = classifyBufferStatus({
      isOverdue,
      bufferMinutes,
      cumulativeRequiredMinutes,
      availableFocusMinutes,
    });

    deadlines.push({
      date: deadlineDate,
      isOverdue,
      beyondHorizon,
      tasksDueOnDate: entries.map((e) => e.task),
      taskCountOnDate: entries.length,
      requiredOnDateMinutes,
      cumulativeRequiredMinutes,
      availableFocusMinutes,
      bufferMinutes,
      utilizationRatio,
      status,
    });
  }

  return {
    deadlines,
    countableTasks: countable,
    totalOpenWorkMinutes,
    totalDeadlineWorkMinutes: cumulativeRequiredMinutes,
    noDeadlineWorkMinutes,
  };
}

export function computeRadar({
  events = [],
  tasks = [],
  settings = {},
  simulatedBlock = null,
  simulatedBlocks = [],
  now = new Date(),
  days = 14,
  timeZone = DEFAULT_TIME_ZONE,
} = {}) {
  const dailyAvailability = computeDailyAvailability({
    events,
    settings,
    simulatedBlock,
    simulatedBlocks,
    now,
    days,
    timeZone,
  });

  const todayStr =
    dailyAvailability[0]?.date || getZonedDateParts(now, timeZone).dateStr;

  const workload = computeDeadlineWorkloads(
    tasks,
    dailyAvailability,
    settings,
    todayStr
  );

  let overallStatus = "Safe";
  for (const dl of workload.deadlines) {
    if (dl.status === "Critical") {
      overallStatus = "Critical";
      break;
    }
    if (dl.status === "Tight") {
      overallStatus = "Tight";
    }
  }

  const totalUsableFocusMinutes = dailyAvailability.reduce(
    (sum, day) => sum + day.usableFocusMinutes,
    0
  );

  return {
    todayStr,
    days: dailyAvailability,
    deadlines: workload.deadlines,
    overallStatus,
    totalUsableFocusMinutes,
    totalOpenWorkMinutes: workload.totalOpenWorkMinutes,
    totalDeadlineWorkMinutes: workload.totalDeadlineWorkMinutes,
    noDeadlineWorkMinutes: workload.noDeadlineWorkMinutes,
    countableTasks: workload.countableTasks,
  };
}

export function simulateRadarWithBlock({
  events = [],
  tasks = [],
  settings = {},
  simulatedBlock = null,
  now = new Date(),
  days = 14,
  timeZone = DEFAULT_TIME_ZONE,
} = {}) {
  const baseline = computeRadar({
    events,
    tasks,
    settings,
    now,
    days,
    timeZone,
  });

  const simulated = computeRadar({
    events,
    tasks,
    settings,
    simulatedBlock,
    now,
    days,
    timeZone,
  });

  const baselineByDate = new Map(
    baseline.deadlines.map((dl) => [dl.date, dl])
  );

  const deadlineImpacts = simulated.deadlines.map((simDl) => {
    const baseDl = baselineByDate.get(simDl.date);
    const baselineStatus = baseDl?.status || "Safe";
    const bufferDeltaMinutes = baseDl
      ? simDl.bufferMinutes - baseDl.bufferMinutes
      : 0;
    return {
      date: simDl.date,
      baselineStatus,
      simulatedStatus: simDl.status,
      bufferDeltaMinutes,
      statusChanged: baselineStatus !== simDl.status,
    };
  });

  return {
    baseline,
    simulated,
    impact: {
      overallStatusChanged:
        baseline.overallStatus !== simulated.overallStatus,
      baselineOverallStatus: baseline.overallStatus,
      simulatedOverallStatus: simulated.overallStatus,
      deadlineImpacts,
    },
  };
}
