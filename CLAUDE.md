# DgFit — çalışma kuralları (önce bunu oku)

DgFit; Fitness, Fit, Yemek, Su ve Sosyal modüllerinden oluşan, tek kullanıcı profili etrafında entegre çalışan Türkçe bir PWA'dır.
Canlı adres: https://dgfit.dgmcraft.online · Ürün spesifikasyonu: https://claude.ai/artifact/JLv5aXfFHPyco87Ee8nRNe

## Kalıcı hafıza

Hafıza `memory/` klasöründedir ve repo ile birlikte her sürümde sunucuya gider.

| Dosya | İçerik |
| --- | --- |
| `memory/STATE.md` | Şu anki faz, faz tablosu, her fazın kanıtı (commit, test, deploy), sıradaki işler |
| `memory/ARCHITECTURE.md` | Teknoloji yığını, klasör haritası, kodlama kuralları, veri modeli |
| `memory/DECISIONS.md` | Tarihli karar kaydı (spesifikasyondan sapmalar dahil) |
| `memory/INFRA.md` | Sunucu, DNS, Caddy, deploy, yedek, geri dönüş, hafızayı geri yükleme |
| `memory/LOG.md` | Kronolojik çalışma günlüğü |
| `memory/manifest.json` | Makine tarafından doğrulanan iddialar (dosyalar, tablolar, rotalar, olaylar, bağımlılıklar) |

## Halüsinasyon önleme kuralları

1. **Hafıza ≠ gerçek.** Bir dosyanın, fonksiyonun, tablonun var olduğunu söylemeden önce koda bak (`grep`, `cat`). Hafızadaki bilgi yalnızca nereye bakacağını söyler.
2. **Kanıtsız kayıt yok.** `STATE.md` ve `LOG.md`'ye yalnızca doğrulanmış şeyler yazılır; her satırda kanıt olur (commit hash, test sonucu, deploy kimliği, canlı kontrol çıktısı). Doğrulanmamış iş "planlandı" olarak yazılır, "tamamlandı" olarak değil.
3. **Makine kontrolü.** `node scripts/memory-check.mjs` manifest'teki her iddiayı koda karşı doğrular. Uyuşmazlık varsa önce hafıza düzeltilir.
4. **Sürüm bilgisi uydurulmaz.** Next.js 16 eğitim verisinden farklıdır: API kullanmadan önce `node_modules/next/dist/docs/` altındaki ilgili belgeyi oku.
5. **Bitti demek = test geçti.** Bir faz yalnızca `scripts/verify.sh` (memory-check + typecheck + birim test + build + e2e) geçince ve canlıda kontrol edilince tamamlanmış sayılır.
6. **Sayılar hesaplanır.** Kalori, makro, su gibi değerler `lib/calc.ts` içindeki test edilmiş fonksiyonlardan gelir; elle yazılmaz.

## Faz ritüeli

**Faz başında:**
1. `memory/STATE.md`, `memory/ARCHITECTURE.md`, `memory/DECISIONS.md` dosyalarını oku.
2. `node scripts/memory-check.mjs` çalıştır; hata varsa hafızayı koda göre düzelt.
3. `git log --oneline | head` ile son commit'in STATE.md'deki kanıtla uyuştuğunu kontrol et.
4. STATE.md'de fazı "devam ediyor" yap, fazın kapsamını (spesifikasyondan) ve kabul kriterlerini yaz; LOG.md'ye başlangıç kaydı ekle.

**Faz sonunda:**
1. `scripts/verify.sh` geçmeli.
2. `memory/manifest.json`, ARCHITECTURE.md, DECISIONS.md güncellenir; `node scripts/memory-check.mjs` geçmeli.
3. Commit → `scripts/bundle.sh` → `scripts/deploy.sh` → canlı e2e.
4. STATE.md'de fazı "tamamlandı" yap ve kanıtları yaz; LOG.md'ye bitiş kaydı ekle.

## Komutlar

```bash
npm test                         # birim testler (node:test)
npx tsc --noEmit                 # tip kontrolü
node scripts/memory-check.mjs    # hafıza ↔ kod doğrulaması
./scripts/verify.sh              # hepsi + build + yerel e2e (yerel Postgres gerekir)
./scripts/bundle.sh              # release.tgz üretir
DGFIT_DEPLOY_TOKEN=... ./scripts/deploy.sh   # canlıya yükler (token: INFRA.md)
```
