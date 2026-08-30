import { NextResponse } from "next/server";
import { firestore } from "../../../../../lib/firestore";
import { createPairing } from "../../../../../lib/pairing";

export async function POST() {
  const pairing = createPairing();
  await firestore().collection("pairings").doc(pairing.id).set({
    code: pairing.code,
    secretHash: pairing.secretHash,
    status: "pending",
    expiresAt: pairing.expiresAt,
    createdAt: new Date(),
  });
  return NextResponse.json(
    {
      pairingId: pairing.id,
      secret: pairing.secret,
      code: pairing.code,
      expiresIn: 600,
    },
    { status: 201 },
  );
}
