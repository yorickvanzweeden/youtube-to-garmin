# Terraform

Keep bootstrap state and production infrastructure in separate roots. The
production root provisions the deployable Google Cloud foundation, including
Vercel OIDC federation, and commits its provider lock file for reproducibility.
## Production foundation

`prod/` provisions the non-secret Google Cloud foundation: required APIs, a
private GCS media bucket, the Firestore Native database, and separate runtime
service accounts for the web app and media worker. It also provisions Artifact
Registry, Cloud Tasks, Cloud Run Jobs, and the IAM bindings required by the
Vercel runtime and task launcher.

```sh
cd infra/prod
terraform init
terraform plan -var-file=terraform.tfvars
```

Copy `terraform.tfvars.example` to a local `terraform.tfvars`; it is ignored by
Git. OAuth, Vercel, and other secret values must be supplied through encrypted
environment configuration, never Terraform variables.

## Local systemd worker

For a residential-IP deployment, install `systemd/garmin-youtube-worker.service.example`
as `~/.config/systemd/user/garmin-youtube-worker.service`. Create
`~/.config/garmin-youtube-worker/env` with `GCS_MEDIA_BUCKET` and
`GOOGLE_APPLICATION_CREDENTIALS`; keep that file mode `0600`. Export YouTube cookies
to a local ignored file and set `YOUTUBE_COOKIES_FILE` there. Then run:

```sh
systemctl --user daemon-reload
systemctl --user enable --now garmin-youtube-worker.service
systemctl --user status garmin-youtube-worker.service
```
