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
  if (!minutes || minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}u` : `${h}u ${m}m`;
}

export function getTodayDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
  return date.toLocaleDateString("nl-NL", {
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

export function computeAutoFit(tasksInBlock, timeBlockId, incomingTaskId = null) {
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

  const sorted = sortBlockTasks(tasksInBlock);
  const totalRequired = sorted.reduce((sum, t) => sum + getTaskDuration(t), 0);

  const fixedTasks = sorted.filter(
    (t) => t.completed === true && t.id !== incomingTaskId
  );
  const scalableTasks = sorted.filter(
    (t) => !(t.completed === true && t.id !== incomingTaskId)
  );

  const fixedDuration = fixedTasks.reduce((sum, t) => sum + getTaskDuration(t), 0);
  const availableMin = Math.max(0, block.durationMin - fixedDuration);
  const totalSlots = Math.floor(availableMin / 15);

  if (scalableTasks.length === 0 || scalableTasks.length > totalSlots) {
    return {
      possible: false,
      block,
      totalRequired,
      availableMin,
      adjustments: [],
    };
  }

  const items = scalableTasks.map((task) => {
    const naturalDuration = SIZE_DURATIONS[task.size] ?? 60;
    const maxSlots = Math.max(1, Math.floor(naturalDuration / 15));
    return {
      task,
      naturalDuration,
      oldDuration: getTaskDuration(task),
      maxSlots,
      weight: naturalDuration,
      target: 0,
      alloc: 1,
    };
  });

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  for (const item of items) {
    item.target = (item.weight / totalWeight) * totalSlots;
    item.alloc = Math.max(1, Math.min(item.maxSlots, Math.floor(item.target)));
  }

  let currentSlots = items.reduce((sum, item) => sum + item.alloc, 0);

  while (currentSlots < totalSlots) {
    let bestItem = null;
    let bestScore = -Infinity;

    for (const item of items) {
      if (item.alloc >= item.maxSlots) continue;
      const deficit = item.target - item.alloc;
      if (
        deficit > bestScore ||
        (deficit === bestScore && bestItem && item.weight > bestItem.weight)
      ) {
        bestScore = deficit;
        bestItem = item;
      }
    }

    if (!bestItem) break;
    bestItem.alloc += 1;
    currentSlots += 1;
  }

  while (currentSlots > totalSlots) {
    let worstItem = null;
    let worstScore = Infinity;

    for (const item of items) {
      if (item.alloc <= 1) continue;
      const deficit = item.target - item.alloc;
      if (deficit < worstScore) {
        worstScore = deficit;
        worstItem = item;
      }
    }

    if (!worstItem) break;
    worstItem.alloc -= 1;
    currentSlots -= 1;
  }

  const adjustments = items.map((item) => {
    const newDuration = item.alloc * 15;
    return {
      taskId: item.task.id,
      title: item.task.title,
      size: item.task.size,
      oldDuration: item.oldDuration,
      newDuration,
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
      node.subtasks.sort(compareTasksForDisplay);
    }
  }

  return roots;
}
