# Çalışma günlüğü

En yeni en üstte. Her kayıt: tarih · ne yapıldı · kanıt.

## 2026-11-04 — Faz 2a başladı
- Faz başı: memory-check geçti; son commit `9d57f8d` STATE ile uyumlu; çalışma ağacı temiz.
- Veri kaynağı araştırması: TURKOMP yazılı izin/ücretli (resmi sayfa 503, arama alıntıları) → kullanılmadı; USDA FDC CC0 (resmi ana sayfa); OFF ODbL (resmi dokümantasyon). USDA SR Legacy zip (6.074.592 bayt) ve OFF API bu ortamdan erişilebilir.

## 2026-11-04 — Faz 1b tamamlandı
- Yapılanlar: `lib/reminders.ts` (10 test), `lib/water-speech.ts` (6 test), `lib/water-insights.ts` (7 test), Web Push (`lib/push.ts`, VAPID DB'de), zamanlayıcı (`lib/scheduler.ts` + `instrumentation.ts`), SW bildirim yanıtları, API uçları, ayarlarda bildirim bölümü, su ekranında "Söyle", istatistikte analiz kartları + rozetler + aylık rapor. Migration 0002_reminders. Commit `4fa3fba`.
- Hafıza kontrolü işe yaradı: yeni tablo/rota/migration hafızaya yazılmadan verify.sh durdu; manifest güncellendi.
- Bulunan kusurlar: JS `\b` Türkçe "ç" ile çalışmıyor (çay algılanmıyordu) → boşluk sınırı; kullanıcının test bildirimi gerçek hatırlatmaların 45 dk aralığını bastırıyordu → test bildirimleri hesaptan çıkarıldı; web-push yalnızca HTTPS → test için kendinden imzalı sertifika + NODE_EXTRA_CA_CERTS (TLS doğrulaması kapatılmadı).
- Doğrulama: verify.sh VERIFY OK (push e2e: sahte servise aes128gcm + VAPID imzalı istek ulaştı; zamanlayıcı 14:00'te gönderdi, 14:10'da göndermedi, 02:00'de göndermedi; bildirim yanıtı su kaydı oluşturdu; oturumsuz 401). Canlı: onboarding OK; su e2e ilk denemede zamanlama nedeniyle başarısız (sabit 1,5 sn bekleme) → metin bekleme ile OK. Canlı test kancası 404. Deploy `2026-11-04T17-07-29-132Z`. 4 test kullanıcısı silindi.

## 2026-11-04 — Faz 1b başladı
- Faz başı: memory-check geçti; son commit `7eb8292` STATE ile uyumlu; çalışma ağacı temiz.
- Next 16 `instrumentation.ts` belgesi okundu (register() sunucu açılışında bir kez çalışır).

## 2026-11-04 — Faz 1a tamamlandı (Su modülü çekirdeği)
- Faz başı: memory-check geçti, son commit `0ebd8ed` STATE ile uyumlu.
- Yapılanlar: 4 yeni tablo (migration 0001_water), `lib/water.ts` + 14 birim test, `lib/water-data.ts`, su aksiyonları, su ekranı / istatistik / ayarlar, Bugün entegrasyonu. Commit `87e936f`.
- Canlıda yakalanan hata: hızlı çift dokunuşta ikinci kayıt, ilki DB'ye yazılmadan geldiği için çift kayıt kontrolünü atlatıyordu (yerelde görünmedi, gecikme yok). Düzeltme: istemci tarafı anında kontrol + sunucuda advisory lock ile kontrol ve eklemeyi tek işlemde yapma; e2e'ye regresyon adımı. Commit `9e64ee9`.
- Test hatası (uygulama değil): su e2e'si sihirbaz hidrasyonu bitmeden localStorage yazıyordu, sihirbaz bunu eziyordu → hidrasyon beklemesi eklendi.
- Doğrulama: verify.sh VERIFY OK; canlı su e2e OK; canlı onboarding e2e bir kez gezinme zaman aşımı verdi, tekrarında OK (aralıklı) → zaman aşımı 60 sn yapıldı. Deploy `2026-11-04T15-56-13-331Z` ve `2026-11-04T16-01-45-488Z` DEPLOY OK. 7 test kullanıcısı silindi; `deneme` hesabı korundu.

## 2026-11-04 — Faz 1a başladı (Su modülü çekirdeği)
- Kalıcı hafıza sistemi kuruldu: `CLAUDE.md`, `memory/*`, `scripts/memory-check.mjs`, `scripts/verify.sh`, `tests/e2e/onboarding.e2e.cjs`.
- Faz başı kontrolü: memory-check çalıştırıldı (sonuç bu commit'in mesajında).

## 2026-11-04 — Faz 0 tamamlandı
- Sunucu: DNS A kaydı (`gddy`), `/opt/dgfit-pwa` (compose: db + app), deploy alıcısı (systemd), Caddy bloğu (ilk reload dosya izni 600 yüzünden başarısız → 644 ile düzeldi; diğer siteler etkilenmedi, fit/glix 200).
- Uygulama: commit `2c7f978` (Faz 0), commit `dce73c0` (paket içine git geçmişi).
- Hatalar ve düzeltmeler: Ruler'da `left: 50%` iç genişliğe göre hesaplanıyordu → ölçülen yarım genişlik; değer 0 olan halkada nokta → çizilmiyor; source.tgz içine eski release.tgz giriyordu → hariç tutuldu; yerel testte eski `next-server` süreci portu tutuyordu → `pkill -f next-server`.
- Doğrulama: birim test 7/7; yerel e2e OK; canlı e2e OK; SW kaydı + çevrimdışı sayfa OK; deploy `2026-11-04T15-03-11-216Z` ve `2026-11-04T15-10-22-113Z` DEPLOY OK; yedek betiği çalıştı (`dgfit-pwa-2026-11-04.dump`).
