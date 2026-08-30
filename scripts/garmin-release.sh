#!/usr/bin/env bash
set -euo pipefail

version="${1:-$(cat VERSION)}"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Expected a SemVer version (for example 0.1.0), got: $version" >&2
  exit 1
fi
: "${GARMIN_DEVELOPER_KEY:?GARMIN_DEVELOPER_KEY must point to the signing key}"
: "${GARMIN_TARGET_DEVICE:?GARMIN_TARGET_DEVICE must name the target device}"

monkeyc_bin="${GARMIN_SDK_BIN:-$HOME/.Garmin/ConnectIQ/Sdks/current/bin}/monkeyc"
if [[ ! -x "$monkeyc_bin" ]]; then
  monkeyc_bin="$(command -v monkeyc || true)"
fi
if [[ -z "$monkeyc_bin" || ! -x "$monkeyc_bin" ]]; then
  echo "Connect IQ SDK / monkeyc was not found" >&2
  exit 1
fi

output_dir="${GARMIN_RELEASE_DIR:-output/garmin}"
mkdir -p "$output_dir"
build_dir="$(mktemp -d)"
trap 'rm -rf "$build_dir"' EXIT
cp -R apps/garmin/. "$build_dir/garmin"
VERSION="$version" perl -0pi -e 's/(<iq:application[^>]* version=")[^"]*(")/$1 . $ENV{VERSION} . $2/e' "$build_dir/garmin/manifest.xml"
output="$output_dir/garmin-audio-v${version}-${GARMIN_TARGET_DEVICE}.iq"
"$monkeyc_bin" -e -f "$build_dir/garmin/monkey.jungle" -o "$output" -y "$GARMIN_DEVELOPER_KEY"
echo "$output"
