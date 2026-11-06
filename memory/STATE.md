# Proje durumu

**Şu anki faz: Faz 5f tamamlandı (takviyeler). Faz 5g (günlük özet görseli) tamamlandı. Önceki: Faz 5e tamamlandı (2026-11-05): geri bildirim sayfası, beyaz liste (kayıt onayı + davet kodu), yeni yönetim paneli ve kullanıcı yönetimi (commit `b318dfb`, release `2026-11-05T15-56-01-796Z`). Kullanıcıdan bekleniyor: G (Sosyal) maddesi boş geldi; OpenAI anahtarı girilmedi (yedek sağlayıcı yok). Faz 0–5e tamamlandı; Faz 6 isteğe bağlı ve beklemede.**

Kural: "tamamlandı" yalnızca kanıtla yazılır. Kanıtsız iş "planlandı" ya da "devam ediyor" olarak kalır.

## Faz tablosu

| Faz | Kapsam | Durum | Kanıt |
| --- | --- | --- | --- |
| 0 | PWA kabuğu, tasarım token'ları, kayıt/giriş, 11 adımlı profil sihirbazı, plan hesapları, Bugün ekranı, profil, kilo girişi, modül yer tutucuları, sunucu altyapısı | tamamlandı | commit `2c7f978` + `dce73c0`; birim test 7/7; yerel e2e OK; canlı e2e OK (test kullanıcısı silindi); deploy `2026-11-04T15-10-22-113Z` DEPLOY OK; SW kayıtlı + çevrimdışı sayfa doğrulandı |
| 1a | Su modülü çekirdeği (aşağıda) | tamamlandı | commit `87e936f` + `9e64ee9`; birim test 21/21; verify.sh VERIFY OK (onboarding + su e2e); canlı su e2e OK ve canlı onboarding e2e OK (deploy `2026-11-04T16-01-45-488Z`); test kullanıcıları silindi |
| 1b | Su: akıllı push hatırlatmaları, sesli kayıt, analiz kartları, rozetler, aylık rapor (aşağıda) | tamamlandı | commit `4fa3fba`; birim test 44/44; verify.sh VERIFY OK (onboarding + push + su e2e); canlı onboarding ve su e2e OK; canlıda test kancası 404, VAPID üretildi, zamanlayıcı logu var (deploy `2026-11-04T17-07-29-132Z`). Gerçek cihazda push teslimi kullanıcı tarafından denenmeli |
| 2a | Yemek çekirdeği: besin veritabanı, arama, öğün kaydı, porsiyonlar, barkod, özel besin, tarif, kopyalama, Bugün entegrasyonu | tamamlandı | commit `5525b9b` + `e8e5318` + `42d0008`; birim test 53/53; verify.sh VERIFY OK (food + onboarding + push + su e2e); canlı onboarding/su/yemek e2e OK (deploy `2026-11-04T19-11-00-792Z`); canlıda foods: usda 7.793 + dgfit 36; OFF barkod canlıdan çalıştı |
| 2b | Fit: günlük hedef kaydı (`daily_targets`), akıllı kalori dengeleme, adaptif TDEE, kilo trendi + haftalık check-in, plan ekranı, kalori bankası | tamamlandı | commit `0910d1e` + `6f491b8`; birim test 67/67; verify.sh VERIFY OK (fit tohumlu e2e + food + onboarding + push + su); canlı fit/food/onboarding/su e2e OK, canlıda `/api/test/fit` 404 (deploy `2026-11-04T19-53-42-460Z`); 4 test kullanıcısı silindi |
| 3a | Fitness çekirdeği: hareket kütüphanesi, program oluşturucu + şablonlar, canlı antrenman, ağırlık öneri motoru, PR, kardiyo, Fit/Su/Yemek entegrasyonu | tamamlandı | commit `52efebb` + `900c804` + `e0d3e53` + `e6bb8da` + `673afef`; birim test 86/86; verify.sh VERIFY OK (fitness + fit + food + onboarding + push + su e2e); `release.sh` RELEASE OK: canlı fitness/fit/food/onboarding/su e2e (deploy `2026-11-04T21-27-04-578Z`); canlıda exercises 876 (93 küratörlü), görsel 200, çevrimdışı kuyruktaki antrenman canlıda kaydedildi; 5 test kullanıcısı silindi |
| 3b | Fitness gelişim: grafikler, ısı haritası, plato, ölçüler + şifreli fotoğraf, kuvvet seviyesi, alternatif, periyodizasyon + deload, GZCLP tam, 783 hareketin Türkçesi, çevrimdışı canlı mod, kilit ekranı dinlenme push'u | tamamlandı | commit `eda136d` + `ff6ec3b` + `cd79683` + `8bee39b` + `b8c341c` (+ test düzeltmeleri); birim test 94/94; verify.sh VERIFY OK (7 e2e, progress tohumlu mod dahil); canlı fit/fitness/food/onboarding/su + progress e2e OK (deploy `2026-11-05T01-04-41-798Z`); canlıda 872/876 hareket Türkçe adımlı, medya şifreli (düz JPEG/PNG imzası 0/4); 9 test kullanıcısı silindi |
| 4a | AI altyapısı (sağlayıcı katmanı, Claude → OpenAI yedeği, kota, önbellek, yönetici AI ayarları, şifreli anahtarlar) + yemek fotoğrafı tanıma + sesli/yazılı öğün ve su kaydı + etiket okuma | tamamlandı (sahte sağlayıcıyla) | commit `8ff0175` + `d3777b6`; birim test 99/99; verify.sh VERIFY OK (8 e2e, AI e2e sahte Claude/OpenAI ile); release deploy `2026-11-05T02-16-18-490Z` canlı e2e OK; canlıda DGFIT_ADMINS=deneme, test kancası ve sahte adresler yok, oturumsuz 401. **Gerçek Claude/OpenAI çağrısı henüz yapılmadı** (anahtar yok) |
| 4b | AI koç (sohbet, onaylı eylemler, kişilik, "ne olur" kartı), günlük proaktif içgörü, haftalık rapor + push, yeme bozukluğu / aşırı antrenman sınırları | tamamlandı (sahte sağlayıcıyla) | commit `ec9ae94`; birim test 112/112; verify.sh VERIFY OK (10 e2e, koç e2e sahte Claude ile); release deploy `2026-11-05T03-05-14-235Z` RELEASE OK; canlıda 0009 uygulandı (4 tablo), `/api/test/coach` POST 404, `/api/coach/insight` oturumsuz 401, `/koc` `/rapor` girişe yönlendirir; 7 test kullanıcısı silindi. **Gerçek API çağrısı yok** |
| 4c | AI haftalık menü + alışveriş listesi + toplu hazırlık, "elimde bunlar var" tarifi, restoran modu, AI program oluşturucu, senaryo simülatörü, karb döngüsü, koçtan "yarının menüsü" | tamamlandı (sahte sağlayıcıyla) | commit `3410884`; birim test 118/118; verify.sh VERIFY OK (11 e2e, planlama e2e sahte Claude ile); release deploy `2026-11-05T03-34-15-650Z` RELEASE OK; canlıda 0010 uygulandı (4 tablo), yeni sayfalar girişe yönlendirir, `/api/ai/restaurant` oturumsuz 401, app logunda hata yok; 7 test kullanıcısı silindi. **Gerçek API çağrısı yok** |
| 5a | Sosyal çekirdek: profil (foto, biyografi, salon, hedef rozeti), PR vitrini, istatistik kartları, gizlilik (profil + öğe bazında), arkadaşlık + takip, arama, davet linki + QR, arkadaş önerileri, akış (önerilen/kronolojik), gönderi türleri, tepki/yorum/kaydetme, antrenman kopyalama, tarif kaydetme, engelle/sessize al/şikayet, AI + kural moderasyonu, bildirimler | tamamlandı | commit `7072263`; birim test 124/124; verify.sh VERIFY OK (12 e2e, sosyal e2e 3 kullanıcı + sahte Claude moderasyonu); release deploy `2026-11-05T05-42-38-190Z` RELEASE OK; canlı kancasız sosyal kontrolü OK (arama → istek → kabul → gönderi → arkadaş akışı → tepki bildirimi → yabancıya 404 → QR); canlıda 0011 (10 tablo), logda hata yok; 10 test kullanıcısı silindi. AI moderasyonu gerçek sağlayıcıyla denenmedi (canlıda anahtar yok → yalnızca kural; fotoğraflı gönderi onaya düşer) |
| 5b | Sosyal genişleme: meydan okumalar, gruplar + grup sohbeti, adil sıralama (DOTS, tutarlılık), düello, birebir mesaj, dürtme, antrenman partneri, 24 saatlik kartlar, PR doğrulama | tamamlandı | commit `8e9b256`; birim test 130/130; verify.sh VERIFY OK (13 e2e, sosyal-2 e2e 3 kullanıcı); release deploy `2026-11-05T06-10-32-259Z` RELEASE OK; canlı kancasız kontrol OK (5a + grup daveti/katılım/sohbet, DM, dürtme, meydan okuma katılım + sıralama, 24 saatlik kart, üye olmayana grup 404); canlıda 0012 (8 tablo), logda hata yok; 10 test kullanıcısı silindi |
| 5c | Kullanıcı incelemesi (6/10): yeni tasarım (modül renk paletleri, açık/koyu/otomatik tema, 7 yuvalı alt bar, sekme bantları + geri düğmeli alt sayfa başlıkları, ayarların ayrı sayfalara bölünmesi) + kurulumda kullanıcının temposuna saygı | tamamlandı | commit `b5b012a` + `238bea8`; birim test 135/135; verify.sh VERIFY OK (13 e2e; tema/alt bar/odak modu onboarding e2e'de, bölünmüş ayarlar su/push/sosyal e2e'de); release `2026-11-05T08-26-24-019Z` RELEASE OK; canlıda 0013 uygulandı (su ayarları `ring`), yeni rotalar oturumsuz girişe yönlendirir, iki temada canlı ekran kontrolü, logda hata yok; 8 test kullanıcısı silindi |
| 5d | Kullanıcı düzeltmeleri (Bugün sıkılaştırma, Fit araçları ayrı sayfalar, geri düğmesi geldiği yere, kaydırarak kapanan alt pencereler, program oluşturma akışı, kardiyo, canlı antrenman, gün seçimi, hareket filtreleri + kendi hareket fotoğrafı) + dış inceleme (8 taşma, 23 UX gözlemi) | tamamlandı | commit `e474925`; birim test 135/135; verify.sh VERIFY OK (13 e2e; yeni `ux.e2e.cjs`: aşağı çekince kapanma, geri = geldiği sayfa, hedef/aktivite düzenleme, gün silme, şablon inceleme, 9 sayfada 320 px taşma yok); release `2026-11-05T14-37-46-231Z` RELEASE OK (canlı ux/fit/fitness/food/onboarding/progress/water e2e), logda hata yok, 8 test kullanıcısı silindi |
| 5e | Geri bildirim sayfası, beyaz liste (kayıt onayı + davet kodu), yönetim panosu (yarı ekran özet + tıklanabilir kartlar), kullanıcı yönetimi (liste/arama/filtre, onay/red/askı, kişiye özel AI kotası, veri sıfırlama, hesap silme, oturum kapatma, not), geri bildirim yönetimi (yanıt + durum) | tamamlandı | commit `b318dfb`; birim test 139/139; verify.sh VERIFY OK (14 e2e; yeni `admin.e2e.cjs`: davetsiz kayıt bekler + sayfa/API kapalı, pano kartları, hızlı onay, geri bildirim + ekran görüntüsü + yanıt + rozet, kişiye özel AI kotası 0 → koçta 0 hak, veri sıfırlama → kurulum, askı → oturum kapanır, tek kullanımlık davet kodu, hesap silme, yönetici kendini silemez, 8 sayfada 320 px taşma yok); release `2026-11-05T15-56-01-796Z` RELEASE OK (canlı testler e2e davet koduyla); canlıda 0014 uygulandı (deneme, xpike approved), canlı kancasız kontrol: davetsiz kayıt `pending`, `/su` ve `/yonetim` → `/beklemede`, API 401; logda hata 0; 9 test kullanıcısı silindi |
| 5f | Kendi takviyem: tanımla (ad, marka, porsiyon birimi + miktar, porsiyon başına kalori/makro, ek içerikler, günlük hedef) → Yemek ekranında +/− ile porsiyon; toplamlar günlüğe, kafein/vitamin özeti ve üst sınır uyarısı; düzenle/sil | tamamlandı | commit `a49d70e` + kart düzeltmesi; birim test 144/144; verify.sh VERIFY OK (15 e2e; yeni `supplement.e2e.cjs`: tutarsız makro engeli, 3 takviye, +/− sayaç, 240 kcal/48 g günlüğe, öğün listesine karışmaz, günlük hedef 1/1, 500 mg kafein uyarısı ve geri alınca kalkması, düzenle/sil, besin aramasında yok, 320 px); ilk canlı denemede uyarı sunucu yenilemesine bağlıydı → istemcide hesaplanır; release `2026-11-05T16-41-25-230Z` RELEASE OK (canlı takviye e2e dahil); AI düzeltmesiyle release `2026-11-05T16-53-04-791Z` RELEASE OK, logda hata 0, test kullanıcıları silindi |
| 5g | Yemek günlük özet görseli: sağ üstte Kaydet → A koyu kart / B açık hikâye → PNG indir ya da paylaş (kalori, makro, öğünler, mikro besin referansları, takviye, su) | tamamlandı | commit `b2a020b`; birim test 146/146; verify.sh VERIFY OK (15 e2e; takviye e2e'de: Mercimek çorbası + takviyelerle iki önizleme 1080 px, PNG 1080×1350 / 1080×1920, indirilen dosya adı, oturumsuz 401); paketleme hatası (public/public → sw.js 404) yerelde yakalanıp düzeltildi; release `2026-11-05T17-15-35-938Z` RELEASE OK, canlıda sw.js/manifest 200, görsel oturumsuz 401, logda hata 0, 9 test kullanıcısı silindi |
| 5h | Ağırsağlam lisanslı içerik (izin: team@lightweightapp.com, 2026-11-06): 5h-1 hareket verisi + videolar + kaynak notu; 5h-2 anatomi haritası; 5h-3 program günü + canlı antrenman tasarımı; 5h-4 ücretsiz programlar + süperset; 5h-5 MSS seans yükü (kendi algoritma); 5h-6 plakalar + rekor denemesi (kendi algoritma) | tamamlandı (5h-1 veri+video, 5h-2 kas haritası, 5h-3 program/antrenman ekranları, 5h-4 ücretsiz programlar + süperset, 5h-5 MSS seans yükü, 5h-6 plakalar + rekor denemesi) | 5h-1: commit `9f9a34a`; verify.sh VERIFY OK (149 birim, 16 e2e, paketle); paket tek seferlik deploy `2026-11-05T22-41-16-200Z` ile taşındı → `/opt/dgfit-pwa/licensed/agirsaglam`, yedek `backups/licensed-agirsaglam-pack.tgz`; compose'a `./licensed:/licensed:ro` + `DGFIT_LICENSED_DIR` (yedek alındı); 698/698 video indirildi (380 MB); canlı içe aktarma 45 eşleşen + 305 yeni (sürüm 0b9db695aa55); release `2026-11-05T22-43-48-661Z` (lisanslı e2e'de yol dışı denemesi Caddy'de 403 → test 403/404 kabul edecek şekilde düzeltildi, canlıda tekrar: LİSANSLI E2E OK); oturumsuz video 401; logda hata 0; 11 test kullanıcısı silindi; 5h-3: commit `9d749db`; verify.sh VERIFY OK (151 birim, 17 e2e; anatomi e2e'de program satırı → Antrenmana Başla → şerit, Video, RiR 2,5 kaydırıcı + paket metni, Tarih penceresinde `20×10 @2,5`); release `2026-11-05T23-22-22-474Z` RELEASE OK; canlıda `workout_sets.rir` = real, şeritte lisanslı küçük resim görüldü, logda hata 0, 11 test kullanıcısı silindi; 5h-4: commit `b9fd4ca`; verify.sh VERIFY OK (157 birim, 18 e2e; ilk çalıştırmada FIT e2e check-in durum mesajı zaman aşımı → tek başına 2/2 geçti, tam verify yeniden VERIFY OK); release `2026-11-05T23-49-37-793Z` RELEASE OK (canlı AG PROGRAM E2E: 35 program, Tek antrenman süzgeci, süpersetli program → editör blokları → canlıda tur içinde dinlenmesiz geçiş + tur sonu dinlenme → boz/bağla); canlıda `program_exercises.superset/note` var, logda hata 0, 12 test kullanıcısı silindi; 5h-5 (MSS): commit `4ea4eca`; verify.sh VERIFY OK (162 birim, 18 e2e; anatomi e2e'de özet MSS kartı lisanslı puanla, tahminsiz + istatistikte haftalık satır; fitness e2e'de kart); release `2026-11-06T00-04-08-038Z` RELEASE OK; logda hata 0; 12 test kullanıcısı silindi; 5h-6: commit `135b110`; verify.sh VERIFY OK (165 birim, 19 e2e; yeni `pr.e2e.cjs`: 100 kg → 25+15 plaka, ağır ısınmada soru, açılış 95 → 100 → hafif → 105, yenilemede sürer, en iyi 100, Günlüğe ekle → özet; canlı plaka hesaplayıcı 60 kg → 20); ilk tam verify'da fitness e2e eski plaka metnini arıyordu → `data-plates` ile düzeltildi; release `2026-11-06T00-27-40-968Z` RELEASE OK (canlı REKOR E2E OK, plaka görselleri yüklendi, oturumsuz plaka 401); logda hata 0; 13 test kullanıcısı silindi |
| GB3 | Geri bildirim 3 (2026-11-07): gün önizleme, İptal, 16:9 şerit, kas haritası hız/yazı, ✓/✗; Türkçe ekli yemek araması + 300 Türk yemeği; topluluk barkodu + bulunamayan barkodlar; yönetimde sekmeler + son işlemler; performans (WebP anatomi, akış sanallaştırma, SW önyükleme, ısındırma) | tamamlandı | main `43fa609`; verify.sh VERIFY OK (170 birim, 22 e2e); release `2026-11-06T21-15-56-993Z` RELEASE OK; canlıda 0021 + foods dgfit 300; logda hata 0; 11 test kullanıcısı silindi |
| 6 | Mağaza sürümü ve cihazlar (isteğe bağlı) | planlandı (beklemede) | — |

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

## Faz 2a kapsamı ve kabul kriterleri (tamamlandı)

Kaynak: spesifikasyon bölüm 6 (Yemek). Veri kaynağı kararı DECISIONS.md'de (TURKOMP kullanılmıyor).

- [x] Besin verisi (commit `5525b9b`): USDA SR Legacy (CC0) içe aktarma betiği → `foods` + `food_portions`; makro + lif, şeker, doymuş yağ, sodyum, su; Türkçe adlar (küratörlü liste) + İngilizce arama yedeği
- [x] Türk yemekleri (36 tarif, commit `5525b9b`): malzeme gramajlarıyla tarif → besin değerleri USDA malzemelerinden HESAPLANIR (elle yazılmaz), "hesaplanmış" etiketi; birim testi toplamları doğrular
- [x] Arama: Türkçe karakter duyarsız, yazım hatasına dayanıklı (trigram), son kullanılan ve sık yenenler üstte
- [x] Öğün kaydı: kahvaltı/öğle/akşam/ara; porsiyon birimleri (g, adet, dilim, su bardağı, yemek kaşığı, porsiyon); kayıt anında kalan bütçe etkisi; düzenle/sil/taşı; geçmiş güne kayıt
- [x] Barkod: kamera ile okuma (BarcodeDetector varsa, yoksa ZXing) + elle giriş; Open Food Facts'ten çekip önbelleğe alma, "© Open Food Facts katkıcıları" atfı; bulunamazsa özel ürün ekleme
- [x] Özel besin ve tarif: kullanıcı kendi besinini/tarifini ekler; pişmiş ağırlık ile porsiyon hesabı
- [x] Hızlı işlemler: dünkü öğünü kopyala, kayıtlı öğün, hızlı kalori
- [x] Entegrasyon: `meal.logged` olayı; Bugün ekranı yenen kalori/makro gerçek veri; yemekten gelen su (çorba, ayran) isteğe bağlı Su'ya
- [x] Testler (birim + e2e) + verify.sh + canlı e2e + hafıza

## Faz 2b kapsamı ve kabul kriterleri (tamamlandı)

Kaynak: spesifikasyon bölüm 5 (Fit).

- [x] Saf motor `lib/fit.ts` (testli): fark dağıtımı (7 gün penceresi, azalan ağırlık, günlük tavan ±%10 / ±250 kcal, kalori tabanı, taşma + kalan), istisna günü (dağıtmak yerine hedef tarihe en fazla 3 gün), kalori bankası (önceki günlerden biriktir, etkinlik günü harca), eksik kayıt kuralı, makro ölçekleme, adaptif TDEE (trend kilo + alınan kalori, güven), hedef tarih tahmini, check-in önerisi (haftalık değişim sınırı)
- [x] Veri: `kcal_adjustments` tablosu, `daily_targets` kapanış anlık görüntüsü (yenen, hedef, fark); günün hedefi = plan tabanı + düzeltmeler
- [x] Gün kapanışı: zamanlayıcı her gece 03.00 sonrası dünü kapatır; "Günü kapat" düğmesi; kapanmamış geçmiş günler (en fazla 7) toparlanır
- [x] Plan ekranı `/fit`: yol haritası grafiği (plan, trend, tartılar, tahmin), istatistikler, önümüzdeki 7 günün hedefleri ve düzeltme gerekçesi, dengeleme kartı + "istisna say", kalori bankası oluştur/iptal, haftalık check-in (öner/uygula), tartı kaydı
- [x] Entegrasyon: Bugün ve Yemek ekranlarında hedef = düzeltilmiş günlük hedef + açıklama; hafta halkaları su + kalori uyumu; `day.closed` olayı
- [x] Testler + verify.sh + canlı e2e + hafıza

## Faz 3a kapsamı ve kabul kriterleri (tamamlandı)

Kaynak: spesifikasyon bölüm 4 (Fitness) ve bölüm 9 (entegrasyon tablosu).

- [x] Hareket verisi: free-exercise-db (876 hareket, kamu malı/Unlicense) içe aktarılır; Türkçe ad, kas, ekipman, tip, zorluk; en sık kullanılan **93** harekette Türkçe teknik adımlar + sık hatalar (kalan 783'te teknik metni yok, 3b); görseller sunucuda barındırılır (dış sitelere bağlantı yok)
- [x] Kütüphane ekranı: arama (Türkçe/İngilizce, yazım hatasına dayanıklı), kas grubu / ekipman / hareket tipi / zorluk filtreleri, hareket detayı (görsel, kaslar, teknik); kullanıcının özel hareketi
- [x] Hareket tipleri: ağırlık × tekrar, vücut ağırlığı + ek yük, destekli, süre, mesafe + süre
- [x] Saf motor `lib/training.ts` (testli): e1RM (Epley, tekrar + RIR), sonraki ağırlık önerisi (hedef tekrar/RIR, plaka artışına yuvarlama), çift aşamalı ilerleme, yorgunluk algılama (2 antrenman üst üste e1RM %3+ düşüş → sabit tut), ilk 2 kayıtta düşük güven, büyük kalori açığında temkinli öneri, ağrı notunda temkin, plaka hesaplayıcı, ısınma setleri (%40/%60/%80), hacim, PR tespiti (en ağır, e1RM, 3/5/10RM, seans hacmi, en çok tekrar), kalori (MET × kg × saat)
- [x] Program oluşturucu: boş program, hazır şablonlar (Full Body, Upper/Lower, Push/Pull/Legs, Bro Split, GZCLP basitleştirilmiş; **5/3/1 3b'ye ertelendi**: yüzdelik TM şeması periyodizasyonla birlikte), kural tabanlı otomatik program (deneyim, gün sayısı, ekipman, hedef); gün → hareket → set hedefleri (tekrar aralığı, RIR, dinlenme, set tipi); kopyalama
- [x] Canlı antrenman: geçen seferin değerleri, tek dokunuşla aynısı / öneriyi kabul, büyük sayı tuşları ve +/−, set tipleri, otomatik dinlenme sayacı (titreşim + ses + bildirim), plaka ve ısınma hesaplayıcı, canlı süre/hacim/set/kalori, not + ağrı işareti, Wake Lock, çevrimdışı kayıt (yerel taslak + kuyruk; sayfa açıkken bağlantı koparsa çalışır, çevrimdışı sayfa yenileme yok); dinlenme bildirimi yalnızca sayfa canlıyken (kilit ekranında güvenilir değil, 3b), öneriyi reddetme nedeni
- [x] Antrenman özeti: süre, hacim, kırılan PR'lar + kutlama, kas grubu dağılımı, önceki aynı günle kıyas ("Sosyalde paylaş" Faz 5)
- [x] Kardiyo: koşu/bisiklet/yürüyüş/yüzme/HIIT/ip atlama; süre, mesafe, nabız; MET ile kalori
- [x] Entegrasyon: `workout.finished` → gün kapanışında yakılan kalori kredisi (Fit) + o gün su hedefi +500 ml/saat (Su) + antrenman sonrası protein önerisi (Yemek); `pr.achieved` olayı; Bugün ekranında antrenman kartı; büyük kalori açığı önerileri temkinli yapar
- [x] Testler (birim + e2e) + verify.sh + canlı e2e + hafıza

Kanıt: e2e `tests/e2e/fitness.e2e.cjs` — program üretimi (3 gün, Full Body), set düzenleme, boş ağırlık koruması, 4×60×10 + 3×40×8 = 3.360 kg hacim, plaka 100 kg = 25 + 15, sayfa yenilemede taslak, ikinci seansta öneriler (`lib/training.ts` ile hesaplanan değer = ekrandaki), bench rekorları, önceki günle kıyas, kardiyo net kcal (ACSM), Bugün egzersiz kredisi + antrenman kartı, su hedefi +250–400 ml, Yemek protein önerisi, kütüphane arama/filtre/detay, özel hareket, çevrimdışı bitir → kuyruk → gönderim.

## Faz 3b kapsamı ve kabul kriterleri (tamamlandı)

Kaynak: spesifikasyon 4.1, 4.2, 4.4, 4.5, 9 ve 3a'dan devredilenler.

- [x] Saf fonksiyonlar (testli): plato tespiti (3+ hafta e1RM ilerlemesi yok → varyasyon / tekrar aralığı / hacim önerisi), alternatif hareket (aynı kas + tip, farklı ekipman), kuvvet standartları (e1RM / vücut ağırlığı, cinsiyete göre 4 seviye — DgFit yaklaşık rehberi, kaynaklı değilse açıkça belirtilir), kas başına haftalık set (10–20 bandı), kas toparlanma durumu (yeşil/sarı/kırmızı), periyodizasyon (lineer, DUP, blok) ve otomatik deload haftası, yüzdelik şemalar: **GZCLP tam** (kaynak: saynotobroscience.com/gzclp-infographic; kaynakta olmayan T1 sıfırlama %85 ve T2 dönüşü DgFit seçimi); **5/3/1 ve nSuns YAPILMADI** — birincil kaynaklara erişilemedi (t-nation 404, Reddit engelli), yüzdeler ezberden yazılmadı
- [x] İstatistik ekranı: hareket bazında e1RM eğrisi, haftalık hacim, kas başına haftalık set, antrenman sıklığı takvimi, kas ısı haritası (son 7 gün + toparlanma)
- [x] Hareket detayı: e1RM grafiği, plato uyarısı, kuvvet seviyesi, alternatifler
- [x] Vücut ölçüleri (bel, göğüs, kalça, kol, uyluk vb.) + ilerleme fotoğrafları: yalnızca sahibine, sunucuda şifreli saklama (AES-256-GCM), yan yana kıyas
- [x] Özel harekete fotoğraf (e2e kapsamında değil; ilerleme fotoğrafıyla aynı şifreli yol)
- [x] Program: periyodizasyon seçimi (lineer/DUP/blok) + deload sıklığı; canlı modda deload/DUP/blok hedefleri; GZCLP şablonu kademeli (5/3/1, nSuns yok — yukarıya bak)
- [x] Canlı mod: alternatif hareketle değiştir ("istasyon dolu"), antrenman öncesi yakıt uyarısı (Yemek), plato bilgisi
- [x] Kilit ekranında dinlenme bildirimi: sunucudan zamanlı Web Push (abonelik varsa). **Gerçek cihazda teslim denenmedi**; e2e yalnızca ucu doğruladı (abonelik yoksa planlanmaz, oturumsuz 401)
- [x] Çevrimdışı: canlı antrenman sayfası service worker önbelleğinden açılır
- [x] Türkçe: kalan 783 hareketin adı + 3–5 kısa adım (kullanıcı "kısa özet" seçti; kaynak talimatın özeti, builder doğrular; 4 harekette kaynakta talimat yok)
- [x] Testler (birim + e2e) + verify.sh + canlı e2e + hafıza

E2E kanıtı `tests/e2e/progress.e2e.cjs`: e1RM grafiği 6 seans, plato haftası ve kuvvet seviyesi `lib/progress.ts` ile hesaplanan değere eşit, alternatifler, takvim, ısı haritası, kas başına set, toparlanma "Dinlendir", ölçü farkı Bel −2, iki fotoğraf + kıyas, başka kullanıcı 404 / oturumsuz 401, GZCLP 100 → 105 kg → 6×2, DUP hafif gün hedefi, canlı modda alternatif, çevrimdışı yeniden yüklemede canlı sayfa + taslak, dinlenme ucu. Yakıt uyarısı ve canlı plato notu e2e'de tetiklenmedi (birim testli fonksiyonlar).

## Faz 4a kapsamı ve kabul kriterleri (tamamlandı, gerçek sağlayıcı denemesi bekliyor)

Kaynak: spesifikasyon bölüm 10; kullanıcı kararları 2026-11-05: Claude'da her yerde Haiku (`claude-haiku-5-5`), limit dolunca OpenAI'ye geçiş (üçüncü sağlayıcı "Evren" bilgi gelince), anahtarlar uygulamadaki yönetici sayfasından.

- [x] Sağlayıcı katmanı: tek arayüz (metin + görsel → doğrulanmış JSON), Claude resmi SDK, OpenAI resmi SDK (model ve çağrı biçimi resmi belgeden), sıra + otomatik geçiş (kota/limit/sunucu hatasında sonrakine), sağlayıcı başına günlük/aylık bütçe (token), kullanıcı başına günlük adil kullanım kotası, aynı isteğe önbellek
- [x] Yönetici AI ayarları (`DGFIT_ADMINS`): anahtarlar şifreli (AES-256-GCM) DB'de, ekranda yalnızca son 4 karakter, sıra, model, limitler, kullanım ve son hatalar; anahtar sohbete/depoya girmez
- [x] Yemek fotoğrafı: görü modeli besinleri + tahmini gramı çıkarır → besin veritabanıyla eşleşir → kalori/makro motor hesaplar → kullanıcı onaylar/düzeltir → öğüne eklenir
- [x] Sesli/yazılı öğün kaydı: konuşma tanıma (tarayıcı) ya da yazı → dil modeli kalemleri ayırır → aynı eşleşme ve onay akışı; içecekler Su'ya da düşer
- [x] Etiket okuma (OCR): besin değeri tablosu fotoğrafından 100 g değerleri + ad → özel besin formunu doldurur, kullanıcı onaylar
- [x] Sınırlar: tıbbi tavsiye yok; kullanıcı verisi yalnızca o isteğe; AI kapalı/kota dolu durumunda net mesaj ve manuel yol
- [x] Testler: birim (ayrıştırma, eşleşme, geçiş, kota) + e2e (sahte Claude ve OpenAI sunucusu; Claude kota hatası → OpenAI'ye geçiş) + verify.sh + canlı e2e + hafıza

Kanıt `tests/e2e/ai.e2e.cjs` (sahte sunucular :3190/:3191): anahtar yokken AI gizli; yönetici olmayana 404; anahtar yalnızca ••••son4; fotoğrafla 3 kalem → kalori = veritabanı 100 g × gram (çorba, simit); ayran Su'ya `effectiveMl`; etiket porsiyon (40 g) → 100 g (kcal 400, sodyum 200 mg); Claude isteği: Haiku 5.5, `output_config.format.json_schema`, base64 görsel, anahtar tek kimlik; Claude 429 → OpenAI (gpt-6-luna, `text.format` json_schema strict); yöneticide hata + bekleme; aynı metin önbellekten (sağlayıcıya gitmez); günlük hak 3 → 4. istek reddedildi.
**Karma model eki (2026-11-05):** commit `368883d`; verify.sh VERIFY OK (AI e2e: fotoğraf ve etiket `claude-opus-5-5` + `fallbacks: default` + `anthropic-beta: server-side-fallback-2026-07-01`; yazı `claude-haiku-5-5` yedeksiz; yöneticide maliyet tablosu ve görev modelleri); release deploy `2026-11-05T02-34-13-285Z` RELEASE OK; canlıda `ai_calls.model` sütunu var, `ai_providers` satırı henüz yok (ilk yönetici ziyaretinde Opus varsayılanlarıyla oluşur); 7 test kullanıcısı silindi.
**Açık:** gerçek API'lerle hiç denenmedi; ilk gerçek kullanımda Opus 5.5 (beta yedekli) ve Haiku 5.5'in `output_config.format` + `effort: low` kabulü ve gpt-6-luna'nın görsel + strict şema kabulü doğrulanmalı.

## Faz 4b kapsamı ve kabul kriterleri (tamamlandı, gerçek sağlayıcı denemesi bekliyor)

Kaynak: spesifikasyon 10 (AI Koç, Sınırlar), 5.6 (haftalık rapor, davranış analizi, "pizza yersem" sohbeti), 7.4 (haftalık su raporu, koça soru), 13 (yeme bozukluğu koruması), 11.5 (kota yalnızca fotoğraf/ses ve koç sohbetinde). Menü/tarif/program oluşturucu 4c'ye ayrıldı (DECISIONS).

- [x] Koç sohbeti `/koc`: tüm modüllerden motorların hesapladığı özet bağlam (profil, hedef, bugünkü bütçe, son 7 gün kalori/makro uyumu, kilo trendi + adaptif TDEE, su, antrenman, PR, program); son 10 mesaj; kişilik destekleyici / disiplinli / bilimsel; sesle soru; sohbeti silme; kullanıcı günlük AI hakkına sayılır
- [x] Onaylı eylemler (koç önerir, kullanıcı onaylar, sunucu doğrular + sahiplik): hedef tarihini N hafta uzat/kısalt (kısaltma `computePlan` güvenli değilse ya da güvenlik bayrağı varsa reddedilir), aktif programın bir gününe hareket ekle (ad → kütüphane eşleşmesi onaydan önce gösterilir), su ekle
- [x] "Ne olur" kartı: koç besin adı + gram verir, kalori besin veritabanından, kalan bütçe ve fark dağıtımı Fit motorundan (`distributeDiff`) hesaplanır; dil modeli sayı yazmaz
- [x] Günlük proaktif içgörü: kural motoru adayları (`lib/insights.ts`, saf, testli) → dil modeli kişiliğe göre ifade eder (AI yoksa kural metni) → günde en fazla 1, Bugün'de tek kart, kapatılabilir, "Koça sor"; son 7 günde aynı konu tekrarlanmaz
- [x] Haftalık rapor `/rapor`: motor istatistikleri (`lib/weekly.ts`, saf, testli: ortalama kalori, hedef uyumu, protein uyumu, en zor günler, hafta sonu/hafta içi farkı, trend kilo değişimi, su ortalaması + hedef günleri, antrenman sayısı/hacim, PR) + dil modeli özet ve en fazla 3 öneri; Pazar 18.00'den sonra hazır; Pazar 19.00 sonrası haftada bir push; geçmiş raporlar
- [x] Sınırlar (`lib/safety.ts`, saf, testli): tekrarlayan çok düşük kalori günleri ve aşırı antrenman bayrakları → Bugün'de nazik destek kartı (uzmana yönlendirme, acilde 112), koç bağlamında bayrak, hedef kısaltma engeli; sohbette riskli ifade (sunucu anahtar kelime + model bayrağı) → destek kartı; tıbbi teşhis/tedavi yok
- [x] Testler: birim (içgörü seçimi, haftalık istatistik, güvenlik bayrakları, koç şemaları) + e2e (sahte sağlayıcıyla sohbet, eylem onayı, ne olur kartı, içgörü kartı, rapor, güvenlik kartı, kota) + verify.sh + canlı e2e + hafıza

Kanıt `tests/e2e/coach.e2e.cjs` (sahte Claude :3190, OpenAI 503): veri yokken "start" içgörüsü AI'sız ve kapatılabilir; 3 gün 600 kcal → Bugün'de "Kendine nazik ol" destek kartı; koç isteği Haiku 5.5, bağlamda BAĞLAM + taban 1200 + düşük kalori bayrağı + aktif program + kişilik + kurallar; ikinci mesajda geçmiş 3 mesaj; pizza 300 g kalorisi = veritabanı 100 g × 3, kalan bütçe önce − kcal = sonra; hedef +2 hafta onayla → Bugün'de tarih değişti; −2 hafta güvenlik bayrağıyla reddedildi; Plank programın ilk gününe eklendi; 300 ml su eklendi; "kusuyorum" → destek kartı, model eylem/ne olur önerse de kaldırıldı, modele uyarı gitti; kişilik disiplinli sonraki isteğe yansıdı; kalan hak = başlangıç − koç çağrısı; 9 gün önceki haftanın raporu AI özetiyle, yeniden açılışta yeniden üretilmedi; sohbet silindi; ikinci kullanıcıda "kayıt boşluğu" içgörüsü AI ifadesiyle (sayı denetiminden geçti).
**Açık:** gerçek modellerle denenmedi; gerçek push teslimi (Pazar 19.00) cihazda denenmeli; besin araması "pizza" için USDA'daki "Pizza rolls" kaydını buluyor (arama kalitesi, ne olur kartını etkiler).

## Faz 4c kapsamı ve kabul kriterleri (tamamlandı, gerçek sağlayıcı denemesi bekliyor)

Kaynak: spesifikasyon 6.4 (AI haftalık menü, alışveriş listesi, meal prep, elimdekiler, restoran modu), 4.2 (AI program oluşturucu), 5.6 (senaryo simülatörü, karb döngüsü), 10 (koç "yarının menüsünü hazırla", menü/program = dil modeli + veritabanı/kurallar).

- [x] AI menü (1 ya da 7 gün): Fit'in günlük kalori/protein hedefleri, beslenme tercihi, alerjiler, bütçe düzeyi → dil modeli DgFit Türkçe besin kataloğundan ad + gram önerir → veritabanı eşleşmesi → motor (`lib/menu.ts`) günü hedef kaloriye ölçekler; kalori/makro motordan; öğünü tek dokunuşla günlüğe ekleme
- [x] Alışveriş listesi: menüden, yemekler tarif malzemelerine açılır, reyonlara göre gruplanır, işaretlenebilir; isteğe bağlı toplu hazırlık (meal prep) adımları
- [x] "Elimde bunlar var": malzemeler (yazı/ses) → en fazla 3 tarif → malzemeler veritabanından, porsiyon bugünkü kalan bütçeye ölçeklenir → günlüğe ekleme
- [x] Restoran modu: menü fotoğrafı (görü modeli) → yemekler + tahmini porsiyon → veritabanı kalorisi → motor kalan bütçeye en uygun 3 seçeneği sıralar → günlüğe ekleme
- [x] AI program oluşturucu: deneyim, gün, seans süresi, ekipman, hedef, zayıf kas grupları → dil modeli kütüphaneden hareket seçer → kural motoru (`lib/ai-program.ts`) set/tekrar/RIR/dinlenme sınırlarını, seans başına hareket sayısını, haftalık kas başına seti denetler → program olarak kaydedilir
- [x] Senaryo simülatörü (`lib/scenario.ts`, saf): ek kardiyo (tür × dk × gün/hafta, MET) ve günlük kalori değişikliği → yeni haftalık tempo ve tahmini hedef tarihi, güvenlik uyarısı
- [x] Karb döngüsü: antrenman günlerinde karbonhidrat +X g, dinlenme günlerinde haftalık toplam korunacak şekilde azalır (saf fonksiyon, açık günlerin hedeflerine uygulanır)
- [x] Koç eylemi "yarının menüsünü hazırla" (onayla → 1 günlük menü)
- [x] Testler: birim (ölçekleme, alışveriş birleştirme, sıralama, program denetimi, simülatör, karb döngüsü) + e2e (sahte sağlayıcıyla menü, alışveriş, elimdekiler, restoran, AI program, simülatör, karb döngüsü, koç menü eylemi) + verify.sh + canlı e2e + hafıza

Kanıt `tests/e2e/planner.e2e.cjs` (sahte Claude :3190): yönetici restoran görevi varsayılan Opus; menü isteği günlük hedefler + KATALOG + alerji (fıstık) + bütçe içerir; 7 gün sekmesi; menemen kalorisi = veritabanı 100 g × ölçeklenmiş gram (250 g değil); eşleşmeyen kalem işaretli; hedeften sapma uyarısı; toplu hazırlık adımları; kahvaltı günlüğe eklendi; alışveriş listesinde menemen yerine yumurta (tarif malzemesi) Süt ürünleri reyonunda, Manav reyonu var, işaret yeniden yüklemede kalıcı; elimdekiler porsiyonu günlüğe eklendi; restoran isteği Opus + görsel, 3 öneri + 4 yemek, ekleme; AI program 4 gün döndü → 3 gün, "Uçan halı" çıkarıldı ve notta, yeni başlayanda set ≤ 4; simülatörde haftada 3 koşu → daha erken tarih; karb döngüsü Bugün karbonhidrat hedefini değiştirdi; koç "yarının menüsü" onayla → 1 günlük menü, önceki 7 günlük arşivlendi.
**Açık:** gerçek modellerle denenmedi; katalog dışı adlar ("pizza" gibi) USDA aramasına düşer ve zayıf eşleşebilir.

## Faz 5a kapsamı ve kabul kriterleri (tamamlandı)

Kaynak: spesifikasyon 8.1–8.3, 8.5 (bildirim tercihleri), 8.6, 9 (Sosyal sütunu), 10 (içerik moderasyonu), 13. İlke: varsayılan olarak her şey özel; kilo/vücut verisi asla otomatik gösterilmez; konum paylaşılmaz.

- [x] Profil: avatar (şifreli medya), biyografi, salon, hedef rozeti (Fit hedefinden), görünürlük herkese açık / yalnızca arkadaşlar / gizli; öğe bazında görünürlük (PR, istatistik, antrenman, öğün, su, fotoğraf) varsayılan kapalı
- [x] PR vitrini (seçilen en fazla 6 hareket: en iyi kg/e1RM, tarihçe, mini grafik) ve istatistik kartları (toplam antrenman, toplam kg, en uzun antrenman serisi, su serisi, rozetler) — yalnızca izin verilen izleyiciye
- [x] Arkadaşlık (istek/onay/ret/çıkar) ve tek yönlü takip (yalnızca açık profiller); kullanıcı adıyla arama; davet linki + QR; arkadaş önerileri (ortak arkadaş, aynı salon, benzer hedef); yakın arkadaş işareti
- [x] Gönderiler: serbest (yazı + en fazla 4 fotoğraf), antrenman özeti (hareketler, setler, hacim; "Bu antrenmanı kopyala"), PR, tarif ("Tariflerime kaydet", "Öğün olarak ekle"), öğün, su serisi, kilometre taşı (yalnızca değişim, "−6 kg"), ilerleme fotoğrafı (yalnızca seçilen arkadaşlar); kitle herkese açık / arkadaşlar / seçilenler
- [x] Akış: önerilen (yakın arkadaş + yeni başarılar öne, saf sıralama fonksiyonu) ve kronolojik; tepkiler (💪 🔥 👏 🏆), yorumlar, kaydetme; engellenen/sessize alınan yazar görünmez
- [x] Güvenlik: engelle, sessize al, şikayet; moderasyon = kural (taciz, zararlı diyet içeriği, yeme bozukluğu işaretinde gönderi gizli + yazara destek) + AI (metin + görsel; AI yoksa fotoğraflı gönderi onaya düşer); yönetici moderasyon sayfası
- [x] Bildirimler: uygulama içi liste + push (arkadaşlık isteği/kabul, tepki, yorum), tür bazında açma/kapama
- [x] Modül entegrasyonu: antrenman özeti ve PR ekranında "Paylaş", tarif ve su serisi paylaşımı, Fit'te kilometre taşı paylaşımı
- [x] Testler: birim (görünürlük kuralları, akış sıralaması, öneriler, moderasyon kuralları) + e2e (iki-üç kullanıcı: arkadaşlık, gizlilik, gönderi türleri, etkileşim, engelleme, şikayet, moderasyon) + verify.sh + canlı e2e + hafıza

Kanıt `tests/e2e/social.e2e.cjs` (A yönetici, B, C): davet linki + QR; gizli C aramada yok; B istek → A bildirim (1) → kabul → B kabul bildirimi; yabancı C yalnızca temel profil, vitrin yok; B vitrinde Squat 120 kg, istatistik, "Kilo veriyor" rozeti, biyografi; antrenman gönderisi (sunucu anlık görüntüsü) → B tepki + yorum + "Bu antrenmanı kopyala" (programda squat) → A'ya tepki/yorum bildirimi; tarif gönderisi → B kaydet + öğün olarak ekle (250 g × 1,2 = 300 kcal); fotoğraflı gönderi AI moderasyonuna gitti, fotoğraf arkadaşa 200, yabancıya 404, gönderi yabancıya 404; seçilen kitle; A herkese açık → C takip → yalnızca herkese açık gönderi, arkadaş/seçilen gönderi ve vitrin görünmez; hakaret → beklemede (arkadaşa 404); AI engeli → gizli; "kusuyorum" → destek kartı; C şikayeti yönetici kuyruğunda, yönetici bekleyeni gizledi; gizli profil yabancıya 404; C, A'yı engelledi → takip düştü, gönderi 404, engelleyene "Bu kişiyi engelledin", engellenene 404.
**Açık:** push bildirimlerinin cihazda teslimi denenmedi; avatar arkadaş önerilerinde gösterilmiyor (baş harf).

## Faz 5b kapsamı ve kabul kriterleri (tamamlandı)

Kaynak: spesifikasyon 8.2 (antrenman partneri), 8.3 (24 saatlik kartlar, paylaşma), 8.4 (meydan okumalar, gruplar, adil sıralama, düello), 8.5 (mesaj, dürtme, bildirim tercihi), 8.6 (PR doğrulama), 9 (su kaydı → meydan okuma puanı).

- [x] Meydan okumalar: hazır şablonlar ("30 gün 2,5 litre su", "Ayda 16 antrenman", "Haftalık en çok hacim", "7 gün protein hedefi") + özel (ölçüt, hedef, süre); arkadaş davet/katılım/ayrılma; ilerleme ve sıralama motorla gerçek kayıtlardan (saf fonksiyon)
- [x] Düello: bire bir haftalık meydan okuma (antrenman sayısı / hacim / su günü), davet + kabul, sonuç
- [x] Gruplar: oluşturma, arkadaş davet/kabul, ayrılma, sahibin çıkarması; grup sohbeti (kural moderasyonu); grup sıralaması (DOTS kuvvet puanı, tutarlılık puanı) — yalnızca "sıralamada görün" diyen üyeler; vücut ağırlığı gösterilmez
- [x] Adil sıralama: DOTS (katsayılar kaynaktan doğrulanır), tutarlılık puanı (haftalık antrenman hedefinin son 4 haftada karşılanma oranı)
- [x] PR doğrulama: şüpheli rekor (7 günde %30'dan fazla artış ya da vücut ağırlığına göre olağandışı) işaretlenir ve sıralamaya girmez; 2 arkadaş tanıklığı ya da kanıt fotoğrafı + yönetici onayıyla doğrulanır
- [x] Birebir mesaj (yalnızca arkadaşlar), gönderi paylaşımı mesajla, okunmamış sayısı, push; uygunsuz mesaj işaretli gösterilir
- [x] Dürtme: "Bugün su içtin mi?" / "Antrenman zamanı" (çift başına tür başına günde 1, kişi başına günde 10), bildirim tercihi
- [x] Antrenman partneri: karşılıklı işaret → partnerin antrenmanı bitince bildirim (antrenman öğesi kapalıysa yok), partnerin aktif programını kopyalama
- [x] 24 saatlik "Bugün salondaydım" kartları (bugünkü antrenman özeti ve/veya fotoğraf), akışın üstünde şerit, 24 saat sonra görünmez
- [x] Testler: birim (DOTS, tutarlılık, meydan okuma ilerleme/sıralama, şüpheli PR, dürtme sınırı) + e2e (3 kullanıcı) + verify.sh + canlı kontrol + hafıza

Kanıt `tests/e2e/social2.e2e.cjs`: karşılıklı partner → B'nin gerçek kayıt yolundan antrenmanı (saveWorkout) A'ya `partner_workout` bildirimi, B partnerin aktif programını kopyaladı; 10 gün önce 60 kg → bugün 100 kg squat şüpheli işaretlendi; "Haftalık en çok hacim": A 1.800, B 1.500 (kayıtlardan), C reddetti → 404; düello "Rakip henüz katılmadı" → katılım → berabere; grup daveti/katılım, sohbet, uygunsuz mesaj gizli; sıralamaya katılmayan görünmez; A'nın DOTS'u test içinde `lib/social-rank.ts` ile hesaplanan değere eşit; B'nin şüpheli rekoru yerine önceki 70 e1RM kullanıldı, 2 tanıkla doğrulanınca 120 ile sıralandı ve B'ye bildirim gitti; DM + okunmamış sayısı; gönderi mesajla paylaşıldı; dürtme ikinci kez engellendi; 24 saatlik kart arkadaşta antrenman özetiyle göründü.
**Açık:** push teslimi cihazda denenmedi; PR kanıt fotoğrafının yönetici onayı e2e'de denenmedi (yönetici kuyruğu + onay kodu var); video Faz 6'da.

## Faz 5c kapsamı ve kabul kriterleri (tamamlandı)

Kaynak: kullanıcı incelemesi 2026-11-05 ("her şey karmakarışık; her düzenleme kendi sayfasını açsın; farklı modüllerde farklı renk paleti; dengeli koyu tema"), alt bar isteği ("ana ekran - fit - su - + - yemek - fitness - sosyal"), onaylanan ekran tasarımı (artifact `2smYSfpGdAX2739CrrjZ3v`, 41 ekran, "bire bir gösterdiğin gibi") ve tempo geri bildirimi ("kullanıcı kaç günde hedefliyorsa onu hedeflesin, güvenli değilse uyar; haftada 1,5 kg üstü kabul edilmez").

- [x] Kurulum temposu: güvenli olmayan süre seçilebilir (uyarı + önerilen süre düğmesi); yalnızca haftada 1,5 kg üstü (18 yaş altında önerilen sınır) engellenir; kalori tabanı korunur ve tahmini süre gösterilir; sunucu aynı kuralı uygular
- [x] Tema: açık, dengeli koyu, otomatik (sistem); Profil → Görünüm'den seçilir, ilk çizimde doğru tema (yanıp sönme yok)
- [x] Modül paletleri: Bugün yeşil, Fit turkuaz, Su mavi, Yemek turuncu, Fitness kırmızı-turuncu, Sosyal mor-mavi, Koç mor, Profil gri; vurgu rengi (düğme, seçili öğe, odak) bulunulan modülden gelir; makro renkleri sabit
- [x] Alt bar 7 yuva: Bugün · Fit · Su · ＋ · Yemek · Fitness · Sosyal; seçili sekme kendi renginde; canlı antrenmanda gizli
- [x] Sekme ana sayfalarında renkli özet bandı (halka + 3 değer); alt sayfalarda modül renginde geri düğmeli başlık
- [x] Ayarlar bölünür, her satır kendi sayfasını açar: Su (hedef, kaplar, hızlı butonlar ve yudum, hatırlatmalar), Profil (hesap, hedef ve plan, görünüm, bildirimler, gizlilik → sosyal, AI koç), Salon (ekipman, bar ve plakalar, artış ve dinlenme, seans süresi), Sosyal (profil bilgileri, gizlilik, profilde görünenler, bildirimler, davet); Su ekranındaki "Düzenle" doğrudan kaplar sayfasını açar
- [x] Testler: birim (tempo kuralları) + tüm e2e'ler yeni yapıya göre + iki temada ekran görüntüsü kontrolü + verify.sh + canlı e2e + hafıza

Kanıt: `tests/calc.test.ts` (ekran görüntüsündeki 70 gün / 1,2 kg/hf kilo alma kabul + uyarı; 50 gün / 1,68 kg/hf red, en kısa 56 gün; kalori tabanı + tahmini süre; 18 yaş altı), `tests/theme.test.ts`, onboarding e2e (30 gün güvensiz ama devam açık; 20 gün kapalı → "günü kullan"; 7 sekme sırası; su sayfasında `data-mod=water`; Açık/Koyu/Otomatik çerezle kalıcı, zemin rgb(243,244,246)/rgb(20,22,27); canlı antrenmanda alt bar yok), su e2e ("Düzenle" → `/su/ayarlar/kaplar`), sosyal e2e (menü → profil bilgileri; ayrı sayfada kaydetmek diğerini bozmaz).
**Açık:** Hesap ve kişisel bilgiler sayfası salt okunur (boy/aktivite düzenleme yok); hedef değiştirme akışı yok (Fit planı); alt sayfaların bir kısmında tasarımdaki alt başlık metni yok.

## Faz 5d kapsamı ve kabul kriterleri (tamamlandı)

Kaynak: kullanıcı mesajı 2026-11-05 (A–F maddeleri; G boş geldi) + `DGMFIT_AI_DEVIR` paketi (başka bir AI'ın 66 rota × 12 boyut görsel incelemesi; commit `45b274f`). Paketteki her bulgu koda/canlıya karşı doğrulanır; gerçek olmayanlar burada gerekçesiyle not edilir.

- [x] SP-01…08: 320 px'te taşan satırlar (tartı, AI günlük hak, kap hacmi, boş program, gün ekle, grup/yorum/mesaj gönder) taşmaz
- [x] ASSET-01: canlıda görseller 200 (doğrulandı: `Side_Bridge/0.jpg` 200 image/jpeg); yerel testte görsel yok → kırık simge yerine yer tutucu
- [x] A: Bugün tek ekrana yakın (kaydırmadan ana bilgiler)
- [x] B: Fit'te kalori bankası, haftalık check-in, senaryo simülatörü, karb döngüsü, önümüzdeki 7 gün düğme; her biri kendi sayfası ve açıklaması
- [x] C: Su kapları bölümü; geri düğmesi geldiği sayfaya döner (tüm alt sayfalar)
- [x] D: Alt pencereler tutamaçtan aşağı kaydırınca animasyonla kapanır, görünür kapat düğmesi (UX-07)
- [x] E: Yemek ekranlarında aynı sorunlar (geri, pencereler, boş durum eylemi UX-23, AI yok mesajı tutarlı UX-18)
- [x] F1: Program oluştur = 3 seçenek (Benim için oluştur · Hazır şablonlar · Boş program) ayrı sayfalar; ortam → ekipman açılır menüleri; şablon incelenebilir; programda hareket düzenle/sil ve gün sil görünür
- [x] F2: Kardiyo türü açılır menü, sayfa düzeni
- [x] F3: Canlı antrenman düzeni (set tablosu, önceki değer, set ekle, dinlenme çubuğu, hareket menüsü)
- [x] F4: Programdan istenen gün seçilerek başlanır
- [x] F5: Kas ısı haritası: amatör çizim kaldırılır; profesyonel görsel kullanıcıdan istenir (varlık tanımı verilir)
- [x] F6: Hareket filtreleri tek "Filtrele" penceresi; kaynak yazısı kaldırılır; kendi hareketine fotoğraf
- [x] UX gözlemleri: profil bilgisi ve hedef düzenleme (UX-03/04), alt bar 320 px (UX-08), bildirim satırları (UX-09), buton silme (UX-10), kurulumda sayı yazma (UX-11), Atla üstte (UX-12), aktivite açıklaması (UX-13), program detayında Başla üstte (UX-14), terim açıklamaları (UX-15), ölçü birimleri (UX-16), faz metni (UX-17), su ilk durum (UX-19), boş istatistik (UX-20), sosyal sıkılaştırma (UX-21), merkezi bildirimler (UX-22), tarih biçimi (UX-24), yönetici model alanları (UX-25). Kapsam dışı: şifremi unuttum (UX-05, e-posta altyapısı ertelendi), hukuk metni ve iletişim adresi (UX-06, kullanıcı kararı)
- [x] Testler + verify.sh + canlı e2e + hafıza

Doğrulama notları: SP-01…08'in ortak nedeni esnek satırdaki `input`un varsayılan en küçük genişliği → genel `min-width: 0` kuralı; 320 px kontrolü ux e2e'de 9 sayfada (grup/yorum/mesaj sayfaları veri gerektirdiği için otomatik değil, aynı kurala dayanır). ASSET-01 canlıda gerçek değil (görsel 200), yer tutucu eklendi.
**Açık / kısmi:** F5 kas haritası şimdilik liste (profesyonel ön/arka anatomi görseli kullanıcıdan istenecek); F3 canlı antrenman standart set tablosuna çevrildi, kullanıcı örnek uygulama görselleri gönderirse ince ayar; UX-22 bildirim merkezi hâlâ modül sayfalarına yönlendiriyor; UX-05 şifremi unuttum (e-posta altyapısı yok) ve UX-06 hukuk metni/iletişim adresi kapsam dışı; C maddesi ("kapların kısmında yalnız bardak görünüyor") canlı veride 3 kap var, yatay şerit 3 sütunlu ızgaraya çevrildi, kullanıcı onayı bekleniyor; G maddesi boş.

## Faz 5e kapsamı ve kabul kriterleri (tamamlandı)

Kaynak: kullanıcı mesajı 2026-11-05 ("ayarlara feedback butonu…", "whitelist mantığına geçiyoruz…", "yönetici paneline ui ux…", "kayıtlı kullanıcıları görme, veri sıfırlama, AI kotası…").

- [x] Profil → Destek → "Geri bildirim gönder" → `/profil/geri-bildirim`: tür (öneri/hata/şikayet/diğer), bölüm, metin, isteğe bağlı ekran görüntüsü (şifreli), cihaz bilgisi; gönderdiklerin + yönetici yanıtı, okunmamış yanıt rozeti; günde en fazla 10
- [x] Beyaz liste: davetsiz kayıt `pending` → `/beklemede`; onaysız kullanıcı sayfa ve API'lere giremez (401); askı/red oturumları kapatır; yöneticilere push (yeni kayıt, yeni geri bildirim)
- [x] Yönetim panosu `/yonetim`: üst yarı özet (6 sayaç + 14 günlük grafik), altta tıklanabilir kartlar (onaylar, kullanıcılar, geri bildirim, moderasyon, AI, davetler) → ilgili sayfa
- [x] Kullanıcılar: arama, durum filtresi + sayılar, sıralama, hızlı onay/red, hepsini onayla; detay: kullanım sayaçları, bilgiler, erişim, AI kotası, oturumlar, not, veri sıfırla, hesap sil
- [x] Geri bildirim yönetimi: filtre (durum/tür), detay (görsel, cihaz), hazır yanıtlar, yanıtla + çözüldü
- [x] Davet kodları: oluştur (hak + süre), paylaş, kapat/sil
- [x] verify.sh + canlı e2e + hafıza

**Açık:** onaylanan kullanıcıya bildirim gitmez (onaydan önce push aboneliği olmaz; e-posta altyapısı yok) — kullanıcı `/beklemede`de "Durumu yenile" ile girer.

## Sıradaki işler

0. Faz 5h tamamlandı (2026-11-06). Kullanıcıdan beklenen: yeni ekranlar hakkında geri bildirim (beğenmezse tasarım değişikliği).

### OTONOM ÇALIŞMA (2026-11-07 başladı) — her adım bitince burayı güncelle, yeni adıma geçerken önce burayı oku
Kullanıcı kararları: (1) aralıksız çalış, soru sorma, belirsizlikte önerdiğin seçenekle devam; (2) yayın: her adım verify.sh + canlı e2e geçince canlıya alınır (görünüm değişiklikleri dahil), ekran görüntüleri rapora; (3) P-6 yemek verisi biçimini Claude belirler (JSON şablonu + diğer AI için talimat); (4) sıra aşağıdaki gibi.
Değişmez kurallar: Ağırsağlam içeriği repoya girmez, PRO içerik yok; /opt/dgmcraft ve fit.dgmcraft.online'a dokunma; gizli anahtar yazma; DGFIT_TEST_HOOKS canlıda yok; commit'te model adı yok; her adım: memory-check → verify.sh → commit → release.sh → canlı test kullanıcılarını sil → STATE/LOG/DECISIONS/ARCHITECTURE/manifest → push.
Yerel ortam notu: `service postgresql start`; sunucu yeniden başlatma betiği scratchpad/restart.sh (yoksa verify.sh'teki komut); lisanslı yerel kopya scratchpad/licensed/agirsaglam (DGFIT_LICENSED_DIR).

| # | Adım | Durum | Kanıt / not |
| --- | --- | --- | --- |
| A1 | Faz 9 altyapı: simülatör (vücut modeli, senaryo üretici, gerçek motorlarla gün gün koşucu, değişmezler, altın dosya, hızlı alt küme verify'da) | tamamlandı | commit `2354960`; verify.sh VERIFY OK (183 birim, 23 e2e); release `2026-11-06T23-05-45-823Z` RELEASE OK (tam sim 4012 senaryo yayın öncesi); simülasyonun bulduğu 2 canlı hata düzeltildi (hedef kalori tabanın altına inebiliyordu; makro yuvarlama birikmesi); logda hata 0; 11 test kullanıcısı silindi |
| A2 | Faz 7-1: Bugünün durumu motoru + antrenman↔yemek↔su + tutarlılık e2e | tamamlandı | aynı commit/release; `lib/day-state.ts`, Bugün antrenman sonrası protein kartı, Su'da antrenman eki açıklaması, `integration.e2e.cjs` canlıda OK |
| A3 | Faz 8: hedefe ulaşma akışı, yağ oranı (Navy), hassas beslenme motoru, haftalık kalite döngüsü | devam ediyor | git worktree `/home/user/dgmfit-a3` dalı `a3-hedef-zekasi` (yayın paketine yarım iş girmesin diye); 0022 migration, computePlan yağsız kütle makroları + kas temposu uyarısı, check-in yön koruması + ölü bant + harcama yumuşatma, recomp antrenman/dinlenme günü, hedefe ulaşma/tarih geçti kartı + seçimler, /profil/vucut, Yemek detaylı hedefler, Fit kalite kartı, goal.e2e.cjs; sim'e hedefe ulaşma seçimi ve süre uzatma eklendi |
| A4 | Faz 9 tam set + düzeltmeler + gerileme | sırada | |
| A5 | Faz 7-2: toparlanma↔öneri, kilo↔plan, tek bildirim planlayıcı, tek kayıt çok etki | sırada | |
| A6 | Faz 7-3: sosyal↔her şey, koç↔her şey | sırada | |
| A7 | P-4 kalite/hız | sırada | |
| A8 | P-5 görsel kalanlar | sırada | |
| A9 | P-6 yemek verisi içe aktarma aracı | sırada | |
| A10 | P-7 özellikler | sırada | |

### Planlandı — onay bekliyor (2026-11-07, kullanıcı "yapılacaklar planına ekle" dedi; başlamak için açık onay gerekir)

**Faz 7: Modüller arası entegrasyon (önerilen sıra: 7-1 → 7-2 → 7-3)**
- 7-1 (1. gün): **Bugünün durumu motoru** — yenen/yakılan/içilen, uyku-toparlanma, antrenman yükü, kilo eğilimi, sıradaki öğün/antrenman tek kaynaktan; Bugün, Fit, Yemek, Su, Fitness, Koç ve bildirimler buradan okur. **Antrenman ↔ Yemek ↔ Su**: program gününe göre karb/protein hedefi (karb döngüsü programa bağlanır), antrenman sonrası protein açığı kartı (son/sık yenenlerden tek dokunuş), süre/yoğunluğa göre su hedefi artışı ("antrenman nedeniyle +500 ml"), antrenman öncesi az yemek/su uyarısı. **Tutarlılık e2e**: antrenman + yemek + su sonrası Bugün/Fit/Yemek/Su/Koç/bildirim aynı sayıları göstermeli.
- 7-2 (2. gün): **Toparlanma ↔ öneri** (ağrı, MSS yükü, uyku, düşük kalori, art arda zor gün → hafif gün/deload; toparlanmamış kasa alternatif). **Kilo eğilimi ↔ plan** (haftalık tek karar: kalori + kardiyo + antrenman sayısı birlikte; anlık "hedefe varış" güncellemesi). **Tek bildirim planlayıcısı** (günlük üst sınır, öncelik, ortak sessiz saat). **Tek kayıt, çok etki** (hızlı ekle ile birden çok kayıt; her kayıttan sonra kalan kcal/protein/su satırı).
- 7-3 (3. gün): **Sosyal ↔ her şey** (rekor/seri/hedefte hazır paylaşım kartı, tüm modüllerden meydan okuma ilerlemesi, partner dürtmesi). **Koç ↔ her şey** (durum motorunu bilir; önerileri tek onayla uygular).

**Faz 8: Hedef zekâsı ve hassas beslenme (kullanıcı isteği 2026-11-07; Faz 7-1 durum motoruyla birlikte, ~1 gün)**
- Hedefe ulaşma akışı: trend kilo hedefe gelince (≈3 gün ±0,3 kg) ya da aşılınca Bugün'de kart → (a) yeni kilo hedefi, (b) hedef tarih aynı kalarak kilomu koruyup kas kazanmak (recomp), (c) bakım. Seçim aşama olarak kaydedilir; seçim yapılana kadar otomatik açığa geçilmez (bugünkü check-in hedef aşılınca bakımın altına iniyor).
- Vücut yağ oranı: kurulum/profilde sor; bilinmiyorsa ABD Donanması formülü (boy, boyun, bel, kadında kalça; `body_measurements` sütunları var), yoksa VKİ-yaş-cinsiyet tahmini ("düşük güven"). Yağsız kütle + yağ kütlesi trendi; 2 haftada bir ölçü hatırlatması.
- Hassas beslenme motoru: BMR Katch-McArdle (yağ oranı varsa) / Mifflin; uyarlanabilir TDEE. Hedefe göre: kas kazanımı (deneyime ve yağ oranına göre ayda %0,5–1,5 tempo, protein 2,0–2,4 g/kg yağsız kütle, yağ 0,8–1 g/kg, antrenman günü karb ↑), recomp (antrenman günü bakım +%5–10, dinlenme −%10–15, haftalık ortalama bakım, protein 2,2–2,6 g/kg yağsız), yağ yakımı (açık yağ oranına göre, protein 2,3–3,1 g/kg yağsız). Sınırlar: doymuş yağ ≤%10 kcal, ilave şeker ≤%10, lif ≥14 g/1000 kcal, sodyum ≤2.300 mg, yaş/cinsiyete göre mikro besinler (kalsiyum, demir, magnezyum, potasyum, D, B12), su. Öğün başına protein dağılımı, antrenman çevresi karb. Yemek ekranında detaylı hedef + kalan (Sade modda yalnızca kcal + 3 makro, dokununca detay).
- Haftalık kalite döngüsü: kilo trendi + bel + yağ oranı + kuvvet artışı birlikte → fazla/açık ince ayarı (hızlı yağ alımı → azalt; kuvvet durdu ve kilo sabit → artır). Kas odaklı tempo uyarısı (deneyime göre çok yavaş/çok hızlı).
- Not (kullanıcıya açıklandı): yağlanmayı belirleyen toplam kalori fazlası; diyet yağı kanıta dayalı aralıkta tutulur.

**Faz 9: Uzun dönem senaryo simülasyonu (kullanıcı isteği 2026-11-07; Faz 7/8'in kabul şartı — bu testler geçmeden Faz 7/8 "tamamlandı" sayılmaz)**
- Sanal kullanıcı simülatörü (`lib/sim/`): enerji dengesi modeli (gerçek harcama ≠ formül: ±%10–15 sapma, metabolik uyum, su/glikojen dalgalanması ±1 kg, kas/yağ ayrımı — Forbes/Hall yaklaşımı), uygulamanın GERÇEK motorları gün gün çalıştırılır (plan, kalori bankası, check-in, uyarlanabilir TDEE, hedefe ulaşma kartı, Faz 8 beslenme motoru, antrenman önerisi).
- Senaryo uzayı (binlerce, kombinasyonla üretilir): süre 30/90/180/365 gün; cinsiyet; yaş 16–70; boy; kilo 45–150 kg; yağ oranı (bilinen/bilinmeyen/yanlış girilmiş); aktivite; deneyim; hedef (kilo ver, kilo al/kas, koruyup kas, bakım); hedef farkı 0,5–40 kg; tempo; uyum (%100/%90/%70, hafta sonu taşması, tatil, hastalık haftası, kayıt boşlukları, tartı sıklığı günlük/haftalık/düzensiz); hedefe erken ulaşma, hedefi aşma, plato, ters yön, yanlış veri (uç tartı, 0 kcal gün).
- Değişmezler (her senaryoda her gün kontrol): kalori tabanının altına inilmez; güvenli/mutlak tempo sınırı aşılmaz; check-in adımı ≤150 kcal; makrolar kaloriyle tutarlı; protein yağsız kütle tabanının altında değil; kas hedefli kullanıcı seçim yapmadan açığa sokulmaz; hedefe ulaşma kartı doğru zamanda bir kez çıkar; salınım yok (hedef etrafında zikzak); hedefe makul toleransla ve makul sürede varış; 18 yaş altı sınırları; tahmin tarihi tutarlı.
- Raporlama: senaryo başına özet (varış günü, sapma, en düşük/yüksek kalori, uyarılar) + başarısızlar listesi; HTML rapor.
- Gerileme koruması: tüm senaryoların sonuçları "altın" dosyada saklanır; her düzeltmeden sonra TAMAMI yeniden çalışır, değişen sonuçlar tek tek gösterilir (bir düzeltmenin başka senaryoyu bozması yakalanır). Hızlı alt küme (~500 senaryo) verify.sh'e girer; tam set (binlerce) her faz sonunda ve yayın öncesi.
- Arayüz uçtan uca: zaman atlatma test kancasıyla (yalnızca yerel) birkaç uzun akış — 1 ayda hedefe varan kullanıcıda kartın çıkması ve seçimlerin planı doğru değiştirmesi, 6 aylık kilo verme, 1 yıllık recomp.
- Bulunan her hata: önce senaryo testi eklenir (kırmızı), sonra düzeltilir (yeşil), sonra tam set yeniden.

**Plana alınan diğer işler (kullanıcı 2026-11-07: "8, 9, 10, 11 dışında diğerlerini plana ekle"; başlamak için yine açık onay gerekir)**
- P-4 Kalite/hız: bölüm bölüm bağımsız hata taraması (Bugün, Fit, Su, Yemek, Sosyal, Koç, Profil, Yönetim) + düzeltmeler + testleri; güvenlik incelemesi + yedekten geri yükleme denemesi; iskelet yükleme ekranları; yemek günlüğünde anında güncelleme (useOptimistic, gereksiz router.refresh kaldırma); hareket listesi 40 satır + "daha fazla"; ilk hafta simülasyonu (kayıttan 7. güne).
- P-5 Görsel denetim kalanları: açık temada bant kutucuk kontrastı, yönetimde 320 px kesilen başlıklar, "…" ile kesilen alt başlıklar, tutarsız onay kutuları, dokunma alanı ≥44 px, büyük yazı ayarı.
- P-6 Yemek verisi içe aktarma aracı (kullanıcının başka AI ile biriktirdiği veri: biçim tanımı, doğrulama, tekrar ayıklama, uç değer kontrolü, tek komutla içe aktarma). Yemek veritabanını DgFit tarafında genişletme işi yapılmaz.
- P-7 Özellikler: haftalık akıllı özet, akıllı hatırlatmalar, hızlı kayıt ("her zamanki kahvaltım"), ilerleme paylaşım kartları, rozet/seri sistemi, fotoğraftan porsiyon tahmini, tarif linkinden içe aktarma, program sihirbazı v2, ölçü/fotoğraf karşılaştırma.
- Plana alınmadı (kullanıcı hariç tuttu): yayın hazırlığı (Faz 6 mağaza paketi, KVKK + hesap silme/veri indirme, yönetimde kullanım istatistikleri). Kullanıcıya ait işler (OpenAI anahtarı, gerçek cihazda bildirim denemesi, e-posta doğrulama) aşağıdaki listede kalır.
- Kural: görünümü değiştiren her şey önce dalda gerçek uygulamada gösterilir, onayla yayınlanır.

1. Kullanıcı `deneme` ile giriş yapıp Profil → AI ayarları'ndan Claude ve OpenAI anahtarlarını girsin; ardından gerçek fotoğraf/yazı ve koç denemesi (yönetici sayfasında hata/kullanım/maliyet görünür).
2. İsteğe bağlı Faz 6 (Capacitor ile mağaza sürümü, Apple Sağlık / Health Connect, Bluetooth şişe, akıllı saat, video) ya da kullanıcı geri bildirimine göre iyileştirmeler.
2. Kullanıcıdan gerçek cihazda bildirim denemesi (Android Chrome + iOS ana ekran) geri bildirimi.
3. E-posta doğrulama kodu (Mailu SMTP) — ertelendi.

## Bilinen eksikler / borçlar

- Bugün ekranındaki seri sayacı hâlâ su serisi (hafta halkaları su + kalori uyumu).
- Canlıda kullanıcının kendi `deneme` hesabı var (2026-11-04 15:04 UTC); test temizliğinde silinmez.
- E2E'de deploy sonrası ilk isteklerde aralıklı gecikme görüldü; testlerde gezinme zaman aşımı 60 sn.
- Push teslimi yalnızca sahte HTTPS servisine karşı otomatik test ediliyor; FCM/APNs'e gerçek teslim otomatik testte yok.
- Yemek: AI fotoğraf/sesli öğün kaydı, AI menü ve alışveriş listesi Faz 4'te; TURKOMP izinsiz kullanılmıyor.
- Fitness: 5/3/1 ve nSuns şablonları kaynak doğrulanınca eklenecek. Dinlenme push'unun gerçek cihaz teslimi kullanıcı tarafından denenmeli. Görseller (free-exercise-db) yerel testte yok.
- Fit: dengeleme e2e'si test kancasıyla tohumlanmış geçmişe dayanıyor; gerçek gece kapanışı canlıda ilk kez 2026-11-05 03.00 sonrası çalışacak (`deneme` planı bugün başladı, kapatılacak geçmiş gün yok). Kapanmış bir günün düzeltmesi sonradan kapanan günlere geri yansımaz (bilinçli sınır). Banka iptalinde geçmiş biriktirme günleri geri verilmez.
- Analiz kartları kural tabanlı; LLM tabanlı koç Faz 4'te (API anahtarı yok).
- Yasal metinler TASLAK; hukuk kontrolü gerekli.
- Bu çalışma ortamında GitHub erişimi yok (GH_TOKEN geçersiz); kod sunucudaki `repo.bundle` ile korunuyor.
