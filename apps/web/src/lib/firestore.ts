import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { configureVercelGoogleAuth } from "./vercel-google-auth";

export function firestore() {
  configureVercelGoogleAuth();
  const app =
    getApps()[0] ??
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.GCP_PROJECT_ID,
    });
  return getFirestore(app);
}
