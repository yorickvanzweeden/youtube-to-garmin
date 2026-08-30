import { NextResponse } from "next/server";
import { firestore } from "../../../../lib/firestore";
import { deviceForRequest, signedMediaUrl } from "../../../../lib/garmin-feed";

export async function GET(request: Request) {
  const device = await deviceForRequest(request);
  if (!device)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sinceValue = new URL(request.url).searchParams.get("since") ?? "0";
  const since = Number.parseInt(sinceValue, 10);
  if (!Number.isSafeInteger(since) || since < 0) {
    return NextResponse.json(
      { error: "since must be a non-negative integer" },
      { status: 400 },
    );
  }

  const snapshot = await firestore()
    .collection("media")
    .where("status", "==", "ready")
    .where("syncToGarmin", "==", true)
    .limit(200)
    .get();
  const items = await Promise.all(
    snapshot.docs.map(async (document) => {
      const media = document.data();
      const revision = typeof media.revision === "number" ? media.revision : 0;
      if (revision <= since || !media.output?.object) return null;
      return {
        id: document.id,
        revision,
        title: media.title ?? "Untitled audio",
        artist: media.artist ?? "Garmin Audio",
        durationSeconds: media.durationSeconds ?? null,
        url: await signedMediaUrl(media.output.object),
      };
    }),
  );

  const data = items.filter(
    (item): item is NonNullable<typeof item> => item !== null,
  );
  const revision = data.reduce(
    (max, item) => Math.max(max, item.revision),
    since,
  );
  await device.ref.update({ lastSeenAt: new Date() });
  return NextResponse.json({ revision, items: data });
}
