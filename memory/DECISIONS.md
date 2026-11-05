# Karar kaydı

Biçim: `tarih · karar · neden · kaynak`. Kaynak = kullanıcı ya da teknik gerekçe.

| Tarih | Karar | Neden | Kaynak |
| --- | --- | --- | --- |
| 2026-11-04 | Uygulama adı **DgFit** | — | Kullanıcı |
| 2026-11-04 | Yalnızca Türkçe arayüz | — | Kullanıcı |
| 2026-11-04 | Tamamen ücretsiz, premium yok; AI'da yalnızca adil kullanım kotası | — | Kullanıcı |
| 2026-11-04 | Ücretsiz besin kaynakları: TURKOMP, USDA FoodData Central, Open Food Facts (FatSecret yok) | TURKOMP lisansı henüz kontrol edilmedi | Kullanıcı |
| 2026-11-04 | Başlangıçta yalnızca PWA; mağaza sürümü (Capacitor) ileride isteğe bağlı | iOS PWA kısıtları biliniyor (Bluetooth, bildirim butonu, Sağlık) | Kullanıcı |
| 2026-11-04 | Sunucu: kullanıcının mevcut VDS'i, alan adı dgfit.dgmcraft.online | — | Kullanıcı |
| 2026-11-04 | Tasarım dili "Gece Salonu" (koyu zemin, lime vurgu) onaylandı | Tasarım canvas'ı: https://claude.ai/artifact/GZAhprYfuJ4piHrZvmW1sP | Kullanıcı |
| 2026-11-04 | Kodu tek ajan (Claude) sırayla yazar; paralel ajan yok | Tutarlılık | Kullanıcı |
| 2026-11-04 | Kalıcı hafıza + her faz başında güncelleme + halüsinasyon önleme kuralları | Tek ajan tüm kodu yazıyor | Kullanıcı |
| 2026-11-04 | NestJS yerine Next.js 16 full-stack (server action + route handler) | Tek uygulama, tek container, daha hızlı geliştirme | Teknik (spesifikasyondan sapma) |
| 2026-11-04 | Şifre hash: Argon2 yerine Node yerleşik **scrypt** (N=16384, r=8, p=1) | Yerel (native) bağımlılık yok, standalone paket sorunsuz | Teknik (spesifikasyondan sapma) |
| 2026-11-04 | ORM: Drizzle + postgres-js; migration'lar kendi `scripts/migrate.mjs` ile | Standalone çıktıda drizzle migrator izlenmeyebilir | Teknik |
| 2026-11-04 | Build bu çalışma ortamında yapılır, sunucuya hazır paket gönderilir | Sunucuda boş RAM ~3,7 GB, swap dolu | Teknik |
| 2026-11-04 | Middleware/proxy kullanılmıyor; yetki kontrolü layout ve aksiyonlarda | Next 16'da middleware → proxy değişimi; gereksiz karmaşıklık | Teknik |
| 2026-11-04 | E-posta doğrulama kodu ertelendi | Mailu SMTP entegrasyonu ayrı iş | Teknik |
| 2026-11-04 | Gün sınırı Europe/Istanbul saatine göre | Kullanıcılar Türkiye'de | Teknik |
| 2026-11-04 | Su hedefi taban formülü 33 ml × kg, 50 ml'ye yuvarlanır | Spesifikasyon 7.3 | Spesifikasyon |
| 2026-11-04 | Kilo verme güvenlik sınırı haftalık %1, kalori tabanı K 1.200 / E 1.500; kilo alma haftalık %0,5 | Spesifikasyon 3.3 | Spesifikasyon |
| 2026-11-04 | Hidrasyon katsayıları: su/maden suyu 1, çay 0,9, ayran 0,9, meyve suyu 0,85, kahve 0,8, diğer 0,8 | Spesifikasyonda "örnek kahve %80"; diğerleri yaklaşık değer, ileride ayarlanabilir | Teknik |
| 2026-11-04 | Çift kayıt: aynı ml, ±2 dakika → onay sorusu (otomatik reddetme yok) | Gerçekten iki bardak içilmiş olabilir | Teknik |
| 2026-11-04 | Saatlik uyarı eşiği 1.000 ml (yalnızca uyarı) | Spesifikasyon 7.3 "güvenlik üst sınırı" | Spesifikasyon |
| 2026-11-04 | İdeal eğri: uyanıştan uykudan 1 saat öncesine kadar doğrusal | Basit ve açıklanabilir; Faz 1b'de kişisel profile göre şekillenebilir | Teknik |
| 2026-11-04 | Tahmin: ≥3 geçmiş gün varsa "bu saatten sonra geçmişte içilen ortalama", yoksa tempo × kalan süre × 0,8; güven <7 düşük, 7–21 orta, ≥21 yüksek | Spesifikasyon 7.5 | Spesifikasyon |
| 2026-11-04 | Esnek seri: ayda 2 dondurma, otomatik uygulanır; bugün seriyi kırmaz | Spesifikasyon 7.10 | Spesifikasyon |
| 2026-11-04 | Su hedef değişikliği bugünden itibaren geçerli (aynı gün ikinci değişiklik öncekinin yerine geçer) | Geçmiş istatistikler bozulmasın | Spesifikasyon |
| 2026-11-04 | Varsayılan kaplar: Bardak 200, Şişe 500 (varsayılan), Termos 750 | İlk kullanımda boş ekran olmasın | Teknik |
| 2026-11-04 | VAPID anahtarları uygulama tarafından üretilip DB'de (`app_config`) saklanır | Gizli anahtar hiçbir zaman sohbet/çalışma ortamından geçmez; yeniden deploy'da değişmez | Teknik |
| 2026-11-04 | Hatırlatma zamanlayıcısı uygulama süreci içinde (instrumentation), ayrı worker yok | Tek container; birden fazla örnek olursa advisory lock eklenmeli | Teknik |
| 2026-11-04 | Test bildirimleri hatırlatma aralık hesabına girmez | Kullanıcının denemesi gerçek hatırlatmayı bastırmasın | Teknik |
| 2026-11-04 | Analiz kartları şimdilik kural tabanlı; LLM (Claude API) Faz 4'te | API anahtarı yok; kurallar test edilebilir | Teknik |
| 2026-11-04 | Rozetler veriden hesaplanır (ayrı tablo yok); kazanılma günü koşulun ilk sağlandığı gün | Tutarlı ve geri alınabilir | Teknik |
| 2026-11-04 | Bildirimde en fazla 2 buton: "<öneri> ml içtim" + "Sonra" | Android 2 aksiyonu güvenle gösteriyor; iOS buton göstermez | Teknik |
| 2026-11-04 | Test kancaları yalnızca `DGFIT_TEST_HOOKS=1` ile; canlı compose'da tanımlı değil | Üretimde dışarıya açık test ucu olmasın | Teknik |
| 2026-11-04 | **TURKOMP kullanılmıyor** | Resmi sitenin "Veri kullanımı" sayfası (arama sonuçlarındaki alıntılar) yazılı izin olmadan kopyalama/kullanımı yasaklıyor, ticari kullanım ücretli. Resmi sayfa 2026-11-04'te 503 verdi, metin doğrudan okunamadı. İzin alınırsa yeniden değerlendirilir | Kaynak: turkomp.tarimorman.gov.tr/useofdata |
| 2026-11-04 | Ana besin verisi: USDA FoodData Central SR Legacy (CC0, izin gerekmez; FDC'ye atıf yapılır) | fdc.nal.usda.gov | Kaynak |
| 2026-11-04 | Barkodlu ürünler: Open Food Facts API (ODbL); ürün bazında sorgu + önbellek, kaynak etiketi `off`, ekranda "© Open Food Facts katkıcıları"; özel User-Agent | ODbL atıf + paylaşım koşulu; OFF verisi ayrı işaretlenir | Kaynak |
| 2026-11-04 | Türk yemeklerinin besin değerleri tarif gramajından USDA malzemeleriyle hesaplanır; ezberden değer yazılmaz | Halüsinasyon önleme kuralı 6 | Teknik |
| 2026-11-04 | Faz 2 ikiye bölündü: 2a Yemek, 2b Fit | Kapsam büyüklüğü | Teknik |
| 2026-11-04 | Öğün kaydı besin değerlerini anlık kopyalar (`meal_items.per100`) | Besin sonradan düzeltilse de geçmiş günler değişmez | Teknik |
| 2026-11-04 | Tarif kcal'i 100 g başına 1 ondalıkla saklanır; porsiyon değeri malzeme toplamından hesaplanır | Yuvarlama hatası (e2e'de 180 ≠ 179) | Teknik |
| 2026-11-04 | Yemekten gelen su varsayılan kapalı; yalnızca su oranı ≥ %80 olan çorba/içecek/süt-kefir-ayran | Yoğurt, peynir gibi katı besinler sıvı sayılmasın | Teknik |
| 2026-11-04 | OFF ürünleri herkese açık önbellek (`source=off`), kullanıcı besinleri yalnızca sahibine | Aynı barkod tekrar sorgulanmasın; gizlilik | Teknik |
| 2026-11-04 | Dengeleme kuralları: kayıt yoksa ya da hedefin %60'ından azsa dengeleme yok; ±50 kcal "hedefte"; az yemenin en fazla 300 kcal'i eklenir; fark sonraki 7 güne azalan ağırlıkla (1,0…0,4), günlük tavan min(%10, 250) ve cinsiyete göre kalori tabanı | Eksik kayıt yanlış ceza/ödül üretmesin; aşırı açık kas kaybı riskli | Teknik |
| 2026-11-04 | Dengeleme geçmişe yazılmaz: geç kapanan gün farkı bugünden itibaren dağıtılır | Kapanmış günlerin anlık görüntüsü değişmesin | Teknik |
| 2026-11-04 | "İstisna say" yalnızca fazla yenen gün için; kalan düzeltmeler silinir, kilo vermede hedef tarih en fazla 3 gün uzar | Özel günde suçluluk yerine şeffaf takas | Ürün |
| 2026-11-04 | Kalori bankası: etkinlik bugünden 2–14 gün sonra, 100–1500 kcal, etkinlikten önceki en fazla 5 günden eşit biriktirme; iptal yalnızca gelmemiş günleri kaldırır | Toplam plan değişmesin; güvenlik sınırları korunsun | Ürün |
| 2026-11-04 | Adaptif harcama tartılara uydurulan doğrusal eğimle hesaplanır, EMA trend uç noktalarıyla değil | E2E'de EMA gecikmesi harcamayı 2.586 gösterdi (gerçek ≈2.786); regresyonla 2.781 | Teknik |
| 2026-11-04 | Check-in en az 14 gün aralık, 10 tam kayıtlı gün, 5 tartı ister; 7 günde bir, en fazla ±150 kcal, protein sabit (fark %60 karb / %40 yağ) | Gürültüye karşı yavaş ve güvenli ayar | Teknik |
| 2026-11-04 | Egzersiz kalorisi (`burned`) şimdilik 0; Fitness (Faz 3) ile gün kapanışına eklenecek | Antrenman kaydı henüz yok | Teknik |
| 2026-11-04 | Faz 3 ikiye bölündü: 3a çekirdek (kütüphane, program, canlı antrenman, öneri, PR, entegrasyon), 3b gelişim (grafik, ısı haritası, ölçü/fotoğraf, standartlar, periyodizasyon) | Kapsam büyüklüğü | Teknik |
| 2026-11-04 | Hareket verisi: free-exercise-db (Unlicense/kamu malı, 876 hareket + görsel). Görseller VDS'de barındırılır | Lisans temiz; dış siteye istek yok (gizlilik + çevrimdışı) | Kaynak |
| 2026-11-04 | "AI program oluşturucu" 3a'da kural tabanlı (deneyim/gün/ekipman/hedef); dil modeliyle yazım Faz 4'te | API anahtarı yok; kurallar test edilebilir | Teknik |
| 2026-11-04 | Kod GitHub'da (`xpike-dgm/dgmfit`, kullanıcı oluşturdu ve push onayı verdi); oturum klonu `/home/user/dgmfit` | Kalıcılık + proje izin kuralları | Altyapı |
| 2026-11-04 | Öneri motoru: Epley (tekrar + RIR) e1RM; çift aşamalı ilerleme; ağırlık "aynı + 1 tekrar" adımında düşmez; yorgunluk 1 düşüş = sabit, 2 ardışık %3+ düşüş = %10 deload; ilk 2 kayıt düşük güven | Spesifikasyon 4.4; geri adım hissi vermesin | Teknik |
| 2026-11-04 | Temkinli öneri eşiği: plan açığı > 750 kcal ya da ağrı notu (dengeli 0,5 kg/hafta ≈ 550 kcal temkin tetiklemez) | 500 eşiği varsayılan planda artışı tamamen durduruyordu | Ürün |
| 2026-11-04 | Egzersiz kalorisi Fit'e **net** eklenir: (MET − 1) × kg × saat; koşu/yürüyüşte ACSM hız denklemi, nabız varsa Keytel (2005); ağırlıkta MET 3,5 / 6,0 (dakikada 0,4+ set) | Dinlenme harcaması TDEE'de zaten var; çift sayım olmasın | Teknik |
| 2026-11-04 | Antrenman günü su hedefi: antrenman + kardiyo dakikası × 500 ml/saat (50 ml'ye yuvarlı); Su ekranı, istatistik, Bugün ve hatırlatmalar aynı eki kullanır | Spesifikasyon 9 entegrasyon tablosu | Teknik |
| 2026-11-04 | Öneri canlı modda istemcide hesaplanır (geçmiş sayfayla gelir) | Salonda bağlantı kopsa da çalışsın | Teknik |
| 2026-11-04 | Çevrimdışı: canlı taslak localStorage'da, bitirilen antrenman kuyruğa; `client_id` ile sunucuda tekrar kaydı engellenir | Spesifikasyon 4.3 "çevrimdışı çalışır"ın 3a kapsamı | Teknik |
| 2026-11-04 | En ağır kiloyla aynı değerdeki 3/5/10RM rekorları ayrıca gösterilmez; hareketin ilk kaydı rekor sayılmaz | Rekor gürültüsü | Ürün |
| 2026-11-04 | 5/3/1 ve nSuns (yüzdelik TM şemaları) 3b'ye; GZCLP 3a'da basitleştirilmiş (çift aşamalı ilerleme) | Periyodizasyonla birlikte doğru yapılsın | Kapsam |
| 2026-11-05 | 5/3/1 ve nSuns yüzdeleri eklenmedi: birincil kaynak doğrulanamadı | Halüsinasyon kuralı: sayılar ezberden yazılmaz | Kapsam |
| 2026-11-05 | GZCLP: T1 5×3→6×2→10×1, T2 3×10→3×8→3×6, T3 3×15 (son set 25 → artış), alt vücut +5 / üst +2,5 kg (kaynaklı); T1 sıfırlama %85 ve T2 dönüşü son başarılı 3×10 + 1 kademe (DgFit seçimi, ekranda açıklanır) | Kaynakta yazmayan kısımlar açıkça işaretli | Teknik |
| 2026-11-05 | Kuvvet seviyesi eşikleri DgFit'in kaba e1RM/vücut ağırlığı rehberi; ekranda "yayımlanmış standart değil" yazar | Lisanslı tablo kopyalanmadı, kaynak iddiası yok | Ürün |
| 2026-11-05 | Toparlanma: 24 sa içinde ya da 48 sa içinde 4+ set → kırmızı, 72 sa içinde → sarı (yaygın 48–72 sa rehberinin basit uygulaması) | Spesifikasyon 4.5 ısı haritası | Teknik |
| 2026-11-05 | Periyodizasyon dağılımları (DUP ağır/orta/hafif, 4 haftalık blok, deload: set ½, RIR +2, yük %90) DgFit tasarımı | Spesifikasyon 4.2 | Teknik |
| 2026-11-05 | Fotoğraflar DB'de AES-256-GCM (anahtar sunucu `.env` `DGFIT_MEDIA_KEY`, AAD kullanıcı kimliği); istemcide 1280 px JPEG'e küçültülür (EXIF/konum düşer); yalnızca sahibine `/api/media/[id]`, başkasına 404; silmede şifreli veri boşaltılır | Spesifikasyon 4.5 "özel ve şifreli"; yedekte de şifreli kalır | Güvenlik |
| 2026-11-05 | Kilit ekranı dinlenme bildirimi: sunucu tek süreçte setTimeout ile Web Push (kullanıcı başına 1); uygulama görünürken SW göstermez | Sayfa uykudayken JS çalışmaz | Teknik |
| 2026-11-05 | 783 hareket için tam çeviri yerine kaynaktan kısa Türkçe özet (3–5 adım) | Kullanıcı seçimi (maliyet) | Ürün |
| 2026-11-05 | ~~AI modeli: Claude'da her yerde `claude-haiku-5-5`~~ (aynı gün karma modelle değişti, aşağıda); sağlayıcı sırası Claude → OpenAI, kota/limit/sunucu hatasında otomatik geçiş; üçüncü sağlayıcı ("Evren") bilgisi gelince | Kullanıcı kararı (maliyet) | Ürün |
| 2026-11-05 | AI anahtarları yönetici sayfasından girilir, DB'de AES-256-GCM ile şifreli; yönetici `DGFIT_ADMINS` (başlangıç: `deneme`) | Anahtar sohbete/depoya girmesin (kullanıcı kararı) | Güvenlik |
| 2026-11-05 | Faz 4 ikiye bölündü: 4a altyapı + Yemek/Su AI kaydı, 4b koç/rapor/öneri | Kapsam | Kapsam |
| 2026-11-05 | OpenAI varsayılan modeli `gpt-6-luna` (resmi modeller sayfası: "cost-sensitive, high-volume"; $0,10/$0,50); yönetici sayfasından değiştirilebilir | Haiku 5.5 ile aynı fiyat düzeyi | Ürün |
| 2026-11-05 | AI yalnızca ad + gram (fotoğraf/metin) ya da etikette yazan sayıları verir; kalori/makro besin veritabanından motor hesaplar; kullanıcı onaylamadan hiçbir şey kaydedilmez | Spesifikasyon 10: "Sayıları her zaman motorlar hesaplar" | Ürün |
| 2026-11-05 | Önbellek görev + girdi özeti (sha256) ile sunucu geneli, 30 gün; içerik saklanmaz, yalnızca sonuç JSON'u | Maliyet; kişisel veri tutulmaz | Teknik |
| 2026-11-05 | Kullanıcı başına günlük AI hakkı varsayılan 25 başarılı çağrı (önbellek sayılmaz), yönetici değiştirir | Spesifikasyon 10 "adil kullanım kotası" | Ürün |
| 2026-11-05 | Hata → geçiş: 429 kota (6 sa bekleme), 429 hız (60 sn), 401/403 (30 dk), 5xx/529 (30 sn), bağlantı (15 sn); hepsinde sıradaki sağlayıcı | Kullanıcı isteği "limit bitince diğerine geçsin" | Teknik |
| 2026-11-05 | Karma model: Claude'da öğün fotoğrafı ve etiket `claude-opus-5-5`, yazı/ses `claude-haiku-5-5` (`ai_providers.task_models`, yönetici sayfasından görev başına değişir; boş = varsayılan model). OpenAI tüm görevlerde `gpt-6-luna` | Kullanıcı kararı: "fotoğrafa opus" (görsel doğruluk); yazı ucuz kalsın | Ürün |
| 2026-11-05 | Opus/Sonnet 5.5 çağrılarında sunucu tarafı yedek açık (`betas: server-side-fallback-2026-07-01`, `fallbacks: 'default'`): Opus reddederse istek başka modelle yanıtlanır ve o modelin fiyatından faturalanır; kullanıcı isterse kapatılır | Reddetme durumunda kullanıcı boş sonuç almasın | Teknik |
| 2026-11-05 | Maliyet tablosu: bu ayın başarılı, önbellek dışı çağrıları için model × görev token toplamı × liste fiyatı (`PRICES`, engine.ts); "tahmini" olarak etiketli, fatura sağlayıcı panelinden | Kullanıcı fotoğraf başı maliyeti görmek istedi | Ürün |
| 2026-11-05 | Faz 4b ikiye bölündü: 4b koç sohbeti + günlük içgörü + haftalık rapor + güvenlik sınırları; 4c AI menü/alışveriş, elimdekiler tarifi, restoran modu, AI program oluşturucu, senaryo simülatörü | Her faz sonunda kullanılabilir sürüm (spesifikasyon 14) | Kapsam |
| 2026-11-05 | Koç bağlamı: her mesajda motorların hesapladığı kısa Türkçe özet (profil, hedef, bugün, son 7 gün, kilo trendi + adaptif TDEE, program, güvenlik bayrakları) + son 10 mesaj; uzun geçmiş gönderilmez | Spesifikasyon 10 "uzun geçmiş yerine özetlenmiş bağlam" | Teknik |
| 2026-11-05 | Koç eylemleri yalnızca 3 tür (hedef tarihi ±12 hafta, programa hareket, su); öneri anında ve onayda iki kez doğrulanır; hedef kısaltma `computePlan` güvenli değilse ya da güvenlik bayrağı varsa reddedilir; tarih değişince günlük kalori bir sonraki check-in'de güncellenir | Spesifikasyon 10 "kullanıcı onayıyla" | Ürün |
| 2026-11-05 | "Yarının menüsünü hazırla" eylemi 4c'ye (menü motoruyla birlikte) | Kapsam | Kapsam |
| 2026-11-05 | Günlük içgörü ve haftalık rapor dil modeli metnindeki her sayı motorun izinli sayılarından gelmeli (`numbersAllowed`); değilse kural metni gösterilir | Halüsinasyon önleme (CLAUDE.md kural 6) | Teknik |
| 2026-11-05 | İçgörü/rapor çağrıları kullanıcının günlük AI hakkına sayılmaz (dönem başına 1 kayıt, sistem tetikli); koç sohbeti sayılır | Spesifikasyon 11.5 | Ürün |
| 2026-11-05 | Güvenlik eşikleri (DgFit tasarımı): çok düşük gün = ≥2 kalem ve < taban × 0,75; son 7 günde ≥3 gün → bayrak; 7/7 antrenman günü → dinlenme uyarısı; ort. egzersiz ≥ 800 kcal ve yenen < taban → yakıt uyarısı. Riskli ifade (kusma, laksatif, aç kalma, kendine zarar) sunucu kalıbı + model bayrağı; kriz kartında 112 | Spesifikasyon 10 ve 13; tıbbi teşhis yok | Güvenlik |
| 2026-11-05 | Haftalık rapor Pazar 18.00'de hazır, push Pazar 19.00 sonrası ilk tikte haftada bir (`report.pushed` olayı); AI metni ilk açılışta üretilip saklanır | Maliyet: yalnızca açılan rapora çağrı | Teknik |
| 2026-11-05 | Menü/elimdekiler/restoran isteklerinde modele DgFit'in Türkçe adlı besin kataloğu (≈185 ad) verilir; dönen ad önce katalogda birebir (parantezli/parantezsiz, takma ad), sonra kullanıcı aramasıyla eşleşir | "pizza → Pizza rolls" gibi zayıf USDA eşleşmelerini azaltmak | Teknik |
| 2026-11-05 | Menü ölçekleme: günün tüm gramları tek katsayıyla (0,7–1,35, 5 g) Fit hedef kalorisine; sınıra takılırsa uyarı. Alışveriş listesinde hazır yemekler tarif malzemelerine açılır (gram × malzeme / pişmiş ağırlık), su yazılmaz | Spesifikasyon 6.4; sayılar motordan | Ürün |
| 2026-11-05 | Restoran sıralaması (DgFit kuralı): bütçeyi aşmayanlar önce; aşmayanlarda kalan bütçenin %35–90'ını dolduran ve protein kalori oranı yüksek olan üstte; aşanlarda en az aşan | Spesifikasyon 6.4 "kalan bütçeye en uygun 3" | Ürün |
| 2026-11-05 | Restoran menüsü görevi de Claude'da Opus 5.5 (görsel okuma; karma model kararıyla tutarlı), migration 0010 mevcut satıra ekler | Kullanıcı kararı "fotoğrafa opus" | Ürün |
| 2026-11-05 | AI program: model yalnızca küratörlü + ekipmana uygun hareket listesinden seçer; kural motoru yeni başlayanda set ≤ 4 ve RIR ≥ 1, süreli harekette tekrar 1, seans başına ~9 dk/hareket (3–9), fazla gün ve bilinmeyen hareketi atar, haftalık set 10–20 bandına göre uyarır; yeni program yalnızca aktif program yoksa aktif olur | Spesifikasyon 4.2 + 10 "dil modeli + kurallar" | Ürün |
| 2026-11-05 | Karb döngüsü (DgFit kuralı): antrenman günü +X g (10–100, varsayılan 40), dinlenme günü −X × n/(7−n), dinlenme karbonhidratı ≥ 50 g; protein/yağ sabit, kalori ±4 kcal/g; yalnızca açık günlere (kapanmış günlerin anlık görüntüsü değişmez) | Spesifikasyon 5.6; haftalık toplam korunur | Ürün |
| 2026-11-05 | Senaryo simülatörü dil modeli kullanmaz: ölçülen (yoksa plan) TDEE + MET ile ek kardiyo + günlük kalori değişikliği → 7.700 kcal/kg ile tempo ve tarih; taban altı ve %1/hafta üstü uyarı | Sayılar motordan (CLAUDE.md kural 6) | Teknik |
| 2026-11-05 | Spesifikasyon 11.5'ten sapma: menü, elimdekiler, restoran ve AI program istekleri de kullanıcının günlük AI hakkına sayılır (kullanıcı tetikli, en pahalı çıktılar); menü ayrıca saatte 6 ile sınırlı | Maliyet kontrolü (uygulama ücretsiz) | Ürün |
