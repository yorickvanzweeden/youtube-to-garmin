#!/usr/bin/env bash
set -euo pipefail

monkeyc_bin="$(command -v monkeyc || true)"
if [[ -z "$monkeyc_bin" ]]; then
  sdk_bin="${GARMIN_SDK_BIN:-$HOME/.Garmin/ConnectIQ/Sdks/current/bin}"
  if [[ ! -x "$sdk_bin/monkeyc" && -z "${GARMIN_SDK_BIN:-}" ]]; then
    sdk_bin="$(find "$HOME/.Garmin/ConnectIQ/Sdks" -mindepth 2 -maxdepth 3 \
      -type f -name monkeyc -perm -u+x -printf '%h\n' 2>/dev/null | sort -V | tail -n 1)"
  fi
  if [[ -x "$sdk_bin/monkeyc" ]]; then
    monkeyc_bin="$sdk_bin/monkeyc"
  fi
fi
if [[ -z "$monkeyc_bin" ]]; then
  echo 'garmin-check: Connect IQ SDK not installed; skipping Phase 0'
  exit 0
fi

if [[ -z "${GARMIN_DEVELOPER_KEY:-}" ]]; then
  echo 'garmin-check: GARMIN_DEVELOPER_KEY is unset; skipping compile'
  exit 0
fi

if [[ "${CI:-}" == "true" && "${GARMIN_ALLOW_CI_SIGNING:-}" != "1" ]]; then
  echo 'garmin-check: CI signing is disabled for regular checks; skipping compile'
  exit 0
fi

if [[ ! -r "$GARMIN_DEVELOPER_KEY" ]]; then
  echo "garmin-check: signing key is not readable: $GARMIN_DEVELOPER_KEY" >&2
  exit 1
fi

output_file="$(mktemp --suffix=.prg)"
trap 'rm -f "$output_file"' EXIT
"$monkeyc_bin" -f apps/garmin/monkey.jungle -o "$output_file" -y "$GARMIN_DEVELOPER_KEY"
echo "garmin-check: Connect IQ app compiled successfully"
