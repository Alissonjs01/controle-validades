import { getPublicEnv } from "@/lib/env";

export type FirebasePublicConfig = Readonly<{
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}>;

export function getFirebasePublicConfig(): FirebasePublicConfig | null {
  const {
    firebaseApiKey,
    firebaseAppId,
    firebaseAuthDomain,
    firebaseMessagingSenderId,
    firebaseProjectId,
    firebaseStorageBucket
  } = getPublicEnv();

  if (
    !firebaseApiKey ||
    !firebaseAuthDomain ||
    !firebaseProjectId ||
    !firebaseStorageBucket ||
    !firebaseMessagingSenderId ||
    !firebaseAppId
  ) {
    return null;
  }

  return {
    apiKey: firebaseApiKey,
    authDomain: firebaseAuthDomain,
    projectId: firebaseProjectId,
    storageBucket: firebaseStorageBucket,
    messagingSenderId: firebaseMessagingSenderId,
    appId: firebaseAppId
  };
}

export function isFirebaseConfigured() {
  return getFirebasePublicConfig() !== null;
}
