// Özelleştirme Ö2a: ✎ → Renkler (kart başına renk; okunurluk uyarısı; açık ve koyu temada türetilmiş renk), modül rengi
// (bant ve vurgu değişir), hazır palet, fotoğraftan palet (tarayıcıda işlenir). Canlıda da çalışır (kanca gerekmez).
const { chromium, devices } = require('playwright')
const zlib = require('zlib')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }

/** Bağımlılıksız küçük PNG: üst yarı mavi, alt yarı turuncu. */
function png(w, h, colorAt) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const [r, g, b] = colorAt(x, y); raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3) } }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

;(async () => {
  const b = await chromium.launch()
  const errors = []
  const ctx = await b.newContext({ ...devices['Pixel 7'], hasTouch: false, isMobile: false, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', colorScheme: 'light' })
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  const u = 'test_c5' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'female', birthDate: '1992-06-06', heightCm: 168, weightKg: 66, activity: 'light', goal: 'lose', targetWeightKg: 61, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  const lum = (rgb) => { const m = rgb.match(/\d+/g).map(Number); return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000 }

  // 1) ✎ Makrolar → Renkler: açık sarı zemin + beyaz başlık (okunmaz → uyarı, otomatik düzeltme)
  await p.goto(BASE + '/?duzenle=1'); await p.getByTestId('card-editor').waitFor()
  await p.locator('[data-edit-card="today.macros"] button[aria-label$="düzenle"]').click()
  await p.getByTestId('card-sheet').waitFor(); await p.getByTestId('card-colors').click()
  const ce = p.getByTestId('color-editor'); await ce.waitFor()
  await ce.locator('[data-slot=bg] [data-swatch="#FFF3BF"]').click()
  await ce.locator('[data-slot=title] [data-swatch="#FFFFFF"]').click()
  await ce.getByTestId('color-notes').waitFor().catch(() => fail('okunurluk uyarısı yok'))
  await p.screenshot({ path: `${OUT}/custom5-01-renk-ekrani.png` })
  await ce.getByTestId('color-done').click()
  await p.getByTestId('edit-done').click(); await p.waitForURL(BASE + '/'); await p.getByTestId('card-board').waitFor()
  await p.reload(); await p.getByTestId('card-board').waitFor()
  const card = p.locator('[data-card="today.macros"] [data-cc] .card').first()
  const bgL = await card.evaluate((e) => getComputedStyle(e).backgroundColor)
  if (bgL.replace(/\s/g, '') !== 'rgb(255,243,191)') fail('açık temada kart zemini seçilen renk değil: ' + bgL)
  const ink = await card.evaluate((e) => getComputedStyle(e).getPropertyValue('--color-ink').trim())
  if (ink.toUpperCase() === '#FFFFFF') fail('okunmayan başlık rengi düzeltilmedi')
  await p.screenshot({ path: `${OUT}/custom5-02-kart-acik.png` })
  await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(300)
  const bgD = await card.evaluate((e) => getComputedStyle(e).backgroundColor)
  if (lum(bgD) > 110) fail('koyu temada zemin koyulaşmadı: ' + bgD)
  await p.screenshot({ path: `${OUT}/custom5-03-kart-koyu.png` })
  await p.emulateMedia({ colorScheme: 'light' })

  // 2) Modül rengi: Su kırmızı → /su bandı değişir
  const m1 = async (path) => { await p.goto(BASE + path); await p.locator('[data-shell]').waitFor(); return p.locator('[data-shell]').evaluate((e) => getComputedStyle(e).getPropertyValue('--m1').trim().toUpperCase()) }
  const water0 = await m1('/su')
  await p.goto(BASE + '/profil/ozellestirme'); await p.getByTestId('studio-colors').click(); await p.getByTestId('module-colors-editor').waitFor()
  await p.getByTestId('module-color-water').fill('#d01010')
  await p.getByTestId('colors-save').click(); await p.getByRole('status').filter({ hasText: 'kaydedildi' }).waitFor()
  const water1 = await m1('/su')
  if (water1 === water0 || !/^#[0-9A-F]{6}$/.test(water1)) fail('su modül rengi değişmedi: ' + water0 + ' → ' + water1)
  await p.screenshot({ path: `${OUT}/custom5-04-su-kirmizi.png` })

  // 3) Hazır palet (Okyanus) → Bugün rengi değişir
  const today0 = await m1('/')
  await p.goto(BASE + '/profil/ozellestirme/renkler'); await p.locator('[data-palette=okyanus]').click()
  await p.getByTestId('colors-save').click(); await p.getByRole('status').filter({ hasText: 'kaydedildi' }).waitFor()
  if ((await m1('/')) === today0) fail('palet uygulanmadı')

  // 4) Fotoğraftan palet: mavi/turuncu fotoğraf → ilk renk mavi tonunda
  await p.goto(BASE + '/profil/ozellestirme/renkler')
  await p.getByTestId('photo-input').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png(40, 40, (x, y) => (y < 26 ? [20, 110, 200] : [230, 90, 30])) })
  await p.getByTestId('photo-colors').waitFor().catch(() => fail('fotoğraftan renk çıkmadı'))
  await p.getByTestId('photo-apply').click()
  const firstHex = await p.locator('[data-module-row=today] .num').innerText()
  const [r, , bl] = [1, 3, 5].map((i) => parseInt(firstHex.slice(i, i + 2), 16))
  if (!(bl > r)) fail('fotoğraf paletinde baskın renk mavi değil: ' + firstHex)
  await p.screenshot({ path: `${OUT}/custom5-05-foto-palet.png`, fullPage: true })

  // 5) Varsayılana dön → modül stili kalkar
  await p.getByRole('button', { name: 'Varsayılana dön' }).click(); await p.getByRole('status').filter({ hasText: 'kaydedildi' }).waitFor()
  await p.goto(BASE + '/'); if (await p.getByTestId('module-colors').count()) fail('modül renkleri sıfırlanmadı')

  console.log('ÖZELLEŞTİRME-5 E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('ÖZELLEŞTİRME-5 E2E FAIL', e.message); process.exit(1) })
