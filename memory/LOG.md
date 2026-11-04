# Çalışma günlüğü

En yeni en üstte. Her kayıt: tarih · ne yapıldı · kanıt.

## 2026-11-04 — Faz 1a başladı (Su modülü çekirdeği)
- Kalıcı hafıza sistemi kuruldu: `CLAUDE.md`, `memory/*`, `scripts/memory-check.mjs`, `scripts/verify.sh`, `tests/e2e/onboarding.e2e.cjs`.
- Faz başı kontrolü: memory-check çalıştırıldı (sonuç bu commit'in mesajında).

## 2026-11-04 — Faz 0 tamamlandı
- Sunucu: DNS A kaydı (`gddy`), `/opt/dgfit-pwa` (compose: db + app), deploy alıcısı (systemd), Caddy bloğu (ilk reload dosya izni 600 yüzünden başarısız → 644 ile düzeldi; diğer siteler etkilenmedi, fit/glix 200).
- Uygulama: commit `2c7f978` (Faz 0), commit `dce73c0` (paket içine git geçmişi).
- Hatalar ve düzeltmeler: Ruler'da `left: 50%` iç genişliğe göre hesaplanıyordu → ölçülen yarım genişlik; değer 0 olan halkada nokta → çizilmiyor; source.tgz içine eski release.tgz giriyordu → hariç tutuldu; yerel testte eski `next-server` süreci portu tutuyordu → `pkill -f next-server`.
- Doğrulama: birim test 7/7; yerel e2e OK; canlı e2e OK; SW kaydı + çevrimdışı sayfa OK; deploy `2026-11-04T15-03-11-216Z` ve `2026-11-04T15-10-22-113Z` DEPLOY OK; yedek betiği çalıştı (`dgfit-pwa-2026-11-04.dump`).
