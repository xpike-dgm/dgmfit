# Altyapı

Son doğrulama: 2026-11-04 (canlı health, deploy log, docker stats).

## Sunucu

- VDS: Ubuntu 24.04, 8 çekirdek, 16 GB RAM (boş ~3,5 GB, swap dolu — sunucuda build yapma), disk ~26 GB boş.
- Erişim: `vds_sabit` MCP sunucusu (root). Bu ortamdan SSH kapalı, HTTPS açık.
- Dış IP: `176.96.128.247` (ikinci IP 212.38.88.237 başka servislerde).
- **Dokunulmayacaklar:** `/opt/dgmcraft` (MCP talimatı) ve `/opt/dgfit` + `fit.dgmcraft.online` (kullanıcının ayrı SparkyFitness tabanlı uygulaması). İsim benzerliğine dikkat: bizim uygulama `/opt/dgfit-pwa`.

## DNS

- GoDaddy, sunucuda `gddy` CLI. Kayıt: `dgfit.dgmcraft.online  A  176.96.128.247  TTL 600` (`gddy dns add`, mevcut kayıtlara dokunulmadı).

## Uygulama yerleşimi (`/opt/dgfit-pwa`, izin 700)

| Yol | İçerik |
| --- | --- |
| `docker-compose.yml` | proje adı `dgfitpwa`; `db` (postgres:17-alpine, 512 MB), `app` (node:22-bookworm-slim, 768 MB, `node migrate.mjs && node server.js`) |
| `.env` | `POSTGRES_PASSWORD`, `SESSION_SECRET` (600; içeriği hafızaya yazılmaz) |
| `current` → `releases/<id>` | çalışan sürüm (symlink, container'a salt okunur bağlanır) |
| `releases/` | son 5 sürüm; her birinde `source.tgz`, `repo.bundle`, `REVISION` |
| `data/pg` | Postgres verisi |
| `uploads/` | ileride kullanıcı dosyaları (`/data/uploads`) |
| `backups/` | günlük `pg_dump -Fc`, 14 gün (`/etc/cron.d/dgfit-pwa-backup`, 03:41) |
| `deploy/token` | deploy token'ı (600) |
| `deploy/receiver.js` | systemd `dgfit-pwa-deploy.service`, `127.0.0.1:3931` |
| `deploy/activate.sh` | symlink değiştir → app'i yeniden oluştur → `/api/health` bekle → başarısızsa önceki sürüme dön |
| `deploy/backup.sh` | yedek betiği |

Portlar: app `127.0.0.1:3930`, deploy alıcısı `127.0.0.1:3931`.

## Caddy

- Site bloğu: `/etc/caddy/dgfit-pwa.caddy` (izin **644** olmalı; 600 iken reload başarısız oldu).
- Ana Caddyfile'a yalnızca `import /etc/caddy/dgfit-pwa.caddy` eklendi; yedek: `/etc/caddy/Caddyfile.pre-dgfit-pwa-<zaman>`.
- `/_deploy*` → 3931 (300 MB gövde, 10 dk zaman aşımı); `/media/*` → `/srv/dgfit-media` dosya sunucusu (1 yıl önbellek); diğer her şey → 3930.
- Hareket görselleri (Faz 3a): `/srv/dgfit-media/exercises/<id>/0.jpg|1.jpg` (free-exercise-db, 1.746 jpg, 102 MB, kaynak commit `/srv/dgfit-media/exercises.REVISION`). `/opt/dgfit-pwa` 700 olduğu için Caddy oradan okuyamaz; görseller bu yüzden `/srv` altında. Caddy yedeği: `/etc/caddy/dgfit-pwa.caddy.pre-media-<zaman>`. Görseller yerel testte yoktur (e2e `/media/` 404'lerini yok sayar).
- Değişiklikten önce: `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`, sonra `systemctl reload caddy`.

## Deploy akışı

1. Yerelde: `./scripts/bundle.sh` → `release.tgz` (~30 MB; standalone + static + public + drizzle + migrate.mjs + besin ve hareket tohumu + source.tgz + repo.bundle).
2. `./scripts/deploy.sh` → `POST https://dgfit.dgmcraft.online/_deploy`. Token `DGFIT_DEPLOY_TOKEN` ortam değişkeninden ya da `~/.config/dgfit/deploy-token` dosyasından (repo dışında; pakete girmez) okunur.
   Tek komut: `./scripts/release.sh [e2e adları]` = paket + deploy + sağlık + test kancası 404 kontrolü + canlı e2e (push hariç).
3. Yanıt `DEPLOY OK <id>` olmalı. Bağlantı koparsa: `curl -H "Authorization: Bearer <token>" https://dgfit.dgmcraft.online/_deploy/log`.
4. Token'ı almak için (MCP): `cat /opt/dgfit-pwa/deploy/token`.

## Hafızayı / kodu geri yükleme (yeni oturumda)

Asıl kaynak GitHub: **https://github.com/xpike-dgm/dgmfit** (dal `main`; 2026-11-04'ten beri her commit push edilir). Oturumda klon yolu `/home/user/dgmfit` (eski yerel klasör `/home/user/dgfit` artık kullanılmıyor). Proje izin kuralları `.claude/settings.json`'da.
Yeni bulut oturumunda deploy token'ı `~/.config/dgfit/deploy-token` dosyasına MCP ile alınır (`cat /opt/dgfit-pwa/deploy/token`).

Yedek yol: kod ve hafıza sunucuda her sürümün `repo.bundle` dosyasındadır:

```bash
TOKEN=<MCP ile: cat /opt/dgfit-pwa/deploy/token>
curl -fsS -H "Authorization: Bearer $TOKEN" https://dgfit.dgmcraft.online/_deploy/repo.bundle -o /tmp/repo.bundle
git clone /tmp/repo.bundle /home/user/dgfit && cd /home/user/dgfit && npm ci
```

Yerel test DB'si: `apt-get install -y postgresql && service postgresql start`, ardından `dgfit/dgfit` kullanıcı ve veritabanı (bkz. `scripts/verify.sh`).

## Bildirimler

- VAPID anahtarı DB'de: `select value->>'publicKey' from app_config where key='vapid'` (özel anahtarı yazdırma).
- Zamanlayıcı logu: `docker compose logs app | grep zamanlayıcı`.
- Push e2e yalnızca yerelde (`TEST_CA_DIR` + `NODE_EXTRA_CA_CERTS`, `verify.sh` kurar). `DGFIT_TEST_HOOKS` canlıda asla açılmaz.

## Kullanıcı verisi temizliği

Test kullanıcıları `test_` / `dbg_` önekiyle açılır ve testten sonra silinir (kullanıcının `deneme` hesabı korunur):
`docker compose exec -T db psql -U dgfit -d dgfit -c "delete from users where username like 'test\_%' or username like 'dbg\_%'"`
