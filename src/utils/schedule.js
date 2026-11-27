export const CATEGORIES = ["Studie", "Projecten", "Thuis", "Health", "Sociaal"];

export const TASK_SIZES = ["XS", "S", "M", "L", "XL"];

export const SIZE_DURATIONS = {
  XS: 15,
  S: 30,
  M: 60,
  L: 120,
  XL: 180,
};

export const TIME_BLOCK_ORDER = ["voormiddag", "namiddag", "avond", "nacht"];

export const TIME_BLOCKS = {
  voormiddag: {
    id: "voormiddag",
    label: "Voormiddag",
    startMin: 540,
    endMin: 720,
    durationMin: 180,
    rangeLabel: "09:00 – 12:00",
  },
  namiddag: {
    id: "namiddag",
    label: "Namiddag",
    startMin: 780,
    endMin: 960,
    durationMin: 180,
    rangeLabel: "13:00 – 16:00",
  },
  avond: {
    id: "avond",
    label: "Avond",
    startMin: 1110,
    endMin: 1320,
    durationMin: 210,
    rangeLabel: "18:30 – 22:00",
  },
  nacht: {
    id: "nacht",
    label: "Nacht",
    startMin: 1320,
    endMin: 1440,
    durationMin: 120,
    rangeLabel: "22:00 – 24:00",
  },
};

function pad2(num) {
  return String(num).padStart(2, "0");
}

export function getTaskDuration(task) {
  if (
    typeof task?.durationOverride === "number" &&
    Number.isFinite(task.durationOverride) &&
    task.durationOverride >= 15
  ) {
    return task.durationOverride;
  }
  return SIZE_DURATIONS[task?.size] ?? 60;
}

export function formatMinutes(totalMinutes) {
  if (totalMinutes === 1440) return "24:00";
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${pad2(hours)}:${pad2(mins)}`;
}

export function formatDurationLabel(minutes) {
  if (!minutes || minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function getShortParentPrefix(parentTitle, wordCount = 3) {
  if (!parentTitle || typeof parentTitle !== "string") return "";
  const words = parentTitle.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, wordCount).join(" ");
}

const brusselsDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getTodayDateString() {
  return brusselsDateFormatter.format(new Date());
}

export function isTimestampTodayInBrussels(timestampMs) {
  if (typeof timestampMs !== "number" || !Number.isFinite(timestampMs) || timestampMs <= 0) {
    return false;
  }
  return brusselsDateFormatter.format(new Date(timestampMs)) === getTodayDateString();
}

export function addDaysToDateString(dateStr, days) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const year = utc.getUTCFullYear();
  const month = pad2(utc.getUTCMonth() + 1);
  const day = pad2(utc.getUTCDate());
  return `${year}-${month}-${day}`;
}

export function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const brusselsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getBrusselsOffsetMinutes(utcMs) {
  const parts = brusselsFormatter.formatToParts(new Date(utcMs));
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

export function toBrusselsRfc3339(dateStr, minutesFromMidnight) {
  const dayOffset = Math.floor(minutesFromMidnight / 1440);
  const effectiveDate =
    dayOffset !== 0 ? addDaysToDateString(dateStr, dayOffset) : dateStr;
  const mins = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;

  const [y, m, d] = effectiveDate.split("-").map(Number);
  const localAsUtcMs = Date.UTC(y, m - 1, d, hours, minutes, 0);
  const firstOffset = getBrusselsOffsetMinutes(localAsUtcMs);
  const refinedUtcMs = localAsUtcMs - firstOffset * 60000;
  const exactOffset = getBrusselsOffsetMinutes(refinedUtcMs);

  const sign = exactOffset >= 0 ? "+" : "-";
  const absOffset = Math.abs(exactOffset);
  const offHours = pad2(Math.floor(absOffset / 60));
  const offMinutes = pad2(absOffset % 60);

  return `${effectiveDate}T${pad2(hours)}:${pad2(minutes)}:00${sign}${offHours}:${offMinutes}`;
}

export function getSlotKey(workDate, timeBlock) {
  if (!workDate || !timeBlock) return null;
  return `${workDate}|${timeBlock}`;
}

export function sortBlockTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    const createdDiff = (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0);
    if (createdDiff !== 0) return createdDiff;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

export function computeBlockSchedule(tasksInBlock, timeBlockId) {
  const block = TIME_BLOCKS[timeBlockId];
  if (!block) {
    return {
      block: null,
      entries: [],
      totalMin: 0,
      blockDurationMin: 0,
      fits: true,
    };
  }

  const sorted = sortBlockTasks(tasksInBlock);
  let cursor = block.startMin;

  const entries = sorted.map((task, idx) => {
    const durationMin = getTaskDuration(task);
    const startMin = cursor;
    const endMin = cursor + durationMin;
    cursor = endMin;

    return {
      task,
      order: idx,
      durationMin,
      startMin,
      endMin,
      startLabel: formatMinutes(startMin),
      endLabel: formatMinutes(endMin),
    };
  });

  const totalMin = cursor - block.startMin;

  return {
    block,
    entries,
    totalMin,
    blockDurationMin: block.durationMin,
    fits: totalMin <= block.durationMin,
  };
}

export function computeAllSchedules(tasks) {
  const groups = new Map();

  for (const task of tasks) {
    if (task.completed) continue;
    const key = getSlotKey(task.workDate, task.timeBlock);
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(task);
  }

  const scheduleMap = new Map();
  for (const [, blockTasks] of groups.entries()) {
    const timeBlockId = blockTasks[0]?.timeBlock;
    const result = computeBlockSchedule(blockTasks, timeBlockId);
    for (const entry of result.entries) {
      scheduleMap.set(entry.task.id, entry);
    }
  }

  return scheduleMap;
}

export function computeAutoFit(tasksInBlock, timeBlockId) {
  const block = TIME_BLOCKS[timeBlockId];
  if (!block) {
    return {
      possible: false,
      block: null,
      totalRequired: 0,
      availableMin: 0,
      adjustments: [],
    };
  }

  const activeTasks = sortBlockTasks(tasksInBlock.filter((t) => !t.completed));
  const totalRequired = activeTasks.reduce((sum, t) => sum + getTaskDuration(t), 0);

  const availableMin = block.durationMin;
  const totalSlots = Math.floor(availableMin / 15);

  if (activeTasks.length === 0 || activeTasks.length > totalSlots) {
    return {
      possible: false,
      block,
      totalRequired,
      availableMin,
      adjustments: [],
    };
  }

  const totalOrig = activeTasks.reduce(
    (sum, t) => sum + Math.max(15, getTaskDuration(t)),
    0
  );
  const ratio = availableMin / totalOrig;

  const items = activeTasks.map((task, index) => {
    const naturalDuration = SIZE_DURATIONS[task.size] ?? 60;
    const origDuration = Math.max(15, getTaskDuration(task));
    const scaled = origDuration * ratio;
    const floored = Math.max(15, Math.floor(scaled / 15) * 15);
    return {
      index,
      task,
      naturalDuration,
      origDuration,
      scaled,
      duration: floored,
    };
  });

  let currentTotal = items.reduce((sum, item) => sum + item.duration, 0);

  while (currentTotal > availableMin) {
    let candidate = null;
    for (const item of items) {
      if (item.duration <= 15) continue;
      if (!candidate) {
        candidate = item;
        continue;
      }
      const excessItem = item.duration - item.scaled;
      const excessCand = candidate.duration - candidate.scaled;
      if (
        excessItem > excessCand ||
        (excessItem === excessCand &&
          (item.duration > candidate.duration ||
            (item.duration === candidate.duration && item.index > candidate.index)))
      ) {
        candidate = item;
      }
    }
    if (!candidate) break;
    candidate.duration -= 15;
    currentTotal -= 15;
  }

  while (currentTotal < availableMin) {
    let candidate = null;
    for (const item of items) {
      if (!candidate) {
        candidate = item;
        continue;
      }
      const itemUnderOrig = item.duration < item.origDuration;
      const candUnderOrig = candidate.duration < candidate.origDuration;
      if (itemUnderOrig !== candUnderOrig) {
        if (itemUnderOrig) candidate = item;
        continue;
      }
      const deficitItem = item.scaled - item.duration;
      const deficitCand = candidate.scaled - candidate.duration;
      if (
        deficitItem > deficitCand ||
        (deficitItem === deficitCand &&
          (item.origDuration > candidate.origDuration ||
            (item.origDuration === candidate.origDuration &&
              item.index < candidate.index)))
      ) {
        candidate = item;
      }
    }
    if (!candidate) break;
    candidate.duration += 15;
    currentTotal += 15;
  }

  let cursor = block.startMin;
  const adjustments = items.map((item) => {
    const newDuration = item.duration;
    const startMin = cursor;
    const endMin = cursor + newDuration;
    cursor = endMin;

    return {
      taskId: item.task.id,
      title: item.task.title,
      size: item.task.size,
      oldDuration: item.origDuration,
      newDuration,
      startMin,
      endMin,
      startLabel: formatMinutes(startMin),
      endLabel: formatMinutes(endMin),
      durationOverride: newDuration === item.naturalDuration ? null : newDuration,
    };
  });

  return {
    possible: true,
    block,
    totalRequired,
    availableMin,
    adjustments,
  };
}

function getDisplayRank(task) {
  if (task.workDate && task.timeBlock) return 0;
  if (task.deadline) return 1;
  return 2;
}

export function compareTasksForDisplay(a, b) {
  const rankA = getDisplayRank(a);
  const rankB = getDisplayRank(b);
  if (rankA !== rankB) return rankA - rankB;

  if (rankA === 0) {
    if (a.workDate !== b.workDate) {
      return a.workDate < b.workDate ? -1 : 1;
    }
    const blockA = TIME_BLOCK_ORDER.indexOf(a.timeBlock);
    const blockB = TIME_BLOCK_ORDER.indexOf(b.timeBlock);
    if (blockA !== blockB) return blockA - blockB;
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
  } else if (rankA === 1) {
    if (a.deadline !== b.deadline) {
      return a.deadline < b.deadline ? -1 : 1;
    }
  }

  const createdDiff = (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0);
  if (createdDiff !== 0) return createdDiff;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

export function groupTasksWithSubtasks(tasks) {
  const nodeMap = new Map();
  const nodes = tasks.map((task) => {
    const node = { ...task, subtasks: [] };
    nodeMap.set(task.id, node);
    return node;
  });

  const roots = [];
  for (const node of nodes) {
    const parentNode = node.parentId ? nodeMap.get(node.parentId) : null;
    if (parentNode && parentNode.id !== node.id) {
      parentNode.subtasks.push(node);
    } else {
      roots.push(node);
    }
  }

  roots.sort(compareTasksForDisplay);
  for (const node of nodes) {
    if (node.subtasks.length > 1) {
      node.subtasks.sort((a, b) => {
        if (Boolean(a.completed) !== Boolean(b.completed)) {
          return a.completed ? 1 : -1;
        }
        return compareTasksForDisplay(a, b);
      });
    }
  }

  return roots;
}

export function getExpiredTaskIdsForCleanup(
  tasks,
  nowMs = Date.now(),
  maxAgeMs = 48 * 60 * 60 * 1000
) {
  const cutoffMs = nowMs - maxAgeMs;
  const taskById = new Map();
  const childrenByParent = new Map();

  for (const t of tasks) {
    taskById.set(t.id, t);
    if (t.parentId) {
      if (!childrenByParent.has(t.parentId)) {
        childrenByParent.set(t.parentId, []);
      }
      childrenByParent.get(t.parentId).push(t.id);
    }
  }

  const expiredIds = new Set();

  for (const task of tasks) {
    const isExpired =
      task.completed &&
      typeof task.completedAtMs === "number" &&
      task.completedAtMs > 0 &&
      task.completedAtMs < cutoffMs;

    if (!isExpired) continue;

    if (!task.parentId) {
      expiredIds.add(task.id);
      const childIds = childrenByParent.get(task.id) || [];
      for (const cid of childIds) {
        expiredIds.add(cid);
      }
    } else if (!taskById.has(task.parentId)) {
      // Orphaned subtask with no parent remaining
      expiredIds.add(task.id);
    }
    // Subtasks belonging to an existing open parent are never deleted
  }

  return Array.from(expiredIds);
}
