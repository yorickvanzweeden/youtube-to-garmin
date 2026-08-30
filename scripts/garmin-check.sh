#!/usr/bin/env bash
set -euo pipefail

if ! command -v monkeyc >/dev/null 2>&1; then
  echo 'garmin-check: Connect IQ SDK not installed; skipping Phase 0'
  exit 0
fi

if [[ -z "${GARMIN_TEST_DEVICE:-}" ]]; then
  echo 'garmin-check: GARMIN_TEST_DEVICE is unset; skipping Phase 0'
  exit 0
fi

echo "garmin-check: compiler wiring placeholder for device ${GARMIN_TEST_DEVICE}"
