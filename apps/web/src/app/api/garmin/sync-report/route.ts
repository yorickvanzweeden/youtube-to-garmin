import { NextResponse } from "next/server";
import { z } from "zod";
import { deviceForRequest } from "../../../../lib/garmin-feed";

const syncReportSchema = z.object({ revision: z.number().int().nonnegative() });

export async function POST(request: Request) {
  const device = await deviceForRequest(request);
  if (!device)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = syncReportSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "revision must be a non-negative integer" },
      { status: 400 },
    );
  await device.ref.update({
    lastSyncRevision: parsed.data.revision,
    lastSeenAt: new Date(),
  });
  return NextResponse.json({ ok: true, revision: parsed.data.revision });
}
