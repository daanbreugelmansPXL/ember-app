import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

export { serverTimestamp };

function getTasksCollection(uid) {
  return collection(db, "users", uid, "tasks");
}

function resolveTimestampMs(value) {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function normalizeTaskDoc(docSnap) {
  const data = docSnap.data({ serverTimestamps: "estimate" }) || {};
  const createdAtMs = resolveTimestampMs(data.createdAt) ?? 0;
  const completedAtMs = resolveTimestampMs(data.completedAt);

  return {
    id: docSnap.id,
    title: data.title || "",
    notes: typeof data.notes === "string" ? data.notes : "",
    category: data.category || "Studie",
    size: data.size || "M",
    workDate: data.workDate || null,
    timeBlock: data.timeBlock || null,
    order: typeof data.order === "number" ? data.order : 0,
    durationOverride:
      typeof data.durationOverride === "number" ? data.durationOverride : null,
    deadline: data.deadline || null,
    parentId: data.parentId || null,
    calendarPrefix:
      typeof data.calendarPrefix === "string" ? data.calendarPrefix : null,
    completed: Boolean(data.completed),
    completedAt: data.completedAt || null,
    completedAtMs,
    shiftCount: typeof data.shiftCount === "number" ? data.shiftCount : 0,
    calendarWorkEventId: data.calendarWorkEventId || null,
    calendarDeadlineEventId: data.calendarDeadlineEventId || null,
    createdAt: data.createdAt || null,
    createdAtMs,
  };
}

export function subscribeToTasks(uid, onTasks, onError) {
  if (!uid) return () => {};
  const colRef = getTasksCollection(uid);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const tasks = snapshot.docs.map(normalizeTaskDoc);
      onTasks(tasks);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
}

export async function createTaskDoc(uid, data) {
  const isSubtask = Boolean(data.parentId);
  const payload = {
    title: data.title.trim(),
    notes: typeof data.notes === "string" ? data.notes.trim() : "",
    category: data.category,
    size: data.size,
    workDate: data.workDate || null,
    timeBlock: data.timeBlock || null,
    order: typeof data.order === "number" ? data.order : 0,
    durationOverride:
      typeof data.durationOverride === "number" ? data.durationOverride : null,
    deadline: data.deadline || null,
    parentId: data.parentId || null,
    calendarPrefix: isSubtask
      ? typeof data.calendarPrefix === "string"
        ? data.calendarPrefix.trim()
        : ""
      : null,
    completed: false,
    completedAt: null,
    shiftCount: 0,
    calendarWorkEventId: null,
    calendarDeadlineEventId: null,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(getTasksCollection(uid), payload);

  return {
    ...payload,
    id: docRef.id,
    completedAtMs: null,
    createdAtMs: Date.now(),
  };
}

export async function updateTaskDoc(uid, taskId, updates) {
  const taskRef = doc(db, "users", uid, "tasks", taskId);
  await updateDoc(taskRef, updates);
}

export async function batchUpdateTasks(uid, entries) {
  if (!entries || entries.length === 0) return;
  const chunkSize = 450;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const entry of entries.slice(i, i + chunkSize)) {
      const taskRef = doc(db, "users", uid, "tasks", entry.id);
      batch.update(taskRef, entry.updates);
    }
    await batch.commit();
  }
}

export async function batchDeleteTasks(uid, taskIds) {
  if (!taskIds || taskIds.length === 0) return;
  const chunkSize = 450;
  for (let i = 0; i < taskIds.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const id of taskIds.slice(i, i + chunkSize)) {
      const taskRef = doc(db, "users", uid, "tasks", id);
      batch.delete(taskRef);
    }
    await batch.commit();
  }
}

export async function batchRestoreTasks(uid, taskSnapshots) {
  if (!taskSnapshots || taskSnapshots.length === 0) return;
  const chunkSize = 450;
  for (let i = 0; i < taskSnapshots.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const snap of taskSnapshots.slice(i, i + chunkSize)) {
      const taskRef = doc(db, "users", uid, "tasks", snap.id);
      const isSubtask = Boolean(snap.parentId);
      const payload = {
        title: snap.title || "",
        notes: typeof snap.notes === "string" ? snap.notes : "",
        category: snap.category || "Studie",
        size: snap.size || "M",
        workDate: snap.workDate || null,
        timeBlock: snap.timeBlock || null,
        order: typeof snap.order === "number" ? snap.order : 0,
        durationOverride:
          typeof snap.durationOverride === "number"
            ? snap.durationOverride
            : null,
        deadline: snap.deadline || null,
        parentId: snap.parentId || null,
        calendarPrefix: isSubtask
          ? typeof snap.calendarPrefix === "string"
            ? snap.calendarPrefix
            : null
          : null,
        completed: Boolean(snap.completed),
        completedAt: snap.completed ? snap.completedAt || serverTimestamp() : null,
        shiftCount: typeof snap.shiftCount === "number" ? snap.shiftCount : 0,
        calendarWorkEventId: null,
        calendarDeadlineEventId: null,
        createdAt: snap.createdAt || serverTimestamp(),
      };
      batch.set(taskRef, payload);
    }
    await batch.commit();
  }
}
