import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "../../../../auth";
import { firestore } from "../../../../lib/firestore";

const updateSchema = z
  .object({
    syncToGarmin: z.boolean().optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.googleSub)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid update", issues: parsed.error.issues },
      { status: 400 },
    );

  const db = firestore();
  const revision = await db.runTransaction(async (transaction) => {
    const mediaReference = db.collection("media").doc(id);
    const mediaSnapshot = await transaction.get(mediaReference);
    if (
      !mediaSnapshot.exists ||
      mediaSnapshot.data()?.ownerGoogleSub !== session.user.googleSub
    )
      return null;
    const libraryReference = db.collection("system").doc("library");
    const librarySnapshot = await transaction.get(libraryReference);
    const nextRevision = Number(librarySnapshot.data()?.revision ?? 0) + 1;
    transaction.set(
      libraryReference,
      { revision: nextRevision, updatedAt: new Date() },
      { merge: true },
    );
    transaction.update(mediaReference, {
      ...parsed.data,
      revision: nextRevision,
      updatedAt: new Date(),
    });
    return nextRevision;
  });
  if (revision === null)
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  return NextResponse.json({ id, revision });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.googleSub)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const db = firestore();
  const revision = await db.runTransaction(async (transaction) => {
    const mediaReference = db.collection("media").doc(id);
    const mediaSnapshot = await transaction.get(mediaReference);
    if (
      !mediaSnapshot.exists ||
      mediaSnapshot.data()?.ownerGoogleSub !== session.user.googleSub
    )
      return null;
    const libraryReference = db.collection("system").doc("library");
    const librarySnapshot = await transaction.get(libraryReference);
    const nextRevision = Number(librarySnapshot.data()?.revision ?? 0) + 1;
    transaction.set(
      libraryReference,
      { revision: nextRevision, updatedAt: new Date() },
      { merge: true },
    );
    transaction.update(mediaReference, {
      status: "deleted",
      syncToGarmin: false,
      revision: nextRevision,
      updatedAt: new Date(),
    });
    return nextRevision;
  });
  if (revision === null)
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
