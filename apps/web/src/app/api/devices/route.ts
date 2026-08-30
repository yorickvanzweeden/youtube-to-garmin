import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { firestore } from "../../../lib/firestore";

export async function GET() {
  const session = await auth();
  if (!session?.user?.googleSub)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const snapshot = await firestore()
    .collection("devices")
    .where("ownerGoogleSub", "==", session.user.googleSub)
    .get();
  return NextResponse.json({
    data: snapshot.docs
      .sort((a, b) => {
        const left = a.data().createdAt?.toMillis?.() ?? 0;
        const right = b.data().createdAt?.toMillis?.() ?? 0;
        return right - left;
      })
      .map((document) => {
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
