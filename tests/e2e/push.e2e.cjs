// Bildirim altyapısı uçtan uca testi (yalnızca yerel): sahte HTTPS push servisi kurar, gerçek bir
// (şifreli, VAPID imzalı) Web Push isteğinin oraya ulaştığını ve bildirim yanıtının su kaydı oluşturduğunu doğrular.
// Gerekli: TEST_CA_DIR içinde localhost için key.pem/cert.pem; uygulama NODE_EXTRA_CA_CERTS=cert.pem ile çalışmalı.
const https = require('https')
const fs = require('fs')
const crypto = require('crypto')
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3100'
const CA = process.env.TEST_CA_DIR
const fail = (m) => { throw new Error(m) }

if (!BASE.includes('localhost')) { console.log('PUSH E2E atlandı (yalnızca yerel)'); process.exit(0) }
if (!CA) { console.log('PUSH E2E atlandı (TEST_CA_DIR yok)'); process.exit(0) }

;(async () => {
  const received = []
  const srv = https.createServer({ key: fs.readFileSync(CA + '/key.pem'), cert: fs.readFileSync(CA + '/cert.pem') }, (req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => { received.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks) }); res.writeHead(201); res.end() })
  })
  await new Promise((r) => srv.listen(4999, '127.0.0.1', r))

  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'tr-TR' })
  const p = await ctx.newPage()
  p.setDefaultNavigationTimeout(60000)
  const u = 'test_p' + Date.now().toString(36)
  await p.goto(BASE + '/kayit')
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com')
  await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500)
  await p.getByRole('button', { name: 'Hesabı oluştur' }).click()
  await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'female', birthDate: '1996-02-02', heightCm: 165, weightKg: 62, activity: 'light', goal: 'recomp', targetWeightKg: 62, tempo: 'balanced', customDays: 90, experience: null, trainingDays: null, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload()
  await p.getByRole('button', { name: /Planı başlat/ }).click()
  await p.waitForURL(BASE + '/')

  // 1) Ayarlar sayfasında bildirim bölümü yükleniyor
  await p.goto(BASE + '/su/ayarlar'); await p.getByRole('link', { name: /Hatırlatmalar ve sessiz saatler/ }).click(); await p.waitForURL('**/su/ayarlar/hatirlatma')
  await p.getByRole('heading', { name: 'Akıllı hatırlatmalar' }).waitFor()

  // 2) VAPID anahtarı servis ediliyor ve kalıcı
  const k1 = await p.evaluate(async () => (await (await fetch('/api/push/key')).json()).publicKey)
  const k2 = await p.evaluate(async () => (await (await fetch('/api/push/key')).json()).publicKey)
  if (!k1 || k1 !== k2 || k1.length < 80) fail('VAPID public key geçersiz: ' + k1)

  // 3) Abonelik (sahte uç nokta, gerçek ECDH anahtarları)
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys()
  const sub = { endpoint: 'https://localhost:4999/push/' + u, keys: { p256dh: ecdh.getPublicKey('base64url'), auth: crypto.randomBytes(16).toString('base64url') } }
  const st = await p.evaluate(async (s) => (await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })).status, sub)
  if (st !== 200) fail('abonelik ' + st)

  // 4) Test bildirimi gerçekten şifreli + VAPID imzalı olarak push servisine ulaşıyor
  const t = await p.evaluate(async () => (await fetch('/api/push/test', { method: 'POST' })).json())
  if (!t.ok || t.delivered !== 1) fail('test bildirimi gönderilmedi: ' + JSON.stringify(t))
  const r = received.at(-1)
  if (!r) fail('push servisi istek almadı')
  if (r.headers['content-encoding'] !== 'aes128gcm') fail('şifreleme başlığı yok')
  if (!/^vapid t=.+, k=/.test(r.headers['authorization'] || '')) fail('VAPID imzası yok')
  if (!(Number(r.headers['ttl']) > 0)) fail('TTL yok')
  if (r.body.length < 100) fail('gövde çok kısa')

  // 4b) Zamanlayıcının gerçek karar + gönderim yolu (test kancası): bugün 14:00, hiç su yok → hatırlatma gider
  const today = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10)
  const at14 = today + 'T14:00:00+03:00'
  const before = received.length
  const run1 = await p.evaluate(async (at) => (await fetch('/api/test/reminder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ at }) })).json(), at14)
  if (!run1.sent || run1.kind !== 'remind' || run1.delivered !== 1) fail('zamanlayıcı hatırlatma göndermedi: ' + JSON.stringify(run1))
  if (received.length !== before + 1) fail('zamanlayıcı bildirimi push servisine ulaşmadı')
  // aynı dakikada tekrar → minimum aralık nedeniyle gönderilmez
  const run2 = await p.evaluate(async (at) => (await fetch('/api/test/reminder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ at }) })).json(), today + 'T14:10:00+03:00')
  if (run2.sent) fail('45 dk dolmadan ikinci hatırlatma gitti')
  // uyku saatinde (02:00) asla gönderilmez
  const run3 = await p.evaluate(async (at) => (await fetch('/api/test/reminder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ at }) })).json(), today + 'T02:00:00+03:00')
  if (run3.sent) fail('uyku saatinde hatırlatma gitti')

  // 5) Bildirim yanıtı ("200 ml içtim") su kaydı oluşturur ve hatırlatmayı işaretler
  const n = await p.evaluate(async () => (await fetch('/api/water/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add:200' }) })).json())
  if (!n.ok) fail('bildirim yanıtı: ' + JSON.stringify(n))
  await p.goto(BASE + '/su')
  const total = await p.locator('[aria-live=polite]').first().innerText()
  if (total.trim() !== '200') fail('bildirimden eklenen su görünmüyor: ' + total)
  if (!(await p.getByText('Bildirim yanıtı').count())) fail('kaynak "Bildirim yanıtı" görünmüyor')

  // 6) Oturumsuz istekler reddedilir
  const anon = await (await b.newContext()).newPage()
  const s401 = await anon.evaluate(async (base) => (await fetch(base + '/api/water/notify', { method: 'POST', body: '{"action":"add:200"}', headers: { 'Content-Type': 'application/json' } })).status, BASE).catch(() => 0)
  await anon.goto(BASE + '/giris')
  const s401b = await anon.evaluate(async () => (await fetch('/api/water/notify', { method: 'POST', body: '{"action":"add:200"}', headers: { 'Content-Type': 'application/json' } })).status)
  if (s401b !== 401) fail('oturumsuz bildirim yanıtı kabul edildi: ' + s401b + ' ' + s401)

  // 7) Abonelikten çıkış → sonraki test bildirimi kimseye gitmez
  await p.evaluate(async (s) => fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: s.endpoint }) }), sub)
  const t2 = await p.evaluate(async () => (await fetch('/api/push/test', { method: 'POST' })).json())
  if (t2.delivered !== 0) fail('çıkıştan sonra bildirim gitti')

  console.log('PUSH E2E OK user=', u)
  await b.close(); srv.close()
})().catch((e) => { console.error('PUSH E2E FAIL', e.message); process.exit(1) })
