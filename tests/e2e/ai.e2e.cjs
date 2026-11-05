// AI katmanı uçtan uca testi — gerçek API yerine sahte Claude (:3190) ve OpenAI (:3191) sunucuları.
// Yönetici anahtar girer → fotoğraf/yazı ile öğün → veritabanı eşleşmesi + kalori (motor) → onay → günlük + su;
// etiket okuma; Claude 429 → OpenAI'ye geçiş; önbellek; kullanıcı günlük hakkı; yönetici olmayana 404.
// Yalnızca yerel (DGFIT_TEST_HOOKS=1 ve sahte adresler verify.sh'te); canlıda kanca olmadığı için atlanır.
const { chromium, devices } = require('playwright')
const http = require('http')
const path = require('path')
const BASE = process.env.BASE || 'http://localhost:3100'
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
const zlib = require('zlib')
/** Her çalıştırmada benzersiz 2×2 PNG (önbellek önceki çalıştırmadan dönmesin). */
function uniquePng() {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2
  const px = () => [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)]
  const raw = Buffer.from([0, ...px(), ...px(), 0, ...px(), ...px()])
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const CLAUDE_KEY = 'sk-ant-test-' + 'a'.repeat(24) + 'c1a1', OPENAI_KEY = 'sk-proj-test-' + 'b'.repeat(24) + 'o9p9'

const MEAL_PHOTO = { items: [{ name: 'mercimek çorbası', grams: 250, portion: '1 kase', drink: null, confidence: 'yüksek' }, { name: 'simit', grams: 100, portion: '1 adet', drink: null, confidence: 'orta' }, { name: 'ayran', grams: 200, portion: '1 bardak', drink: 'ayran', confidence: 'yüksek' }], note: null }
const MEAL_TEXT = { items: [{ name: 'beyaz peynir', grams: 60, portion: '2 dilim', drink: null, confidence: 'orta' }], note: null }
const LABEL = { name: 'Test kraker', brand: 'Örnek', basis: 'porsiyon', servingGrams: 40, kcal: 160, protein: 4, carb: 24, sugar: 2, fat: 5, satFat: 1, fiber: 1.2, salt: 0.2 }

const state = { claude: 'ok', calls: { claude: 0, openai: 0 }, last: {} }
function fake(port, handler) {
  return new Promise((res) => {
    const s = http.createServer((req, rsp) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { const r = handler(req, b ? JSON.parse(b) : {}); rsp.writeHead(r.status, { 'Content-Type': 'application/json' }); rsp.end(JSON.stringify(r.body)) }) })
    s.listen(port, '127.0.0.1', () => res(s))
  })
}
const pick = (system, hasImage, text) => (/besin değeri tablosu/i.test(system) ? LABEL : hasImage ? MEAL_PHOTO : MEAL_TEXT)

;(async () => {
  const W = await import(path.join(__dirname, '../../lib/water.ts'))
  const hookCheck = await fetch(BASE + '/api/test/fitness', { method: 'POST' }).catch(() => null)
  if (!hookCheck || hookCheck.status === 404) { console.log('AI E2E ATLANDI (canlı: test kancası yok, sahte sağlayıcı kullanılamaz)'); return }
  const sc = await fake(3190, (req, body) => {
    if (req.url !== '/v1/messages') return { status: 404, body: {} }
    state.calls.claude++; state.last.claude = { key: req.headers['x-api-key'] ?? String(req.headers.authorization ?? '').replace(/^Bearer /, ''), auths: [req.headers['x-api-key'], req.headers.authorization].filter(Boolean).length, body }
    if (state.claude === 'rate') return { status: 429, body: { type: 'error', error: { type: 'rate_limit_error', message: 'rate limit' } } }
    const content = body.messages[0].content
    const out = pick(body.system, content.some((c) => c.type === 'image'), content.find((c) => c.type === 'text')?.text)
    return { status: 200, body: { id: 'msg_t', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify(out) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 120, output_tokens: 60 } } }
  })
  const so = await fake(3191, (req, body) => {
    if (req.url !== '/v1/responses') return { status: 404, body: {} }
    state.calls.openai++; state.last.openai = { auth: req.headers.authorization, body }
    const content = body.input[0].content
    const out = pick(body.instructions, content.some((c) => c.type === 'input_image'), content.find((c) => c.type === 'input_text')?.text)
    return { status: 200, body: { id: 'resp_t', object: 'response', created_at: 1, status: 'completed', model: body.model, output: [{ type: 'message', id: 'm1', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(out), annotations: [] }] }], usage: { input_tokens: 90, output_tokens: 40, total_tokens: 130 } } }
  })

  const b = await chromium.launch()
  const errors = []
  const mk = async () => {
    const ctx = await b.newContext({ ...devices['iPhone 14'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' }); const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('dialog', (d) => d.accept())
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
    return p
  }
  const signup = async (p, u) => {
    await p.goto(BASE + '/kayit')
    await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
    await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
    await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
    await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'female', birthDate: '1992-03-03', heightCm: 165, weightKg: 64, activity: 'light', goal: 'lose', targetWeightKg: 60, tempo: 'balanced', customDays: 90, experience: null, trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:30', sleepTime: '23:30' })))
    await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  }
  const p = await mk()
  const shot = (n) => p.screenshot({ path: `${OUT}/ai-${n}.png`, fullPage: true })
  const u = 'test_ai' + Date.now().toString(36)
  await signup(p, u)

  // 0) Önceki yerel çalıştırmadan kalan anahtarları sil (sağlayıcı ayarları sunucu genelidir)
  await p.goto(BASE + '/yonetim/ai')
  for (const id of ['claude', 'openai']) {
    const del = p.getByTestId(`provider-${id}`).getByRole('button', { name: 'Anahtarı sil' })
    if (await del.count()) { await del.click(); await p.getByTestId(`provider-${id}`).getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor() }
    const rs = p.getByTestId(`provider-${id}`).getByRole('button', { name: 'Beklemeyi sıfırla' })
    if (await rs.count()) { await rs.click(); await p.waitForTimeout(500) }
  }
  // 1) Anahtar yokken AI bölümü görünmez; yönetici olmayana /yonetim/ai 404
  await p.goto(BASE + '/yemek/ekle')
  if (await p.getByTestId('ai-meal').count()) fail('anahtar yokken AI bölümü görünmemeli')
  const q = await mk(); await signup(q, 'test_nx' + Date.now().toString(36))
  const r404 = await q.goto(BASE + '/yonetim/ai'); if (r404.status() !== 404) fail('yönetici olmayana AI ayarları ' + r404.status())

  // 2) Yönetici anahtarları girer (yalnızca son 4 karakter görünür)
  await p.goto(BASE + '/profil'); await p.getByRole('link', { name: /AI ayarları/ }).click(); await p.waitForURL('**/yonetim/ai')
  for (const [id, key] of [['claude', CLAUDE_KEY], ['openai', OPENAI_KEY]]) {
    const sec = p.getByTestId(`provider-${id}`)
    await sec.locator(`#${id}-key`).fill(key); await sec.getByRole('button', { name: 'Kaydet' }).click()
    await sec.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor()
    await sec.getByText(`••••${key.slice(-4)}`).waitFor().catch(() => fail(id + ' anahtar son 4 karakteri görünmüyor'))
    if ((await p.content()).includes(key)) fail('anahtarın tamamı sayfada görünüyor')
    if ((await sec.getByTestId('provider-status').innerText()) !== 'Kullanılabilir') fail(id + ' kullanılabilir değil')
  }

  // 3) Fotoğrafla öğün (Claude) → 3 kalem; kalori veritabanından
  const api = (s) => p.evaluate(async (x) => (await fetch(x)).json(), s)
  const first = async (qq) => (await api('/api/food/search?q=' + encodeURIComponent(qq))).results[0]
  const corba = await first('mercimek çorbası'), simit = await first('simit')
  await p.goto(BASE + '/yemek/ekle?ogun=lunch')
  await p.getByTestId('ai-photo').setInputFiles({ name: 'o.png', mimeType: 'image/png', buffer: uniquePng() })
  await p.getByTestId('ai-review').waitFor({ timeout: 20000 }).catch(() => fail('AI önerisi gelmedi'))
  if (state.last.claude?.key !== CLAUDE_KEY || state.last.claude.auths !== 1) fail('Claude anahtarı çözülüp tek kimlik olarak gönderilmedi: ' + JSON.stringify({ calls: state.calls, auths: state.last.claude?.auths }))
  const cb = state.last.claude.body
  if (cb.model !== 'claude-haiku-5-5' || cb.output_config?.format?.type !== 'json_schema' || !cb.messages[0].content.some((c) => c.type === 'image' && c.source.type === 'base64')) fail('Claude isteği beklenen biçimde değil')
  const rows = p.getByTestId('ai-row')
  if ((await rows.count()) !== 3) fail('3 kalem bekleniyordu')
  const k1 = Math.round((corba.per100.kcal * 250) / 100), k2 = Math.round((simit.per100.kcal * 100) / 100)
  if (num(await rows.nth(0).getByTestId('ai-kcal').innerText()) !== k1) fail('çorba kalorisi ' + k1)
  if (num(await rows.nth(1).getByTestId('ai-kcal').innerText()) !== k2) fail('simit kalorisi ' + k2)
  await p.getByTestId('ai-review').getByText('Yanıt: Claude').waitFor()
  await shot('01-oneri')
  const ayranHit = (await api('/api/food/search?q=ayran')).results[0]
  const k3 = ayranHit ? Math.round((ayranHit.per100.kcal * 200) / 100) : 0
  await p.getByRole('button', { name: /^Ekle · / }).click()
  await p.getByText(new RegExp(`200 ml Su'ya`)).waitFor().catch(() => fail('ayran su takibine eklenmedi'))
  await p.goto(BASE + '/yemek')
  const eaten = num((await p.locator('section[aria-label="Günlük özet"] .num').first().innerText()).split('/')[0])
  if (eaten !== k1 + k2 + k3) fail(`günlük ${eaten}, beklenen ${k1 + k2 + k3}`)
  await p.goto(BASE + '/')
  const water = num((await p.locator('section[aria-label="Su"] .num').first().innerText()))
  if (water !== W.effectiveMl(200, 'ayran')) fail('su ' + water)

  // 4) Etiket okuma (Claude): porsiyon değerleri 100 g'a çevrilir
  await p.goto(BASE + '/yemek/besin/yeni')
  await p.getByTestId('label-input').setInputFiles({ name: 'e.png', mimeType: 'image/png', buffer: uniquePng() })
  await p.getByTestId('label-ocr').getByRole('status').filter({ hasText: 'Etiketten dolduruldu' }).waitFor({ timeout: 20000 }).catch(() => fail('etiket okunmadı'))
  for (const [id, v] of [['cf-kcal', '400'], ['cf-protein', '10'], ['cf-carb', '60'], ['cf-fat', '12,5'], ['cf-sodium', '200'], ['cf-name', 'Test kraker']]) if ((await p.inputValue('#' + id)) !== v) fail(`${id} = ${await p.inputValue('#' + id)}, beklenen ${v}`)

  // 5) Claude 429 → OpenAI'ye geçiş
  state.claude = 'rate'
  await p.goto(BASE + '/yemek/ekle?ogun=dinner')
  await p.getByRole('button', { name: 'Yaz ya da söyle' }).click()
  const tx = 'iki dilim beyaz peynir ' + Date.now().toString(36)
  await p.fill('#ai-text', tx)
  await p.getByRole('button', { name: 'Ayrıştır' }).click()
  await p.getByTestId('ai-review').getByText('Yanıt: OpenAI').waitFor({ timeout: 20000 }).catch(() => fail('OpenAI\'ye geçilmedi'))
  const ob = state.last.openai.body
  if (state.last.openai.auth !== 'Bearer ' + OPENAI_KEY || ob.model !== 'gpt-6-luna' || ob.text?.format?.type !== 'json_schema' || ob.text.format.strict !== true) fail('OpenAI isteği beklenen biçimde değil')
  await p.keyboard.press('Escape')
  await p.goto(BASE + '/yonetim/ai')
  await p.getByTestId('provider-claude').getByTestId('provider-error').getByText(/rate 429/).waitFor().catch(() => fail('Claude hatası yöneticide görünmüyor'))
  if ((await p.getByTestId('provider-claude').getByTestId('provider-status').innerText()) !== 'bekleme süresinde') fail('Claude beklemede değil')

  // 6) Aynı istek önbellekten (sağlayıcıya gitmez)
  const before = state.calls.openai + state.calls.claude
  await p.goto(BASE + '/yemek/ekle?ogun=dinner')
  await p.getByRole('button', { name: 'Yaz ya da söyle' }).click(); await p.fill('#ai-text', '  ' + tx.toLocaleUpperCase('tr-TR') + ' '); await p.getByRole('button', { name: 'Ayrıştır' }).click()
  await p.getByTestId('ai-review').getByText('Yanıt: önbellek').waitFor({ timeout: 20000 }).catch(() => fail('önbellek kullanılmadı'))
  if (state.calls.openai + state.calls.claude !== before) fail('önbellekteki istek sağlayıcıya gitti')
  await p.keyboard.press('Escape')

  // 7) Bekleme sıfırlanır; kullanıcı günlük hakkı (başarılı 3 çağrı yapıldı) 3'e çekilince yeni istek reddedilir
  await p.goto(BASE + '/yonetim/ai')
  await p.getByTestId('provider-claude').getByRole('button', { name: 'Beklemeyi sıfırla' }).click()
  await p.waitForTimeout(800)
  if ((await p.getByTestId('provider-claude').getByTestId('provider-status').innerText()) !== 'Kullanılabilir') fail('bekleme sıfırlanmadı')
  await p.fill('#ai-daily', '3'); await p.getByRole('button', { name: 'Kaydet' }).last().click(); await p.waitForTimeout(800)
  state.claude = 'ok'
  await p.goto(BASE + '/yemek/ekle')
  await p.getByRole('button', { name: 'Yaz ya da söyle' }).click(); await p.fill('#ai-text', 'bir kase yoğurt ' + Date.now().toString(36)); await p.getByRole('button', { name: 'Ayrıştır' }).click()
  await p.getByRole('alert').filter({ hasText: 'AI hakkın doldu' }).waitFor({ timeout: 15000 }).catch(() => fail('günlük hak sınırı uygulanmadı'))
  await shot('02-kota')
  // sonraki çalıştırmaları etkilememesi için varsayılana dön
  await p.goto(BASE + '/yonetim/ai'); await p.fill('#ai-daily', '25'); await p.getByRole('button', { name: 'Kaydet' }).last().click(); await p.waitForTimeout(800)

  if (errors.length) fail('Tarayıcı hataları:\n' + errors.join('\n'))
  await b.close(); sc.close(); so.close()
  console.log('AI E2E OK', u)
})().catch((e) => { console.error('AI E2E FAIL:', e.message); process.exit(1) })
