# Çalışma günlüğü

En yeni en üstte. Her kayıt: tarih · ne yapıldı · kanıt.

## 2026-11-05 — Faz 4b başladı
- Faz başı: memory-check geçti; son commit `5c9d997` STATE ile uyumlu; çalışma ağacı temiz. Spesifikasyon bölüm 10, 5.6, 6.4, 7.4, 13, 11.5 Claude Docs'tan okundu.
- Kapsam kararı: 4b = koç + içgörü + rapor + sınırlar; menü/tarif/restoran/program oluşturucu 4c.

## 2026-11-05 — 4a eki: karma model (fotoğraf/etiket Opus, yazı Haiku)
- Kullanıcı kararı: "evet karma modeli ekle, fotoğrafa opus". Migration 0008 (`ai_providers.task_models`, `ai_calls.model`), `modelFor`, `PRICES`, Opus için sunucu tarafı yedek; yönetici sayfasında görev başına model + bu ayın tahmini maliyet tablosu.
- Bulunan kusur: zod 4'te `z.record(z.enum(...))` tüm anahtarları zorunlu kılıyor → kaydetme sessizce reddediliyordu (AI e2e "Kaydedildi" beklerken zaman aşımı) → `z.partialRecord`.
- Doğrulama: commit `368883d`; verify.sh VERIFY OK (birim 99/99, 8 e2e); release `2026-11-05T02-34-13-285Z` RELEASE OK; canlı DB'de `ai_calls.model` mevcut; 7 test kullanıcısı silindi.

## 2026-11-05 — Faz 4a tamamlandı (sahte sağlayıcıyla)
- OpenAI belgesi web okuma ajanıyla okundu (models/pricing/images-vision/error-codes + openai-node README): `gpt-6-luna` ($0,10/$0,50), Responses API `input_image` + base64 data URL, `text.format` json_schema, 429 kodları (credit_balance_exhausted, *_spend_limit_exceeded, *_usage_limit_exceeded, slow_down), 503 server_is_overloaded. Claude tarafı: claude-api rehberi + SDK tipleri (`output_config.format: {type:'json_schema', schema}`).
- SDK sürümleri: @anthropic-ai/sdk 1.5.0, openai 7.51.0. Kurulu SDK kaynağından doğrulandı: Anthropic SDK 1.x anahtarı `Authorization: Bearer` ile gönderir (x-api-key değil) ve ortamdaki ANTHROPIC_BASE_URL'e düşer → resmi adresler açıkça verildi, `authToken: null`.
- Bulunan kusurlar (e2e/inceleme): bu bulut ortamında ANTHROPIC_BASE_URL tanımlıydı (SDK'yı başka yere yönlendirebilirdi); kullanıcı günlük hakkı başarısız çağrıları da sayıyordu; JSON Schema dönüştürmede SDK yardımcısı `enum`'u açıklamaya taşıyordu → kendi alt küme dönüştürücüsü. Test kaynaklı: önceki çalıştırmanın önbelleği ve anahtarları (benzersiz PNG + başta temizlik).
- Doğrulama: birim 99/99; verify.sh VERIFY OK (8 e2e); release `2026-11-05T02-16-18-490Z` RELEASE OK; canlı container ortamı kontrol edildi (DGFIT_ADMINS=deneme; test/sahte değişkenler yok); 7 test kullanıcısı silindi.

## 2026-11-05 — Faz 4a başladı
- Faz başı: memory-check geçti; son commit `2d6a857` STATE ile uyumlu; çalışma ağacı temiz.
- Spesifikasyon bölüm 10 Claude Docs bağlayıcısıyla okundu. Kullanıcı kararları (AskUserQuestion): 3 sağlayıcı ve limit dolunca geçiş (Claude, OpenAI, "Evren"; Evren bilgisi yok → şimdilik iki sağlayıcı), her yerde Haiku, anahtarlar yönetici sayfasından. Faz 4 ikiye bölündü.

## 2026-11-05 — Faz 3b tamamlandı
- Kaynak doğrulama (web okuma ajanı): 5/3/1 t-nation 404, jimwendler.com'da yüzde yok, gzclp.com 503, Reddit engelli. Yalnızca GZCLP kuralları ikincil kaynaktan (saynotobroscience.com/gzclp-infographic) doğrulandı → GZCLP yapıldı, 5/3/1 ve nSuns ezberden yazılmadı.
- Çeviri: kullanıcı "kısa Türkçe özet" seçti (AskUserQuestion). Tek arka plan ajanı 783 hareketi `data/exercises-tr-auto/part1-4.json`'a yazdı (kendi doğrulaması PASS); benim builder doğrulamam geçti; 12 birim dönüşümü (inç/ft/lb → cm/m/kg) elle kontrol edildi, doğru; 3 ondalık nokta virgüle çevrildi; 4 rastgele örnek kaynağa sadık.
- Kod: `lib/progress.ts` + `lib/schemes.ts` (8 test), şema 0006, `lib/media.ts` (AES-256-GCM, AAD = kullanıcı kimliği, imzadan tür), `lib/fitness-stats.ts`, `lib/rest-push.ts`, SW v3 (canlı antrenman sayfası önbelleği, görünürken dinlenme push'u gösterilmez, bildirime dokununca aynı sayfada yeniden yükleme yok). Sunucu: `DGFIT_MEDIA_KEY` `.env`'e üretildi (yazdırılmadı), compose'a eklendi (yedek `docker-compose.yml.pre-media-key-<zaman>`).
- Kendi incelememde bulunan: bildirim tıklaması programsız `/fitness/antrenman`'a gidip taslağı kaybettirecekti → istemci gerçek adresi gönderir, SW aynı sayfadaysa yalnızca odaklar.
- Ekran görüntüsü incelemesinde bulunan güvenlik hataları (`cd79683`): plato tekrar aralığı başka kullanıcının programından okunuyordu; `saveWorkout` istemcinin program günü kimliğini doğrulamadığı için başkasının GZCLP durumu ilerletilebilirdi → sahiplik kontrolleri. Bu ikisi için otomatik regresyon testi yok (iki kullanıcılı sunucu aksiyonu testi kurulmadı).
- Test kaynaklı: yerel Postgres ortam yeniden başlayınca kapalıydı; canlı modda `dayOf` kapsam hatası; fotoğraf yüklemede eski durum mesajıyla yarış (canlıda göründü).
- Doğrulama: birim 94/94; verify.sh VERIFY OK (7 e2e); release deploy `2026-11-05T01-04-41-798Z`, canlı e2e OK (progress düzeltmeden sonra ayrıca canlıda OK); canlı DB 872/876 Türkçe adımlı, `media_blobs` içinde düz imza 0/4; 9 test kullanıcısı silindi.

## 2026-11-05 — Faz 3b başladı
- Faz başı: memory-check geçti; son commit `dc60bb7` STATE ile uyumlu; çalışma ağacı temiz, `origin/main` ile eşit.

## 2026-11-05 — Faz 3a tamamlandı
- Depo GitHub'a taşındı: `xpike-dgm/dgmfit` (kullanıcı onayıyla push; geçmişte token/sır taraması temiz). Proje izin kuralları `.claude/settings.json` (commit `9456bb2`). Kullanıcı ayar dosyasına izin ekleme denemem otomatik mod güvenlik kontrolünce engellendi (öz-değişiklik) — doğru davranış, etrafından dolaşılmadı.
- Veri: free-exercise-db 876 hareket + 93 küratörlü Türkçe teknik; builder kaynak adla eşleşmeyeni durdurur. Görseller VDS `/srv/dgfit-media` + Caddy `/media/*` (diğer site 200, dizin dışı 404). Commit `52efebb`.
- Motor `lib/training.ts` (14 test), şablonlar + üretici `lib/programs.ts` (5 test; tüm anahtarlar veri setinde). Kendi incelememde bulunanlar: "aynı ağırlık + 1 tekrar" adımında e1RM ağırlığı düşürüyordu → ağırlık düşmez; vücut ağırlığı squat/şınav 6–10 tekrarda kalıyordu → 15–25 / 8–20; kettlebell etiketli goblet squat evde dumbbell ile atlanıyordu → eşdeğer ekipman.
- Şema 0005 + veri katmanı + aksiyonlar (`900c804`), ekranlar (`e0d3e53`, `e6bb8da`).
- E2E ile bulunan gerçek hatalar (`673afef`): (1) aramasız kütüphane filtresi `ORDER BY 0` ile çöküyordu; (2) alt sayfadan alt sayfaya geçişte yenisi de kapanıyordu (Sheet onClose); (3) Fit "İstisna say" onayı kartla birlikte siliniyordu (önceki fazda yarış nedeniyle tesadüfen geçmişti); (4) sayı alanının erişilebilir adına birim karışıyordu; (5) geçmişsiz harekette boş alanla 0 kg set kaydı → engellendi; (6) dengeli tempo açığı (~550 kcal) ağırlık artışını tamamen durduruyordu → eşik 750; (7) aynı set 3 rekor olarak sayılıyordu (kg = 3RM = 5RM). Test kaynaklı: Su e2e sabit 09:00 gece yarısından sonra gelecekte kalıyordu; Next rota duyurucusuyla çift metin eşleşmesi; yerelde `/media` 404.
- Doğrulama: birim 86/86; verify.sh VERIFY OK; release.sh RELEASE OK (deploy `2026-11-04T21-27-04-578Z`); canlı DB exercises 876/93; 5 test kullanıcısı silindi.

## 2026-11-04 — Faz 3a başladı
- Faz başı: memory-check geçti; son commit `267f03f` (betikler) STATE ile uyumlu; çalışma ağacı temiz.
- Spesifikasyon bölüm 4 ve 9 Claude Docs bağlayıcısıyla okundu. Faz 3 ikiye bölündü (3a çekirdek, 3b gelişim).
- Hareket verisi kaynağı: github.com/yuhonas/free-exercise-db — LICENSE.md "public domain" (Unlicense) doğrudan okundu; `dist/exercises.json` 876 hareket (strength 584, stretching 123, plyometrics 61, powerlifting 38, olympic 35, strongman 21, cardio 14); görsel örneği 38.047 bayt jpg.

## 2026-11-04 — Faz 2b tamamlandı
- `lib/fit.ts` saf motor + 14 test; `lib/fit-data.ts` veri katmanı; zamanlayıcıya gece kapanışı; Bugün/Yemek düzeltilmiş hedef; hafta halkaları su + kalori uyumu. Ara commit `0910d1e`.
- `/fit` ekranı + aksiyonlar + `tests/e2e/fit.e2e.cjs` (beklenen değerler `lib/fit.ts` içe aktarılarak hesaplanır). Commit `6f491b8`.
- Bulunan kusurlar: (1) eşzamanlı gün kapanışı (zamanlayıcı + düğme) çift düzeltme yazabilirdi → satır `ON CONFLICT … WHERE closed_at IS NULL` ile atomik sahipleniyor; (2) kapalı güne öğün eklenince fark güncellenmiyordu → `refreshClosedDay`; (3) e2e ekran görüntüsünde ölçülen harcama 2.586 (gerçek ≈2.786; EMA gecikmesi) → tartılara doğrusal eğim, 2.781; (4) grafik açıklaması veri çizgisinin üstüne biniyordu → grafiğin altına taşındı.
- Doğrulama: birim 67/67; verify.sh VERIFY OK; deploy `2026-11-04T19-53-42-460Z`; canlı fit (canlı mod: banka, gün kapat/aç, tartı), food, onboarding, su e2e OK; canlı test kancası 404; 4 test kullanıcısı silindi, `deneme` korundu.

## 2026-11-04 — Faz 2b başladı
- Faz başı: memory-check geçti; son commit `2c2e757` STATE ile uyumlu; çalışma ağacı temiz.

## 2026-11-04 — Faz 2a tamamlandı
- Besin verisi: USDA SR Legacy (7.793) + 149 Türkçe küratörlü (ilk denemede 138/146 USDA açıklaması birebir eşleşti, 8'i aday bulucuyla düzeltildi) + 36 Türk yemeği tariften hesaplandı (Atwater ve verim kontrolleri). Builder ilk çalıştırmada yanlış malzeme anahtarını yakaladı (`kirmizi-mercimek-kuru`). Commit `5525b9b`.
- Veri katmanı + aksiyonlar + arama/barkod API, commit `e8e5318`. Arama denemesi: "simit"te alakasız İngilizce sonuç → İngilizce adlar için eşik 0,7.
- Ekranlar commit `42d0008`. E2E ile bulunan gerçek hatalar: (1) gram modunda son kullanılan miktar 50 g → 0,5 g'a dönüşüyordu; (2) gram miktarı (portionQty) 100 üstünde doğrulamadan geçemiyordu; (3) tarif porsiyon kalorisi yuvarlanmış 100 g değerinden hesaplanıyordu (180 ≠ 179) → kcal 1 ondalık + toplamdan hesap; (4) yemekten gelen su kuralı yoğurdu da sayacaktı → yalnızca çorba/içecek/süt-kefir-ayran. Test kaynaklı hatalar: sil düğmesiyle çift eşleşen seçici, son miktar varsayılanı değişince kopyalama beklentisi.
- Doğrulama: birim 53/53; verify.sh VERIFY OK; canlı onboarding + su + yemek e2e OK (OFF barkod canlıda çalıştı); deploy `2026-11-04T19-11-00-792Z`; 4 test kullanıcısı silindi.

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
