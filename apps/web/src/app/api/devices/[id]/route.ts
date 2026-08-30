import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { firestore } from "../../../../lib/firestore";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.googleSub)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const reference = firestore().collection("devices").doc(id);
  const snapshot = await reference.get();
  if (
    !snapshot.exists ||
    snapshot.data()?.ownerGoogleSub !== session.user.googleSub
  )
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  await reference.delete();
  return new NextResponse(null, { status: 204 });
}
