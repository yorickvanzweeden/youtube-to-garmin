# Garmin Audio

Private YouTube-to-Garmin audio sync, structured as a pnpm/uv/Terraform monorepo.

This repository is currently scaffolded through Phase 0 in [PLAN.md](PLAN.md). The application, worker, Garmin app, and infrastructure directories contain foundations and placeholders only.

## Prerequisites

Install the tools declared in `mise.toml`, then run:

```sh
just install
just check
```

Cloud credentials, Vercel credentials, and Garmin SDK credentials are intentionally not part of this repository.
