import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { firestore } from "../../../lib/firestore";
import { mediaCreateSchema } from "../../../lib/media";
import { enqueueJob } from "../../../lib/task-launch";

export async function GET() {
  const session = await auth();
  if (!session?.user?.googleSub)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await firestore()
    .collection("media")
    .where("ownerGoogleSub", "==", session.user.googleSub)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return NextResponse.json({
    data: snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.googleSub)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = mediaCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );

  const db = firestore();
  const mediaId = randomUUID();
  const jobId = randomUUID();
  const now = new Date();
  const revision = await db.runTransaction(async (transaction) => {
    const libraryReference = db.collection("system").doc("library");
    const librarySnapshot = await transaction.get(libraryReference);
    const currentRevision = librarySnapshot.exists
      ? Number(librarySnapshot.data()?.revision ?? 0)
      : 0;
    const nextRevision = currentRevision + 1;
    transaction.set(
      libraryReference,
      { revision: nextRevision, updatedAt: now },
      { merge: true },
    );
    transaction.set(db.collection("media").doc(mediaId), {
      source: { type: "youtube", url: parsed.data.url },
      profile: parsed.data.profile,
      status: "queued",
      syncToGarmin: true,
      ownerGoogleSub: session.user.googleSub,
      revision: nextRevision,
      activeJobId: jobId,
      createdAt: now,
      updatedAt: now,
    });
    transaction.set(db.collection("jobs").doc(jobId), {
      mediaId,
      state: "queued",
      attempts: 0,
      createdAt: now,
    });
    return nextRevision;
  });
  await enqueueJob(jobId);

  return NextResponse.json(
    { id: mediaId, jobId, revision, status: "queued" },
    { status: 201 },
  );
}
