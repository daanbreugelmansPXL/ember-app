import { addDaysToDateString, toBrusselsRfc3339 } from "../utils/schedule";

const CALENDAR_EVENTS_BASE =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export class CalendarAuthError extends Error {
  constructor(
    message = "Google Agenda sessie is verlopen of niet verbonden.",
    status = 401
  ) {
    super(message);
    this.name = "CalendarAuthError";
    this.status = status;
  }
}

async function calendarRequest(url, accessToken, options = {}) {
  if (!accessToken) {
    throw new CalendarAuthError("Geen actief Google OAuth token gevonden.", 401);
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
      "Google Agenda toegang is verlopen of geweigerd.",
      response.status
    );
  }

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    const error = new Error(
      `Google Calendar API fout (${response.status}): ${errorBody || response.statusText}`
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export function buildWorkEventPayload(task, slot) {
  const prefix = task.completed ? "[✓]" : "[ ]";
  return {
    summary: `${prefix} ${task.title}`,
    start: {
      dateTime: toBrusselsRfc3339(task.workDate, slot.startMin),
      timeZone: "Europe/Brussels",
    },
    end: {
      dateTime: toBrusselsRfc3339(task.workDate, slot.endMin),
      timeZone: "Europe/Brussels",
    },
  };
}

export function buildDeadlineEventPayload(task) {
  const summary = task.completed
    ? `[✓] [DL] ${task.title}`
    : `[DL] ${task.title}`;
  return {
    summary,
    start: {
      date: task.deadline,
    },
    end: {
      date: addDaysToDateString(task.deadline, 1),
    },
    colorId: "11",
  };
}

export async function upsertEvent(accessToken, eventId, payload) {
  if (eventId) {
    try {
      const updated = await calendarRequest(
        `${CALENDAR_EVENTS_BASE}/${encodeURIComponent(eventId)}`,
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

  const created = await calendarRequest(CALENDAR_EVENTS_BASE, accessToken, {
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
      `${CALENDAR_EVENTS_BASE}/${encodeURIComponent(eventId)}`,
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

export async function syncTaskCalendarEvents(accessToken, task, slot) {
  let nextWorkId = task.calendarWorkEventId || null;
  let nextDeadlineId = task.calendarDeadlineEventId || null;

  if (task.workDate && task.timeBlock && slot) {
    const workPayload = buildWorkEventPayload(task, slot);
    nextWorkId = await upsertEvent(
      accessToken,
      task.calendarWorkEventId,
      workPayload
    );
  } else if (task.calendarWorkEventId) {
    await deleteEvent(accessToken, task.calendarWorkEventId);
    nextWorkId = null;
  }

  if (task.deadline) {
    const deadlinePayload = buildDeadlineEventPayload(task);
    nextDeadlineId = await upsertEvent(
      accessToken,
      task.calendarDeadlineEventId,
      deadlinePayload
    );
  } else if (task.calendarDeadlineEventId) {
    await deleteEvent(accessToken, task.calendarDeadlineEventId);
    nextDeadlineId = null;
  }

  return {
    calendarWorkEventId: nextWorkId,
    calendarDeadlineEventId: nextDeadlineId,
    changed:
      nextWorkId !== (task.calendarWorkEventId || null) ||
      nextDeadlineId !== (task.calendarDeadlineEventId || null),
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
