#!/bin/bash
# Faz kabul kontrolü: hafıza + tip + birim test + build + yerel e2e.
# Yerel Postgres: postgres://dgfit:dgfit@127.0.0.1:5432/dgfit (yoksa: apt-get install -y postgresql; service postgresql start)
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== 1/5 hafıza kontrolü"; node scripts/memory-check.mjs
echo "== 2/5 tip kontrolü"; npx tsc --noEmit
echo "== 3/5 birim testler"; npm test --silent 2>&1 | grep -E "^# (tests|pass|fail)"
npm test --silent >/dev/null 2>&1 || { echo "BİRİM TEST BAŞARISIZ"; npm test; exit 1; }
echo "== 4/5 paket"; ./scripts/bundle.sh
echo "== 5/5 yerel e2e"
service postgresql start >/dev/null 2>&1 || true
pkill -f next-server >/dev/null 2>&1 || true; sleep 1
export DATABASE_URL=postgres://dgfit:dgfit@127.0.0.1:5432/dgfit
# push testi için localhost'a kendinden imzalı sertifika (yalnızca test süreci güvenir)
export TEST_CA_DIR=/tmp/dgfit-test-ca
if [ ! -f $TEST_CA_DIR/cert.pem ]; then mkdir -p $TEST_CA_DIR && openssl req -x509 -newkey rsa:2048 -nodes -keyout $TEST_CA_DIR/key.pem -out $TEST_CA_DIR/cert.pem -days 30 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" >/dev/null 2>&1; fi
( cd dist && node migrate.mjs && NODE_EXTRA_CA_CERTS=$TEST_CA_DIR/cert.pem DGFIT_TEST_HOOKS=1 PORT=3100 HOSTNAME=127.0.0.1 NODE_ENV=production nohup node server.js > /tmp/dgfit-local.log 2>&1 & )
for i in $(seq 1 30); do curl -fsS localhost:3100/api/health >/dev/null 2>&1 && break; sleep 1; done
fail=0
for t in tests/e2e/*.e2e.cjs; do BASE=http://localhost:3100 node "$t" || fail=1; done
pkill -f next-server >/dev/null 2>&1 || true
[ $fail = 0 ] && echo "VERIFY OK" || { echo "E2E BAŞARISIZ"; exit 1; }
