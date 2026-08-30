#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--apply]" >&2
  echo "Default mode lists the variables that would be uploaded." >&2
}

apply=false
case "${1:-}" in
  "") ;;
  --apply) apply=true ;;
  *) usage; exit 2 ;;
esac

[[ -f .env ]] || { echo 'vercel-env-sync: .env is required' >&2; exit 1; }
command -v vercel >/dev/null 2>&1 || { echo 'vercel-env-sync: vercel CLI is required' >&2; exit 1; }

# shellcheck disable=SC1091
set -a
source .env
set +a

project="${VERCEL_PROJECT_NAME:-youtube-to-garmin}"
scope="${VERCEL_TEAM_ID:-}"
vars=(
  AUTH_SECRET
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  ALLOWED_GOOGLE_SUB
  GCP_PROJECT_ID
  GCP_PROJECT_NUMBER
  GCP_REGION
  CLOUD_TASKS_REGION
  GCS_MEDIA_BUCKET
  CLOUD_TASKS_QUEUE
  CLOUD_RUN_JOB_NAME
  CLOUD_RUN_SERVICE_ACCOUNT
)

if [[ -z "${ALLOWED_GOOGLE_SUB:-}" && -n "${BOOTSTRAP_GOOGLE_EMAIL:-}" ]]; then
  vars+=(BOOTSTRAP_GOOGLE_EMAIL)
fi

for name in "${vars[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "vercel-env-sync: missing local value for $name" >&2
    exit 1
  fi
done

echo "Vercel project: $project"
echo "Target: production"
printf 'Variables: %s\n' "${vars[*]}"

if [[ "$apply" != true ]]; then
  echo 'Dry run only. Re-run with --apply to upload encrypted values.'
  exit 0
fi

for name in "${vars[@]}"; do
  printf '%s' "${!name}" | vercel env add "$name" production --scope "$scope" --project "$project"
done
