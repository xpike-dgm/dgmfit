// Özelleştirme Ö2b: stil — köşe, yoğunluk, yazı tipi, simge, bant (düz/fotoğraf), hareketi azalt, yüksek kontrast, birimler
// (lb/oz/kJ; lb ile tartı girişi kg kaydeder), titreşim/ses, akşam renkleri (saat 22.30'da sıcak katman). Canlıda da çalışır.
const { chromium, devices } = require('playwright')
const zlib = require('zlib')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
function png(w, h, colorAt) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) raw.set(colorAt(x, y), y * (w * 3 + 1) + 1 + x * 3) }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

;(async () => {
  const b = await chromium.launch()
  const errors = []
  const ctx = await b.newContext({ ...devices['Pixel 7'], hasTouch: false, isMobile: false, locale: 'tr-TR', timezoneId: 'Europe/Istanbul', colorScheme: 'light' })
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  const u = 'test_c6' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1987-07-07', heightCm: 182, weightKg: 80, activity: 'moderate', goal: 'lose', targetWeightKg: 75, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  const shell = p.locator('[data-shell]')
  const pick = async (group, name) => { await p.getByTestId(group).getByRole('radio', { name, exact: true }).click(); await p.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor(); await p.waitForTimeout(150) }
  const toggle = async (id) => { await p.getByTestId(id).click(); await p.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor(); await p.waitForTimeout(150) }

  // 1) Görünüm
  await p.goto(BASE + '/profil/ozellestirme'); await p.getByTestId('studio-style').click(); await p.getByTestId('colors-style').waitFor()
  await pick('st-radius', 'Keskin'); await pick('st-density', 'Sıkı'); await pick('st-font', 'Klasik')
  await p.getByTestId('style-more').click(); await p.getByTestId('style-form').waitFor()
  await pick('st-icons', 'Kalın'); await pick('st-band', 'Düz')
  await toggle('st-motion'); await toggle('st-contrast')
  await p.goto(BASE + '/'); await p.getByTestId('card-board').waitFor()
  const attrs = await shell.evaluate((e) => ['radius', 'density', 'font', 'icons', 'band', 'motion', 'contrast'].map((k) => e.getAttribute('data-' + k)).join(','))
  if (attrs !== 'sharp,compact,serif,bold,flat,reduce,high') fail('stil öznitelikleri beklenmedik: ' + attrs)
  const r = await p.locator('[data-card="today.macros"] .card').first().evaluate((e) => getComputedStyle(e).borderTopLeftRadius)
  if (r !== '10px') fail('keskin köşe uygulanmadı: ' + r)
  if (!/Georgia|Palatino|Iowan/.test(await shell.evaluate((e) => getComputedStyle(e).fontFamily))) fail('yazı tipi uygulanmadı')
  const sw = await p.locator('nav[aria-label="Ana menü"] svg').first().evaluate((e) => getComputedStyle(e).strokeWidth)
  if (sw !== '2.7px' && sw !== '2.7') fail('kalın simge uygulanmadı: ' + sw)
  await p.screenshot({ path: `${OUT}/custom6-01-stil.png` })

  // 2) Bant fotoğrafı
  await p.goto(BASE + '/profil/ozellestirme/stil/daha')
  await p.getByTestId('band-photo-input').setInputFiles({ name: 'bant.png', mimeType: 'image/png', buffer: png(64, 32, (x) => (x < 32 ? [200, 60, 120] : [40, 90, 200])) })
  await p.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor({ timeout: 30000 })
  await p.goto(BASE + '/')
  const bg = await p.locator('.band').first().evaluate((e) => getComputedStyle(e).backgroundImage)
  if (!bg.includes('url(') || !bg.includes('/api/media/')) fail('bant fotoğrafı uygulanmadı: ' + bg.slice(0, 120))
  await p.screenshot({ path: `${OUT}/custom6-02-bant-foto.png` })

  // 3) Birimler: lb / oz / kJ
  await p.goto(BASE + '/profil/ozellestirme/stil/daha')
  await pick('st-weight', 'lb'); await pick('st-volume', 'oz'); await pick('st-energy', 'kJ')
  await p.goto(BASE + '/')
  if (!(await p.locator('[data-card="today.fit"]').innerText()).includes('lb')) fail('Fit kartı lb değil')
  if (!(await p.locator('[data-card="today.water"]').innerText()).includes('oz')) fail('Su kartı oz değil')
  if (!(await p.locator('[data-card="today.header"]').innerText()).includes('kalan kJ')) fail('kalori halkası kJ değil')
  await p.goto(BASE + '/fit'); await p.locator('#fit-kg').waitFor()
  if (!(await p.locator('#fit-kg').getAttribute('placeholder')).endsWith('lb')) fail('tartı girişi lb değil')
  await p.fill('#fit-kg', '165'); await p.locator('#tarti').getByRole('button', { name: 'Kaydet' }).click(); await p.getByText('Tartı kaydedildi.').waitFor()
  await p.goto(BASE + '/profil/ozellestirme/stil/daha'); await pick('st-weight', 'kg')
  await p.goto(BASE + '/fit'); await p.locator('#fit-kg').waitFor()
  const ph = await p.locator('#fit-kg').getAttribute('placeholder')
  if (ph !== '74,8 kg') fail('165 lb → 74,8 kg kaydedilmedi: ' + ph)

  // 4) Titreşim/ses/akşam kalıcı; akşam 22.30'da sıcak katman
  await p.goto(BASE + '/profil/ozellestirme/stil/daha')
  await pick('st-haptics', 'Kapalı'); await toggle('st-sound'); await toggle('st-warm')
  await p.reload(); await p.getByTestId('style-form').waitFor()
  if ((await p.getByTestId('st-haptics').getByRole('radio', { name: 'Kapalı' }).getAttribute('aria-checked')) !== 'true') fail('titreşim ayarı kalıcı değil')
  if (!(await p.getByTestId('st-warm').isChecked()) || !(await p.getByTestId('st-sound').isChecked())) fail('ses/akşam ayarı kalıcı değil')
  const p2 = await ctx.newPage()
  await p2.clock.install({ time: new Date('2026-11-07T22:30:00+03:00') })
  await p2.goto(BASE + '/'); await p2.getByTestId('warm-layer').waitFor({ state: 'attached' }).catch(() => fail('akşam katmanı görünmedi'))
  await p2.close()

  console.log('ÖZELLEŞTİRME-6 E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('ÖZELLEŞTİRME-6 E2E FAIL', e.message); process.exit(1) })
