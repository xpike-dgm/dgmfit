# Proje durumu

**Şu anki faz: Faz 1b tamamlandı · sıradaki: Faz 2 (Yemek + Fit)**

Kural: "tamamlandı" yalnızca kanıtla yazılır. Kanıtsız iş "planlandı" ya da "devam ediyor" olarak kalır.

## Faz tablosu

| Faz | Kapsam | Durum | Kanıt |
| --- | --- | --- | --- |
| 0 | PWA kabuğu, tasarım token'ları, kayıt/giriş, 11 adımlı profil sihirbazı, plan hesapları, Bugün ekranı, profil, kilo girişi, modül yer tutucuları, sunucu altyapısı | tamamlandı | commit `2c7f978` + `dce73c0`; birim test 7/7; yerel e2e OK; canlı e2e OK (test kullanıcısı silindi); deploy `2026-11-04T15-10-22-113Z` DEPLOY OK; SW kayıtlı + çevrimdışı sayfa doğrulandı |
| 1a | Su modülü çekirdeği (aşağıda) | tamamlandı | commit `87e936f` + `9e64ee9`; birim test 21/21; verify.sh VERIFY OK (onboarding + su e2e); canlı su e2e OK ve canlı onboarding e2e OK (deploy `2026-11-04T16-01-45-488Z`); test kullanıcıları silindi |
| 1b | Su: akıllı push hatırlatmaları, sesli kayıt, analiz kartları, rozetler, aylık rapor (aşağıda) | tamamlandı | commit `4fa3fba`; birim test 44/44; verify.sh VERIFY OK (onboarding + push + su e2e); canlı onboarding ve su e2e OK; canlıda test kancası 404, VAPID üretildi, zamanlayıcı logu var (deploy `2026-11-04T17-07-29-132Z`). Gerçek cihazda push teslimi kullanıcı tarafından denenmeli |
| 2 | Yemek + Fit (besin veritabanı, öğün kaydı, kalori dengeleme, adaptif TDEE) | planlandı | — |
| 3 | Fitness (hareket kütüphanesi, program, canlı antrenman, AI ağırlık önerisi, PR) | planlandı | — |
| 4 | AI katmanı (fotoğraf/ses kaydı, koç, raporlar) | planlandı | — |
| 5 | Sosyal | planlandı | — |
| 6 | Mağaza sürümü ve cihazlar (isteğe bağlı) | planlandı | — |

## Faz 1a kapsamı ve kabul kriterleri (tamamlandı)

Kaynak: spesifikasyon bölüm 7 (Su modülü).

- [x] Veri modeli: `water_logs` (ml, içecek türü, hidrasyon katsayısı, kap, kaynak, zaman, yumuşak silme, düzenleme geçmişi), `water_containers`, `water_settings` (miktar butonları, yudum hacmi, haftalık hedef planı), hedef tarihçesi geçmişi bozmaz
- [x] Kayıt: tek dokunuş butonları (özelleştirilebilir), sık kullanılan miktarları öğrenme, yudum kaydı + kalibrasyon, kap tanımlama, doluluk seçerek ekleme, "şişemi bitirdim"/yarım/çeyrek, geçmişe kayıt, 5 sn geri al, çift kayıt uyarısı
- [x] İçecek türleri ve hidrasyon katsayısı (su, çay, kahve, maden suyu, ayran, meyve suyu)
- [x] Hedef: kişisel taban + haftanın günlerine farklı hedef; günü uyanış–uyku aralığına bölen ideal eğri; gerçek zamanlı tempo; hedefe ulaşma tahmini ve saati; dağılım skoru
- [x] Zaman çizelgesi: kronolojik liste, düzenleme, silme, birleştirme, kaynağını gösterme, takvimden geçmiş güne gitme
- [x] İstatistik: saatlik dağılım, son 7/30 gün grafiği, ortalama, en iyi/en kötü gün, hedef tamamlama oranı, seri ve esnek seri (ayda 2 dondurma)
- [x] Bugün ekranı entegrasyonu: su kartı gerçek veri, hafta şeridi halkaları su ilerlemesiyle; `water.logged` olayı yayınlanır
- [x] Testler: hesaplama birim testleri (ideal eğri, tempo, tahmin, dağılım skoru, seri, çift kayıt, sık miktar) + e2e (ekle, geri al, kap, yudum, düzenle, sil, geçmiş gün)
- [x] `scripts/verify.sh` geçer, canlıda e2e geçer, hafıza güncellenir

Faz 1a'da yapılmayanlar (Faz 1b'ye kaldı): push bildirimleri ve davranışı öğrenen hatırlatma zamanlayıcısı, bildirimden yanıt, sesli kayıt, AI analiz metinleri (şu an kural tabanlı tek içgörü var: en zayıf 3 saatlik dilim), rozetler, gün sonu bildirimi, NFC, Bluetooth şişe, ikinci tema.

## Faz 1b kapsamı ve kabul kriterleri (tamamlandı)

Kaynak: spesifikasyon 7.2 (akıllı hatırlatma), 7.4 (analiz), 7.10 (rozet, aylık rapor), 7.1 (sesli kayıt).

- [x] Web Push altyapısı: VAPID anahtarları (sunucu `.env`), `push_subscriptions` tablosu, abone ol/çık API'si, izin akışı (iOS'ta "Ana ekrana ekle" rehberi)
- [x] Hatırlatma karar motoru (`lib/reminders.ts`, saf + testli): uyanık pencere, sessiz saatler, ideal eğrinin gerisinde kalınca sıklaşma, önde iken seyrelme, su içilince sayaç sıfırlama, günlük tavan, 3 yok sayılan bildirimden sonra 2 saat sessizlik, sürekli yok sayılan saatlerde azaltma, öneri miktarı en fazla 300–400 ml, gün sonu özet bildirimi
- [x] Zamanlayıcı: `instrumentation.ts` ile sunucu açılışında dakikalık döngü, tek örnek kilidi; `water_reminders` tablosunda gönderilen/açılan/işe yarayan kayıtları
- [x] Bildirimden yanıt: Android'de "200 ml içtim" / "250 ml" / "Sonra" butonları (service worker → API); iOS'ta dokununca su ekranı
- [x] Hatırlatmanın işe yarayıp yaramadığı: bildirimden sonraki 20 dk içinde su kaydı → etkili
- [x] Sesli ve yazılı kayıt: Türkçe ayrıştırıcı (`lib/water-speech.ts`, testli) — sayılar yazıyla/rakamla, ml/litre/bardak/şişe/yudum/yarım, içecek türü, "az önce / yarım saat önce / saat 2'de"; Web Speech API varsa ses, yoksa yazı
- [x] Analiz kartları (`waterInsights`, kural tabanlı, testli): en zayıf dilim, son haftalara göre iyileşme/kötüleşme, en zayıf gün, ilk su saatinin kayması, istikrar, hatırlatma etkinliği
- [x] Rozetler (kazanıldığı tarih saklanır) ve aylık karşılaştırma raporu (son 6 ay)
- [x] Ayarlar: hatırlatmaları aç/kapat, sessiz saatler, günlük tavan, gün sonu özeti; test bildirimi gönder
- [x] Testler + `scripts/verify.sh` + canlı e2e (push aboneliği Chromium'da) + hafıza güncellemesi

Kapsam dışı (not): hava durumu ve antrenmana bağlı hatırlatma (Faz 3 / dış API), özel bildirim sesleri (Web Push sistem sesini kullanır), NFC ve Bluetooth (ayrı iş), açık tema.

## Sıradaki işler

1. Faz 2: Yemek + Fit (besin veritabanı — TURKOMP lisansı kontrolü, USDA, Open Food Facts; öğün kaydı; barkod; tarif; kalori dengeleme; adaptif TDEE; `daily_targets`).
2. Kullanıcıdan gerçek cihazda bildirim denemesi (Android Chrome + iOS ana ekran) geri bildirimi.
3. E-posta doğrulama kodu (Mailu SMTP) — ertelendi.

## Bilinen eksikler / borçlar

- `daily_targets` tablosu henüz doldurulmuyor (Faz 2'de kalori dengelemeyle).
- Bugün ekranındaki seri ve hafta halkaları şimdilik yalnızca suya dayalı; Yemek gelince ortak "mükemmel gün" oranına geçecek.
- Canlıda kullanıcının kendi `deneme` hesabı var (2026-11-04 15:04 UTC); test temizliğinde silinmez.
- E2E'de deploy sonrası ilk isteklerde aralıklı gecikme görüldü; testlerde gezinme zaman aşımı 60 sn.
- Push teslimi yalnızca sahte HTTPS servisine karşı otomatik test ediliyor; FCM/APNs'e gerçek teslim otomatik testte yok.
- Analiz kartları kural tabanlı; LLM tabanlı koç Faz 4'te (API anahtarı yok).
- Yasal metinler TASLAK; hukuk kontrolü gerekli.
- Bu çalışma ortamında GitHub erişimi yok (GH_TOKEN geçersiz); kod sunucudaki `repo.bundle` ile korunuyor.
