#!/bin/bash
# Standalone sürüm paketi: dist/ altında çalıştırılabilir uygulama + release.tgz
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist
NEXT_TELEMETRY_DISABLED=1 npx next build >/tmp/dgfit-build.log 2>&1 || { tail -50 /tmp/dgfit-build.log; exit 1; }
cp -a .next/standalone/. dist/
mkdir -p dist/.next && cp -a .next/static dist/.next/static
# standalone çıktısı izlenen public dosyalarını (ör. görsel yazı tipleri) zaten kopyalar; iç içe "public/public" olmasın
mkdir -p dist/public && cp -a public/. dist/public/
[ -f dist/public/sw.js ] && [ -f dist/public/fonts/manrope-700.ttf ] || { echo "PAKET: public eksik"; exit 1; }
cp -a drizzle dist/drizzle
cp scripts/migrate.mjs dist/migrate.mjs
mkdir -p dist/data && cp data/foods-seed.json.gz data/exercises-seed.json.gz dist/data/
rm -rf dist/node_modules/postgres && cp -a node_modules/postgres dist/node_modules/postgres
# kaynak kod yedeği (sunucuda arşivlenir)
tar --exclude=node_modules --exclude=.next --exclude=dist --exclude=.git --exclude=release.tgz -czf dist/source.tgz .
git bundle create dist/repo.bundle --all >/dev/null 2>&1 || true
git rev-parse --short HEAD 2>/dev/null > dist/REVISION || date -u +%Y%m%d%H%M > dist/REVISION
tar -czf release.tgz -C dist .
ls -la release.tgz | awk '{print "release.tgz", $5, "bytes"}'
