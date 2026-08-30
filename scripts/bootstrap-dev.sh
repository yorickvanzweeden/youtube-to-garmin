#!/usr/bin/env bash
set -euo pipefail

command -v mise >/dev/null 2>&1 || { echo 'Install mise first'; exit 1; }
mise install
pnpm install
uv sync --directory apps/worker
lefthook install
