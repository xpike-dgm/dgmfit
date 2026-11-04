#!/bin/bash
# Faz sonu tek komut: paket → canlıya yükle → sağlık → canlı e2e. Onay sayısını azaltmak için adımlar tek betikte.
# Kullanım: ./scripts/release.sh            (tüm e2e)
#           ./scripts/release.sh fit food   (yalnızca seçilenler)
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/bundle.sh | tail -1
./scripts/deploy.sh | tail -1
for i in $(seq 1 30); do curl -sf https://dgfit.dgmcraft.online/api/health >/dev/null && break; sleep 2; done
echo "sağlık: $(curl -s https://dgfit.dgmcraft.online/api/health)"
echo "test kancası (404 olmalı): $(curl -s -o /dev/null -w '%{http_code}' -X POST https://dgfit.dgmcraft.online/api/test/fit)"
export BASE=https://dgfit.dgmcraft.online OUT="${OUT:-/tmp/dgfit-e2e}"; mkdir -p "$OUT"
if [ $# -gt 0 ]; then tests=(); for t in "$@"; do tests+=("tests/e2e/$t.e2e.cjs"); done; else tests=(tests/e2e/*.e2e.cjs); fi
fail=0
for t in "${tests[@]}"; do
  case "$t" in *push*) echo "atlandı (yalnızca yerel): $t"; continue;; esac
  node "$t" 2>&1 | grep -v 'MODULE_TYPELESS\|Reparsing\|To eliminate\|trace-warnings' | tail -2 || fail=1
done
[ $fail = 0 ] && echo "RELEASE OK" || { echo "RELEASE: canlı e2e başarısız"; exit 1; }
