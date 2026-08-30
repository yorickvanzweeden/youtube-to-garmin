#!/usr/bin/env bash
set -euo pipefail

roots=(infra/bootstrap infra/prod)
for root in "${roots[@]}"; do
  if find "$root" -maxdepth 1 -name '*.tf' -print -quit | grep -q .; then
    terraform -chdir="$root" fmt -check
    terraform -chdir="$root" validate
  else
    echo "terraform-check: $root has no configuration yet; skipping"
  fi
done

if command -v tflint >/dev/null 2>&1; then tflint --recursive; else echo 'terraform-check: tflint not installed; skipping'; fi
if command -v trivy >/dev/null 2>&1; then trivy config infra; else echo 'terraform-check: trivy not installed; skipping'; fi
