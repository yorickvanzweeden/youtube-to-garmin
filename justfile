set shell := ["bash", "-euo", "pipefail", "-c"]

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
    GARMIN_TARGET_DEVICE="${GARMIN_TARGET_DEVICE:-fr170m}" ./scripts/garmin-release.sh "{{version}}"

garmin-sim:
    @sdk_bin="${GARMIN_SDK_BIN:-$HOME/.Garmin/ConnectIQ/Sdks/current/bin}"; if [[ ! -x "$sdk_bin/monkeyc" ]]; then sdk_bin="$HOME/.Garmin/ConnectIQ/Sdks/connectiq-sdk-lin-9.2.0-2026-06-09-92a1605b2/bin"; fi; sim_dir="$$(mktemp -d /tmp/garmin-sim.XXXXXX)"; trap 'rm -rf "$sim_dir"' EXIT; key_file="$sim_dir/developer_key.der"; if [[ -n "${GARMIN_DEVELOPER_KEY:-}" ]]; then key_file="$GARMIN_DEVELOPER_KEY"; else openssl genrsa 4096 2>/dev/null | openssl pkcs8 -topk8 -nocrypt -outform DER -out "$key_file"; fi; "$sdk_bin/monkeyc" -d "${GARMIN_TARGET_DEVICE:-fr170m}" -f apps/garmin/monkey.jungle -o "$sim_dir/youtube-mp3-sync.prg" -y "$key_file"; "$sdk_bin/monkeydo" "$sim_dir/youtube-mp3-sync.prg" "${GARMIN_TARGET_DEVICE:-fr170m}"

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
