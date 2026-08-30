set shell := ["bash", "-euoc"]

default:
    @just --list

install:
    pnpm install
    uv sync --directory apps/worker

check: check-web check-contracts check-worker check-terraform check-garmin

build:
    pnpm --dir apps/web exec next build --webpack
    docker build -f apps/worker/Dockerfile -t youtube-to-garmin-worker:ci apps/worker

check-web:
    pnpm --dir apps/web typecheck
    pnpm exec biome check .

check-contracts:
    pnpm --dir packages/contracts check

check-worker:
    uv run --directory apps/worker ruff check .
    uv run --directory apps/worker ty check
    uv run --directory apps/worker pytest

check-terraform:
    ./scripts/terraform-check.sh

check-garmin:
    ./scripts/garmin-check.sh

garmin-release version="$(cat VERSION)":
    GARMIN_TARGET_DEVICE="${GARMIN_TARGET_DEVICE:-fr165m}" ./scripts/garmin-release.sh "{{version}}"

infra-plan:
    @test -f infra/prod/terraform.tfvars || (echo 'Create infra/prod/terraform.tfvars from the example first' >&2; exit 1)
    terraform -chdir=infra/prod init
    terraform -chdir=infra/prod plan -input=false -var-file=terraform.tfvars

infra-apply:
    @test -f infra/prod/terraform.tfvars || (echo 'Create infra/prod/terraform.tfvars from the example first' >&2; exit 1)
    terraform -chdir=infra/prod apply -input=false -var-file=terraform.tfvars

worker-image:
    @test -n "${WORKER_IMAGE:-}" || (echo 'WORKER_IMAGE is required in .env' >&2; exit 1)
    docker build -f apps/worker/Dockerfile -t "$WORKER_IMAGE" apps/worker
    docker push "$WORKER_IMAGE"

test:
    pnpm --dir apps/web test
    uv run --directory apps/worker pytest
