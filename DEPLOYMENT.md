# Deployment runbook

This project keeps secrets out of Git and Terraform state. Run the checks
before deploying:

```sh
set -a; source .env; set +a
just check
```

## Google Cloud foundation

Create a local `infra/prod/terraform.tfvars` from the example, then review the
plan against the configured project:

```sh
terraform -chdir=infra/prod init
terraform -chdir=infra/prod plan -var-file=terraform.tfvars
terraform -chdir=infra/prod apply -var-file=terraform.tfvars
```

The apply provisions the private media bucket, Firestore, Artifact Registry,
Cloud Tasks queue, Cloud Run Job, service accounts, IAM, and Vercel OIDC
federation. Build and push the worker image to the output repository before
starting the Cloud Run Job.

## Vercel project

Link the existing project and enable Secure Backend Access / OIDC federation:

```sh
vercel link --yes --scope yorick-projects --project youtube-to-garmin
vercel env ls --scope yorick-projects --project youtube-to-garmin
```

Configure these encrypted Vercel variables for Production using values from
the local `.env` or a secret manager:

```text
AUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ALLOWED_GOOGLE_SUB
GCP_PROJECT_ID
GCP_PROJECT_NUMBER
GCP_REGION
GCS_MEDIA_BUCKET
CLOUD_TASKS_QUEUE
CLOUD_RUN_JOB_NAME
CLOUD_RUN_SERVICE_ACCOUNT
```

`VERCEL_OIDC_TOKEN` is supplied by Vercel when OIDC federation is enabled; it
must not be manually copied into Git or long-lived environment configuration.

## Post-deploy checks

1. Open the production URL and complete the authorized Google sign-in.
2. Add a YouTube URL and confirm a queued job is created.
3. Confirm the worker reaches `ready` and the media appears in the Garmin feed.
4. Pair the watch, run a sync, and verify the native cached-audio player lists the track.
