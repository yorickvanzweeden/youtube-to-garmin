import { Storage } from "@google-cloud/storage";
import { firestore } from "./firestore";
import { digest } from "./pairing";
import { configureVercelGoogleAuth } from "./vercel-google-auth";

export async function deviceForRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token) return null;
  const snapshot = await firestore()
    .collection("devices")
    .where("tokenHash", "==", digest(token))
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0];
}

export async function signedMediaUrl(object: string) {
  configureVercelGoogleAuth();
  const bucketName = process.env.GCS_MEDIA_BUCKET;
  if (!bucketName)
    throw new Error("GCS_MEDIA_BUCKET is required to serve media");
  const storage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
  const [url] = await storage
    .bucket(bucketName)
    .file(object)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
  return url;
}
