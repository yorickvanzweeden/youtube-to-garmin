import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { firestore } from "../../../../../lib/firestore";
import { enqueueJob } from "../../../../../lib/task-launch";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.googleSub)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const db = firestore();
  const jobReference = db.collection("jobs").doc(id);
  const jobSnapshot = await jobReference.get();
  if (!jobSnapshot.exists)
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const job = jobSnapshot.data() ?? {};
  if (job.state !== "failed")
    return NextResponse.json(
      { error: "Only failed jobs can be retried" },
      { status: 409 },
    );
  const launchGeneration = Number(job.launchGeneration ?? 0) + 1;
  await jobReference.update({
    state: "queued",
    attempts: 0,
    launchGeneration,
    error: null,
    queuedAt: new Date(),
  });
  const task = await enqueueJob(id, launchGeneration);
  return NextResponse.json({
    jobId: id,
    status: "queued",
    taskId: task.taskId,
  });
}
