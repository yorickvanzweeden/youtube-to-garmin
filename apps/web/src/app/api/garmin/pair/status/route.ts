import { NextResponse } from "next/server";
import { firestore } from "../../../../../lib/firestore";
import { digest } from "../../../../../lib/pairing";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pairingId = url.searchParams.get("pairingId");
  const secret = url.searchParams.get("secret");
  if (!pairingId || !secret)
    return NextResponse.json(
      { error: "Missing pairing credentials" },
      { status: 400 },
    );

  const document = await firestore()
    .collection("pairings")
    .doc(pairingId)
    .get();
  const pairing = document.data();
  if (!document.exists || !pairing || pairing.secretHash !== digest(secret)) {
    return NextResponse.json(
      { error: "Invalid pairing credentials" },
      { status: 401 },
    );
  }
  if (pairing.expiresAt.toDate() < new Date())
    return NextResponse.json({ status: "expired" });
  if (pairing.status !== "approved")
    return NextResponse.json({ status: pairing.status });

  return NextResponse.json({
    status: "approved",
    deviceToken: pairing.deviceToken,
  });
}
