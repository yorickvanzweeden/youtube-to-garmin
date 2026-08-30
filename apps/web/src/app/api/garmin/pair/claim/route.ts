import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { firestore } from "../../../../../lib/firestore";
import { createDeviceToken } from "../../../../../lib/pairing";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.googleSub)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    code?: unknown;
  } | null;
  if (typeof body?.code !== "string" || !/^\d{6}$/.test(body.code)) {
    return NextResponse.json(
      { error: "A six-digit pairing code is required" },
      { status: 400 },
    );
  }

  const db = firestore();
  const snapshot = await db
    .collection("pairings")
    .where("code", "==", body.code)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (snapshot.empty)
    return NextResponse.json(
      { error: "Pairing code not found" },
      { status: 404 },
    );
  const pairing = snapshot.docs[0];
  const data = pairing.data();
  if (data.expiresAt.toDate() < new Date())
    return NextResponse.json(
      { error: "Pairing code expired" },
      { status: 410 },
    );

  const device = createDeviceToken();
  const batch = db.batch();
  batch.update(pairing.ref, {
    status: "approved",
    deviceToken: device.token,
    approvedAt: new Date(),
    approvedBy: session.user.googleSub,
  });
  batch.set(db.collection("devices").doc(pairing.id), {
    tokenHash: device.tokenHash,
    name: "Garmin device",
    createdAt: new Date(),
    lastSeenAt: null,
  });
  await batch.commit();
  return NextResponse.json({ deviceId: pairing.id, status: "approved" });
}
