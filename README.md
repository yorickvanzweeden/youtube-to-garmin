# Garmin Audio

Private YouTube-to-Garmin audio sync, structured as a pnpm/uv/Terraform monorepo.

The repository contains the working web application, Cloud Run media worker,
Garmin Connect IQ app, and Terraform production foundation. The remaining
deployment step is applying the reviewed Terraform plan to the configured GCP
project; secrets stay outside Git.

## Prerequisites

Install the tools declared in `mise.toml`, then run:

```sh
just install
just check
```

Cloud credentials, Vercel credentials, and Garmin SDK credentials are intentionally not part of this repository.

## Local workflow

Keep credentials in the ignored root `.env` file. Run `just install` once, then
use `just check` for the full TypeScript, web-test, worker, Terraform, and
Garmin validation suite. The repository's Lefthook pre-commit and pre-push
hooks run the relevant checks automatically.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the reviewed infrastructure and Vercel
deployment runbook.
