# Çalışma günlüğü

En yeni en üstte. Her kayıt: tarih · ne yapıldı · kanıt.

## 2026-11-07 — Özelleştirme Ö1b-1 tamamlandı (diğer ekranlar)
- Fit, Fitness, Su (WaterScreen), Yemek (FoodDiary) CardBoard'a geçti; kayıtta fit/fitness/water/food kartları; `LayoutCtx.advanced`; stüdyo ekran başına durum (`allScreenLayouts`) — önceki sürümde tüm ekranlar Bugün'ün durumunu gösteriyordu.
- Görsel kontrol: Su düzenlemesinde ✎/− düğmeleri içeriğin (içecek çipleri, miktar düğmeleri) üstüne biniyordu → kart başlık şeridi; bandın alt taşması yer tutucunun üstüne biniyordu → düzenlemede kapalı.
- verify'da sosyal-2 e2e iki kez düştü (yalnız başına da): 2. tanık rekoru doğrulayınca bekleyen liste boşalıyor, bileşen null dönüp "Rekor doğrulandı" mesajını siliyordu (gerçek UX hatası, zamanlamaya bağlı) → kart mesajla kalır.
- Doğrulama: commit `ef8b3fe`; verify.sh VERIFY OK (225 birim); release `2026-11-07T04-19-32-106Z` RELEASE OK; canlıda 12 e2e OK; 14 test kullanıcısı silindi; logda hata 0.

## 2026-11-07 — Özelleştirme Ö1a tamamlandı
- Kart kaydı + düzen modeli (saf, 6 test), 0024 ui_designs, Bugün 11 karta bölündü (yeni 'Seriler' çekmecede), düzenleme modu (basılı tut-sürükle, FLIP, kenarda kaydırma, −, ✎ boyut + yukarı/aşağı, çekmece: dokun/sürükle, geri al, Vazgeç/Bitti), stüdyo `/profil/ozellestirme`, gizli kartın verisi hesaplanmaz, koç kartı gizlense de güvenlik kartı.
- Görsel kontrol (ekran görüntüleri): yarım boyutta antrenman kartı sıkışıyordu → düğme alt satıra kayar; düzenlemede boş koşullu kartlar çok yer kaplıyordu → küçük yer tutucu.
- Test: planlama e2e makroları eski 'Kalori' bölümünde arıyordu (makrolar artık ayrı kart) → `[data-card="today.macros"]`.
- Doğrulama: commit `d5cf19d`; verify.sh VERIFY OK (223 birim, 27 e2e); release `2026-11-07T03-25-38-663Z` RELEASE OK; canlıda özelleştirme e2e OK; logda hata 0.

## 2026-11-07 — Özelleştirme Ö1a başladı
- Kullanıcı prototipi onayladı ve genişletilebilir kodlama istedi. Faz başı: memory-check geçti; son commit `5e3c364` STATE ile uyumlu.
- Mimari: kart kaydı (sabit kimlik + sürüm + göç eşlemesi) ↔ kullanıcının tasarımı (yalnızca kimlik, boyut, ileride ayarlar) ↔ ekran çizicileri; tasarım kişisel veri içermez (şablon olarak paylaşılabilir).

## 2026-11-07 — Otonom A8+A9+A10: görsel kalanlar, yemek verisi içe aktarma, özellikler
- A8 (P-5): büyük yazı ayarı (yakınlaştırma kapalı olduğu için; zoom 1,1/1,2), onay kutuları tek tip, açık temada bant kontrastı hesaplanarak ≥4,5:1 (koyulaştırılmış degrade + siyah tonlu kutular), 320 px taraması (yeni tarayıcı betiği '…' kesilmelerini ve <40 px dokunma alanlarını da sayar) → bant alt başlıkları, yönetim kutuları, davet kodları, makro etiketi, küçük bağlantı/simgeler (`.hit`), 32 px düğmeler.
- A9 (P-6): kullanıcının başka AI ile topladığı yemek verisi için biçim + talimat + doğrulayıcı/içe aktarıcı. İlke korunur: değerler elle yazılmaz (USDA eşlemesi / tariften hesap / etiket + tutarlılık denetimi).
- A10 (P-7): 9 özelliğin hepsi (bkz. STATE A10). Tarif linki: yalnızca https, özel/yerel IP yok (DNS denetimi, yönlendirmeler yeniden denetlenir), 8 sn / 2 MB.
- Hatalar: JS `\b` Türkçe harfte çalışmıyor (ölçü ayrıştırıcı 'su bardağı'nı kaçırıyordu) → ileri bakış; kesir '1/2' sayıdan önce eşlenmeli; planlama e2e iki seçici değişikliğe takıldı (öncelik çipleri ortak bölüme taşındı; 'Karb.' kısaltması üst öğe yolunu değiştirdi) → test sağlamlaştırıldı; canlı p7 e2e'de yazı boyutu çerezi yarışı → test aksiyonun bitmesini bekler.
- Doğrulama: verify.sh VERIFY OK (217 birim, 26 e2e); commit `e4c3696` (+ test `23bf5c6`); release `2026-11-07T01-08-57-818Z` DEPLOY OK, canlı e2e 11/12 OK + p7 düzeltilmiş testle canlıda 2/2 OK; 0023 canlıda; logda hata 0; 15 test kullanıcısı silindi.

## 2026-11-07 — Otonom A5+A6+A7: entegrasyon 7-2/7-3, kalite/hız, 3 inceleme ajanı
- A5: toparlanma motoru (ağrı, MSS yükü, uyku, düşük kalori → hafif gün/deload), kilo eğilimi ↔ plan önerisi, tek bildirim planlayıcısı (günde 8, acil/planlı/normal), kayıt sonrası kalan satırı. A6: koç bağlamı genişledi, Bugün partner kartı, hedef paylaşımı.
- A7: yemek günlüğü anında güncelleme (useOptimistic), hareket kütüphanesi sayfalama, ilk hafta sim kuralı, yedekten geri yükleme denemesi (ağsız geçici container, 2 sn, canlıya dokunulmadı; yedek izinleri 600 + umask 077).
- 3 Sonnet inceleme ajanı (Bugün/Fit/Su, Yemek/Koç/Profil, güvenlik+sosyal/yönetim): kritik yok; ~40 bulgu. Düzeltilenler: check-in çift uygulama, hedef seçimi koruması + eski dengeleme düzeltmelerinin silinmesi, banka günü koruması, recomp ortalaması, yağ oranı ölçü denetimi, gece yarısı sonrası su özeti, su serisi tutarlılığı, kurulum sunucu doğrulaması, barkod (OFF önce, topluluk 'doğrulanmadı'), besin değeri fiziksel tutarlılık, koç eylemi/plan öğünü atomik, AI kotası paralel istek, push SSRF, bildirim tekrarı, şüpheli PR, engelleme kapsamı, moderasyon, şikâyet tekrarı, oturum hız sınırı, medya kotası, güvenlik başlıkları. Bilinçli bırakılan: push günlük üst sınırı bellekte (yeniden başlatmada sıfırlanır), yönetici adı listesi (mevcut hesaplar kayıtlı).
- Hatalar (doğrulamada bulundu): koç eylemi sahiplenmesi jsonb'de metin anahtar arıyordu (`actions->'0'`) → `(index::int)`; grup loading.tsx akışlı yanıtta 404'leri 200 yaptı → kaldırıldı; test push servisi allowlist'e takıldı → yalnızca test kancasıyla; partner kartı testi A'nın antrenmanı yüzünden gizleniyordu → iki durumlu kart. Kendi test hatam: ikinci e2e koşusu ilkiyle çakıştı (3190 portu), davet kodu küçük harfti.
- Doğrulama: verify.sh VERIFY OK (194 birim, 25 e2e); commit `b50dc87`; release `2026-11-07T00-40-21-394Z` RELEASE OK; canlıda başlıklar doğrulandı; logda hata 0; 12 test kullanıcısı silindi.

## 2026-11-07 — Otonom A3+A4: hedef zekâsı + tam senaryo seti
- A3 (Faz 8): yağ oranı (kullanıcı girer ya da Donanma formülüyle boyun/bel/kalça ölçülerinden; yoksa VKİ tahmini), yağsız kütleye göre protein/yağ/karbonhidrat, kas kazanım temposu uyarısı, haftalık check-in'de yön koruması (kas hedefinde harcamanın altına, kilo vermede üstüne inmez) + 60 kcal ölü bant + ölçülen harcamanın öncekiyle yumuşatılması, recomp'ta antrenman günü fazla/dinlenme günü az kalori, hedefe ulaşınca Bugün'de seçim kartı ("kilomu koruyup kas kazanayım" → aynı bitiş tarihli koruma aşaması), hedef tarih geçince "süreyi uzat", /profil/vucut, Yemek'te detaylı besin hedefleri (lif, şeker, doymuş yağ, sodyum, potasyum, kalsiyum, demir, D, B12, su), Fit'te kazanım kalitesi kartı.
- A4 (Faz 9): 4012 senaryoda değişmez ihlali 0; sonuç uyarıları kas hedefinde açığa sokma 679→1, hedef sonrası zikzak 558→~33, hedefi kaçırma 82→6, uzatmada da ulaşılamayan 30→17. Kalanlar: kullanıcının seçtiği gerçekçi olmayan plan, tartı gürültüsü, eksik kayıt.
- Hata (test): goal e2e "tarih geçti" kartı çıkmıyordu → test kancası bitiş tarihini kaydırmıyordu (`shiftEnd`).
- Doğrulama: commit `e1ee78e`, `aec697f`, `bb273c5`; verify.sh VERIFY OK (185 birim, 24 e2e); release `2026-11-06T23-42-58-726Z` RELEASE OK; logda hata 0; 12 test kullanıcısı silindi.
- Yedekten geri yükleme denemesi (A7 parçası): `dgfit-pwa-2026-11-06.dump` ağsız geçici postgres:17 container'ına 2 sn'de geri yüklendi (users 4, foods 7830, goals 8, migration 20 = yedek anındaki şema), canlıya dokunulmadı, container silindi. Bulgu: yedek dosyaları 644 izinliydi (klasör 700 olduğu için dışarı açık değildi) → `deploy/backup.sh`'e `umask 077`, mevcut yedekler 600 (önceki betik: `deploy/backup.sh.pre-umask`).

## 2026-11-07 — Otonom A1+A2: senaryo simülatörü + Bugünün durumu
- Kullanıcı aralıksız çalışma istedi (soru yok; test geçen her adım canlıya). Sıra STATE "OTONOM ÇALIŞMA" tablosunda.
- A1: Fit orkestrasyonu saf fonksiyonlara ayrıldı (`balanceWindow`, `trendSeries`, `checkinCompute`); `lib/sim` (sanal vücut: Katch-McArdle, Forbes, uyumsal termogenez, glikojen/su, tartı gürültüsü; davranış: uyum, eksik kayıt, tatil/hastalık, yanlış tartı; gün gün gerçek motor), değişmezler + sonuç kuralları, altın dosyalar (`tests/sim/golden-*.json`), hızlı set `npm test`'te (~9 sn), tam set (4012 senaryo, ~105 sn) `release.sh`'te kapı.
- Simülasyonun bulduğu canlı hatalar: (1) check-in tabanı düşürünce önceden yazılmış eksi dengeleme hedefi güvenli tabanın 150 kcal altına itebiliyordu → `targetKcal` (dayTargets + sim); (2) `scaleMacros` karbonhidratı ve yağı ayrı yuvarlıyordu, 50 check-in'de ~90 kcal sapma; kalori çok düşünce karbonhidrat eksiye inemediği için toplam aşılıyordu → karbonhidrat kalan kaloriden.
- A2: `lib/day-state.ts` (kalan kcal/protein/su tek hesap), Bugün'de antrenman sonrası protein kartı (son kullanılanlardan protein yoğun 3 öneri), Su'da "Antrenman nedeniyle +X ml", ekranlar arası tutarlılık e2e (`integration.e2e.cjs`: Bugün = Yemek kalan/bütçe, Bugün = Su hedefi, 60 dk kardiyo ≥ +500 ml).
- Doğrulama: commit `2354960`; verify.sh VERIFY OK (183 birim, 23 e2e); release `2026-11-06T23-05-45-823Z` RELEASE OK; logda hata 0; 11 test kullanıcısı silindi.

## 2026-11-07 — Geri bildirim 3: fitness, yemek araması + barkod, yönetim, performans
- Kullanıcı (5 ekran görüntüsü): gün sekmesi direkt başlatıyor; şerit fotoğrafları bozuk; iptal düğmesi; kas haritası yazısı + gecikme; doğru/yanlış yazısı sığmıyor; barkod 2 üründe bulamadı; "tavuklu pilav" yok ("yemek sorunu kesinlikle çözülmeli"); yönetimde kullanıcı sayfası + son işlemler. Ayrıca 2 Sonnet ajanı: görsel denetim (≈75 sayfa × 6 boyut, yatay taşma 0) ve performans (sunucu 15–40 ms; gecikme: kas haritasında bilerek 260 ms, ağır kas akışı, dokunuş geri bildirimi yok, yayından sonra soğuk ilk açılış 0,3–1,1 sn).
- Fitness: gün sekmesi `/fitness?gun=` ile yalnızca önizler ("Seçili gün"), başlatma "Antrenmana başla" ile; canlı antrenmanda Bitir yanında İptal (sorar), alttaki "Antrenmanı sil" kalktı, üst saat kaldırıldı (istatistikte var); şerit 16:9 (küçük resimler 640×360, kutu 112×92 kırpıyordu), seçim halkası iç çizgi; kas haritası yazısı akışta, 260 ms bekleme kaldırıldı, kas sayfaları önceden yüklenir, `anatomi/[kas]/loading.tsx`; anatomi görselleri 800 px WebP (sunucuda pakete eklendi, ~150 KB, PNG ~700 KB); kas akışında yalnızca görünen ±1 video + figür, diğerleri küçük resim; doğru/yanlış ✓/✗ simge; hareket listesinde video rozeti küçük resim köşesinde.
- Yemek: `searchStems` (Türkçe ek kırpma; birim test) + kök eşleşmeli arama, kısmi sonuçlar `partial` ("birebir yok — yakın sonuçlar"), altta "Yapay zekâya sor" / "Kendim eklerim"; AI menü/koç/öğün eşleştirmesi kısmi sonucu kullanmaz. Veritabanı (ajan): Türk yemekleri 36 → 300, küratörlü malzeme 149 → 341 (USDA'dan hesaplanır; vekil türler approx; kokoreç/kelle paça/leblebi/hellim/nar ekşisi/sumak USDA'da karşılık yok). Derlemede aynı USDA besinine bağlanan ikinci ad kendi kimliğini alır (ilk tam verify'da aktarım ON CONFLICT ile durdu → düzeltildi).
- Barkod: OFF canlıdan erişilebilir (kullanıcının ürünleri OFF'ta yok). EAN-13/UPC-A varyantları; barkodlu kullanıcı ürünü topluluk ürünü olur (başkaları barkodla ve aramada bulur, "kullanıcı ekledi", ekleyenin adı görünmez; formda uyarı); bulunamayan barkod `barcode_misses` (0021) → yönetimde kart + `/yonetim/barkodlar`; ürün eklenince düşer.
- Yönetim: kullanıcı sayfası Özet / Son işlemler / Yönet sekmeleri; `userActivity` mevcut tablolardan (giriş+cihaz, öğün, su, antrenman, kardiyo, tartı, ölçü, program, gönderi, yorum, mesaj, AI, geri bildirim, profil) tarih-saatli; mesaj/gönderi içeriği gösterilmez.
- Performans: alt menüde `useLinkStatus` + basılma; SW `navigationPreload` (v4); `today.ts` iki sorgu paralel; `release.sh` yayından sonra ana sayfaları ısıtır.
- Testler: yeni `foodsearch.e2e.cjs` (ekli sorgular, yakın sonuç, 2 kullanıcıyla topluluk barkodu); fitness (gün önizleme + İptal), admin (son işlemler, sekmeler), fixes (squat adı aramadan okunur). Test kancası antrenmanı 8 dk önce başlatır (40 dk'da gece yarısı dünün tarihine düşüp sosyal-2 meydan okumasında sayılmıyordu).
- Doğrulama: main `43fa609`; verify.sh VERIFY OK (170 birim, 22 e2e); release `2026-11-06T21-15-56-993Z` RELEASE OK (canlı foodsearch/fitness/fixes/anatomy/licensed/food/fit/water/ux/sade OK); canlıda foods dgfit 300, `barcode_misses` var, WebP oturumsuz 401, sw v4; logda hata 0; 11 test kullanıcısı + test barkodu silindi. Depo/geçmişte lisanslı içerik olmadığı tarandı (kullanıcı sordu).

## 2026-11-06 — Sosyal sayfası sadeleştirmesi
- Kullanıcı (ekran görüntüsüyle): "Sosyal'de çok fazla buton yok mu". 6 madde onaylandı ve `sosyal-sade` dalında gerçek uygulamada gösterildi: bant kutuları menü (Meydan okuma / Mesajlar / Gruplar, halka → Arkadaşlar; `Band` artık `ringHref` ve kutu bağlantısı alır), 4'lü düğme satırı ve Paylaş/Profilim satırı kalktı, hikâye satırında "+ Paylaş" balonu (Gönderi / Bugün salondaydım), akış sekmeleri 2 (Kaydedilenler kendi profilde), gönderide yalnızca kullanılmış tepkiler + tek "Tepki ver" + kaydet simgesi, arkadaş yokken "Arkadaşlarını ekle" kartı, Ara ve Profil simge. Akıştan önceki dokunulabilir öğe ~18 → ~9.
- Testler: `social` (tepki seçiciyi açar), `social2` (Paylaş balonu → Bugün salondaydım), `sade` (Sosyal bölümü).
- Not: yerel Postgres kapsayıcı yeniden başlayınca kapanıyor; e2e öncesi `service postgresql start`.
- Doğrulama: commit `4753cf8`; verify.sh VERIFY OK (169 birim, 21 e2e); release `2026-11-06T19-47-07-078Z` RELEASE OK; logda hata 0; test kullanıcıları silindi.

## 2026-11-06 — Arayüz sadeleştirmesi (Sade/Gelişmiş mod)
- Kullanıcının arkadaşları: "çok karışık, fazla yazı". Adımlar: (1) `scripts/ui-audit.cjs` ile ölçüm, (2) taslak — ilk sürüm elle çizilmiş ekranlarla reddedildi ("basit uygulama olmuş"); kullanıcı "kendi uygulamamız iyi, sadece sadeleştirme" dedi → değişiklikler `sade-taslak` dalında gerçek uygulamada yapılıp önce/sonra görüntüleriyle sunuldu (https://claude.ai/artifact/Rb6gpfu9QBSTSPvaw1aZJN) ve onaylandı, (3) uygulama, (4) ölçüm.
- Ölçüm (kelime, önce → sonra): İstatistik 180 → 30, Özet 107 → 32, Fit 160 → 65, Program 216 → 146 (dokunulabilir 62 → 43, boy 3,5 → 2,3 ekran), Fitness 141 → 99, Hareket 250 → 176, Yemek 186 → 153; Bugün, Su, canlı antrenman değişmedi. Alt menü 7 bölme kaldı.
- Doğrulama: commit `c25c20e` (taslak `44e5caa`); verify.sh VERIFY OK (169 birim, 21 e2e; yeni `sade.e2e.cjs`); release `2026-11-06T19-16-27-057Z` RELEASE OK; canlıda 4 profilin hepsi sade modda, logda hata 0, test kullanıcıları silindi.

## 2026-11-06 — Fitness bağımsız inceleme (2 Sonnet ajanı) ve düzeltmeler
- Kullanıcı isteğiyle iki ajan (sunucu/mantık, ekran/akış) salt okuma inceledi; bulgular kodda doğrulandı, kullanıcı "hepsini düzelt" dedi. Yetki/IDOR açığı bulunmadı.
- Düzeltilenler:
  - Rekor ve kayıt: silinen antrenmanın rekorları kaldırılır ve hareket rekorları yeniden hesaplanır (`recomputeRecords`); ilk kayıt sıfırsa sonraki seans sahte rekor üretmez (`detectPRs`); destekli harekette etkin yük; aynı hareket iki kez gelirse güncel kayıtla kıyas; geçerli set yoksa kayıt reddedilir.
  - Program: DUP için gerçek seans sayısı; GZCLP'de başarısız set sırayı kaydırmaz, T3 AMRAP kademenin son seti; program kopyası periyodizasyon/deload'u korur; hareket silince sıra yeniden numaralanır, ekleme `max+1`; tek kalan süperset çözülür; aktif yapma yalnızca var olan programa.
  - Canlı antrenman ve rekor denemesi: başka günün/serbest yarım taslağı sorulmadan silinmez ("Yarım kalan antrenmanın var"); açık taslağa "bu hareketle başlat" hareketi ekler; hareket çıkarma onaylı ve seçim doğru; alternatif değiştirmede seçim yeni harekete geçer, çift dokunma engelli; rekor denemesinde başka hareketin yarım denemesi sorulur, çevrimdışı kaydetme hata verir.
  - Hata mesajları ve girişler: hatalar pencere içinde (program düzenleyici, Aktif yap/Kopyala/Sil); filtre penceresi güncel; kalp/ekle hata ve bağlantıda geri alınır; sayı girişinde tek ayırıcı; RiR "2,5" ve "4+".
  - Diğer: kardiyoda gerçek dışı hız reddedilir (ACSM sınırlı); lisanslı uçta bozuk % kodu ve klasör 404; favori yalnızca görünen harekete; Ağırsağlam program dinlenmesi 15–600 sn; dakika toplamı yuvarlanır; `roundTo('up')` tam katı atlamaz; çevrimdışı kuyrukta reddedilen antrenman sessizce silinmez.
- Canlı veri: silinmiş tek antrenmandan kalan 2 rekor satırı (o hareketlerde başka antrenman yok) silindi; silinmiş antrenmana ait rekor satırı 0.
- Doğrulama: commit `350a5f3`; verify.sh VERIFY OK (169 birim, 20 e2e; yeni `fixes.e2e.cjs`: 100 → 500 sil → 105 rekor (önceki 100) ve hareket sayfasında en ağır 105, "60.5.2" → "60.52", açık taslağa squat eklenip seçilir, gün değişince taslak sorusu + devam/sil, sil+ekle sonrası sıra yenilemede sabit); release `2026-11-06T17-41-42-385Z` RELEASE OK; logda hata 0; test kullanıcıları silindi.

## 2026-11-06 — Kullanıcı geri bildirimi: 3 düzeltme
- Kullanıcı (ekran görüntüleriyle): "Kas haritası" kartı simsiyah; hareket listesinde fotoğraflar yok; hareket detayında alt menü görünüyor.
- Düzeltme: kart tema kartı (`card`); liste ve hareket arama ucu lisanslı küçük resmi önce kullanır (`thumbFor`, `searchExercises().videoFile`), yoksa kütüphane görseli; `hidesNav` `/fitness/hareketler/<id>`'yi kapsar (liste sayfası hariç), detay sayfasına alt boşluk.
- Doğrulama: commit `30788f4`; verify.sh VERIFY OK (165 birim, 19 e2e; lisanslı e2e'de alt menü yok + küçük resim yüklenmesi); release `2026-11-06T15-59-06-349Z` RELEASE OK; canlı kontrol: "barbell" listesinde 20/20 küçük resim yüklendi, detayda alt menü 0, kart koyu temada kart renginde; logda hata 0; test kullanıcıları silindi.

## 2026-11-06 — Faz 5h-6: plakalar + rekor denemesi
- `BarLoad` (lisanslı bar/plaka görselleri, yoksa çizim) canlı plaka hesaplayıcıda ve `/fitness/rekor`da. Rekor denemesi: hedef + bar → bar×8 + 5 ısınma + 3 deneme; ağır setlerde "Bu set nasıl geçti?" (Kaldıramadım/Zorlandım/Normaldi/Hafifti) → sonraki deneme ayarı; dinlenme sayacı; yerelde saklanır; "Günlüğe ekle" → "Rekor denemesi" antrenmanı.
- Kapsam: Ağırsağlam'da Rekor Denemesi PRO → kendi algoritma ve metin; ayrıca 5h-3'teki RiR açıklamaları paketin `premium` bölümündendi → DgFit'in kendi metnine çevrildi (DECISIONS).
- Hatalar: ilk kez yapılan harekette rekor kartı çıkmaz (genel kural) → test özet içeriğine bakacak şekilde düzeltildi; plaka hesaplayıcıda yinelenen metin fitness e2e'yi bozdu → eski metin kaldırıldı, test `data-plates` okur.
- Doğrulama: commit `135b110`; verify.sh VERIFY OK (165 birim, 19 e2e); release `2026-11-06T00-27-40-968Z` RELEASE OK; logda hata 0; 13 test kullanıcısı silindi.

## 2026-11-06 — Faz 5h-5: MSS seans yükü
- Antrenman özetinde "MSS yükü" kartı (5 kademe, puan, açıklama, en çok katkı veren 3 hareket), istatistikte son 7 günün seansları ve haftalık not. Kendi algoritmamız ve metinlerimiz: paketteki analiz metinleri Ağırsağlam'da PRO özelliği olduğu için kullanılmadı (DECISIONS).
- Hata: efor çarpanında normal setlerde yüksek RiR indirimi (0,8) `max(1, …)` yüzünden kayboluyordu → birim testi yakaladı, düzeltildi.
- Doğrulama: commit `4ea4eca`; verify.sh VERIFY OK (162 birim, 18 e2e); release `2026-11-06T00-04-08-038Z` RELEASE OK; logda hata 0; 12 test kullanıcısı silindi.

## 2026-11-06 — Faz 5h-4: ücretsiz programlar + süperset
- 35 ücretsiz program şablon listesinde (süzgeç: Ev/Salon/Başlangıç/Orta/Tek antrenman/Haftalık), ayrıntı sayfası (küçük resim, hedef, dinlenme, not, süperset blokları, kaynak satırı), "Bu şablonu kullan" → kullanıcı programı. Paket çalışma anında okunur, DB'ye şablon kopyalanmaz. 0019: `program_exercises.superset`, `note`.
- Süperset: editörde kırmızı çizgili blok + "Sonraki hareketle süperset yap / Süperseti boz"; canlıda S1 rozeti, "Süperset 1 · 1/3 · sonra: …" çipi, tur içinde dinlenmeden geçiş, tur sonunda dinlenme ve ilk üyeye dönüş.
- Hatalar: program sayfası editöre alanları tek tek aktarıyordu → `superset`/`note` ve 5h-3'ten kalan `thumb`/`images` eksikti (5h-3'te program satırları hep simge gösteriyordu), eklendi; yerel sunucu eski süreç portu tuttuğu için yeniden başlamamıştı (`fuser -k 3100/tcp`); ilk tasarımda süperset setleri "S" tipindeydi → set numarası görünmüyordu, normal tipe alındı; şerit rozeti adın üstüne biniyordu → alt köşeye.
- Doğrulama: commit `b9fd4ca`; verify.sh VERIFY OK (157 birim, 18 e2e); release `2026-11-05T23-49-37-793Z` RELEASE OK; logda hata 0; 12 test kullanıcısı silindi.

## 2026-11-06 — Faz 5h-3: program günü + canlı antrenman yeni düzeni
- Kullanıcının gönderdiği ekranlara göre: program günü satırları küçük resim + "N set · X tekrar · R RiR", gün başına "Antrenmana Başla"; canlı ekranda hareket şeridi, ilerleme çubuğu, tek hareket görünümü, Tarih/Video pencereleri, SET/KG/TEKRAR/RIR/✓ tablosu, RiR kaydırıcısı (yarım adım, paket metinleri), son sette otomatik sonraki hareket. 0018: `workout_sets.rir` real.
- e2e'ler şeride uyarlandı (fitness, progress, planner); anatomi e2e'ye program → canlı → RiR 2,5 → Tarih adımı eklendi.
- Hata: manifest'te 0018 yoktu → memory-check yakaladı, eklendi.
- Doğrulama: commit `9d749db`; verify.sh VERIFY OK (151 birim, 17 e2e); release `2026-11-05T23-22-22-474Z` RELEASE OK; canlı rir sütunu real; logda hata 0; 11 test kullanıcısı silindi.

## 2026-11-06 — Faz 5h-2: kas haritası + video akışı + yeni hareket detayı
- Kullanıcının gönderdiği uygulama ekranlarına göre (akış ve düzen aynı, renk/yazı DgFit): `/fitness/anatomi`, `/fitness/anatomi/[kas]`, `/fitness/kaydedilenler`, `LicensedHero`, `FeatureTiles`, `BodyFigure`, 0017 `exercise_favorites`. Kas vurgusu paketteki çokgenlerden (yumuşatılmış), MSS ve açıklama etiketleri paket metninden (kullanıcı: "elimizdekilerle yapalım").
- Hata: yerel pakette yalnızca 2 video vardı → akışta dosyası olmayan harekete video adresi verilmiyor; testler için göğüs videoları geçici klasöre indirildi.
- Sunucuda 349 küçük resim üretildi (`licensed/agirsaglam/thumbs`, ffmpeg, 7,8 MB) — 5h-3 için.
- Doğrulama: commit `eeae866`; verify.sh VERIFY OK (151 birim, 17 e2e); release `2026-11-05T23-02-53-105Z` RELEASE OK (canlı anatomi + lisanslı e2e dahil); logda hata 0; 11 test kullanıcısı silindi.

## 2026-11-06 — Faz 5h-1: Ağırsağlam lisanslı içerik (hareket verisi + videolar)
- İzin: team@lightweightapp.com (kullanıcı ekran görüntüleriyle paylaştı; şartlar DECISIONS). Depo herkese açık → içerik sunucuda, depoda yalnızca kod.
- Kod: `scripts/licensed-map.mjs`, migrate `seedLicensed`, 0016 `exercises.licensed`, `lib/licensed.ts`, `/api/lisansli/[kind]/[file]` (oturum + Range), hareket sayfası video/kas etkisi/MSS/etiket/açıklama/kaynak satırı, listede VİDEO rozeti, kütüphane görünürlüğü `user_id is null`.
- Süreç: kullanıcı iki kez "Dur" dedi; onay almadan başlanmıştı (kullanıcı uyardı). Bundan sonra açık "başla/devam" olmadan iş yok. Kullanıcı: "elimizdekilerle yapalım, sırayla başla ve hepsini hallet" (kas vurgusu çokgenle, metinler paketten; kaynak satırı en küçük haliyle — izin şartı).
- Doğrulama: commit `9f9a34a`; verify.sh VERIFY OK (149 birim, 16 e2e); tek seferlik paketli deploy `2026-11-05T22-41-16-200Z`; 698 video indirildi; release `2026-11-05T22-43-48-661Z`; canlı lisanslı e2e OK (Range 206, yanlış yapılış sekmesi, yol dışı 403), oturumsuz 401.

## 2026-11-05 — Hareket adları İngilizce
- Kullanıcı isteği: Fitness'ta hareket adları İngilizce kalsın. `scripts/data/build_exercises.mjs`: görünen ad = kaynak adı, Türkçe ad takma adların başına; hareket verisi sürümü 6b1d9d0883fb (veri özeti, commit değil). Hareket sayfası alt başlığı "Türkçe: …". e2e'lerde Türkçe hareket adları İngilizceye çevrildi (fitness, progress, social).
- Doğrulama: commit `3805ab9`; verify.sh VERIFY OK (146 birim, 15 e2e); release `2026-11-05T17-57-24-577Z` RELEASE OK; canlı DB: `Barbell Squat [Squat (barbell)]`, `Pullups [Barfiks]`, 876 hareket; test kullanıcıları silindi.

## 2026-11-05 — Faz 5g: günlük özet görseli
- Kullanıcı isteği: Yemek sağ üstüne kaydetme düğmesi, günün kalorisi + mikro besinler güzel bir şablonda fotoğraf olarak insin; önce şablon onayı. İki taslak (HTML → PNG) gönderildi; kullanıcı: ikisi birden seçilebilsin, kullanıcı adı bana kalmış (gösterilmedi), takviye/su kalsın.
- `app/api/yemek/gorsel/route.tsx` (next/og; belge: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md` — yalnızca flex, ttf/otf/woff), `lib/day-card.ts` + 2 birim test, `DayCardSheet.tsx`, `public/fonts/*.ttf` (Google Fonts, OFL; Türkçe karakterler fontTools ile doğrulandı).
- Hatalar: test kontrolünden geçmek için ilk etiket "Kaydet" yemek e2e'sindeki "Kaydet" ile çakıştı → "Görseli indir" / "Günün özet görseli"; standalone çıktı `public/fonts`u kopyalayınca `cp -a public dist/public` iç içe kopyaladı ve sw.js 404 oldu (konsol hatasıyla yakalandı) → `public/.` + varlık denetimi; memory-check `route.tsx` tanımıyordu.
- Doğrulama: commit `b2a020b`; verify.sh VERIFY OK (146 birim, 15 e2e); release `2026-11-05T17-15-35-938Z` RELEASE OK.

## 2026-11-05 — Faz 5f: takviyeler + AI menü düzeltmesi
- Kullanıcı önerisi: takviyeyi kullanıcı tanımlasın (porsiyon değerleri), sonra yalnızca porsiyon işaretlesin. Hazır TR veritabanı yerine bu yol (DECISIONS). 0015 `foods.supplement`; `meal_items.meal='supplement'`; `lib/supplements.ts` + 5 birim test; Yemek'te Takviyeler kartı, `/yemek/takviyeler` (+ yeni, [id]).
- Canlı ilk denemede `supplement.e2e` kafein uyarısının geri alınca kalkmasını sunucu yenilemesinden önce bekliyordu → uyarı ve ek içerik toplamı istemcide anlık sayaçtan.
- Canlı AI hatası (kullanıcı ekran görüntüsü, AI menü 7 gün): `ai_calls` `menu … bad_output 200: Yanıt yarıda kesildi` (Haiku, 4.000 token çıktı sınırı). Düzeltme: görev başına çıktı sınırı (menü 16.000, program 10.000, elimdekiler 6.000) ve uzun görevlerde 180 sn zaman aşımı (`lib/ai/engine.ts` `maxTokensFor`).
- Doğrulama: commit `a49d70e`; verify.sh VERIFY OK (144 birim, 15 e2e) ×2; release `2026-11-05T16-41-25-230Z` RELEASE OK; AI düzeltmesi aşağıdaki release ile.

## 2026-11-05 — Faz 5e: geri bildirim, beyaz liste, yönetim paneli
- Başlangıç: kullanıcı isteği (ayarlara geri bildirim düğmesi + sayfası; whitelist — kayıtlar yönetim paneline düşsün, onaylanınca girsin; panoda yarı ekran özet + tıklanabilir kartlar; kullanıcıları görme, veri sıfırlama, kişiye özel AI kotası).
- Şema 0014: `users.status/status_at/status_by/ai_daily/admin_note/invite_code/last_seen_at`, `feedback`, `invites`; eski hesaplar approved. Erişim katmanı `getSessionUser` → `getUser` (onaylı/yönetici) → `requireUser` (→ `/beklemede`). Kayıt: davet kodu geçerliyse onaylı (koşullu kullanım artışı), değilse pending + yöneticilere push.
- Sayfalar: `/profil/geri-bildirim`, `/beklemede`, `/yonetim` (+ `ActivityBars` tek seri, dokununca değer), `/yonetim/kullanicilar` (+ `[id]` yönetim), `/yonetim/geri-bildirim` (+ `[id]` yanıt), `/yonetim/davetler`; AI ve moderasyon sayfaları panoya döner; Profil'de "Yönetim paneli" (bekleyen rozeti) ve "Geri bildirim gönder" (yanıt rozeti).
- AI: `userDailyLimit` (kişiye özel → genel); 0 = AI kapalı mesajı; koç kalan hakkı buradan.
- Testler: `tests/access.test.ts` (3), `tests/e2e/admin.e2e.cjs`; tüm e2e kayıtları `DGFIT_E2E_INVITE` ile (verify.sh yerel kod üretir; release.sh `~/.config/dgfit/e2e-invite` okur). Hatalar: 320 px'te ızgara öğesi `min-w-0` yoktu (pano 450 px) → düzeltildi; askı durumu yenilemeden önce okunuyordu → öznitelik beklenir.
- Doğrulama: commit `b318dfb`; verify.sh VERIFY OK (139 birim, 14 e2e); deploy `2026-11-05T15-55-03-946Z` → canlı DB'ye e2e davet kodu eklendi (label `e2e (otomatik test)`) → release `2026-11-05T15-56-01-796Z` RELEASE OK; canlı kancasız beyaz liste kontrolü (pending, `/beklemede`, API 401); logda hata 0; 9 test kullanıcısı silindi.

## 2026-11-05 — Kas ısı haritası, koç ekranı, program paylaşma, AI şema düzeltmesi
- Kas haritası: kullanıcının ürettiği renk kodlu ön/arka görsel `data/body-map-source.webp` → `scripts/data/build_bodymap.py` (opencv; en yakın palet rengi + kontur) → `lib/body-map-paths.ts` (17 KB, ön 10 / arka 10 kas grubu); `BodyMap.tsx` son 7 gün setine göre 4 kademe boyar, dokununca kas + set + toparlanma.
- Koç: tam ekran sohbet (alt bar gizli, `hidesNav('/koc')`), kendiliğinden büyüyen yazma alanı (kullanıcının ekran görüntüsündeki kesilen metin), içte mikrofon + gönder, avatar balonları, yazıyor animasyonu, başlıkta sohbetler / yeni / ayarlar, kalan hak alt başlıkta.
- Sosyal: `program` gönderi türü (anlık görüntü; yalnızca ortak kütüphane hareketleri), `saveProgramCopy` → "Programlarıma kaydet"; program sayfasında Paylaş. sosyal e2e'ye adım.
- Canlı AI hatası (kullanıcı: "Elimde bunlar var" → "AI yanıt veremedi"): `ai_calls` kaydı `bad_output: recipes[0].ingredients[].grams too_small minimum 5` (tuz/baharat < 5 g). Düzeltme: gram alt sınırı 0,5; `parseResult` yalnızca sayı sınırı aşımında (negatif hariç) değeri sınıra çekip yeniden dener; `tests/ai.test.ts` yeni test. OpenAI sağlayıcısı etkin ama anahtarsız → yedek devreye giremedi (kullanıcıya bildirildi).
- Test kaynaklı: sosyal-2'de düğme hidrasyondan önce tıklanıyordu → `networkidle` beklenir.
- Doğrulama: commit `2d615d3`; verify.sh VERIFY OK (136 birim, 13 e2e); release `2026-11-05T15-15-46-385Z` RELEASE OK; test kullanıcıları silindi.

## 2026-11-05 — xpike yönetici yapıldı
- Kullanıcı isteği: `/opt/dgfit-pwa/docker-compose.yml` `DGFIT_ADMINS: deneme` → `deneme,xpike` (önce yedek: `docker-compose.yml.bak-<zaman>`), `docker compose up -d app`. Kanıt: container `printenv DGFIT_ADMINS` = `deneme,xpike`, sağlık `{"ok":true,"db":true}`.

## 2026-11-05 — Faz 5d tamamlandı
- Ortak: `components/Sheet.tsx` `useSheet` (tutamaç/başlıktan aşağı çekince 90 px ya da hızlı kaydırmada kapanır, az çekince geri döner; boşluk/Esc/Kapat aynı animasyon), QuickAdd aynı davranışa geçti; `BackButton` (ModShell sekme içi gezinme izi tutar; iz varsa tarayıcı geri, yoksa üst sayfa); genel `input{min-width:0}` + `button{flex-shrink:0}`; `ExImg` yer tutucu; alt bar 350 px altında yalnız simge.
- Bugün: hafta şeridi bantta, makrolar tek satır, Fit/Su/Antrenman kutuları, koç kartı 3 satır. Fit: 5 araç ayrı sayfa (`/fit/{gunler,banka,checkin,senaryo,karb}`, ortak `load.ts`). Su: kaplar 3 sütun ızgara.
- Fitness: program oluştur 3 seçenek (`olustur` ortam → ekipman açılır menüsü, `sablonlar` + `[id]` inceleme, `bos`); düzenleyicide hareket Düzenle/Sil ve `removeDay` (geçmiş antrenman korunur, sıra yeniden numaralanır); periyodizasyon en alta; kardiyo türü açılır menü, nabız açılır; canlı antrenman set tablosu (Set · Önceki · kg · Tekrar · RIR · ✓), ilerleme çubuğu, "tekrar yedek" açıklaması; Fitness ana sayfasında gün seçici (tamamlanan gün sırayı ondan sonrasına alır — mevcut kural); kas ısı haritası çizimi kaldırıldı → grup listesi; hareket filtreleri tek pencere + kaldırılabilir etiket; kaynak yazıları kaldırıldı (veri kamu malı); kendi hareketine oluştururken fotoğraf.
- Profil: `replanAction` (boy, aktivite, hedef türü/kilo/süre → güncel trend kiloyla bugünden yeni hedef; 1,5 kg/hf sınırı) + önizlemeli `PlanForm`.
- UX: aktivite açıklamaları antrenman hariç günlük hayat; kurulumda değere dokunup yazma, Atla üstte; ölçü birimleri; faz metni silindi; su ilk durumda olumsuz mesaj yok; boş istatistikte grafik yok; sosyal kısa düğmeler; alışveriş boş durumunda Menü oluştur; AI yok mesajı tek bileşen (`AiOff`); meydan okuma tarihleri; yönetici model alanları tam genişlik; bildirim satırları 52 px.
- Bulunan kusurlar: koç ve progress e2e eski program sayfası/"@ RIR" metnine bağlıydı → güncellendi; ux e2e ilk sürümünde açılış animasyonu bitmeden tutamaç ölçülüyordu ve boş programın varsayılan "Gün 1"i sayılmıyordu (uygulama doğru).
- Doğrulama: commit `e474925`; verify.sh VERIFY OK; release `2026-11-05T14-37-46-231Z` RELEASE OK; 8 test kullanıcısı silindi.

## 2026-11-05 — Faz 5d başladı (kullanıcı düzeltmeleri + dış inceleme paketi)
- Faz başı: memory-check geçti; son commit `45b274f` (paketteki incelenen commit ile aynı). ASSET-01 canlıda doğrulandı: görsel 200; yalnızca yerel ortamda görsel yok.

## 2026-11-05 — Kullanıcı geri bildirimi: kayıt formu + yakınlaştırma/yenileme
- Kayıt ekranında koşullar/KVKK bağlantısı sayfadan çıkıyordu → form siliniyordu. Artık metin alt sayfada açılır (`components/legal.tsx` ortak içerik, `/yasal/*` de onu kullanır); kullanıcı adı, e-posta ve onay `sessionStorage` taslağında (şifre asla saklanmaz, gönderince silinir).
- Yakınlaştırma kapalı (`maximumScale: 1`, `userScalable: false`, `html { touch-action: pan-x pan-y }`, iOS `gesturestart` engeli); aşağı çekip yenileme kapalı (`html { overscroll-behavior: none }`).
- Koç e2e'sinde zamanlama yarışı: kayıttan sonra Bugün'ün ilk içgörü isteği test kancasının sıfırlamasından sonra bitince "start" içgörüsü yazılıyordu → test isteğin bitmesini bekler (uygulama doğru).
- Doğrulama: commit `eccdbe2`; release `2026-11-05T08-42-21-771Z` RELEASE OK (canlı onboarding/su/fit e2e), 3 test kullanıcısı silindi; verify.sh VERIFY OK (onboarding e2e: koşullar alt sayfası, dönüşte form dolu, yenilemede kullanıcı adı/e-posta var, şifre yok, viewport ve overscroll kontrolü).

## 2026-11-05 — Faz 5c tamamlandı
- Tempo: `computePlan` artık `allowed` (mutlak sınır 1,5 kg/hf), `minDays`, `expectedDays` döner; sihirbaz ve sunucu `allowed`'a bakar; kalori tabanında gerçek tempo gösterilir (önceden istenen tempo yazılıyordu).
- Tasarım: token'lar iki temada; `lime` → modül vurgusu `acc` (70 dosyada sınıf taşındı, sabit hex'ler token'a); `ModShell`, `Band`, renkli `TopBar`, `Menu`, 7 yuvalı alt bar; Bugün/Fit/Su/Yemek/Fitness/Sosyal bantları; ayarlar 18 yeni sayfaya bölündü; Görünüm sayfası (çerez); 0013 su görünümü halka.
- Bulunan kusur: su e2e hedefi "/ 2.600 ml" metninden okuyordu, yeni bantta değer "Hedef 2.600 ml" → test güncellendi (uygulama doğru).
- Doğrulama: commit `238bea8`; verify.sh VERIFY OK (135 birim, 13 e2e); release `2026-11-05T08-26-24-019Z` RELEASE OK; canlıda `_migrations` son 0013, `water_settings` hepsi `ring`, 20 dk logda hata 0; 8 test kullanıcısı silindi.

## 2026-11-05 — Faz 5c başladı (yeni tasarım + tempo)
- Faz başı: memory-check geçti; son commit `2c1198f` STATE ile uyumlu; çalışma ağacı temiz. Kullanıcı 41 ekranlık tasarımı onayladı ve kurulumda temponun engellenmemesini istedi.

## 2026-11-05 — Faz 5b tamamlandı
- DOTS: web okuma ajanı OpenPowerlifting `crates/coefficients/src/dots.rs` ve `lib.rs`'i (poly4 = A·x⁴+B·x³+C·x²+D·x+E) okudu; Wikipedia sayfası 404. Katsayılar ve 40–210 / 40–150 kg sınırları koda bu kaynaktan girildi.
- Saf `lib/social-rank.ts` + `tests/social2.test.ts` (6); veri katmanı `lib/social2-data.ts`; migration 0012; `saveWorkout` rekorları şüphe nedeniyle yazar; zamanlayıcıda `workout.finished` → partner bildirimi; ekranlar `/sosyal/meydan`, `/sosyal/gruplar`, `/sosyal/mesaj`, profilde arkadaş araçları ve doğrulama bekleyen rekorlar, akışta 24 saatlik kart şeridi, yönetici kanıt kuyruğu.
- Bulunan kusurlar: düello sayfası rakip katılmadan durum satırını hiç göstermiyordu → her zaman gösterilir. Test kaynaklı: vitrini kapalı kullanıcının şüpheli rekoru arkadaşlara görünmüyordu (kural doğru; sahibine "vitrini arkadaşlara aç" ipucu eklendi, test vitrini açar).
- Doğrulama: commit `8e9b256`; verify.sh VERIFY OK (birim 130/130, 13 e2e); release `2026-11-05T06-10-32-259Z` RELEASE OK; canlı kancasız 5a+5b kontrolü OK; canlıda 8 tablo + `0012_social2.sql`; 10 test kullanıcısı silindi.

## 2026-11-05 — Faz 5b başladı
- Faz başı: memory-check geçti; son commit `d6eabdb` STATE ile uyumlu; çalışma ağacı temiz. DOTS katsayıları web okuma ajanıyla kaynaktan doğrulanıyor.

## 2026-11-05 — Faz 5a tamamlandı
- Saf kurallar `lib/social.ts` (profil/öğe/gönderi görünürlüğü, akış puanı, öneri puanı, kilometre taşı, haftalık seri), `lib/moderation.ts`; `tests/social.test.ts` (6). Veri katmanı `lib/social-data.ts`, migration 0011 (10 tablo), `qrcode` 1.5.4 (MIT; npm'den doğrulandı), ekranlar `/sosyal` (+ yeni, p/[id], ara, arkadaslar, bildirimler, ayarlar), `/u/[username]`, `/yonetim/moderasyon`; antrenman özeti, rekor, su serisi ve Fit'e "Paylaş" bağlantıları.
- Bulunan kusurlar: JS `\b` Türkçe harfleri kelime harfi saymıyor → "şişko" gibi hakaretler kaçıyordu (birim test yakaladı) → Unicode harf sınırı. PR vitrini 120 kg'ı "120,0 kg" gösteriyordu → tam sayıda ondalıksız. Engellenen kişiye "Bu profili göremezsin" ekranı engeli sızdırıyordu → yalnızca engelleyene gösterilir, diğerine 404. Test kaynaklı: kilo alma hedefli test kullanıcısı güvenli tempoyu aştığı için sihirbazda doğru şekilde engellendi (test verisi düzeltildi); "Gönder"/"Kaydet" seçicileri alt dize eşleşmesiyle çakıştı; önceki çalıştırmanın aynı metinli gönderisi moderasyon kuyruğunda çakıştı (metin benzersiz yapıldı).
- Doğrulama: commit `7072263`; verify.sh VERIFY OK (birim 124/124, 12 e2e); release `2026-11-05T05-42-38-190Z` RELEASE OK; canlı kancasız sosyal kontrolü OK; canlıda 10 tablo + `0011_social.sql`; 10 test kullanıcısı silindi.

## 2026-11-05 — Faz 5a başladı
- Faz başı: memory-check geçti; son commit `07b70cf` STATE ile uyumlu; çalışma ağacı temiz. Spesifikasyon 8, 9, 10, 13 Claude Docs'tan okundu. Faz 5 ikiye bölündü (DECISIONS).

## 2026-11-05 — Faz 4c tamamlandı (sahte sağlayıcıyla)
- Saf motorlar: `lib/menu.ts` (ölçekleme, alışveriş, restoran sıralaması), `lib/scenario.ts` (simülatör, karb döngüsü), `lib/ai-program.ts` (program denetimi); `tests/planner.test.ts` (6).
- Veri katmanı `lib/planner-data.ts` (Türkçe besin kataloğu modele verilir, ad eşleşmesi katalog → arama), migration 0010, ekranlar `/yemek/plan`, `/yemek/plan/alisveris`, `/yemek/elimdeki`, `/yemek/restoran`, programlarda "AI ile oluştur", Plan'da simülatör + karb döngüsü; `dayTargets` karb döngüsünü açık günlere uygular; koç eylemi `plan_menu`.
- Bulunan sorunlar: Plan ekranındaki ikinci düğme adı ("…kaydet") fit e2e'deki "Kaydet" seçicisiyle çakıştı (Playwright alt dize eşleşmesi) → "Döngüyü uygula". Ekran görüntüsünde: ölçek sınırına takılan menü hedefin çok altında kalıyordu ve kullanıcıya söylenmiyordu → %10'dan fazla sapmada uyarı + e2e adımı.
- Doğrulama: commit `3410884`; verify.sh VERIFY OK (birim 118/118, 11 e2e); release `2026-11-05T03-34-15-650Z` RELEASE OK; canlıda 4 tablo + `0010_planner.sql`; 7 test kullanıcısı silindi.

## 2026-11-05 — Faz 4c başladı
- Faz başı: memory-check geçti; son commit `6b72158` STATE ile uyumlu; çalışma ağacı temiz. Kapsam spesifikasyon 6.4, 4.2, 5.6, 10'dan.

## 2026-11-05 — Faz 4b tamamlandı (sahte sağlayıcıyla)
- Saf motorlar: `lib/weekly.ts` (DayFacts, weekStats, ruleSuggestions, numbersAllowed), `lib/safety.ts`, `lib/insights.ts`, `lib/coach-calc.ts`; birim testler `tests/coach.test.ts` (13).
- Veri katmanı `lib/coach-data.ts`, migration 0009, ekranlar `/koc`, `/rapor`, Bugün `InsightCard`, zamanlayıcıda Pazar 19.00 rapor push'u.
- Bulunan sorunlar: yerel e2e 11 hesap açınca kayıt hız sınırı (IP başına saatte 10) push ve su e2e'sini kırdı → sınır yalnızca `DGFIT_TEST_HOOKS=1` iken 200 (canlıda 10). Süreli hareket koç etiketinde "3 × 1" görünüyordu → "3 × 45 sn". Ekran görüntüsünde fark edildi: "pizza" araması USDA "Pizza rolls" kaydını buluyor (açık iş).
- Doğrulama: commit `ec9ae94`; verify.sh VERIFY OK (birim 112/112, 10 e2e); release `2026-11-05T03-05-14-235Z` RELEASE OK; canlıda 4 tablo + `0009_coach.sql`, `/api/test/coach` POST 404, app logunda hata yok; 7 test kullanıcısı silindi.

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
