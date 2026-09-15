type PublicEnv = Readonly<{
  firebaseApiKey: string | undefined;
  firebaseAuthDomain: string | undefined;
  firebaseProjectId: string | undefined;
  firebaseStorageBucket: string | undefined;
  firebaseMessagingSenderId: string | undefined;
  firebaseAppId: string | undefined;
}>;

export function getPublicEnv(): PublicEnv {
  return {
    firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };
}
