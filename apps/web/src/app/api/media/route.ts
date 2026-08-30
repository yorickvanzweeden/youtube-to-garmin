import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { firestore } from "../../../lib/firestore";
import { mediaCreateSchema } from "../../../lib/media";

export async function GET() {
  const session = await auth();
  if (!session?.user?.googleSub)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await firestore()
    .collection("media")
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
  const batch = db.batch();
  batch.set(db.collection("media").doc(mediaId), {
    source: { type: "youtube", url: parsed.data.url },
    profile: parsed.data.profile,
    status: "queued",
    syncToGarmin: true,
    activeJobId: jobId,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(db.collection("jobs").doc(jobId), {
    mediaId,
    state: "queued",
    attempts: 0,
    createdAt: now,
  });
  await batch.commit();

  return NextResponse.json(
    { id: mediaId, jobId, status: "queued" },
    { status: 201 },
  );
}
