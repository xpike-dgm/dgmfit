#!/bin/bash
# Faz sonu tek komut: paket → canlıya yükle → sağlık → canlı e2e. Onay sayısını azaltmak için adımlar tek betikte.
# Kullanım: ./scripts/release.sh            (tüm e2e)
#           ./scripts/release.sh fit food   (yalnızca seçilenler)
set -euo pipefail
cd "$(dirname "$0")/.."
# Faz 9: tam senaryo simülasyonu (~4000 senaryo, ~2 dk) — değişmez ihlali ya da altın dosyadan sapma varsa yayın durur
simlog=$(mktemp); simok=1
node --experimental-strip-types scripts/sim.mjs full >"$simlog" 2>&1 || simok=0
grep -E '^SİM|HATA|ALTIN' "$simlog" || true; rm -f "$simlog"
[ $simok = 1 ] || { echo 'RELEASE: simülasyon başarısız'; exit 1; }
./scripts/bundle.sh | tail -1
./scripts/deploy.sh | tail -1
for i in $(seq 1 30); do curl -sf https://dgfit.dgmcraft.online/api/health >/dev/null && break; sleep 2; done
echo "sağlık: $(curl -s https://dgfit.dgmcraft.online/api/health)"
# ısındırma: yayından sonra her sayfanın ilk açılışı (modül yükleme) kullanıcıya değil buraya düşsün
for r in / /fit /su /yemek /yemek/ekle /fitness /fitness/antrenman /fitness/hareketler /fitness/anatomi /sosyal /profil /koc /yonetim; do curl -s -o /dev/null "https://dgfit.dgmcraft.online$r"; done
echo "test kancası (404 olmalı): $(curl -s -o /dev/null -w '%{http_code}' -X POST https://dgfit.dgmcraft.online/api/test/fit)"
export BASE=https://dgfit.dgmcraft.online OUT="${OUT:-/tmp/dgfit-e2e}"; mkdir -p "$OUT"
# Beyaz liste: canlı test hesapları e2e davet koduyla açılır (kod repo dışında: ~/.config/dgfit/e2e-invite; INFRA.md)
[ -z "${DGFIT_E2E_INVITE:-}" ] && [ -f ~/.config/dgfit/e2e-invite ] && export DGFIT_E2E_INVITE="$(cat ~/.config/dgfit/e2e-invite)"
[ -z "${DGFIT_E2E_INVITE:-}" ] && { echo "RELEASE: e2e davet kodu yok (~/.config/dgfit/e2e-invite)"; exit 1; }
if [ $# -gt 0 ]; then tests=(); for t in "$@"; do tests+=("tests/e2e/$t.e2e.cjs"); done; else tests=(tests/e2e/*.e2e.cjs); fi
fail=0
for t in "${tests[@]}"; do
  case "$t" in *push*) echo "atlandı (yalnızca yerel): $t"; continue;; esac
  node "$t" 2>&1 | grep -v 'MODULE_TYPELESS\|Reparsing\|To eliminate\|trace-warnings' | tail -2 || fail=1
done
[ $fail = 0 ] && echo "RELEASE OK" || { echo "RELEASE: canlı e2e başarısız"; exit 1; }
