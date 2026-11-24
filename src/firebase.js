import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDgunv6aqSVe55X-nS_EGkut7ABUjNz_vw",
  authDomain: "ember-app-efdcf.firebaseapp.com",
  projectId: "ember-app-efdcf",
  storageBucket: "ember-app-efdcf.firebasestorage.app",
  messagingSenderId: "1049779631627",
  appId: "1:1049779631627:web:1a3b7ee0dbe281d5a1790e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/tasks");

export const OAUTH_TOKEN_KEY = "ember_google_access_token";

export function getStoredAccessToken() {
  return sessionStorage.getItem(OAUTH_TOKEN_KEY);
}

export function setStoredAccessToken(token) {
  if (token) {
    sessionStorage.setItem(OAUTH_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(OAUTH_TOKEN_KEY);
  }
}

export async function ensureUserProfile(user) {
  if (!user) return null;
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const newProfile = {
      displayName: user.displayName || "Avonturier",
      email: user.email || "",
      level: 1,
      xp: 0,
      hp: 10,
      streak: 0,
      gold: 0,
      createdAt: serverTimestamp(),
    };
    await setDoc(userRef, newProfile);
    const createdSnap = await getDoc(userRef);
    return createdSnap.exists() ? createdSnap.data() : newProfile;
  }

  return userSnap.data();
}

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken || null;
  if (accessToken) {
    setStoredAccessToken(accessToken);
  }
  const profile = await ensureUserProfile(result.user);
  return { user: result.user, accessToken, profile };
}

export async function reconnectGoogleTasks() {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken || null;
  if (accessToken) {
    setStoredAccessToken(accessToken);
  }
  return accessToken;
}

export async function logoutUser() {
  setStoredAccessToken(null);
  await signOut(auth);
}

export { app, auth, db, googleProvider };
