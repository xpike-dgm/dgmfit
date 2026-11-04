#!/bin/bash
# Kullanım: ./scripts/deploy.sh   (önce ./scripts/bundle.sh)
# Token: DGFIT_DEPLOY_TOKEN ortam değişkeni ya da ~/.config/dgfit/deploy-token (repo dışında; pakete girmez).
set -euo pipefail
cd "$(dirname "$0")/.."
TOKEN_FILE="${DGFIT_DEPLOY_TOKEN_FILE:-$HOME/.config/dgfit/deploy-token}"
if [ -z "${DGFIT_DEPLOY_TOKEN:-}" ] && [ -r "$TOKEN_FILE" ]; then DGFIT_DEPLOY_TOKEN="$(tr -d '\n' < "$TOKEN_FILE")"; fi
: "${DGFIT_DEPLOY_TOKEN:?DGFIT_DEPLOY_TOKEN gerekli (ya da $TOKEN_FILE)}"
curl -sS --fail-with-body -X POST -H "Authorization: Bearer $DGFIT_DEPLOY_TOKEN" \
  -H 'Content-Type: application/gzip' --data-binary @release.tgz --max-time 600 \
  https://dgfit.dgmcraft.online/_deploy
