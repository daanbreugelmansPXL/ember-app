import {
  addDaysToDateString,
  toBrusselsRfc3339,
} from "../utils/schedule.js";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const PRIMARY_EVENTS_BASE = `${CALENDAR_API_BASE}/calendars/primary/events`;

const brusselsDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export class CalendarAuthError extends Error {
  constructor(
    message = "Google Calendar session expired or disconnected.",
    status = 401
  ) {
    super(message);
    this.name = "CalendarAuthError";
    this.status = status;
  }
}

async function calendarRequest(url, accessToken, options = {}) {
  if (!accessToken) {
    throw new CalendarAuthError("No active Google OAuth token found.", 401);
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new CalendarAuthError(
      "Google Calendar authorization expired or denied.",
      response.status
    );
  }

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    const error = new Error(
      `Google Calendar API error (${response.status}): ${errorBody || response.statusText}`
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function fetchCalendarList(accessToken) {
  const items = [];
  let pageToken = "";

  do {
    const url = new URL(`${CALENDAR_API_BASE}/users/me/calendarList`);
    url.searchParams.set("maxResults", "250");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const data = await calendarRequest(url.toString(), accessToken);
    if (Array.isArray(data?.items)) {
      for (const item of data.items) {
        if (!item?.id || item.deleted) continue;
        items.push({
          id: item.id,
          summary: item.summaryOverride || item.summary || item.id,
          primary: Boolean(item.primary),
          backgroundColor: item.backgroundColor || null,
          accessRole: item.accessRole || "reader",
        });
      }
    }
    pageToken = data?.nextPageToken || "";
  } while (pageToken);

  items.sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return a.summary.localeCompare(b.summary);
  });

  return items;
}

async function fetchSingleCalendarEvents(
  accessToken,
  calendarId,
  rule,
  timeMin,
  timeMax
) {
  const events = [];
  let pageToken = "";
  const keyword =
    typeof rule?.keywordFilter === "string"
      ? rule.keywordFilter.trim().toLowerCase()
      : "";
  const rawTravel = Number(rule?.travelMinutes);
  const travelMinutes = Number.isFinite(rawTravel)
    ? Math.max(0, Math.round(rawTravel))
    : 0;

  try {
    do {
      const url = new URL(
        `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
      );
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("maxResults", "2500");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const data = await calendarRequest(url.toString(), accessToken);
      if (Array.isArray(data?.items)) {
        for (const event of data.items) {
          if (!event) continue;
          if (event.status === "cancelled") continue;
          if (!event.start?.dateTime || !event.end?.dateTime) continue;
          if (event.transparency === "transparent") continue;

          const summary = typeof event.summary === "string" ? event.summary : "";
          if (keyword && !summary.toLowerCase().includes(keyword)) {
            continue;
          }

          events.push({
            id: event.id || `${calendarId}-${event.start.dateTime}`,
            calendarId,
            summary,
            location: typeof event.location === "string" ? event.location : "",
            startDateTime: event.start.dateTime,
            endDateTime: event.end.dateTime,
            travelMinutes,
          });
        }
      }

      pageToken = data?.nextPageToken || "";
    } while (pageToken);
  } catch (err) {
    if (err instanceof CalendarAuthError) {
      throw err;
    }
    if (err?.status === 404 || err?.status === 410) {
      return [];
    }
    throw err;
  }

  return events;
}

export async function fetchUpcomingBusyEvents(
  accessToken,
  calendarRules = {},
  options = {}
) {
  const { days = 14, now = new Date() } = options;

  const enabledEntries = Object.entries(calendarRules || {}).filter(
    ([calendarId, rule]) => Boolean(calendarId && rule?.enabled === true)
  );
  if (enabledEntries.length === 0) {
    return [];
  }

  const todayStr = brusselsDateFormatter.format(now);
  const timeMin = toBrusselsRfc3339(todayStr, 0);
  const timeMax = toBrusselsRfc3339(addDaysToDateString(todayStr, days), 0);

  const perCalendarLists = await Promise.all(
    enabledEntries.map(([calendarId, rule]) =>
      fetchSingleCalendarEvents(accessToken, calendarId, rule, timeMin, timeMax)
    )
  );

  const merged = perCalendarLists.flat();
  merged.sort(
    (a, b) =>
      new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
  );
  return merged;
}

export function formatDeadlineSummary(task) {
  const size = task?.size || "M";
  const title = typeof task?.title === "string" ? task.title.trim() : "";
  return `[!] (${size}) ${title}`;
}

export function buildDeadlineEventPayload(task) {
  return {
    summary: formatDeadlineSummary(task),
    description: typeof task?.notes === "string" ? task.notes : "",
    start: {
      date: task.deadline,
    },
    end: {
      date: addDaysToDateString(task.deadline, 1),
    },
    colorId: "11",
    transparency: "transparent",
  };
}

export async function upsertEvent(accessToken, eventId, payload) {
  if (eventId) {
    try {
      const updated = await calendarRequest(
        `${PRIMARY_EVENTS_BASE}/${encodeURIComponent(eventId)}`,
        accessToken,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      return updated?.id || eventId;
    } catch (err) {
      if (err?.status !== 404 && err?.status !== 410) {
        throw err;
      }
    }
  }

  const created = await calendarRequest(PRIMARY_EVENTS_BASE, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return created?.id || null;
}

export async function deleteEvent(accessToken, eventId) {
  if (!eventId) return;
  try {
    await calendarRequest(
      `${PRIMARY_EVENTS_BASE}/${encodeURIComponent(eventId)}`,
      accessToken,
      {
        method: "DELETE",
      }
    );
  } catch (err) {
    if (err?.status !== 404 && err?.status !== 410) {
      throw err;
    }
  }
}

export async function syncTaskCalendarEvents(accessToken, task) {
  if (!task) {
    return {
      calendarWorkEventId: null,
      calendarDeadlineEventId: null,
      changed: false,
    };
  }

  const prevWorkId = task.calendarWorkEventId || null;
  const prevDeadlineId = task.calendarDeadlineEventId || null;

  if (prevWorkId) {
    await deleteEvent(accessToken, prevWorkId);
  }

  if (task.completed) {
    if (prevDeadlineId) {
      await deleteEvent(accessToken, prevDeadlineId);
    }
    return {
      calendarWorkEventId: null,
      calendarDeadlineEventId: null,
      changed: Boolean(prevWorkId || prevDeadlineId),
    };
  }

  let nextDeadlineId = prevDeadlineId;
  if (task.deadline) {
    const deadlinePayload = buildDeadlineEventPayload(task);
    nextDeadlineId = await upsertEvent(
      accessToken,
      prevDeadlineId,
      deadlinePayload
    );
  } else if (prevDeadlineId) {
    await deleteEvent(accessToken, prevDeadlineId);
    nextDeadlineId = null;
  }

  return {
    calendarWorkEventId: null,
    calendarDeadlineEventId: nextDeadlineId,
    changed: Boolean(prevWorkId) || nextDeadlineId !== prevDeadlineId,
  };
}

export async function deleteTaskCalendarEvents(accessToken, task) {
  if (!accessToken || !task) return;
  if (task.calendarWorkEventId) {
    await deleteEvent(accessToken, task.calendarWorkEventId);
  }
  if (task.calendarDeadlineEventId) {
    await deleteEvent(accessToken, task.calendarDeadlineEventId);
  }
}
