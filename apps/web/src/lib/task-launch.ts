import { createHash } from "node:crypto";

import { configureVercelGoogleAuth } from "./vercel-google-auth";

type LaunchConfig = {
  projectId: string;
  region: string;
  queue: string;
  jobName: string;
  serviceAccountEmail: string;
};

function config(): LaunchConfig {
  const values = {
    projectId: process.env.GCP_PROJECT_ID,
    region: process.env.CLOUD_TASKS_REGION,
    queue: process.env.CLOUD_TASKS_QUEUE,
    jobName: process.env.CLOUD_RUN_JOB_NAME,
    serviceAccountEmail: process.env.CLOUD_RUN_SERVICE_ACCOUNT,
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length)
    throw new Error(`Missing task launch configuration: ${missing.join(", ")}`);
  return values as LaunchConfig;
}

export async function enqueueJob(jobId: string, launchGeneration = 0) {
  configureVercelGoogleAuth();
  const values = config();
  const { CloudTasksClient } = await import("@google-cloud/tasks");
  const client = new CloudTasksClient();
  const parent = client.queuePath(
    values.projectId,
    values.region,
    values.queue,
  );
  const taskId = createHash("sha256")
    .update(`${jobId}:${launchGeneration}`)
    .digest("hex");
  const runUrl = `https://run.googleapis.com/v2/projects/${values.projectId}/locations/${values.region}/jobs/${values.jobName}:run`;
  await client.createTask({
    parent,
    task: {
      name: `${parent}/tasks/launch-${taskId}`,
      httpRequest: {
        httpMethod: "POST",
        url: runUrl,
        headers: { "content-type": "application/json" },
        body: Buffer.from(
          JSON.stringify({
            overrides: {
              containerOverrides: [{ env: [{ name: "JOB_ID", value: jobId }] }],
            },
          }),
        ).toString("base64"),
        oidcToken: {
          serviceAccountEmail: values.serviceAccountEmail,
          audience: "https://run.googleapis.com/",
        },
      },
    },
  });
  return { taskId, runUrl };
}
