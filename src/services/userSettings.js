import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";

export const DEFAULT_USER_SETTINGS = {
  activeStart: "09:00",
  activeEnd: "22:00",
  maxFocusCapMinutes: 300,
  restBlocks: [
    { id: "lunch", label: "Lunch", start: "12:00", end: "13:00" },
  ],
  onlineKeywords: ["online", "teams", "zoom", "remote"],
  categories: ["Studie", "Projecten", "Health", "Sociaal", "Thuis"],
  calendarRules: {},
  quickBusyBlocks: [],
};

const TIME_PATTERN = /^(?:([01]\d|2[0-3]):([0-5]\d)|24:00)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const brusselsDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function createDefaultSettings() {
  return {
    activeStart: DEFAULT_USER_SETTINGS.activeStart,
    activeEnd: DEFAULT_USER_SETTINGS.activeEnd,
    maxFocusCapMinutes: DEFAULT_USER_SETTINGS.maxFocusCapMinutes,
    restBlocks: DEFAULT_USER_SETTINGS.restBlocks.map((b) => ({ ...b })),
    onlineKeywords: [...DEFAULT_USER_SETTINGS.onlineKeywords],
    categories: [...DEFAULT_USER_SETTINGS.categories],
    calendarRules: {},
    quickBusyBlocks: [],
  };
}

export function isValidTimeString(str, allowEndOfDay = false) {
  if (typeof str !== "string") return false;
  if (!TIME_PATTERN.test(str)) return false;
  if (!allowEndOfDay && str === "24:00") return false;
  return true;
}

export function timeToMinutes(str) {
  if (typeof str !== "string" || !TIME_PATTERN.test(str)) return null;
  if (str === "24:00") return 1440;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

export function getCurrentBrusselsDateAndMinutes(now = new Date()) {
  const parts = brusselsDateTimeFormatter.formatToParts(now);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const minutes = Number(map.hour) * 60 + Number(map.minute);
  return { dateStr, minutes };
}

function normalizeRestBlocks(rawBlocks) {
  if (!Array.isArray(rawBlocks)) {
    return DEFAULT_USER_SETTINGS.restBlocks.map((b) => ({ ...b }));
  }

  const seenIds = new Set();
  const normalized = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    if (!block || typeof block !== "object") continue;
    if (!isValidTimeString(block.start, false) || !isValidTimeString(block.end, true)) {
      continue;
    }
    const startMin = timeToMinutes(block.start);
    const endMin = timeToMinutes(block.end);
    if (startMin === null || endMin === null || endMin <= startMin) continue;

    let id =
      typeof block.id === "string" && block.id.trim()
        ? block.id.trim()
        : `rest-${i + 1}`;
    while (seenIds.has(id)) {
      id = `${id}-${i + 1}`;
    }
    seenIds.add(id);

    const label =
      typeof block.label === "string" && block.label.trim()
        ? block.label.trim()
        : "Rest";

    normalized.push({
      id,
      label,
      start: block.start,
      end: block.end,
    });
  }

  return normalized;
}

function normalizeOnlineKeywords(rawKeywords) {
  if (!Array.isArray(rawKeywords)) {
    return [...DEFAULT_USER_SETTINGS.onlineKeywords];
  }

  const seen = new Set();
  const normalized = [];
  for (const kw of rawKeywords) {
    if (typeof kw !== "string") continue;
    const trimmed = kw.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    normalized.push(trimmed);
  }
  return normalized;
}

function normalizeCategories(rawCategories) {
  if (!Array.isArray(rawCategories)) {
    return [...DEFAULT_USER_SETTINGS.categories];
  }

  const seen = new Set();
  const normalized = [];
  for (const cat of rawCategories) {
    if (typeof cat !== "string") continue;
    const trimmed = cat.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    normalized.push(trimmed);
  }

  return normalized.length > 0
    ? normalized
    : [...DEFAULT_USER_SETTINGS.categories];
}

function normalizeCalendarRules(rawRules) {
  if (!rawRules || typeof rawRules !== "object" || Array.isArray(rawRules)) {
    return {};
  }

  const normalized = {};
  for (const [calendarId, rule] of Object.entries(rawRules)) {
    if (!calendarId || !rule || typeof rule !== "object") continue;
    const rawTravel = Number(rule.travelMinutes);
    const travelMinutes = Number.isFinite(rawTravel)
      ? Math.max(0, Math.min(240, Math.round(rawTravel)))
      : 0;

    normalized[calendarId] = {
      enabled: Boolean(rule.enabled),
      keywordFilter:
        typeof rule.keywordFilter === "string" ? rule.keywordFilter : "",
      travelMinutes,
    };
  }
  return normalized;
}

export function prunePastQuickBusyBlocks(blocks, now = new Date()) {
  if (!Array.isArray(blocks)) {
    return { blocks: [], pruned: false };
  }

  const { dateStr: todayStr, minutes: nowMinutes } =
    getCurrentBrusselsDateAndMinutes(now);

  const kept = [];
  const seenIds = new Set();

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block || typeof block !== "object") continue;
    if (typeof block.date !== "string" || !DATE_PATTERN.test(block.date)) continue;
    if (!isValidTimeString(block.start, false) || !isValidTimeString(block.end, true)) {
      continue;
    }

    const startMin = timeToMinutes(block.start);
    const endMin = timeToMinutes(block.end);
    if (startMin === null || endMin === null || endMin <= startMin) continue;

    if (block.date < todayStr) continue;
    if (block.date === todayStr && endMin <= nowMinutes) continue;

    let id =
      typeof block.id === "string" && block.id.trim()
        ? block.id.trim()
        : `busy-${block.date}-${i + 1}`;
    while (seenIds.has(id)) {
      id = `${id}-${i + 1}`;
    }
    seenIds.add(id);

    kept.push({
      id,
      date: block.date,
      start: block.start,
      end: block.end,
      label:
        typeof block.label === "string" && block.label.trim()
          ? block.label.trim()
          : "Busy Block",
    });
  }

  return {
    blocks: kept,
    pruned: kept.length !== blocks.length,
  };
}

export function normalizeUserSettings(rawSettings, options = {}) {
  const { prunePastBlocks = true, now = new Date() } = options;

  const isMissingObject =
    !rawSettings || typeof rawSettings !== "object" || Array.isArray(rawSettings);
  const src = isMissingObject ? {} : rawSettings;

  let activeStart = isValidTimeString(src.activeStart, false)
    ? src.activeStart
    : DEFAULT_USER_SETTINGS.activeStart;
  let activeEnd = isValidTimeString(src.activeEnd, true)
    ? src.activeEnd
    : DEFAULT_USER_SETTINGS.activeEnd;

  const startMin = timeToMinutes(activeStart);
  const endMin = timeToMinutes(activeEnd);
  if (startMin === null || endMin === null || endMin <= startMin) {
    activeStart = DEFAULT_USER_SETTINGS.activeStart;
    activeEnd = DEFAULT_USER_SETTINGS.activeEnd;
  }

  const rawCap = Number(src.maxFocusCapMinutes);
  const maxFocusCapMinutes = Number.isFinite(rawCap)
    ? Math.max(30, Math.min(960, Math.round(rawCap)))
    : DEFAULT_USER_SETTINGS.maxFocusCapMinutes;

  const restBlocks = normalizeRestBlocks(src.restBlocks);
  const onlineKeywords = normalizeOnlineKeywords(src.onlineKeywords);
  const categories = normalizeCategories(src.categories);
  const calendarRules = normalizeCalendarRules(src.calendarRules);

  const rawQuickBlocks = Array.isArray(src.quickBusyBlocks)
    ? src.quickBusyBlocks
    : [];
  const quickResult = prunePastBlocks
    ? prunePastQuickBusyBlocks(rawQuickBlocks, now)
    : prunePastQuickBusyBlocks(rawQuickBlocks, new Date(0));

  const requiredKeys = [
    "activeStart",
    "activeEnd",
    "maxFocusCapMinutes",
    "restBlocks",
    "onlineKeywords",
    "categories",
    "calendarRules",
    "quickBusyBlocks",
  ];
  const missingKey = requiredKeys.some((key) => src[key] === undefined);

  return {
    settings: {
      activeStart,
      activeEnd,
      maxFocusCapMinutes,
      restBlocks,
      onlineKeywords,
      categories,
      calendarRules,
      quickBusyBlocks: quickResult.blocks,
    },
    needsPersist: isMissingObject || missingKey || quickResult.pruned,
  };
}

export async function saveUserSettings(uid, nextSettings) {
  const { settings } = normalizeUserSettings(nextSettings, {
    prunePastBlocks: true,
  });
  await setDoc(doc(db, "users", uid), { settings }, { merge: true });
  return settings;
}
