import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { firestore } from "../../../lib/firestore";

export async function GET() {
  const session = await auth();
  if (!session?.user?.googleSub)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const snapshot = await firestore()
    .collection("devices")
    .orderBy("createdAt", "desc")
    .get();
  return NextResponse.json({
    data: snapshot.docs.map((document) => {
      const device = document.data();
      return {
        id: document.id,
        name: device.name,
        createdAt: device.createdAt,
        lastSeenAt: device.lastSeenAt,
        lastSyncRevision: device.lastSyncRevision ?? 0,
      };
    }),
  });
}
