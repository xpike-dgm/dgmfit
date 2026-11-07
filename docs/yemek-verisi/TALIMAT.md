# DgFit yemek verisi — başka bir yapay zekâ için talimat

Bu metni, yemek verisi toplayan yapay zekâya olduğu gibi ver. Çıktısı tek bir JSON dosyası olmalı; DgFit bu dosyayı
`scripts/food-import.mjs` ile doğrular, tekrarları ayıklar ve ekler.

## Görev

Türkiye'de yaygın tüketilen besinler, ev yemekleri ve paketli ürünler için aşağıdaki biçimde bir JSON dosyası üret.
Biçim adı `dgfit-yemek/1`. Örnek dosya: `SABLON.json` (örnek kayıtları ve `$sablon` satırını silerek kullan).

## En önemli kural: besin değerini uydurma

DgFit'te kalori ve makro değerleri **hesaplanır**, elle yazılmaz. Bu yüzden üç tür kayıt var ve yalnızca üçüncüsünde sayı yazılır:

| Bölüm | Ne yazarsın | Değerler nereden gelir |
| --- | --- | --- |
| `besinler` | Türkçe ad + **USDA SR Legacy** karşılığı (`usda`: FDC numarası, ör. `168421`, ya da birebir İngilizce açıklama) | USDA veritabanından |
| `yemekler` | Malzemeler ve gramları + pişmiş toplam ağırlık | Malzemelerden hesaplanır |
| `urunler` | Elindeki **hazır 100 g değerleri** (paketli ürün, hazır yemek, genel besin fark etmez) | Olduğu gibi kabul edilir |

Elinde zaten 100 g değerleri olan veriler (binlerce satır) için `urunler` bölümünü ya da aşağıdaki **CSV** biçimini kullan;
tek tek araştırma, etiket fotoğrafı ya da barkod gerekmez. Yalnız fiziksel olarak imkânsız satırlar (aşağıdaki denetimler) ayrılır.

## Alanlar

### besinler (tek malzeme)
- `ad` (2–80 karakter, Türkçe, ör. "Kırmızı mercimek (kuru)")
- `kategori` (ör. Sebzeler, Meyveler, Bakliyat, Tahıllar, Süt ürünleri, Et, Kümes hayvanları, Balık, Kuruyemiş, Yağlar, İçecekler, Baharat)
- `usda`: USDA FoodData Central **SR Legacy** kaydı. Önce FDC numarası (`fdc_id`, sayı), bulamazsan birebir İngilizce açıklama.
  Pişmiş/çiğ durumuna dikkat et (ör. "Lentils, mature seeds, cooked, boiled, without salt" ile "Lentils, raw" farklıdır).
- `porsiyonlar`: `[["1 su bardağı", 200], ["1 adet", 120]]` (gram, ev ölçüsünün gerçek ağırlığı)
- `esanlamlar` (isteğe bağlı): aramada bulunsun diye başka adlar
- `anahtar` (isteğe bağlı): küçük harf, rakam ve tire (ör. `kirmizi-mercimek`). Yemek malzemelerinde bu anahtarla ya da adla anılır.

### yemekler (tarif)
- `ad`, `kategori` (Çorbalar, Ana yemekler, Zeytinyağlılar, Pilavlar, Hamur işleri, Tatlılar, Salatalar, Kahvaltılık…)
- `malzemeler`: `{ "anahtar ya da ad": gram, … }` — **çiğ** gramlar, tipik ev tarifi (4–6 kişilik). Su da yazılır (ör. `"su": 1200`).
  Malzeme DgFit'te zaten varsa onun anahtarını kullan (liste aşağıda nasıl alınır), yoksa önce `besinler`e ekle.
- `pismis_agirlik`: tencerede çıkan toplam pişmiş ağırlık (g). Çiğ toplamın %40–130'u arasında olmalı.
- `porsiyonlar`: `[["1 kase", 250], ["1 tabak", 300]]`

### urunler (hazır 100 g değerleri)
- `ad` (zorunlu), `kategori` (zorunlu), `marka` ve `barkod` (EAN-13/EAN-8/UPC) isteğe bağlı. Barkodun sağlama basamağı tutmazsa ürün barkodsuz eklenir.
- `100g`: `kcal`, `protein`, `karbonhidrat`, `yag` zorunlu; `lif`, `seker`, `doymus_yag`, `sodyum_mg` ya da `tuz_g` isteğe bağlı
- `kaynak` isteğe bağlı (satır başına ya da dosyanın en üstünde bir kez; uygulamada "Kaynak: …" olarak görünür)

## Toplu veri: CSV
Binlerce satır için en kolayı CSV. İlk satır başlık; sütun sırası serbest; virgül ya da noktalı virgülle ayrılabilir
(noktalı virgüllü dosyada ondalık virgül olur: `1,7`). Örnek: `SABLON.csv`.

| Sütun | Zorunlu | Örnek |
| --- | --- | --- |
| `ad` | evet | Ayran |
| `kategori` | evet | İçecekler |
| `kcal`, `protein`, `karbonhidrat`, `yag` | evet | 36 · 1,7 · 2,6 · 2 |
| `marka`, `barkod` | hayır | Sütaş · 8690000000029 |
| `lif`, `seker`, `doymus_yag`, `sodyum_mg` ya da `tuz_g` | hayır | 0 · 2,6 · 1,3 · 0,6 |
| `porsiyon` | hayır | `1 kutu=200|1 bardak=250` (ad=gram, `|` ile ayrılır) |
| `esanlamlar` | hayır | `ayran içeceği|yayık ayranı` |
| `kaynak` | hayır | TÜRKOMP |

Değerler her zaman **100 g** içindir (porsiyon değil). Aynı ad + marka ya da aynı barkod zaten varsa satır atlanır.

## Denetimler (yalnız bunlara takılan satırlar ayrılır)
- USDA karşılığı bulunmalı (bulunamazsa araç yakın kayıtları önerir)
- Ürünlerde: 100 g'da en fazla 900 kcal, makrolar toplamı en fazla 105 g (etiket yuvarlaması payı), kalori makrolarla uyumlu (4/4/9), şeker ≤ karbonhidrat, doymuş yağ ≤ yağ
- Tariflerde: tüm malzemeler bulunmalı; pişmiş ağırlık çiğ toplamla tutarlı olmalı
- Porsiyon gramı 1–3000
- Aynı ad, anahtar ya da barkod zaten varsa kayıt **atlanır** (tekrar eklenmez)
- Kategorisine göre olağan dışı kalori **uyarı** verir (ör. 100 g'da 400 kcal'lik "sebze")

## Mevcut anahtarlar
DgFit'teki besin ve yemek anahtarları `data/tr-foods.json` ve `data/tr-dishes.json` içinde (`k` alanı). Tariflerde bunları kullan
(ör. `sogan`, `zeytinyagi`, `tereyagi`, `un`, `salca-domates`, `su`, `tuz`).

## İçe aktarma (DgFit tarafı)
```bash
node --experimental-strip-types scripts/food-import.mjs gelen.json            # rapor: hatalar, uyarılar, atlananlar, hesaplanan değerler
node --experimental-strip-types scripts/food-import.mjs gelen.json --uygula   # hata yoksa ekler ve besin verisini yeniden derler
node --experimental-strip-types scripts/food-import.mjs veri.csv --uygula --hatalilari-atla   # bozuk satırları rapora ayırır, kalanı ekler
```
Tam rapor `<dosya>.rapor.txt` olarak yazılır (hatalı satırlar CSV satır numarasıyla).
Sonra normal yayın akışı (`./scripts/verify.sh` → `./scripts/release.sh`) yeni besinleri canlıya taşır.
