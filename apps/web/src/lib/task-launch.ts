import { createHash } from "node:crypto";
import { GoogleAuth } from "google-auth-library";

import { configureVercelGoogleAuth } from "./vercel-google-auth";

type LaunchConfig = {
  projectId: string;
  taskRegion: string;
  runRegion: string;
  queue: string;
  jobName: string;
  serviceAccountEmail: string;
};

function config(): LaunchConfig {
  const values = {
    projectId: process.env.GCP_PROJECT_ID,
    taskRegion: process.env.CLOUD_TASKS_REGION,
    runRegion: process.env.GCP_REGION,
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
  const parent = `projects/${values.projectId}/locations/${values.taskRegion}/queues/${values.queue}`;
  const taskId = createHash("sha256")
    .update(`${jobId}:${launchGeneration}`)
    .digest("hex");
  const runUrl = `https://run.googleapis.com/v2/projects/${values.projectId}/locations/${values.runRegion}/jobs/${values.jobName}:run`;
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-tasks"],
  });
  const client = await auth.getClient();
  await client.request({
    url: `https://cloudtasks.googleapis.com/v2/${parent}/tasks`,
    method: "POST",
    data: {
      task: {
        name: `${parent}/tasks/launch-${taskId}`,
        httpRequest: {
          httpMethod: "POST",
          url: runUrl,
          headers: { "content-type": "application/json" },
          body: Buffer.from(
            JSON.stringify({
              overrides: {
                containerOverrides: [
                  { env: [{ name: "JOB_ID", value: jobId }] },
                ],
              },
            }),
          ).toString("base64"),
          oauthToken: {
            serviceAccountEmail: values.serviceAccountEmail,
            scope: "https://www.googleapis.com/auth/cloud-platform",
          },
        },
      },
    },
  });
  return { taskId, runUrl };
}
