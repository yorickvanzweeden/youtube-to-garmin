set shell := ["zsh", "-cu"]

default:
    @just --list

install:
    pnpm install
    uv sync --directory apps/worker

check: check-web check-contracts check-worker check-terraform check-garmin

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

test:
    pnpm --dir apps/web test
    uv run --directory apps/worker pytest
