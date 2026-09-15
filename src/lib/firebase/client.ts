import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore
} from "firebase/firestore";

import { getFirebasePublicConfig } from "@/lib/firebase/config";

let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let authPromise: Promise<void> | null = null;

export function getFirebaseApp() {
  const config = getFirebasePublicConfig();

  if (!config) {
    return null;
  }

  if (appInstance) {
    return appInstance;
  }

  const existingApp = getApps()[0];
  appInstance = existingApp ?? initializeApp(config);

  return appInstance;
}

export function getFirebaseDb() {
  const app = getFirebaseApp();

  if (!app) {
    return null;
  }

  if (firestoreInstance) {
    return firestoreInstance;
  }

  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch {
    firestoreInstance = getFirestore(app);
  }

  return firestoreInstance;
}

export function ensureFirebaseAnonymousAuth() {
  const app = getFirebaseApp();

  if (!app) {
    return Promise.resolve();
  }

  const auth = getAuth(app);

  if (auth.currentUser) {
    return Promise.resolve();
  }

  authPromise ??= signInAnonymously(auth).then(() => undefined);

  return authPromise;
}
