// Planlama uçtan uca testi (Faz 4c) — sahte Claude (:3190), OpenAI kapalı (503).
// AI menü (katalog + Fit hedefleri → veritabanı kalorisi + ölçekleme), günlüğe ekleme, alışveriş listesi (tarif malzemeleri, reyon, işaretleme),
// toplu hazırlık, elimdekiler (porsiyon), restoran modu (sıralama + ekleme), AI program (kural denetimi), senaryo simülatörü,
// karb döngüsü (Bugün hedefi değişir), koçtan "yarının menüsü". Yalnızca yerel; canlıda kanca olmadığı için atlanır.
const { chromium, devices } = require('playwright')
const http = require('http')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
const CLAUDE_KEY = 'sk-ant-test-' + 'p'.repeat(24) + 'p1a2'
const zlib = require('zlib')
function uniquePng() {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2
  const px = () => [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)]
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from([0, ...px(), ...px(), 0, ...px(), ...px()]))), chunk('IEND', Buffer.alloc(0))])
}

const state = { calls: [] }
const userText = (body) => { const m = body.messages.at(-1); return typeof m.content === 'string' ? m.content : m.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') }
const DAY = { meals: [
  { meal: 'breakfast', items: [{ name: 'Menemen', grams: 250 }, { name: 'Beyaz ekmek', grams: 50 }] },
  { meal: 'lunch', items: [{ name: 'Mercimek çorbası', grams: 300 }, { name: 'Bulgur pilavı', grams: 150 }] },
  { meal: 'dinner', items: [{ name: 'Tavuk göğsü (pişmiş)', grams: 150 }, { name: 'Mevsim salata', grams: 150 }, { name: 'Uçan balık ezmesi', grams: 100 }] },
] }
function route(body) {
  const props = Object.keys(body.output_config?.format?.schema?.properties ?? {})
  const t = userText(body)
  if (props.includes('prepSteps')) {
    const n = Number((t.match(/Gün sayısı: (\d)/) || [])[1] ?? 1)
    return { task: 'menu', out: { days: Array.from({ length: n }, () => DAY), prepSteps: /istendi/.test(t) && !/istenmedi/.test(t) ? ['Pazar günü bulgur pilavını ve çorbayı pişirip kaplara böl.'] : [] } }
  }
  if (props.includes('recipes')) return { task: 'pantry', out: { recipes: [{ title: 'Peynirli menemen', minutes: 15, servings: 2, ingredients: [{ name: 'Yumurta', grams: 200 }, { name: 'Domates', grams: 200 }, { name: 'Beyaz peynir', grams: 60 }, { name: 'Zeytinyağı', grams: 10 }], steps: ['Domatesi doğra ve zeytinyağında pişir.', 'Yumurtaları ve peyniri ekle.'] }], note: null } }
  if (props.includes('dishes')) return { task: 'restaurant', out: { dishes: [{ menuName: 'Lahmacun', food: 'Lahmacun', grams: 180 }, { menuName: 'Izgara köfte porsiyon', food: 'Izgara köfte', grams: 200 }, { menuName: 'Kayseri mantısı', food: 'Mantı', grams: 350 }, { menuName: 'Kahve', food: 'Filtre kahve (sade)', grams: 200 }], note: null } }
  if (props.includes('days') && props.includes('notes')) {
    const n = Number((t.match(/Haftada (\d) gün/) || [])[1] ?? 3)
    const names = ((t.match(/HAREKETLER: (.*)$/m) || [])[1] ?? '').split(' | ').map((x) => x.replace(/ \[.*\]$/, '')).filter(Boolean)
    const ex = (i) => ({ name: names[i % names.length], sets: 8, repMin: 8, repMax: 12, rir: 0, rest: 90 })
    return { task: 'program', out: { name: 'Test AI programı', days: Array.from({ length: n + 1 }, (_, d) => ({ name: `AI Gün ${d + 1}`, focus: 'Tam vücut', exercises: [ex(d * 3), ex(d * 3 + 1), ex(d * 3 + 2), { name: 'Uçan halı', sets: 3, repMin: 8, repMax: 12, rir: 2, rest: 60 }] })), notes: ['Isınmayı atlama.'] } }
  }
  if (props.includes('reply')) return { task: 'coach', out: { reply: 'Yarın için menünü hazırlayabilirim.', actions: [{ type: 'plan_menu', weeks: null, programDay: null, exercise: null, sets: null, repMin: null, repMax: null, ml: null, drink: null }], whatIf: [], safety: 'yok' } }
  if (props.includes('title')) return { task: 'insight', out: { title: 'x', body: 'y' } }
  return { task: 'other', out: { items: [], note: null } }
}
function fake(port, handler) {
  return new Promise((res) => {
    const s = http.createServer((req, rsp) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { const r = handler(req, b ? JSON.parse(b) : {}); rsp.writeHead(r.status, { 'Content-Type': 'application/json' }); rsp.end(JSON.stringify(r.body)) }) })
    s.listen(port, '127.0.0.1', () => res(s))
  })
}

;(async () => {
  const hookCheck = await fetch(BASE + '/api/test/coach', { method: 'POST' }).catch(() => null)
  if (!hookCheck || hookCheck.status === 404) { console.log('PLANLAMA E2E ATLANDI (canlı: test kancası yok, sahte sağlayıcı kullanılamaz)'); return }
  const sc = await fake(3190, (req, body) => {
    if (req.url !== '/v1/messages' && req.url !== '/v1/messages?beta=true') return { status: 404, body: {} }
    const r = route(body)
    state.calls.push({ task: r.task, model: body.model, text: userText(body), image: body.messages.at(-1).content?.some?.((c) => c.type === 'image') })
    return { status: 200, body: { id: 'msg_t', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify(r.out) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 2000, output_tokens: 400 } } }
  })
  const so = await fake(3191, () => ({ status: 503, body: { error: { message: 'kapalı', code: 'server_is_overloaded' } } }))

  const b = await chromium.launch()
  const errors = []
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('dialog', (d) => d.accept())
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  const shot = (n) => p.screenshot({ path: `${OUT}/planner-${n}.png`, fullPage: true })
  const api = (s) => p.evaluate(async (x) => (await fetch(x)).json(), s)
  const foodBy = async (q) => (await api('/api/food/search?q=' + encodeURIComponent(q))).results.find((r) => r.name === q)
  const u = 'test_aipl' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1990-05-05', heightCm: 180, weightKg: 85, activity: 'moderate', goal: 'lose', targetWeightKg: 78, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: ['fıstık'], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  await p.goto(BASE + '/yonetim/ai')
  const sec = p.getByTestId('provider-claude')
  const rs = sec.getByRole('button', { name: 'Beklemeyi sıfırla' }); if (await rs.count()) { await rs.click(); await p.waitForTimeout(500) }
  await sec.locator('#claude-key').fill(CLAUDE_KEY); await sec.getByRole('button', { name: 'Kaydet' }).click()
  await sec.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor()
  if ((await p.inputValue('#claude-tm-restaurant')) !== 'claude-opus-5-5') fail('restoran görevi varsayılan Opus değil')

  // 1) AI menü: 7 gün, ekonomik, toplu hazırlık
  await p.goto(BASE + '/yemek'); await p.getByTestId('ai-plan-links').getByRole('link', { name: 'AI menü' }).click(); await p.waitForURL('**/yemek/plan')
  const form = p.getByTestId('menu-form')
  await form.getByRole('button', { name: '7 gün' }).click(); await form.getByRole('button', { name: 'Ekonomik' }).click()
  await form.getByLabel('Toplu hazırlık planı (meal prep)').check()
  await form.getByRole('button', { name: 'Menü oluştur' }).click()
  await p.getByTestId('plan-day-total').waitFor({ timeout: 30000 }).catch(() => fail('menü oluşmadı'))
  const mc = state.calls.find((c) => c.task === 'menu')
  if (!mc || !/Günlük hedefler: 1\. gün \d+ kcal, protein \d+ g/.test(mc.text) || !mc.text.includes('KATALOG:') || !mc.text.includes('fıstık') || !mc.text.includes('Ekonomik')) fail('menü isteği hedef/katalog/alerji/bütçe içermiyor')
  if ((await p.getByRole('tab').count()) !== 7) fail('7 gün sekmesi bekleniyordu')
  // ölçekleme: aynı ham menü (≈ toplam) günün hedefine 0,7–1,35 kat ölçeklenir; kalori = veritabanı 100 g × gram
  const br = p.locator('[data-testid=plan-meal][data-meal=breakfast] li').first()
  const brText = await br.innerText()
  const menemen = await foodBy('Menemen')
  const g = num(brText.match(/· ([\d.]+) g/)[1]), k = num(brText.match(/([\d.]+) kcal/)[1])
  if (k !== Math.round((menemen.per100.kcal * g) / 100)) fail(`menemen kalorisi ${k} ≠ veritabanı (${g} g)`)
  if (g === 250) fail('gramlar hedefe ölçeklenmemiş görünüyor')
  await p.getByText('eşleşme yok').first().waitFor().catch(() => fail('eşleşmeyen kalem işaretlenmedi'))
  await p.getByTestId('plan-off').waitFor().catch(() => fail('hedeften sapma uyarısı yok (sahte menü hedefin altında)'))
  await p.getByTestId('prep').waitFor().catch(() => fail('toplu hazırlık adımları yok'))
  await shot('01-menu')

  // 2) Kahvaltıyı günlüğe ekle
  await p.locator('[data-testid=plan-meal][data-meal=breakfast]').getByRole('button', { name: 'Günlüğe ekle' }).click()
  await p.getByRole('status').filter({ hasText: 'Kahvaltı günlüğe eklendi' }).waitFor()
  await p.goto(BASE + '/yemek'); await p.getByText('Menemen').first().waitFor().catch(() => fail('menemen günlükte yok'))

  // 3) Alışveriş listesi: menemen → yumurta (tarif malzemesi), reyonlar, işaretleme kalıcı
  await p.goto(BASE + '/yemek/plan'); await p.getByRole('link', { name: 'Alışveriş' }).click(); await p.waitForURL('**/alisveris**')
  const dairy = p.locator('[data-testid=shop-aisle][aria-label="Süt ürünleri ve kahvaltılık"]')
  await dairy.getByText('Yumurta', { exact: true }).waitFor().catch(() => fail('yumurta (menemen malzemesi) listede yok'))
  if (await p.getByTestId('shop').getByText('Menemen', { exact: true }).count()) fail('hazır yemek malzemelerine açılmadı')
  await p.locator('[data-testid=shop-aisle][aria-label="Manav"]').waitFor()
  await dairy.getByRole('checkbox').first().check(); await p.waitForTimeout(600); await p.reload()
  if (!(await dairy.getByRole('checkbox').first().isChecked())) fail('işaret kalıcı değil')
  await shot('02-alisveris')

  // 4) Elimdekiler
  await p.goto(BASE + '/yemek/elimdeki')
  await p.fill('#pantry-text', 'yumurta, domates, beyaz peynir'); await p.getByRole('button', { name: 'Tarif öner' }).click()
  const rec = p.getByTestId('pantry-recipe').first()
  await rec.waitFor({ timeout: 20000 }).catch(() => fail('tarif gelmedi'))
  const portion = num(await rec.getByTestId('portion-kcal').innerText())
  if (!(portion > 0)) fail('porsiyon kalorisi yok')
  await rec.getByRole('button', { name: 'Porsiyonu günlüğe ekle' }).click()
  await rec.getByRole('status').filter({ hasText: 'öğününe eklendi' }).waitFor()

  // 5) Restoran modu: Opus + görsel; bütçeye uyan önce; ekle
  await p.goto(BASE + '/yemek/restoran')
  await p.getByTestId('rest-photo').setInputFiles({ name: 'm.png', mimeType: 'image/png', buffer: uniquePng() })
  await p.getByTestId('rest-top').first().waitFor({ timeout: 20000 }).catch(() => fail('restoran seçenekleri gelmedi'))
  const rc = state.calls.find((c) => c.task === 'restaurant')
  if (rc.model !== 'claude-opus-5-5' || !rc.image) fail('restoran isteği Opus + görsel değil: ' + rc.model)
  if ((await p.getByTestId('rest-top').count()) !== 3) fail('3 seçenek bekleniyordu')
  if ((await p.getByTestId('rest-dish').count()) !== 4) fail('tüm menü 4 yemek olmalı')
  await p.getByTestId('rest-top').first().getByRole('button', { name: /ekle$/ }).click()
  await p.getByRole('status').filter({ hasText: 'öğününe eklendi' }).waitFor()
  await shot('03-restoran')

  // 6) AI program: fazla gün ve bilinmeyen hareket atılır, yeni başlayanda set ≤ 4
  await p.goto(BASE + '/fitness/programlar/olustur'); await p.selectOption('#gen-env', 'gym')
  const ai = p.getByTestId('ai-program')
  await ai.getByRole('button', { name: 'Arka bacak' }).click()
  await ai.getByRole('button', { name: 'AI ile oluştur' }).click()
  await p.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/, { timeout: 30000 }).catch(() => fail('AI programı oluşmadı'))
  const pc = state.calls.find((c) => c.task === 'program')
  if (!pc.text.includes('Zayıf kas grupları: hamstrings') || !pc.text.includes('HAREKETLER:')) fail('program isteği eksik')
  if ((await p.getByTestId('program-day').count()) !== 3) fail('3 gün bekleniyordu (fazla gün atılmalı)')
  if (await p.getByText('Uçan halı', { exact: true }).count()) fail('bilinmeyen hareket programa girdi')
  await p.getByText(/Çıkarılan: .*Uçan halı/).first().waitFor().catch(() => fail('çıkarılan hareket notu yok'))
  const sets = await p.getByTestId('program-day').first().getByText(/^\d+ ×/).allInnerTexts().catch(() => [])
  if (sets.some((s) => num(s.split('×')[0]) > 4)) fail('yeni başlayanda set sınırı uygulanmadı: ' + sets.join(','))

  // 7) Senaryo simülatörü: haftada 3 gün koşu → daha erken varış
  await p.goto(BASE + '/fit/senaryo')
  const sc0 = await p.getByTestId('scenario-date').innerText()
  await p.locator('#sc-week').focus(); for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowRight')
  await p.getByTestId('scenario-out').getByText(/erken/).waitFor().catch(async () => fail('simülatör erken varış göstermedi: ' + (await p.getByTestId('scenario-out').innerText())))
  if ((await p.getByTestId('scenario-date').innerText()) === sc0) fail('tarih değişmedi')

  // 8) Karb döngüsü: Pzt/Çar/Cum → Bugün karbonhidrat hedefi değişir
  await p.goto(BASE + '/')
  const carbGoal = async () => num((await p.locator('section[aria-label="Kalori"]').getByText(/Karbonhidrat/).locator('..').locator('..').innerText()).split('/')[1])
  const c0 = await carbGoal()
  await p.goto(BASE + '/fit/karb')
  const cc = p.getByTestId('carb-cycle')
  await cc.getByLabel('Karb döngüsünü aç').check()
  for (const d of ['Pzt', 'Çar', 'Cum']) await cc.getByRole('button', { name: d, exact: true }).click()
  await cc.getByTestId('carb-preview').waitFor()
  await cc.getByRole('button', { name: 'Döngüyü uygula' }).click(); await cc.getByRole('status').waitFor()
  await p.goto(BASE + '/')
  const c1 = await carbGoal()
  if (c1 === c0) fail('karb döngüsü bugünkü hedefe yansımadı: ' + c0)

  // 9) Koçtan "yarının menüsü" → onay → 1 günlük menü (önceki 7 günlük menü arşivlenir)
  await p.goto(BASE + '/koc')
  await p.fill('#coach-input', 'Yarının menüsünü hazırla'); await p.getByRole('button', { name: 'Gönder' }).click()
  const act = p.getByTestId('coach-action').first()
  await act.waitFor({ timeout: 20000 })
  await act.getByRole('button', { name: 'Onayla' }).click()
  await p.locator('[data-testid=coach-action][data-status=done]').waitFor({ timeout: 30000 }).catch(async () => fail('menü eylemi uygulanmadı: ' + (await act.innerText())))
  await p.getByRole('link', { name: 'Menüyü aç' }).click(); await p.waitForURL('**/yemek/plan')
  await p.getByTestId('plan-day-total').waitFor()
  if ((await p.getByRole('tab').count()) !== 1) fail('koç menüsü 1 günlük olmalı')
  if (state.calls.filter((c) => c.task === 'menu').length !== 2) fail('ikinci menü isteği gitmedi')

  if (errors.length) fail('Tarayıcı hataları:\n' + errors.join('\n'))
  await b.close(); sc.close(); so.close()
  console.log('PLANLAMA E2E OK', u)
})().catch((e) => { console.error('PLANLAMA E2E FAIL:', e.message); process.exit(1) })
