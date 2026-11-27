import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import {
  auth,
  db,
  ensureUserProfile,
  loginWithGoogle,
  logoutUser,
} from "./firebase";
import {
  clearCalendarTokenCache,
  connectGoogleCalendar,
  consumeCalendarAuthCallback,
  disconnectGoogleCalendar,
  getCalendarAccessToken,
} from "./services/calendarAuth";
import {
  normalizeUserSettings,
  saveUserSettings,
} from "./services/userSettings";
import {
  batchDeleteTasks,
  batchRestoreTasks,
  batchUpdateTasks,
  createTaskDoc,
  serverTimestamp,
  subscribeToTasks,
  updateTaskDoc,
} from "./services/firestoreTasks";
import {
  CalendarAuthError,
  deleteTaskCalendarEvents,
  fetchCalendarList,
  fetchUpcomingBusyEvents,
  syncTaskCalendarEvents,
} from "./services/googleCalendar";
import { computeRadar } from "./utils/radarEngine";
import {
  computeAllSchedules,
  computeAutoFit,
  computeBlockSchedule,
  getExpiredTaskIdsForCleanup,
  getSlotKey,
  isTimestampTodayInBrussels,
  sortBlockTasks,
} from "./utils/schedule";
import { LoginScreen } from "./components/LoginScreen";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { TaskList } from "./components/TaskList";
import { TaskModal } from "./components/TaskModal";
import { BlockFullModal } from "./components/BlockFullModal";
import { SettingsModal } from "./components/SettingsModal";
import { StatusToast } from "./components/StatusToast";
import { UndoToast } from "./components/UndoToast";

function isTypingElement(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  return target.isContentEditable;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [busyTaskIds, setBusyTaskIds] = useState(() => new Set());

  const [activeView, setActiveView] = useState("active");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [collapsedParentIds, setCollapsedParentIds] = useState(() => new Set());

  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [scrollToTaskId, setScrollToTaskId] = useState(null);
  const highlightTimerRef = useRef(null);

  const [isCompletedPulsing, setIsCompletedPulsing] = useState(false);
  const pulseTimerRef = useRef(null);

  const [calendarConnected, setCalendarConnected] = useState(false);
  const [isCheckingCalendar, setIsCheckingCalendar] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarError, setCalendarError] = useState("");
  const [statusToast, setStatusToast] = useState(null);
  const didJustConnectRef = useRef(false);
  const callbackHandledRef = useRef(false);
  const persistedSettingsKeyRef = useRef(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [taskModalState, setTaskModalState] = useState(null);
  const [isSavingModal, setIsSavingModal] = useState(false);
  const savingRef = useRef(false);

  const [pendingBlockAction, setPendingBlockAction] = useState(null);
  const [isApplyingBlockAction, setIsApplyingBlockAction] = useState(false);

  const [swapSourceId, setSwapSourceId] = useState(null);
  const [undoToast, setUndoToast] = useState(null);
  const undoTimerRef = useRef(null);
  const cleanedUpUidRef = useRef(null);

  const activeTasks = useMemo(
    () => tasks.filter((t) => !t.completed),
    [tasks]
  );

  const unscheduledTasks = useMemo(
    () => tasks.filter((t) => !t.completed && (!t.workDate || !t.timeBlock)),
    [tasks]
  );

  const completedTodayTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.completed && isTimestampTodayInBrussels(t.completedAtMs)
      ),
    [tasks]
  );

  const { settings: userSettings, needsPersist: settingsNeedPersist } =
    useMemo(
      () => normalizeUserSettings(profile?.settings, { prunePastBlocks: true }),
      [profile?.settings]
    );

  // Radar engine output (ready for 1.5B dashboard & Shift Simulator)
  const radarData = useMemo(
    () =>
      computeRadar({
        events: calendarEvents,
        tasks,
        settings: userSettings,
      }),
    [calendarEvents, tasks, userSettings]
  );
  void radarData;

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

  const triggerCompletedPulse = useCallback(() => {
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current);
    }
    setIsCompletedPulsing(false);
    requestAnimationFrame(() => {
      setIsCompletedPulsing(true);
      pulseTimerRef.current = setTimeout(() => {
        setIsCompletedPulsing(false);
        pulseTimerRef.current = null;
      }, 950);
    });
  }, []);

  useEffect(() => {
    return () => {
      clearUndoTimer();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [clearUndoTimer]);

  // Smooth scroll and temporary Ember highlight after Jump-to-Task
  useEffect(() => {
    if (activeView !== "active" || !scrollToTaskId) return;

    const frameId = requestAnimationFrame(() => {
      const el = document.getElementById(`ember-task-card-${scrollToTaskId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setScrollToTaskId(null);

      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedTaskId(null);
        highlightTimerRef.current = null;
      }, 1500);
    });

    return () => cancelAnimationFrame(frameId);
  }, [activeView, scrollToTaskId]);

  useEffect(() => {
    if (callbackHandledRef.current) return;
    callbackHandledRef.current = true;
    const result = consumeCalendarAuthCallback();
    if (!result) return;
    setStatusToast({ type: result.type, message: result.message });
    if (result.type === "success") {
      didJustConnectRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!statusToast) return undefined;
    const timer = setTimeout(() => {
      setStatusToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [statusToast]);

  useEffect(() => {
    if (!user || !profile || !settingsNeedPersist) return;
    const persistKey = `${user.uid}:${JSON.stringify(userSettings)}`;
    if (persistedSettingsKeyRef.current === persistKey) return;
    persistedSettingsKeyRef.current = persistKey;
    saveUserSettings(user.uid, userSettings).catch((err) => {
      console.error("Failed to persist normalized settings:", err);
    });
  }, [profile, settingsNeedPersist, user, userSettings]);

  const runWithCalendarToken = useCallback(async (operation) => {
    const token = await getCalendarAccessToken(false);
    if (!token) {
      setCalendarConnected(false);
      return { skipped: true, value: null };
    }

    try {
      const value = await operation(token);
      setCalendarConnected(true);
      return { skipped: false, value };
    } catch (err) {
      if (
        err instanceof CalendarAuthError ||
        err?.status === 401 ||
        err?.status === 403
      ) {
        clearCalendarTokenCache();
        const freshToken = await getCalendarAccessToken(true);
        if (!freshToken) {
          setCalendarConnected(false);
          return { skipped: true, value: null };
        }
        try {
          const retryValue = await operation(freshToken);
          setCalendarConnected(true);
          return { skipped: false, value: retryValue };
        } catch (retryErr) {
          if (
            retryErr instanceof CalendarAuthError ||
            retryErr?.status === 401 ||
            retryErr?.status === 403
          ) {
            clearCalendarTokenCache();
            setCalendarConnected(false);
            return { skipped: true, value: null };
          }
          throw retryErr;
        }
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    let unsubscribeProfile = null;
    let unsubscribeTasks = null;
    let cancelled = false;

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
        cleanedUpUidRef.current = null;
        persistedSettingsKeyRef.current = null;
        clearCalendarTokenCache();
        setUser(null);
        setProfile(null);
        setTasks([]);
        setCalendarEvents([]);
        setCalendarConnected(false);
        setIsCheckingCalendar(false);
        setIsLoadingTasks(false);
        setCalendarError("");
        setTasksError("");
        setSwapSourceId(null);
        setTaskModalState(null);
        setPendingBlockAction(null);
        setIsSettingsOpen(false);
        setAuthReady(true);
        return;
      }

      setUser(firebaseUser);
      setAuthReady(true);
      setIsLoadingTasks(true);
      setTasksError("");

      setIsCheckingCalendar(true);
      const shouldForceRefresh = didJustConnectRef.current;
      didJustConnectRef.current = false;
      getCalendarAccessToken(shouldForceRefresh)
        .then((token) => {
          if (!cancelled) {
            setCalendarConnected(Boolean(token));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCalendarConnected(false);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsCheckingCalendar(false);
          }
        });

      try {
        const initialProfile = await ensureUserProfile(firebaseUser);
        if (!cancelled) {
          setProfile(initialProfile);
        }
      } catch (err) {
        console.error("Failed to load or create user profile:", err);
      }

      unsubscribeProfile = onSnapshot(
        doc(db, "users", firebaseUser.uid),
        (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data());
          }
        },
        (err) => {
          console.error("Firestore profile listener error:", err);
        }
      );

      unsubscribeTasks = subscribeToTasks(
        firebaseUser.uid,
        (nextTasks) => {
          setTasks(nextTasks);
          setIsLoadingTasks(false);

          if (cleanedUpUidRef.current !== firebaseUser.uid) {
            cleanedUpUidRef.current = firebaseUser.uid;
            const expiredIds = getExpiredTaskIdsForCleanup(nextTasks);
            if (expiredIds.length > 0) {
              batchDeleteTasks(firebaseUser.uid, expiredIds).catch(() => {});
            }
          }
        },
        (err) => {
          setTasksError(err?.message || "Failed to load tasks from Firestore.");
          setIsLoadingTasks(false);
        }
      );
    });

    return () => {
      cancelled = true;
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeTasks) unsubscribeTasks();
    };
  }, []);

  useEffect(() => {
    if (!user || !calendarConnected) {
      setCalendarEvents([]);
      return undefined;
    }

    let cancelled = false;
    runWithCalendarToken((token) =>
      fetchUpcomingBusyEvents(token, userSettings.calendarRules)
    )
      .then((res) => {
        if (cancelled) return;
        if (res.skipped) {
          setCalendarEvents([]);
        } else {
          setCalendarEvents(Array.isArray(res.value) ? res.value : []);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setCalendarError(
          err?.message || "Could not load upcoming Google Calendar events."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [calendarConnected, runWithCalendarToken, user, userSettings.calendarRules]);

  const syncCalendarForTargets = useCallback(
    async (uid, nextTasksList, targetTaskIds = []) => {
      const targetIdSet = new Set(targetTaskIds.filter(Boolean));
      const tasksToSync = nextTasksList.filter((task) => {
        if (!targetIdSet.has(task.id)) return false;
        return Boolean(
          (!task.completed && task.deadline) ||
            task.calendarDeadlineEventId ||
            task.calendarWorkEventId
        );
      });

      if (tasksToSync.length === 0) return;

      try {
        const res = await runWithCalendarToken(async (token) => {
          const idUpdates = [];
          for (const task of tasksToSync) {
            const result = await syncTaskCalendarEvents(token, task);
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
          return idUpdates;
        });

        if (res.skipped) return;

        if (res.value && res.value.length > 0) {
          await batchUpdateTasks(uid, res.value);
        }
        setCalendarError("");
      } catch (err) {
        setCalendarError(
          err?.message || "Google Calendar deadline sync failed."
        );
      }
    },
    [runWithCalendarToken]
  );

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError("");
    try {
      const { profile: freshProfile } = await loginWithGoogle();
      if (freshProfile) {
        setProfile(freshProfile);
      }
    } catch (err) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setLoginError(err?.message || "Sign in failed. Please try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleConnectCalendar = async () => {
    setCalendarError("");
    await connectGoogleCalendar();
  };

  const handleDisconnectCalendar = async () => {
    setCalendarError("");
    await disconnectGoogleCalendar();
    setCalendarConnected(false);
    setCalendarEvents([]);
    setStatusToast({
      type: "info",
      message: "Google Calendar disconnected.",
    });
  };

  const handleFetchCalendars = useCallback(async () => {
    const res = await runWithCalendarToken((token) => fetchCalendarList(token));
    if (res.skipped) {
      throw new Error("Google Calendar is not connected.");
    }
    return res.value || [];
  }, [runWithCalendarToken]);

  const handleSaveSettings = async (nextSettings, categoryRenames = {}) => {
    if (!user || isSavingSettings) return;
    setIsSavingSettings(true);
    setTasksError("");

    try {
      const saved = await saveUserSettings(user.uid, nextSettings);

      const renameEntries = Object.entries(categoryRenames).filter(
        ([oldName, newName]) => oldName && newName && oldName !== newName
      );
      if (renameEntries.length > 0) {
        const renameMap = new Map(renameEntries);
        const taskUpdates = tasks
          .filter((t) => renameMap.has(t.category))
          .map((t) => ({
            id: t.id,
            updates: { category: renameMap.get(t.category) },
          }));
        if (taskUpdates.length > 0) {
          await batchUpdateTasks(user.uid, taskUpdates);
        }

        if (selectedCategory !== "ALL" && renameMap.has(selectedCategory)) {
          setSelectedCategory(renameMap.get(selectedCategory));
        }
      }

      if (
        selectedCategory !== "ALL" &&
        !saved.categories.includes(selectedCategory) &&
        !categoryRenames[selectedCategory]
      ) {
        setSelectedCategory("ALL");
      }

      setIsSettingsOpen(false);
      setStatusToast({
        type: "success",
        message: "Settings saved.",
      });
    } catch (err) {
      setTasksError(err?.message || "Could not save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogout = async () => {
    clearUndoTimer();
    setUndoToast(null);
    cleanedUpUidRef.current = null;
    persistedSettingsKeyRef.current = null;
    clearCalendarTokenCache();
    await logoutUser();
    setCalendarConnected(false);
    setCalendarEvents([]);
    setTasks([]);
    setCalendarError("");
    setTasksError("");
    setSwapSourceId(null);
    setTaskModalState(null);
    setPendingBlockAction(null);
    setIsSettingsOpen(false);
  };

  const handleToggleSubtasksCollapse = useCallback((parentId) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

  const handleJumpToTask = useCallback(
    (task) => {
      if (!task) return;
      if (task.parentId) {
        setCollapsedParentIds((prev) => {
          if (!prev.has(task.parentId)) return prev;
          const next = new Set(prev);
          next.delete(task.parentId);
          return next;
        });
      }

      if (selectedCategory !== "ALL") {
        const parentTask = task.parentId
          ? tasks.find((t) => t.id === task.parentId)
          : null;
        const visibleUnderFilter =
          task.category === selectedCategory ||
          (parentTask && !parentTask.completed && parentTask.category === selectedCategory);
        if (!visibleUnderFilter) {
          setSelectedCategory("ALL");
        }
      }

      setActiveView("active");
      setHighlightedTaskId(task.id);
      setScrollToTaskId(task.id);
    },
    [selectedCategory, tasks]
  );

  const commitSaveTask = async ({
    editingTask,
    formData,
    order,
    oldSlotKey,
    newSlotKey,
    extraAdjustments = [],
    onFirestoreCommitted,
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
        notes: formData.notes,
        calendarPrefix: editingTask.parentId ? formData.calendarPrefix : null,
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

    if (onFirestoreCommitted) {
      onFirestoreCommitted();
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

    const childIdsToSync =
      editingTask && editingTask.title !== formData.title
        ? nextTasksList
            .filter((t) => t.parentId === savedTask.id && !t.completed)
            .map((t) => t.id)
        : [];

    const affectedIds = [
      savedTask.id,
      ...childIdsToSync,
      ...otherAdjustmentUpdates.map((entry) => entry.id),
    ];
    const affectedSlots = [oldSlotKey, newSlotKey].filter(Boolean);

    await syncCalendarForTargets(user.uid, nextTasksList, affectedIds, affectedSlots);
  };

  const handleSaveTaskFromModal = async (formData) => {
    if (!user || savingRef.current) return;
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
        const existingActiveInBlock = tasks.filter(
          (t) =>
            !t.completed &&
            t.id !== editingTask?.id &&
            getSlotKey(t.workDate, t.timeBlock) === newSlotKey
        );
        order =
          existingActiveInBlock.length === 0
            ? 0
            : Math.max(...existingActiveInBlock.map((t) => t.order ?? 0)) + 1;
      }
    }

    // Strict pre-save capacity check against active tasks only
    if (newSlotKey && !editingTask?.completed) {
      const candidateTask = {
        ...(editingTask || {}),
        ...formData,
        id: editingTask?.id || "__new__",
        order,
        completed: false,
        createdAtMs: editingTask?.createdAtMs ?? Date.now(),
      };

      const blockTasks = [
        ...tasks.filter(
          (t) =>
            !t.completed &&
            t.id !== editingTask?.id &&
            getSlotKey(t.workDate, t.timeBlock) === newSlotKey
        ),
        candidateTask,
      ];

      const scheduleCheck = computeBlockSchedule(blockTasks, formData.timeBlock);
      if (!scheduleCheck.fits) {
        const autoFit = computeAutoFit(blockTasks, formData.timeBlock);
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

    savingRef.current = true;
    setIsSavingModal(true);
    setTasksError("");
    try {
      await commitSaveTask({
        editingTask,
        formData,
        order,
        oldSlotKey,
        newSlotKey,
        onFirestoreCommitted: () => {
          setTaskModalState(null);
          setIsSavingModal(false);
          savingRef.current = false;
        },
      });
    } catch (err) {
      setTasksError(err?.message || "Could not save task.");
      setIsSavingModal(false);
      savingRef.current = false;
    }
  };

  const handleExecuteSwap = async (targetTaskId) => {
    if (!user || !swapSourceId) return;
    const taskA = tasks.find((t) => t.id === swapSourceId);
    const taskB = tasks.find((t) => t.id === targetTaskId);

    if (
      !taskA ||
      !taskB ||
      taskA.id === taskB.id ||
      taskA.completed ||
      taskB.completed
    ) {
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
      tasks.filter(
        (t) => !t.completed && getSlotKey(t.workDate, t.timeBlock) === slotA
      )
    );
    const blockBTasks = sameBlock
      ? blockATasks
      : sortBlockTasks(
          tasks.filter(
            (t) => !t.completed && getSlotKey(t.workDate, t.timeBlock) === slotB
          )
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
      const postBlockA = simulatedTasks.filter(
        (t) => !t.completed && getSlotKey(t.workDate, t.timeBlock) === slotA
      );
      const checkA = computeBlockSchedule(postBlockA, taskA.timeBlock);
      if (!checkA.fits) {
        overflowResults.push(computeAutoFit(postBlockA, taskA.timeBlock));
      }

      const postBlockB = simulatedTasks.filter(
        (t) => !t.completed && getSlotKey(t.workDate, t.timeBlock) === slotB
      );
      const checkB = computeBlockSchedule(postBlockB, taskB.timeBlock);
      if (!checkB.fits) {
        overflowResults.push(computeAutoFit(postBlockB, taskB.timeBlock));
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
      setTasksError(err?.message || "Could not swap tasks.");
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
          onFirestoreCommitted: () => {
            setPendingBlockAction(null);
            setTaskModalState(null);
          },
        });
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
      } else if (pendingBlockAction.type === "reopen") {
        const targetTask = pendingBlockAction.task;
        const adjMap = new Map(
          allAdjustments.map((adj) => [adj.taskId, adj.durationOverride])
        );

        const entries = allAdjustments.map((adj) => ({
          id: adj.taskId,
          updates:
            adj.taskId === targetTask.id
              ? {
                  completed: false,
                  completedAt: null,
                  durationOverride: adj.durationOverride,
                }
              : { durationOverride: adj.durationOverride },
        }));

        const finalTasks = tasks.map((t) => {
          if (t.id === targetTask.id) {
            return {
              ...t,
              completed: false,
              completedAt: null,
              completedAtMs: null,
              durationOverride: adjMap.has(t.id)
                ? adjMap.get(t.id)
                : t.durationOverride,
            };
          }
          if (adjMap.has(t.id)) {
            return { ...t, durationOverride: adjMap.get(t.id) };
          }
          return t;
        });

        await batchUpdateTasks(user.uid, entries);
        setPendingBlockAction(null);

        await syncCalendarForTargets(
          user.uid,
          finalTasks,
          [targetTask.id, ...allAdjustments.map((a) => a.taskId)],
          pendingBlockAction.slotKey ? [pendingBlockAction.slotKey] : []
        );
      }
    } catch (err) {
      setTasksError(err?.message || "Could not apply Auto-fit.");
    } finally {
      setIsApplyingBlockAction(false);
    }
  };

  const completeSingleTaskAndClearCalendar = useCallback(
    async (taskToComplete) => {
      if (!user || !taskToComplete) return;

      if (swapSourceId === taskToComplete.id) {
        setSwapSourceId(null);
      }

      await updateTaskDoc(user.uid, taskToComplete.id, {
        completed: true,
        completedAt: serverTimestamp(),
      });

      triggerCompletedPulse();

      const hadCalendarEvents = Boolean(
        taskToComplete.calendarWorkEventId ||
          taskToComplete.calendarDeadlineEventId
      );

      if (hadCalendarEvents) {
        try {
          const res = await runWithCalendarToken((token) =>
            deleteTaskCalendarEvents(token, taskToComplete)
          );
          if (!res.skipped) {
            await updateTaskDoc(user.uid, taskToComplete.id, {
              calendarWorkEventId: null,
              calendarDeadlineEventId: null,
            });
          }
        } catch (err) {
          setCalendarError(
            err?.message ||
              "Could not remove Google Calendar event for completed task."
          );
        }
      }
    },
    [runWithCalendarToken, swapSourceId, triggerCompletedPulse, user]
  );

  const handleToggleComplete = async (task) => {
    if (!user) return;

    if (!task.completed) {
      let promptParent = null;
      if (task.parentId) {
        const parentTask = tasks.find((t) => t.id === task.parentId);
        const otherOpenSubtasks = tasks.filter(
          (t) => t.parentId === task.parentId && t.id !== task.id && !t.completed
        );
        if (parentTask && !parentTask.completed && otherOpenSubtasks.length === 0) {
          promptParent = parentTask;
        }
      }

      setTasksBusy([task.id], true);
      setTasksError("");

      try {
        await completeSingleTaskAndClearCalendar(task);

        clearUndoTimer();
        if (promptParent) {
          setUndoToast({
            type: "parentPrompt",
            message: "All subtasks done. Complete parent task?",
            parentId: promptParent.id,
            taskIds: [task.id],
          });
          undoTimerRef.current = setTimeout(() => {
            setUndoToast(null);
            undoTimerRef.current = null;
          }, 8000);
        } else {
          setUndoToast({
            type: "complete",
            message: "Task completed",
            taskIds: [task.id],
          });
          undoTimerRef.current = setTimeout(() => {
            setUndoToast(null);
            undoTimerRef.current = null;
          }, 6000);
        }
      } catch (err) {
        setTasksError(err?.message || "Could not complete task.");
      } finally {
        setTasksBusy([task.id], false);
      }
      return;
    }

    // Reopen completed task
    const slotKey = getSlotKey(task.workDate, task.timeBlock);
    if (slotKey) {
      const reopenedCandidate = {
        ...task,
        completed: false,
        completedAt: null,
        completedAtMs: null,
      };
      const blockTasks = [
        ...tasks.filter(
          (t) =>
            !t.completed &&
            t.id !== task.id &&
            getSlotKey(t.workDate, t.timeBlock) === slotKey
        ),
        reopenedCandidate,
      ];
      const scheduleCheck = computeBlockSchedule(blockTasks, task.timeBlock);
      if (!scheduleCheck.fits) {
        const autoFit = computeAutoFit(blockTasks, task.timeBlock);
        setPendingBlockAction({
          type: "reopen",
          task,
          slotKey,
          overflowResults: [autoFit],
          canAutoFit: autoFit.possible,
        });
        return;
      }
    }

    const nextTasksList = tasks.map((t) =>
      t.id === task.id
        ? { ...t, completed: false, completedAt: null, completedAtMs: null }
        : t
    );

    setTasksBusy([task.id], true);
    setTasksError("");

    try {
      await updateTaskDoc(user.uid, task.id, {
        completed: false,
        completedAt: null,
      });
      await syncCalendarForTargets(
        user.uid,
        nextTasksList,
        [task.id],
        slotKey ? [slotKey] : []
      );
    } catch (err) {
      setTasksError(err?.message || "Could not reopen task.");
    } finally {
      setTasksBusy([task.id], false);
    }
  };

  const handleConfirmCompleteParent = useCallback(async () => {
    if (!user || !undoToast || undoToast.type !== "parentPrompt") return;
    const parentTask = tasks.find((t) => t.id === undoToast.parentId);
    clearUndoTimer();
    setUndoToast(null);

    if (!parentTask || parentTask.completed) return;

    setTasksBusy([parentTask.id], true);
    setTasksError("");

    try {
      await completeSingleTaskAndClearCalendar(parentTask);

      setUndoToast({
        type: "complete",
        message: "Parent task completed",
        taskIds: [parentTask.id],
      });
      undoTimerRef.current = setTimeout(() => {
        setUndoToast(null);
        undoTimerRef.current = null;
      }, 6000);
    } catch (err) {
      setTasksError(err?.message || "Could not complete parent task.");
    } finally {
      setTasksBusy([parentTask.id], false);
    }
  }, [
    clearUndoTimer,
    completeSingleTaskAndClearCalendar,
    setTasksBusy,
    tasks,
    undoToast,
    user,
  ]);

  const handleUndoToast = useCallback(async () => {
    if (!user || !undoToast) return;
    const currentToast = undoToast;
    clearUndoTimer();
    setUndoToast(null);

    if (currentToast.type === "delete") {
      const snapshots = currentToast.snapshotTasks || [];
      if (snapshots.length === 0) return;

      const restoredIds = snapshots.map((s) => s.id);
      const restoredWithoutEvents = snapshots.map((s) => ({
        ...s,
        calendarWorkEventId: null,
        calendarDeadlineEventId: null,
      }));
      const existingIds = new Set(tasks.map((t) => t.id));
      const mergedTasks = [
        ...tasks.filter((t) => !restoredIds.includes(t.id)),
        ...restoredWithoutEvents,
      ].filter((t) => existingIds.has(t.id) || restoredIds.includes(t.id));

      const activeRestored = restoredWithoutEvents.filter((t) => !t.completed);
      const affectedSlotKeys = Array.from(
        new Set(
          activeRestored
            .map((t) => getSlotKey(t.workDate, t.timeBlock))
            .filter(Boolean)
        )
      );

      setTasksBusy(restoredIds, true);
      setTasksError("");

      try {
        await batchRestoreTasks(user.uid, snapshots);
        await syncCalendarForTargets(
          user.uid,
          mergedTasks,
          activeRestored.map((t) => t.id),
          affectedSlotKeys
        );
      } catch (err) {
        setTasksError(err?.message || "Could not restore deleted task.");
      } finally {
        setTasksBusy(restoredIds, false);
      }
      return;
    }

    // Undo task completion
    const idsToRestore = currentToast.taskIds || [];
    if (idsToRestore.length === 0) return;

    const idSet = new Set(idsToRestore);
    const affectedSlotKeys = Array.from(
      new Set(
        tasks
          .filter((t) => idSet.has(t.id))
          .map((t) => getSlotKey(t.workDate, t.timeBlock))
          .filter(Boolean)
      )
    );

    const nextTasksList = tasks.map((t) =>
      idSet.has(t.id)
        ? {
            ...t,
            completed: false,
            completedAt: null,
            completedAtMs: null,
            calendarWorkEventId: null,
            calendarDeadlineEventId: null,
          }
        : t
    );

    setTasksBusy(idsToRestore, true);
    setTasksError("");

    try {
      await batchUpdateTasks(
        user.uid,
        idsToRestore.map((id) => ({
          id,
          updates: {
            completed: false,
            completedAt: null,
            calendarWorkEventId: null,
            calendarDeadlineEventId: null,
          },
        }))
      );
      await syncCalendarForTargets(
        user.uid,
        nextTasksList,
        idsToRestore,
        affectedSlotKeys
      );
    } catch (err) {
      setTasksError(err?.message || "Could not undo task completion.");
    } finally {
      setTasksBusy(idsToRestore, false);
    }
  }, [clearUndoTimer, setTasksBusy, syncCalendarForTargets, tasks, undoToast, user]);

  const handleDeleteTask = async (task) => {
    if (!user || !task) return;

    const childSubtasks = tasks.filter((t) => t.parentId === task.id);
    const tasksToDelete = [task, ...childSubtasks];
    const deleteIds = tasksToDelete.map((t) => t.id);
    const deleteIdSet = new Set(deleteIds);

    const affectedSlotKeys = Array.from(
      new Set(
        tasksToDelete
          .filter((t) => !t.completed)
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

      clearUndoTimer();
      setUndoToast({
        type: "delete",
        message:
          tasksToDelete.length > 1
            ? "Task & subtasks deleted"
            : "Task deleted",
        snapshotTasks: tasksToDelete,
      });
      undoTimerRef.current = setTimeout(() => {
        setUndoToast(null);
        undoTimerRef.current = null;
      }, 6000);

      const hadAnyCalendarEvents = tasksToDelete.some((deletedTask) =>
        Boolean(
          deletedTask.calendarWorkEventId ||
            deletedTask.calendarDeadlineEventId
        )
      );

      if (hadAnyCalendarEvents) {
        try {
          await runWithCalendarToken(async (token) => {
            for (const deletedTask of tasksToDelete) {
              await deleteTaskCalendarEvents(token, deletedTask);
            }
          });
        } catch (err) {
          setCalendarError(
            err?.message || "Could not delete linked Google Calendar events."
          );
        }
      }
    } catch (err) {
      setTasksError(err?.message || "Could not delete task.");
    } finally {
      setTasksBusy(deleteIds, false);
      setIsSavingModal(false);
    }
  };

  // Global keyboard shortcuts (PC): Ctrl/Cmd+Z, N, Escape
  useEffect(() => {
    if (!user) return;

    const handleGlobalKeyDown = (event) => {
      if (event.key === "Escape") {
        if (pendingBlockAction && !isApplyingBlockAction) {
          event.preventDefault();
          setPendingBlockAction(null);
        } else if (isSettingsOpen && !isSavingSettings) {
          event.preventDefault();
          setIsSettingsOpen(false);
        } else if (taskModalState && !isSavingModal) {
          event.preventDefault();
          setTaskModalState(null);
        } else if (swapSourceId) {
          event.preventDefault();
          setSwapSourceId(null);
        }
        return;
      }

      if (isTypingElement(event.target)) {
        return;
      }

      const keyLower = event.key.toLowerCase();

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        keyLower === "z"
      ) {
        if (undoToast) {
          event.preventDefault();
          handleUndoToast();
        }
        return;
      }

      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        keyLower === "n"
      ) {
        if (!taskModalState && !pendingBlockAction && !isSettingsOpen) {
          event.preventDefault();
          setTaskModalState({ editingTask: null, parentTask: null });
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    handleUndoToast,
    isApplyingBlockAction,
    isSavingModal,
    isSavingSettings,
    isSettingsOpen,
    pendingBlockAction,
    swapSourceId,
    taskModalState,
    undoToast,
    user,
  ]);

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
      <Header
        user={user}
        profile={profile}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
      />

      <div className="lg:flex lg:min-h-dvh">
        <Sidebar
          user={user}
          profile={profile}
          categories={userSettings.categories}
          activeView={activeView}
          onSelectView={(nextView) => {
            setActiveView(nextView);
            if (nextView !== "active") {
              setSwapSourceId(null);
            }
          }}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          activeTasks={activeTasks}
          unscheduledCount={unscheduledTasks.length}
          completedTodayCount={completedTodayTasks.length}
          isCompletedPulsing={isCompletedPulsing}
          onOpenCreate={() =>
            setTaskModalState({ editingTask: null, parentTask: null })
          }
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLogout={handleLogout}
        />

        <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-5xl">
            <TaskList
              allTasks={tasks}
              activeTasks={activeTasks}
              unscheduledTasks={unscheduledTasks}
              completedTodayTasks={completedTodayTasks}
              categories={userSettings.categories}
              activeView={activeView}
              onSelectView={(nextView) => {
                setActiveView(nextView);
                if (nextView !== "active") {
                  setSwapSourceId(null);
                }
              }}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              scheduleMap={scheduleMap}
              isLoading={isLoadingTasks}
              busyTaskIds={busyTaskIds}
              error={tasksError}
              calendarNeedsReconnect={!isCheckingCalendar && !calendarConnected}
              calendarError={calendarError}
              onDismissCalendarError={() => setCalendarError("")}
              onReconnectCalendar={handleConnectCalendar}
              swapSourceId={swapSourceId}
              onStartSwap={(id) => setSwapSourceId(id)}
              onExecuteSwap={handleExecuteSwap}
              onCancelSwap={() => setSwapSourceId(null)}
              collapsedParentIds={collapsedParentIds}
              onToggleSubtasksCollapse={handleToggleSubtasksCollapse}
              highlightedTaskId={highlightedTaskId}
              isCompletedPulsing={isCompletedPulsing}
              onJumpToTask={handleJumpToTask}
              onOpenCreate={() =>
                setTaskModalState({ editingTask: null, parentTask: null })
              }
              onOpenAddSubtask={(parentTask) =>
                setTaskModalState({ editingTask: null, parentTask })
              }
              onOpenEdit={(editingTask) =>
                setTaskModalState({
                  editingTask,
                  parentTask: editingTask.parentId
                    ? tasks.find((t) => t.id === editingTask.parentId) || null
                    : null,
                })
              }
              onToggleComplete={handleToggleComplete}
              onDeleteTask={handleDeleteTask}
            />
          </div>
        </main>
      </div>

      {taskModalState && (
        <TaskModal
          key={
            taskModalState.editingTask?.id ||
            `new-${taskModalState.parentTask?.id || "root"}`
          }
          editingTask={taskModalState.editingTask}
          parentTask={taskModalState.parentTask}
          allTasks={tasks}
          categories={userSettings.categories}
          isSaving={isSavingModal}
          onClose={() => {
            if (!isSavingModal) {
              setTaskModalState(null);
            }
          }}
          onSave={handleSaveTaskFromModal}
          onDelete={handleDeleteTask}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          settings={userSettings}
          calendarConnected={calendarConnected}
          isCheckingCalendar={isCheckingCalendar}
          onConnectCalendar={handleConnectCalendar}
          onDisconnectCalendar={handleDisconnectCalendar}
          onFetchCalendars={handleFetchCalendars}
          onSave={handleSaveSettings}
          onClose={() => {
            if (!isSavingSettings) {
              setIsSettingsOpen(false);
            }
          }}
          isSaving={isSavingSettings}
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
        onUndo={handleUndoToast}
        onConfirmParent={handleConfirmCompleteParent}
        onDismiss={() => {
          clearUndoTimer();
          setUndoToast(null);
        }}
      />

      {!undoToast && (
        <StatusToast
          toast={statusToast}
          onDismiss={() => setStatusToast(null)}
        />
      )}
    </div>
  );
}
