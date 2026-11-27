import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  createDefaultSettings,
  normalizeUserSettings,
} from "./services/userSettings.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgunv6aqSVe55X-nS_EGkut7ABUjNz_vw",
  authDomain: "ember-app-efdcf.firebaseapp.com",
  projectId: "ember-app-efdcf",
  storageBucket: "ember-app-efdcf.firebasestorage.app",
  messagingSenderId: "1049779631627",
  appId: "1:1049779631627:web:1a3b7ee0dbe281d5a1790e",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  db = getFirestore(app);
}

const googleProvider = new GoogleAuthProvider();

export async function ensureUserProfile(user) {
  if (!user) return null;
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const newProfile = {
      displayName: user.displayName || "Adventurer",
      email: user.email || "",
      level: 1,
      xp: 0,
      hp: 10,
      streak: 0,
      gold: 0,
      settings: createDefaultSettings(),
      createdAt: serverTimestamp(),
    };
    await setDoc(userRef, newProfile);
    const createdSnap = await getDoc(userRef);
    return createdSnap.exists() ? createdSnap.data() : newProfile;
  }

  const data = userSnap.data();
  const { settings, needsPersist } = normalizeUserSettings(data.settings, {
    prunePastBlocks: true,
  });

  if (needsPersist) {
    await setDoc(userRef, { settings }, { merge: true });
    return { ...data, settings };
  }

  return data;
}

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const profile = await ensureUserProfile(result.user);
  return { user: result.user, profile };
}

export async function logoutUser() {
  await signOut(auth);
}

export { app, auth, db, googleProvider };
