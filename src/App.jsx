import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import {
  auth,
  db,
  ensureUserProfile,
  getStoredAccessToken,
  loginWithGoogle,
  logoutUser,
  reconnectGoogleCalendar,
  setStoredAccessToken,
} from "./firebase";
import {
  batchDeleteTasks,
  batchUpdateTasks,
  createTaskDoc,
  subscribeToTasks,
  updateTaskDoc,
} from "./services/firestoreTasks";
import {
  CalendarAuthError,
  deleteTaskCalendarEvents,
  syncTaskCalendarEvents,
} from "./services/googleCalendar";
import {
  computeAllSchedules,
  computeAutoFit,
  computeBlockSchedule,
  getSlotKey,
  sortBlockTasks,
} from "./utils/schedule";
import { LoginScreen } from "./components/LoginScreen";
import { Header } from "./components/Header";
import { TaskList } from "./components/TaskList";
import { TaskModal } from "./components/TaskModal";
import { BlockFullModal } from "./components/BlockFullModal";
import { UndoToast } from "./components/UndoToast";

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [accessToken, setAccessToken] = useState(() => getStoredAccessToken());
  const accessTokenRef = useRef(accessToken);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  const [tasks, setTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [busyTaskIds, setBusyTaskIds] = useState(() => new Set());

  const [calendarNeedsReconnect, setCalendarNeedsReconnect] = useState(
    () => !getStoredAccessToken()
  );
  const [calendarError, setCalendarError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [taskModalState, setTaskModalState] = useState(null);
  const [isSavingModal, setIsSavingModal] = useState(false);

  const [pendingBlockAction, setPendingBlockAction] = useState(null);
  const [isApplyingBlockAction, setIsApplyingBlockAction] = useState(false);

  const [swapSourceId, setSwapSourceId] = useState(null);
  const [undoToast, setUndoToast] = useState(null);
  const undoTimerRef = useRef(null);

  const scheduleMap = useMemo(() => computeAllSchedules(tasks), [tasks]);

  const setTasksBusy = useCallback((ids, busy) => {
    setBusyTaskIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (busy) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearUndoTimer();
  }, [clearUndoTimer]);

  useEffect(() => {
    if (!swapSourceId) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !taskModalState && !pendingBlockAction) {
        setSwapSourceId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingBlockAction, swapSourceId, taskModalState]);

  useEffect(() => {
    let unsubscribeProfile = null;
    let unsubscribeTasks = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      if (unsubscribeTasks) {
        unsubscribeTasks();
        unsubscribeTasks = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setTasks([]);
        setIsLoadingTasks(false);
        setCalendarNeedsReconnect(false);
        setCalendarError("");
        setTasksError("");
        setSwapSourceId(null);
        setTaskModalState(null);
        setPendingBlockAction(null);
        setAuthReady(true);
        return;
      }

      setUser(firebaseUser);
      setAuthReady(true);
      setIsLoadingTasks(true);
      setTasksError("");

      const storedToken = getStoredAccessToken();
      setAccessToken(storedToken);
      setCalendarNeedsReconnect(!storedToken);

      try {
        const initialProfile = await ensureUserProfile(firebaseUser);
        setProfile(initialProfile);
      } catch (err) {
        console.error("Kon gebruikersprofiel niet laden of aanmaken:", err);
      }

      unsubscribeProfile = onSnapshot(
        doc(db, "users", firebaseUser.uid),
        (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data());
          }
        },
        (err) => {
          console.error("Firestore profiel-listener fout:", err);
        }
      );

      unsubscribeTasks = subscribeToTasks(
        firebaseUser.uid,
        (nextTasks) => {
          setTasks(nextTasks);
          setIsLoadingTasks(false);
        },
        (err) => {
          setTasksError(err?.message || "Kon taken niet laden uit Firestore.");
          setIsLoadingTasks(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeTasks) unsubscribeTasks();
    };
  }, []);

  const syncCalendarForTargets = useCallback(
    async (
      uid,
      nextTasksList,
      targetTaskIds = [],
      affectedSlotKeys = [],
      tokenOverride
    ) => {
      const token =
        tokenOverride !== undefined ? tokenOverride : accessTokenRef.current;

      if (!token) {
        setCalendarNeedsReconnect(true);
        return;
      }

      const targetIdSet = new Set(targetTaskIds.filter(Boolean));
      const slotKeySet = new Set(affectedSlotKeys.filter(Boolean));

      const tasksToSync = nextTasksList.filter((task) => {
        if (targetIdSet.has(task.id)) return true;
        const slotKey = getSlotKey(task.workDate, task.timeBlock);
        return Boolean(slotKey && slotKeySet.has(slotKey));
      });

      if (tasksToSync.length === 0) return;

      const nextScheduleMap = computeAllSchedules(nextTasksList);
      const idUpdates = [];

      try {
        for (const task of tasksToSync) {
          const slot = nextScheduleMap.get(task.id) || null;
          const result = await syncTaskCalendarEvents(token, task, slot);
          if (result.changed) {
            idUpdates.push({
              id: task.id,
              updates: {
                calendarWorkEventId: result.calendarWorkEventId,
                calendarDeadlineEventId: result.calendarDeadlineEventId,
              },
            });
          }
        }

        if (idUpdates.length > 0) {
          await batchUpdateTasks(uid, idUpdates);
        }
        setCalendarNeedsReconnect(false);
        setCalendarError("");
      } catch (err) {
        if (err instanceof CalendarAuthError || err?.status === 401 || err?.status === 403) {
          setStoredAccessToken(null);
          setAccessToken(null);
          setCalendarNeedsReconnect(true);
          setCalendarError("");
        } else {
          setCalendarError(
            err?.message || "Google Agenda synchronisatie is gedeeltelijk mislukt."
          );
        }
      }
    },
    []
  );

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError("");
    try {
      const { accessToken: freshToken, profile: freshProfile } =
        await loginWithGoogle();
      if (freshProfile) {
        setProfile(freshProfile);
      }
      setAccessToken(freshToken);
      setCalendarNeedsReconnect(!freshToken);
    } catch (err) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setLoginError(err?.message || "Inloggen mislukt. Probeer het opnieuw.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleReconnectCalendar = async () => {
    setCalendarError("");
    try {
      const freshToken = await reconnectGoogleCalendar();
      setAccessToken(freshToken);
      setCalendarNeedsReconnect(!freshToken);

      if (freshToken && user) {
        const syncIds = tasks
          .filter(
            (t) =>
              (t.workDate && t.timeBlock) ||
              t.deadline ||
              t.calendarWorkEventId ||
              t.calendarDeadlineEventId
          )
          .map((t) => t.id);

        await syncCalendarForTargets(user.uid, tasks, syncIds, [], freshToken);
      }
    } catch (err) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setCalendarError(
          err?.message || "Opnieuw verbinden met Google Agenda mislukt."
        );
      }
    }
  };

  const handleLogout = async () => {
    clearUndoTimer();
    setUndoToast(null);
    await logoutUser();
    setAccessToken(null);
    setTasks([]);
    setCalendarNeedsReconnect(false);
    setCalendarError("");
    setTasksError("");
    setSwapSourceId(null);
    setTaskModalState(null);
    setPendingBlockAction(null);
  };

  const commitSaveTask = async ({
    editingTask,
    formData,
    order,
    oldSlotKey,
    newSlotKey,
    extraAdjustments = [],
  }) => {
    if (!user) return;

    const adjMap = new Map(
      extraAdjustments.map((adj) => [adj.taskId, adj.durationOverride])
    );

    const taskKey = editingTask ? editingTask.id : "__new__";
    const resolvedDurationOverride = adjMap.has(taskKey)
      ? adjMap.get(taskKey)
      : formData.durationOverride;

    let savedTask;
    if (editingTask) {
      const updates = {
        title: formData.title,
        category: formData.category,
        size: formData.size,
        workDate: formData.workDate,
        timeBlock: formData.timeBlock,
        order,
        durationOverride: resolvedDurationOverride,
        deadline: formData.deadline,
      };
      await updateTaskDoc(user.uid, editingTask.id, updates);
      savedTask = { ...editingTask, ...updates };
    } else {
      savedTask = await createTaskDoc(user.uid, {
        ...formData,
        order,
        durationOverride: resolvedDurationOverride,
      });
    }

    const otherAdjustmentUpdates = extraAdjustments
      .filter((adj) => adj.taskId !== "__new__" && adj.taskId !== editingTask?.id)
      .map((adj) => ({
        id: adj.taskId,
        updates: { durationOverride: adj.durationOverride },
      }));

    if (otherAdjustmentUpdates.length > 0) {
      await batchUpdateTasks(user.uid, otherAdjustmentUpdates);
    }

    const nextTasksList = editingTask
      ? tasks.map((t) => {
          if (t.id === savedTask.id) return savedTask;
          if (adjMap.has(t.id)) {
            return { ...t, durationOverride: adjMap.get(t.id) };
          }
          return t;
        })
      : [
          ...tasks.map((t) =>
            adjMap.has(t.id)
              ? { ...t, durationOverride: adjMap.get(t.id) }
              : t
          ),
          savedTask,
        ];

    const affectedIds = [
      savedTask.id,
      ...otherAdjustmentUpdates.map((entry) => entry.id),
    ];
    const affectedSlots = [oldSlotKey, newSlotKey].filter(Boolean);

    await syncCalendarForTargets(user.uid, nextTasksList, affectedIds, affectedSlots);
  };

  const handleSaveTaskFromModal = async (formData) => {
    if (!user) return;
    const editingTask = taskModalState?.editingTask || null;
    const oldSlotKey = editingTask
      ? getSlotKey(editingTask.workDate, editingTask.timeBlock)
      : null;
    const newSlotKey = getSlotKey(formData.workDate, formData.timeBlock);

    let order = 0;
    if (newSlotKey) {
      if (editingTask && newSlotKey === oldSlotKey) {
        order = editingTask.order ?? 0;
      } else {
        const existingInBlock = tasks.filter(
          (t) =>
            t.id !== editingTask?.id &&
            getSlotKey(t.workDate, t.timeBlock) === newSlotKey
        );
        order =
          existingInBlock.length === 0
            ? 0
            : Math.max(...existingInBlock.map((t) => t.order ?? 0)) + 1;
      }
    }

    if (newSlotKey) {
      const candidateTask = {
        ...(editingTask || {}),
        ...formData,
        id: editingTask?.id || "__new__",
        order,
        completed: editingTask?.completed ?? false,
        createdAtMs: editingTask?.createdAtMs ?? Date.now(),
      };

      const blockTasks = [
        ...tasks.filter(
          (t) =>
            t.id !== editingTask?.id &&
            getSlotKey(t.workDate, t.timeBlock) === newSlotKey
        ),
        candidateTask,
      ];

      const scheduleCheck = computeBlockSchedule(blockTasks, formData.timeBlock);
      if (!scheduleCheck.fits) {
        const autoFit = computeAutoFit(
          blockTasks,
          formData.timeBlock,
          candidateTask.id
        );
        setPendingBlockAction({
          type: "save",
          editingTask,
          formData,
          order,
          oldSlotKey,
          newSlotKey,
          overflowResults: [autoFit],
          canAutoFit: autoFit.possible,
        });
        return;
      }
    }

    setIsSavingModal(true);
    setTasksError("");
    try {
      await commitSaveTask({
        editingTask,
        formData,
        order,
        oldSlotKey,
        newSlotKey,
      });
      setTaskModalState(null);
    } catch (err) {
      setTasksError(err?.message || "Kon taak niet opslaan.");
    } finally {
      setIsSavingModal(false);
    }
  };

  const handleExecuteSwap = async (targetTaskId) => {
    if (!user || !swapSourceId) return;
    const taskA = tasks.find((t) => t.id === swapSourceId);
    const taskB = tasks.find((t) => t.id === targetTaskId);

    if (!taskA || !taskB || taskA.id === taskB.id) {
      setSwapSourceId(null);
      return;
    }

    const slotA = getSlotKey(taskA.workDate, taskA.timeBlock);
    const slotB = getSlotKey(taskB.workDate, taskB.timeBlock);
    if (!slotA || !slotB) {
      setSwapSourceId(null);
      return;
    }

    const sameBlock = slotA === slotB;
    const blockATasks = sortBlockTasks(
      tasks.filter((t) => getSlotKey(t.workDate, t.timeBlock) === slotA)
    );
    const blockBTasks = sameBlock
      ? blockATasks
      : sortBlockTasks(
          tasks.filter((t) => getSlotKey(t.workDate, t.timeBlock) === slotB)
        );

    const normalizedOrderMap = new Map();
    blockATasks.forEach((t, idx) => normalizedOrderMap.set(t.id, idx));
    if (!sameBlock) {
      blockBTasks.forEach((t, idx) => normalizedOrderMap.set(t.id, idx));
    }

    const orderA = normalizedOrderMap.get(taskA.id) ?? 0;
    const orderB = normalizedOrderMap.get(taskB.id) ?? 0;

    const updatesMap = new Map();
    for (const t of blockATasks) {
      updatesMap.set(t.id, { order: normalizedOrderMap.get(t.id) });
    }
    if (!sameBlock) {
      for (const t of blockBTasks) {
        updatesMap.set(t.id, { order: normalizedOrderMap.get(t.id) });
      }
    }

    updatesMap.set(taskA.id, {
      workDate: taskB.workDate,
      timeBlock: taskB.timeBlock,
      order: orderB,
      ...(sameBlock ? {} : { durationOverride: null }),
    });

    updatesMap.set(taskB.id, {
      workDate: taskA.workDate,
      timeBlock: taskA.timeBlock,
      order: orderA,
      ...(sameBlock ? {} : { durationOverride: null }),
    });

    const simulatedTasks = tasks.map((t) => {
      const upd = updatesMap.get(t.id);
      return upd ? { ...t, ...upd } : t;
    });

    const overflowResults = [];
    if (!sameBlock) {
      const checkA = computeBlockSchedule(
        simulatedTasks.filter(
          (t) => getSlotKey(t.workDate, t.timeBlock) === slotA
        ),
        taskA.timeBlock
      );
      if (!checkA.fits) {
        overflowResults.push(
          computeAutoFit(
            simulatedTasks.filter(
              (t) => getSlotKey(t.workDate, t.timeBlock) === slotA
            ),
            taskA.timeBlock,
            taskB.id
          )
        );
      }

      const checkB = computeBlockSchedule(
        simulatedTasks.filter(
          (t) => getSlotKey(t.workDate, t.timeBlock) === slotB
        ),
        taskB.timeBlock
      );
      if (!checkB.fits) {
        overflowResults.push(
          computeAutoFit(
            simulatedTasks.filter(
              (t) => getSlotKey(t.workDate, t.timeBlock) === slotB
            ),
            taskB.timeBlock,
            taskA.id
          )
        );
      }
    }

    const swapEntries = Array.from(updatesMap.entries()).map(([id, updates]) => ({
      id,
      updates,
    }));
    const affectedSlotKeys = sameBlock ? [slotA] : [slotA, slotB];

    if (overflowResults.length > 0) {
      setPendingBlockAction({
        type: "swap",
        taskA,
        taskB,
        swapEntries,
        simulatedTasks,
        affectedSlotKeys,
        overflowResults,
        canAutoFit: overflowResults.every((res) => res.possible),
      });
      return;
    }

    setTasksBusy([taskA.id, taskB.id], true);
    setTasksError("");
    try {
      await batchUpdateTasks(user.uid, swapEntries);
      setSwapSourceId(null);
      await syncCalendarForTargets(
        user.uid,
        simulatedTasks,
        [taskA.id, taskB.id],
        affectedSlotKeys
      );
    } catch (err) {
      setTasksError(err?.message || "Kon taken niet omwisselen.");
    } finally {
      setTasksBusy([taskA.id, taskB.id], false);
    }
  };

  const handleConfirmAutoFit = async () => {
    if (!user || !pendingBlockAction) return;
    setIsApplyingBlockAction(true);
    setTasksError("");

    const allAdjustments = pendingBlockAction.overflowResults.flatMap(
      (res) => res.adjustments || []
    );

    try {
      if (pendingBlockAction.type === "save") {
        await commitSaveTask({
          editingTask: pendingBlockAction.editingTask,
          formData: pendingBlockAction.formData,
          order: pendingBlockAction.order,
          oldSlotKey: pendingBlockAction.oldSlotKey,
          newSlotKey: pendingBlockAction.newSlotKey,
          extraAdjustments: allAdjustments,
        });
        setPendingBlockAction(null);
        setTaskModalState(null);
      } else if (pendingBlockAction.type === "swap") {
        const entryMap = new Map(
          pendingBlockAction.swapEntries.map((entry) => [
            entry.id,
            { ...entry.updates },
          ])
        );

        for (const adj of allAdjustments) {
          const existing = entryMap.get(adj.taskId) || {};
          entryMap.set(adj.taskId, {
            ...existing,
            durationOverride: adj.durationOverride,
          });
        }

        const finalEntries = Array.from(entryMap.entries()).map(
          ([id, updates]) => ({ id, updates })
        );
        const adjMap = new Map(
          allAdjustments.map((adj) => [adj.taskId, adj.durationOverride])
        );

        const finalTasks = pendingBlockAction.simulatedTasks.map((t) =>
          adjMap.has(t.id) ? { ...t, durationOverride: adjMap.get(t.id) } : t
        );

        await batchUpdateTasks(user.uid, finalEntries);
        setPendingBlockAction(null);
        setSwapSourceId(null);

        await syncCalendarForTargets(
          user.uid,
          finalTasks,
          [pendingBlockAction.taskA.id, pendingBlockAction.taskB.id],
          pendingBlockAction.affectedSlotKeys
        );
      }
    } catch (err) {
      setTasksError(err?.message || "Kon Auto-fit niet toepassen.");
    } finally {
      setIsApplyingBlockAction(false);
    }
  };

  const handleToggleComplete = async (task) => {
    if (!user) return;

    if (!task.completed) {
      let autoCompletedParent = false;
      const affectedTasks = [task];

      if (task.parentId) {
        const parentTask = tasks.find((t) => t.id === task.parentId);
        const otherOpenSubtasks = tasks.filter(
          (t) => t.parentId === task.parentId && t.id !== task.id && !t.completed
        );
        if (parentTask && !parentTask.completed && otherOpenSubtasks.length === 0) {
          affectedTasks.push(parentTask);
          autoCompletedParent = true;
        }
      }

      const affectedIds = affectedTasks.map((t) => t.id);
      const affectedIdSet = new Set(affectedIds);
      const nextTasksList = tasks.map((t) =>
        affectedIdSet.has(t.id) ? { ...t, completed: true } : t
      );

      setTasksBusy(affectedIds, true);
      setTasksError("");

      try {
        await batchUpdateTasks(
          user.uid,
          affectedIds.map((id) => ({ id, updates: { completed: true } }))
        );

        clearUndoTimer();
        setUndoToast({
          message: autoCompletedParent
            ? "Taak en hoofdtaak afgevinkt"
            : "Taak afgevinkt",
          taskIds: affectedIds,
        });
        undoTimerRef.current = setTimeout(() => {
          setUndoToast(null);
          undoTimerRef.current = null;
        }, 6000);

        await syncCalendarForTargets(user.uid, nextTasksList, affectedIds, []);
      } catch (err) {
        setTasksError(err?.message || "Kon taak niet afvinken.");
      } finally {
        setTasksBusy(affectedIds, false);
      }
      return;
    }

    const nextTasksList = tasks.map((t) =>
      t.id === task.id ? { ...t, completed: false } : t
    );

    setTasksBusy([task.id], true);
    setTasksError("");

    try {
      await updateTaskDoc(user.uid, task.id, { completed: false });
      await syncCalendarForTargets(user.uid, nextTasksList, [task.id], []);
    } catch (err) {
      setTasksError(err?.message || "Kon taak niet heropenen.");
    } finally {
      setTasksBusy([task.id], false);
    }
  };

  const handleUndoComplete = async () => {
    if (!user || !undoToast) return;
    const idsToRestore = undoToast.taskIds;
    clearUndoTimer();
    setUndoToast(null);

    const idSet = new Set(idsToRestore);
    const nextTasksList = tasks.map((t) =>
      idSet.has(t.id) ? { ...t, completed: false } : t
    );

    setTasksBusy(idsToRestore, true);
    setTasksError("");

    try {
      await batchUpdateTasks(
        user.uid,
        idsToRestore.map((id) => ({ id, updates: { completed: false } }))
      );
      await syncCalendarForTargets(user.uid, nextTasksList, idsToRestore, []);
    } catch (err) {
      setTasksError(err?.message || "Kon afvinken niet ongedaan maken.");
    } finally {
      setTasksBusy(idsToRestore, false);
    }
  };

  const handleDeleteTask = async (task) => {
    if (!user || !task) return;

    const childSubtasks = tasks.filter((t) => t.parentId === task.id);
    const tasksToDelete = [task, ...childSubtasks];
    const deleteIds = tasksToDelete.map((t) => t.id);
    const deleteIdSet = new Set(deleteIds);

    const affectedSlotKeys = Array.from(
      new Set(
        tasksToDelete
          .map((t) => getSlotKey(t.workDate, t.timeBlock))
          .filter(Boolean)
      )
    );

    const remainingTasks = tasks.filter((t) => !deleteIdSet.has(t.id));

    setTasksBusy(deleteIds, true);
    setIsSavingModal(true);
    setTasksError("");

    try {
      await batchDeleteTasks(user.uid, deleteIds);

      if (deleteIdSet.has(swapSourceId)) {
        setSwapSourceId(null);
      }
      if (taskModalState?.editingTask?.id === task.id) {
        setTaskModalState(null);
      }

      const token = accessTokenRef.current;
      if (token) {
        try {
          for (const deletedTask of tasksToDelete) {
            await deleteTaskCalendarEvents(token, deletedTask);
          }
          if (affectedSlotKeys.length > 0) {
            await syncCalendarForTargets(
              user.uid,
              remainingTasks,
              [],
              affectedSlotKeys,
              token
            );
          }
        } catch (err) {
          if (
            err instanceof CalendarAuthError ||
            err?.status === 401 ||
            err?.status === 403
          ) {
            setStoredAccessToken(null);
            setAccessToken(null);
            setCalendarNeedsReconnect(true);
          } else {
            setCalendarError(
              err?.message || "Kon gekoppelde Google Agenda events niet verwijderen."
            );
          }
        }
      }
    } catch (err) {
      setTasksError(err?.message || "Kon taak niet verwijderen.");
    } finally {
      setTasksBusy(deleteIds, false);
      setIsSavingModal(false);
    }
  };

  if (!authReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#07090e] text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        isLoggingIn={isLoggingIn}
        error={loginError}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-[#07090e] text-slate-100">
      <Header user={user} profile={profile} onLogout={handleLogout} />

      <main className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:px-6 sm:py-8">
        <TaskList
          tasks={tasks}
          scheduleMap={scheduleMap}
          isLoading={isLoadingTasks}
          busyTaskIds={busyTaskIds}
          error={tasksError}
          calendarNeedsReconnect={calendarNeedsReconnect}
          calendarError={calendarError}
          onDismissCalendarError={() => setCalendarError("")}
          onReconnectCalendar={handleReconnectCalendar}
          swapSourceId={swapSourceId}
          onStartSwap={(id) => setSwapSourceId(id)}
          onExecuteSwap={handleExecuteSwap}
          onCancelSwap={() => setSwapSourceId(null)}
          onOpenCreate={() =>
            setTaskModalState({ editingTask: null, parentTask: null })
          }
          onOpenAddSubtask={(parentTask) =>
            setTaskModalState({ editingTask: null, parentTask })
          }
          onOpenEdit={(editingTask) =>
            setTaskModalState({ editingTask, parentTask: null })
          }
          onToggleComplete={handleToggleComplete}
          onDeleteTask={handleDeleteTask}
        />
      </main>

      {taskModalState && (
        <TaskModal
          key={
            taskModalState.editingTask?.id ||
            `new-${taskModalState.parentTask?.id || "root"}`
          }
          editingTask={taskModalState.editingTask}
          parentTask={taskModalState.parentTask}
          allTasks={tasks}
          isSaving={isSavingModal}
          onClose={() => setTaskModalState(null)}
          onSave={handleSaveTaskFromModal}
          onDelete={handleDeleteTask}
        />
      )}

      {pendingBlockAction && (
        <BlockFullModal
          overflowResults={pendingBlockAction.overflowResults}
          canAutoFit={pendingBlockAction.canAutoFit}
          mode={pendingBlockAction.type}
          isBusy={isApplyingBlockAction}
          onChooseOther={() => setPendingBlockAction(null)}
          onConfirmAutoFit={handleConfirmAutoFit}
        />
      )}

      <UndoToast
        toast={undoToast}
        onUndo={handleUndoComplete}
        onDismiss={() => {
          clearUndoTimer();
          setUndoToast(null);
        }}
      />
    </div>
  );
}
