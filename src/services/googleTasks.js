const LISTS_ENDPOINT = "https://tasks.googleapis.com/tasks/v1/users/@me/lists";
const TASKS_LISTS_BASE = "https://tasks.googleapis.com/tasks/v1/lists";

export class AuthExpiredError extends Error {
  constructor(message = "Google Tasks sessie is verlopen of niet verbonden.") {
    super(message);
    this.name = "AuthExpiredError";
    this.status = 401;
  }
}

async function googleTasksRequest(url, accessToken, options = {}) {
  if (!accessToken) {
    throw new AuthExpiredError("Geen actief Google OAuth token gevonden.");
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
    throw new AuthExpiredError("OAuth token is verlopen of ongeldig.");
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Google Tasks API fout (${response.status}): ${errorBody || response.statusText}`);
  }

  return response.json();
}

export async function fetchTaskLists(accessToken) {
  const data = await googleTasksRequest(LISTS_ENDPOINT, accessToken, {
    method: "GET",
  });
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((list) => ({
    id: list.id,
    title: list.title || "Takenlijst",
  }));
}

export async function fetchOpenTasks(accessToken) {
  const lists = await fetchTaskLists(accessToken);

  const tasksPerList = await Promise.all(
    lists.map(async (list) => {
      const url = `${TASKS_LISTS_BASE}/${encodeURIComponent(list.id)}/tasks?showCompleted=false`;
      const data = await googleTasksRequest(url, accessToken, {
        method: "GET",
      });
      const items = Array.isArray(data.items) ? data.items : [];

      return items
        .filter((task) => task.status !== "completed" && task.title && task.title.trim() !== "")
        .map((task) => ({
          ...task,
          listId: list.id,
          listTitle: list.title,
        }));
    })
  );

  return {
    lists,
    tasks: tasksPerList.flat(),
  };
}

export async function completeGoogleTask(accessToken, listId, taskId) {
  const url = `${TASKS_LISTS_BASE}/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`;
  return googleTasksRequest(url, accessToken, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "completed",
    }),
  });
}
