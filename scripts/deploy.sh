#!/bin/bash
# Kullanım: DGFIT_DEPLOY_TOKEN=... ./scripts/deploy.sh   (önce ./scripts/bundle.sh)
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DGFIT_DEPLOY_TOKEN:?DGFIT_DEPLOY_TOKEN gerekli}"
curl -sS --fail-with-body -X POST -H "Authorization: Bearer $DGFIT_DEPLOY_TOKEN" \
  -H 'Content-Type: application/gzip' --data-binary @release.tgz --max-time 600 \
  https://dgfit.dgmcraft.online/_deploy
