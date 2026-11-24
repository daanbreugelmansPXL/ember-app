const TASKS_ENDPOINT = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";

export class AuthExpiredError extends Error {
  constructor(message = "Google Tasks sessie is verlopen of niet verbonden.") {
    super(message);
    this.name = "AuthExpiredError";
    this.status = 401;
  }
}

export async function fetchOpenTasks(accessToken) {
  if (!accessToken) {
    throw new AuthExpiredError("Geen actief Google OAuth token gevonden.");
  }

  const response = await fetch(`${TASKS_ENDPOINT}?showCompleted=false`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new AuthExpiredError("OAuth token is verlopen of ongeldig.");
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Fout bij ophalen van Google Tasks (${response.status}): ${errorBody || response.statusText}`);
  }

  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.filter((task) => task.status !== "completed" && task.title && task.title.trim() !== "");
}

export async function completeGoogleTask(accessToken, taskId) {
  if (!accessToken) {
    throw new AuthExpiredError("Geen actief Google OAuth token gevonden.");
  }

  const response = await fetch(`${TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      status: "completed",
    }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new AuthExpiredError("OAuth token is verlopen of ongeldig.");
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Kon taak niet afvinken (${response.status}): ${errorBody || response.statusText}`);
  }

  return response.json();
}
