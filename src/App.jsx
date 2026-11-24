import { useCallback, useEffect, useState } from "react";
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
  reconnectGoogleTasks,
} from "./firebase";
import {
  AuthExpiredError,
  completeGoogleTask,
  fetchOpenTasks,
} from "./services/googleTasks";
import { LoginScreen } from "./components/LoginScreen";
import { Header } from "./components/Header";
import { TaskList } from "./components/TaskList";

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [accessToken, setAccessToken] = useState(() => getStoredAccessToken());

  const [taskLists, setTaskLists] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [completingIds, setCompletingIds] = useState(() => new Set());
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const loadTasks = useCallback(async (token) => {
    if (!token) {
      setNeedsReconnect(true);
      setTaskLists([]);
      setTasks([]);
      return;
    }

    setIsLoadingTasks(true);
    setTasksError("");
    setNeedsReconnect(false);

    try {
      const { lists, tasks: openTasks } = await fetchOpenTasks(token);
      setTaskLists(lists);
      setTasks(openTasks);
    } catch (err) {
      if (err instanceof AuthExpiredError || err?.status === 401) {
        setNeedsReconnect(true);
        setTaskLists([]);
        setTasks([]);
      } else {
        setTasksError(err?.message || "Kon taken niet ophalen.");
      }
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribeProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setTaskLists([]);
        setTasks([]);
        setNeedsReconnect(false);
        setAuthReady(true);
        return;
      }

      setUser(firebaseUser);
      setAuthReady(true);

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

      const storedToken = getStoredAccessToken();
      setAccessToken(storedToken);
      if (storedToken) {
        loadTasks(storedToken);
      } else {
        setNeedsReconnect(true);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [loadTasks]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError("");
    try {
      const { accessToken: freshToken, profile: freshProfile } = await loginWithGoogle();
      if (freshProfile) {
        setProfile(freshProfile);
      }
      setAccessToken(freshToken);
      if (freshToken) {
        await loadTasks(freshToken);
      } else {
        setNeedsReconnect(true);
      }
    } catch (err) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setLoginError(err?.message || "Inloggen mislukt. Probeer het opnieuw.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleReconnect = async () => {
    setTasksError("");
    try {
      const freshToken = await reconnectGoogleTasks();
      setAccessToken(freshToken);
      if (freshToken) {
        await loadTasks(freshToken);
      } else {
        setNeedsReconnect(true);
      }
    } catch (err) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setTasksError(err?.message || "Opnieuw verbinden met Google Tasks mislukt.");
      }
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setAccessToken(null);
    setTaskLists([]);
    setTasks([]);
    setNeedsReconnect(false);
    setTasksError("");
  };

  const handleCompleteTask = async (listId, taskId) => {
    if (!accessToken) {
      setNeedsReconnect(true);
      return;
    }

    setCompletingIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    setTasksError("");

    try {
      await completeGoogleTask(accessToken, listId, taskId);
      setTasks((prev) => prev.filter((t) => !(t.id === taskId && t.listId === listId)));
    } catch (err) {
      if (err instanceof AuthExpiredError || err?.status === 401) {
        setNeedsReconnect(true);
      } else {
        setTasksError(err?.message || "Kon de taak niet afvinken.");
      }
    } finally {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
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

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <TaskList
          taskLists={taskLists}
          tasks={tasks}
          isLoading={isLoadingTasks}
          completingIds={completingIds}
          error={tasksError}
          needsReconnect={needsReconnect}
          onRefresh={() => loadTasks(accessToken)}
          onCompleteTask={handleCompleteTask}
          onReconnect={handleReconnect}
        />
      </main>
    </div>
  );
}
