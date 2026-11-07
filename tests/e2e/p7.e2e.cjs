// P-5/P-7: büyük yazı, onay kutusu, her zamanki öğün (tek dokunuş), başarılar + rozet paylaşımı, öğün hatırlatma ayarı,
// program sihirbazı v2 (öncelikli bölge). Alışkanlık verisi yerel test kancasıyla yazılır (canlıda kendini atlar).
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }

;(async () => {
  const b = await chromium.launch()
  const errors = []
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  const u = 'test_p7' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1995-03-03', heightCm: 178, weightKg: 82, activity: 'moderate', goal: 'lose', targetWeightKg: 77, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  // 1) Büyük yazı (Görünüm) → html[data-text], geri al
  await p.goto(BASE + '/profil/gorunum'); await p.getByTestId('text-size').getByRole('radio', { name: /Büyük/ }).first().click()
  await p.waitForFunction(() => document.documentElement.getAttribute('data-text') === 'lg')
  // seçim anında uygulanır; çerez sunucu aksiyonuyla yazılır → aksiyon bitince (düğmeler yeniden etkin) yenile
  await p.waitForTimeout(300); await p.waitForFunction(() => !document.querySelector('[data-testid=text-size] button[disabled]'))
  await p.reload(); if ((await p.evaluate(() => document.documentElement.getAttribute('data-text'))) !== 'lg') fail('büyük yazı çerezde kalmadı')
  await p.screenshot({ path: `${OUT}/p7-01-buyuk-yazi.png` })
  await p.getByTestId('text-size').getByRole('radio', { name: /^Normal/ }).click(); await p.waitForFunction(() => !document.documentElement.hasAttribute('data-text'))
  await p.waitForTimeout(300); await p.waitForFunction(() => !document.querySelector('[data-testid=text-size] button[disabled]'))

  // 2) Program sihirbazı v2: öncelikli bölge → ek set + haftalık set notu
  await p.goto(BASE + '/fitness/programlar/olustur'); await p.selectOption('#gen-env', 'gym')
  await p.getByTestId('gen-priority').getByRole('button', { name: 'Baldır' }).click()
  await p.getByRole('button', { name: 'Programı oluştur' }).click(); await p.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/)
  if (!/Öncelikli bölgeler \(haftalık set\): Baldır \d+/.test(await p.locator('body').innerText())) fail('öncelikli bölge notu yok')

  // 3) Öğün hatırlatma ayarı görünür, onay kutusu tek tip (22 px)
  await p.goto(BASE + '/profil/bildirimler'); const tg = p.getByTestId('meal-reminders').locator('input[type=checkbox]')
  if (!(await tg.isChecked())) fail('öğün hatırlatması varsayılan açık değil')
  const box = await tg.boundingBox(); if (!box || Math.round(box.width) !== 22) fail('onay kutusu 22 px değil: ' + box?.width)

  // 4) Her zamanki kahvaltı: 7 gün aynı kahvaltı → bugün boş kahvaltıda tek dokunuş
  const h = await p.evaluate(async () => { const r = await fetch('/api/test/fit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: 7, kgPerDay: 0.05, breakfast: true }) }); return r.status })
  if (h === 404) { console.log('P7 E2E (kısmi) OK — canlı: kanca yok'); await b.close(); return }
  await p.goto(BASE + '/yemek'); const um = p.locator('[data-testid=usual-meal][data-meal=breakfast]')
  await um.waitFor().catch(() => fail('her zamanki kahvaltı önerisi yok'))
  if (!/Yumurta/i.test(await um.innerText())) fail('öneride yumurta yok: ' + (await um.innerText()))
  await p.screenshot({ path: `${OUT}/p7-02-her-zamanki.png` })
  await um.click(); await p.getByRole('status').filter({ hasText: /Her zamanki kahvaltı eklendi/ }).waitFor().catch(() => fail('her zamanki kahvaltı eklenmedi'))
  await p.reload(); if (await p.locator('[data-testid=usual-meal][data-meal=breakfast]').count()) fail('öğün doluyken öneri hâlâ görünüyor')

  // 5) Başarılar: ilk öğün + 7 gün kayıt; rozet paylaşımı
  await p.goto(BASE + '/profil/basarilar'); await p.getByTestId('achievements').waitFor()
  const streak = Number(await p.getByTestId('streak-food').innerText()); if (streak < 7) fail('kayıt serisi ' + streak)
  if ((await p.locator('li[data-earned="1"]').count()) < 2) fail('kazanılmış rozet sayısı az')
  await p.screenshot({ path: `${OUT}/p7-03-basarilar.png`, fullPage: true })
  await p.getByTestId('badge-share').first().click(); await p.waitForURL('**/sosyal/yeni?tur=badge*')
  await p.getByRole('button', { name: 'Paylaş', exact: true }).click(); await p.waitForURL(/\/sosyal\/p\/[0-9a-f-]{36}$/)
  await p.getByTestId('post-badge').waitFor().catch(() => fail('rozet gönderisi görünmüyor'))

  console.log('P7 E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('P7 E2E FAIL', e.message); process.exit(1) })
