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
