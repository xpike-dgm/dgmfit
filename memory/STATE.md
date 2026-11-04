# Proje durumu

**Şu anki faz: Faz 1a — Su modülü çekirdeği (devam ediyor, başlangıç 2026-11-04)**

Kural: "tamamlandı" yalnızca kanıtla yazılır. Kanıtsız iş "planlandı" ya da "devam ediyor" olarak kalır.

## Faz tablosu

| Faz | Kapsam | Durum | Kanıt |
| --- | --- | --- | --- |
| 0 | PWA kabuğu, tasarım token'ları, kayıt/giriş, 11 adımlı profil sihirbazı, plan hesapları, Bugün ekranı, profil, kilo girişi, modül yer tutucuları, sunucu altyapısı | tamamlandı | commit `2c7f978` + `dce73c0`; birim test 7/7; yerel e2e OK; canlı e2e OK (test kullanıcısı silindi); deploy `2026-11-04T15-10-22-113Z` DEPLOY OK; SW kayıtlı + çevrimdışı sayfa doğrulandı |
| 1a | Su modülü çekirdeği (aşağıda) | devam ediyor | — |
| 1b | Su: akıllı push hatırlatmaları, sesli kayıt, AI analiz, gelişmiş istatistik, rozetler, görünüm seçenekleri | planlandı | — |
| 2 | Yemek + Fit (besin veritabanı, öğün kaydı, kalori dengeleme, adaptif TDEE) | planlandı | — |
| 3 | Fitness (hareket kütüphanesi, program, canlı antrenman, AI ağırlık önerisi, PR) | planlandı | — |
| 4 | AI katmanı (fotoğraf/ses kaydı, koç, raporlar) | planlandı | — |
| 5 | Sosyal | planlandı | — |
| 6 | Mağaza sürümü ve cihazlar (isteğe bağlı) | planlandı | — |

## Faz 1a kapsamı ve kabul kriterleri

Kaynak: spesifikasyon bölüm 7 (Su modülü).

- [ ] Veri modeli: `water_logs` (ml, içecek türü, hidrasyon katsayısı, kap, kaynak, zaman, yumuşak silme, düzenleme geçmişi), `water_containers`, `water_settings` (miktar butonları, yudum hacmi, haftalık hedef planı), hedef tarihçesi geçmişi bozmaz
- [ ] Kayıt: tek dokunuş butonları (özelleştirilebilir), sık kullanılan miktarları öğrenme, yudum kaydı + kalibrasyon, kap tanımlama, doluluk seçerek ekleme, "şişemi bitirdim"/yarım/çeyrek, geçmişe kayıt, 5 sn geri al, çift kayıt uyarısı
- [ ] İçecek türleri ve hidrasyon katsayısı (su, çay, kahve, maden suyu, ayran, meyve suyu)
- [ ] Hedef: kişisel taban + haftanın günlerine farklı hedef; günü uyanış–uyku aralığına bölen ideal eğri; gerçek zamanlı tempo; hedefe ulaşma tahmini ve saati; dağılım skoru
- [ ] Zaman çizelgesi: kronolojik liste, düzenleme, silme, birleştirme, kaynağını gösterme, takvimden geçmiş güne gitme
- [ ] İstatistik: saatlik dağılım, son 7/30 gün grafiği, ortalama, en iyi/en kötü gün, hedef tamamlama oranı, seri ve esnek seri (ayda 2 dondurma)
- [ ] Bugün ekranı entegrasyonu: su kartı gerçek veri, hafta şeridi halkaları su ilerlemesiyle; `water.logged` olayı yayınlanır
- [ ] Testler: hesaplama birim testleri (ideal eğri, tempo, tahmin, dağılım skoru, seri, çift kayıt, sık miktar) + e2e (ekle, geri al, kap, yudum, düzenle, sil, geçmiş gün)
- [ ] `scripts/verify.sh` geçer, canlıda e2e geçer, hafıza güncellenir

## Sıradaki işler

1. Faz 1a'yı yukarıdaki kriterlere göre tamamla.
2. TURKOMP lisansını kontrol et (Faz 2 öncesi).
3. E-posta doğrulama kodu (Mailu SMTP) — ertelendi.

## Bilinen eksikler / borçlar

- `daily_targets` tablosu henüz doldurulmuyor (Faz 2'de kalori dengelemeyle).
- Seri sayacı Bugün ekranında sabit 0 (Faz 1a ile su serisinden beslenecek).
- Yasal metinler TASLAK; hukuk kontrolü gerekli.
- Bu çalışma ortamında GitHub erişimi yok (GH_TOKEN geçersiz); kod sunucudaki `repo.bundle` ile korunuyor.
