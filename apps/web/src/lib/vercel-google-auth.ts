import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const subjectTokenPath = join(tmpdir(), "youtube-to-garmin-vercel-oidc-token");

export function configureVercelGoogleAuth(): void {
  const token = process.env.VERCEL_OIDC_TOKEN;
  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const projectId = process.env.GCP_PROJECT_ID;
  const serviceAccount = process.env.CLOUD_RUN_SERVICE_ACCOUNT;

  if (!token || !projectNumber || !projectId || !serviceAccount) return;

  writeFileSync(subjectTokenPath, token, { encoding: "utf8", mode: 0o600 });
  const credentialsPath = join(
    tmpdir(),
    "youtube-to-garmin-google-credentials.json",
  );
  writeFileSync(
    credentialsPath,
    JSON.stringify({
      type: "external_account",
      audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/vercel/providers/vercel`,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      token_url: "https://sts.googleapis.com/v1/token",
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
      credential_source: {
        file: subjectTokenPath,
        format: { type: "text" },
      },
      universe_domain: "googleapis.com",
    }),
    { encoding: "utf8", mode: 0o600 },
  );
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
}
