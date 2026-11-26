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

function getTasksCollection(uid) {
  return collection(db, "users", uid, "tasks");
}

function normalizeTaskDoc(docSnap) {
  const data = docSnap.data() || {};
  const createdAtMs =
    typeof data.createdAt?.toMillis === "function"
      ? data.createdAt.toMillis()
      : typeof data.createdAt === "number"
        ? data.createdAt
        : 0;

  return {
    id: docSnap.id,
    title: data.title || "",
    category: data.category || "Studie",
    size: data.size || "M",
    workDate: data.workDate || null,
    timeBlock: data.timeBlock || null,
    order: typeof data.order === "number" ? data.order : 0,
    durationOverride:
      typeof data.durationOverride === "number" ? data.durationOverride : null,
    deadline: data.deadline || null,
    parentId: data.parentId || null,
    completed: Boolean(data.completed),
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
  const payload = {
    title: data.title.trim(),
    category: data.category,
    size: data.size,
    workDate: data.workDate || null,
    timeBlock: data.timeBlock || null,
    order: typeof data.order === "number" ? data.order : 0,
    durationOverride:
      typeof data.durationOverride === "number" ? data.durationOverride : null,
    deadline: data.deadline || null,
    parentId: data.parentId || null,
    completed: false,
    shiftCount: 0,
    calendarWorkEventId: null,
    calendarDeadlineEventId: null,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(getTasksCollection(uid), payload);

  return {
    ...payload,
    id: docRef.id,
    createdAtMs: Date.now(),
  };
}

export async function updateTaskDoc(uid, taskId, updates) {
  const taskRef = doc(db, "users", uid, "tasks", taskId);
  await updateDoc(taskRef, updates);
}

export async function batchUpdateTasks(uid, entries) {
  if (!entries || entries.length === 0) return;
  const batch = writeBatch(db);
  for (const entry of entries) {
    const taskRef = doc(db, "users", uid, "tasks", entry.id);
    batch.update(taskRef, entry.updates);
  }
  await batch.commit();
}

export async function batchDeleteTasks(uid, taskIds) {
  if (!taskIds || taskIds.length === 0) return;
  const batch = writeBatch(db);
  for (const id of taskIds) {
    const taskRef = doc(db, "users", uid, "tasks", id);
    batch.delete(taskRef);
  }
  await batch.commit();
}
