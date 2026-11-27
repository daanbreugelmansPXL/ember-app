import { CALENDAR_PROXY_URL } from "../config.js";
import { auth } from "../firebase.js";

const PROXY_BASE_URL = CALENDAR_PROXY_URL.replace(/\/+$/, "");
const REFRESH_BUFFER_MS = 2 * 60 * 1000;

let tokenCache = null;
let inflightRequest = null;

export function clearCalendarTokenCache() {
  tokenCache = null;
  inflightRequest = null;
}

async function getFirebaseIdToken() {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  const idToken = await currentUser.getIdToken();
  return { uid: currentUser.uid, idToken };
}

function formatCalendarErrorMessage(rawCode) {
  const code = String(rawCode || "").trim();
  if (!code || code === "access_denied") {
    return "Google Calendar connection was cancelled.";
  }
  return `Google Calendar connection failed: ${code}.`;
}

export async function getCalendarAccessToken(forceRefresh = false) {
  const authContext = await getFirebaseIdToken();
  if (!authContext) {
    clearCalendarTokenCache();
    return null;
  }

  const { uid, idToken } = authContext;

  if (
    !forceRefresh &&
    tokenCache &&
    tokenCache.uid === uid &&
    tokenCache.accessToken &&
    Date.now() < tokenCache.expiresAtMs - REFRESH_BUFFER_MS
  ) {
    return tokenCache.accessToken;
  }

  if (!forceRefresh && inflightRequest && inflightRequest.uid === uid) {
    return inflightRequest.promise;
  }

  const requestPromise = (async () => {
    const response = await fetch(`${PROXY_BASE_URL}/token`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: "application/json",
      },
    });

    if (response.status === 404 || response.status === 401) {
      clearCalendarTokenCache();
      return null;
    }

    const data = await response.json().catch(() => null);

    if (data?.connected === false || !data?.accessToken) {
      if (response.ok) {
        clearCalendarTokenCache();
        return null;
      }
      const error = new Error(
        data?.error ||
          data?.message ||
          `Failed to retrieve Google Calendar token (${response.status}).`
      );
      error.status = response.status;
      throw error;
    }

    if (!response.ok) {
      const error = new Error(
        data?.error ||
          data?.message ||
          `Failed to retrieve Google Calendar token (${response.status}).`
      );
      error.status = response.status;
      throw error;
    }

    const parsedExpiresIn = Number(data.expiresIn ?? data.expires_in);
    const expiresInSec =
      Number.isFinite(parsedExpiresIn) && parsedExpiresIn > 0
        ? parsedExpiresIn
        : 3600;

    tokenCache = {
      uid,
      accessToken: data.accessToken,
      expiresAtMs: Date.now() + expiresInSec * 1000,
    };

    return data.accessToken;
  })();

  inflightRequest = { uid, promise: requestPromise };
  try {
    return await requestPromise;
  } finally {
    if (inflightRequest?.promise === requestPromise) {
      inflightRequest = null;
    }
  }
}

export async function connectGoogleCalendar() {
  const authContext = await getFirebaseIdToken();
  if (!authContext) {
    throw new Error("Please sign in before connecting Google Calendar.");
  }

  const returnUrl = window.location.origin + window.location.pathname;

  const response = await fetch(`${PROXY_BASE_URL}/auth/init`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authContext.idToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ returnUrl }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.authUrl) {
    throw new Error(
      data?.error ||
        data?.message ||
        "Failed to initialize Google Calendar connection."
    );
  }

  window.location.assign(data.authUrl);
}

export async function disconnectGoogleCalendar() {
  const authContext = await getFirebaseIdToken();
  if (!authContext) {
    clearCalendarTokenCache();
    return;
  }

  try {
    const response = await fetch(`${PROXY_BASE_URL}/disconnect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authContext.idToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok && response.status !== 404) {
      const data = await response.json().catch(() => null);
      throw new Error(
        data?.error ||
          data?.message ||
          `Failed to disconnect Google Calendar (${response.status}).`
      );
    }
  } finally {
    clearCalendarTokenCache();
  }
}

export function consumeCalendarAuthCallback() {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const connectedParam = url.searchParams.get("calendar_connected");
  const errorParam = url.searchParams.get("calendar_error");

  if (connectedParam === null && errorParam === null) {
    return null;
  }

  url.searchParams.delete("calendar_connected");
  url.searchParams.delete("calendar_error");

  const nextQuery = url.searchParams.toString();
  const cleanUrl = `${url.pathname}${nextQuery ? `?${nextQuery}` : ""}${url.hash}`;
  window.history.replaceState({}, document.title, cleanUrl);

  if (errorParam !== null) {
    return {
      type: "error",
      code: errorParam,
      message: formatCalendarErrorMessage(errorParam),
    };
  }

  if (connectedParam === "1" || connectedParam === "true") {
    return {
      type: "success",
      message: "Google Calendar connected successfully.",
    };
  }

  return null;
}
