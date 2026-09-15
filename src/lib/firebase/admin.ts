import {
  cert,
  getApps,
  initializeApp,
  type ServiceAccount
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function pushConfigured() {
  return Boolean(
    process.env.FIREBASE_ADMIN_CREDENTIALS &&
      process.env.WEB_PUSH_PUBLIC_KEY &&
      process.env.WEB_PUSH_PRIVATE_KEY
  );
}

export function adminServices() {
  const app =
    getApps().find((item) => item.name === "push-server") ??
    initializeApp(
      {
        credential: cert(
          JSON.parse(
            process.env.FIREBASE_ADMIN_CREDENTIALS ?? "{}"
          ) as ServiceAccount
        )
      },
      "push-server"
    );
  return { db: getFirestore(app), auth: getAuth(app) };
}
