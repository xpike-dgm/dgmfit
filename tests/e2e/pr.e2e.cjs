// Faz 5h-6: rekor denemesi — Fitness → Rekor denemesi → hareket seç → hedef 100 kg, bar 20 → plaka dizilimi (görsel/çizim)
// → ısınmalar (ağır ısınmada "nasıl geçti?") → 3 deneme, yanıta göre ağırlık ayarı → sonuç → Günlüğe ekle → özet + rekor.
// Ayrıca canlı antrenmandaki plaka hesaplayıcı yeni bar/plaka görünümünü kullanır.
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
  const errors = []
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  const u = 'test_pr' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1990-03-03', heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'lose', targetWeightKg: 76, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  const shot = (n) => p.screenshot({ path: `${OUT}/pr-${n}.png` })

  // 1) Fitness → Rekor denemesi → hareket seç
  await p.goto(BASE + '/fitness'); await p.getByTestId('pr-link').click(); await p.waitForURL('**/fitness/rekor')
  await p.fill('#ex-q', 'Barbell Squat'); await p.getByRole('button', { name: /^Barbell Squat/ }).first().click()
  await p.waitForURL(/\/fitness\/rekor\?ex=\d+/)
  const exId = new URL(p.url()).searchParams.get('ex')
  await p.getByTestId('pr-form').waitFor()
  await p.fill('#pr-target', '100'); await p.getByRole('button', { name: '20 kg', exact: true }).click()
  const load = p.getByTestId('pr-form').getByTestId('bar-load')
  if ((await load.getAttribute('data-plates')) !== '25,15') fail('100 kg plaka dizilimi 25+15 değil: ' + (await load.getAttribute('data-plates')))
  if ((await load.getByTestId('plate').count()) !== 2) fail('plaka sayısı 2 değil')
  await shot('01-form')
  await p.getByRole('button', { name: 'Başla', exact: true }).click()

  // 2) Isınmalar: sor-ma (hafif) → ağır ısınmada soru; dinlenmeyi bitir
  const step = p.getByTestId('pr-step')
  const finishRest = async () => { const r = p.getByTestId('pr-rest'); if (await r.isVisible().catch(() => false)) await r.getByRole('button', { name: 'Dinlenmeyi bitir' }).click() }
  const kgNow = async () => Number(await step.getAttribute('data-kg'))
  let guard = 0, asked = 0
  while ((await step.getAttribute('data-kind')) === 'warmup' && guard++ < 10) {
    await step.getByRole('button', { name: 'Seti bitir' }).click()
    const sheet = p.getByTestId('pr-felt')
    if (await sheet.isVisible({ timeout: 800 }).catch(() => false)) { asked++; await sheet.getByRole('button', { name: /^Normaldi/ }).click() }
    await p.getByTestId('pr-rest').waitFor()
    if (guard === 1) await shot('02-dinlenme')
    await finishRest(); await step.waitFor()
  }
  if (asked < 2) fail('ağır ısınmalarda "nasıl geçti" sorulmadı: ' + asked)
  // 3) Denemeler: 1. normal (95) → 2. hedef (100) → 2. hafif → 3. 105; 3. başarısız
  if ((await kgNow()) !== 95) fail('açılış denemesi 95 değil: ' + (await kgNow()))
  await shot('03-deneme')
  const attempt = async (felt) => { await step.getByRole('button', { name: 'Seti bitir' }).click(); await p.getByTestId('pr-felt').getByRole('button', { name: new RegExp('^' + felt) }).click() }
  await attempt('Normaldi'); await finishRest(); await step.waitFor()
  if ((await kgNow()) !== 100) fail('2. deneme 100 değil: ' + (await kgNow()))
  await attempt('Hafifti'); await finishRest(); await step.waitFor()
  if ((await kgNow()) !== 105) fail('hafif yanıtı sonrası 3. deneme 105 değil: ' + (await kgNow()))
  // yenilense de kaldığı yerden sürer
  await p.reload(); await step.waitFor(); if ((await kgNow()) !== 105) fail('yenileyince deneme kayboldu')
  await attempt('Kaldıramadım')
  const res = p.getByTestId('pr-result'); await res.waitFor()
  if ((await res.getByTestId('pr-best').innerText()).trim() !== '100 kg') fail('en iyi deneme 100 kg değil')
  await shot('04-sonuc')
  await res.getByRole('button', { name: 'Günlüğe ekle' }).click()
  await p.waitForURL(/\/fitness\/antrenman\/[0-9a-f-]{36}\?yeni=1/)
  // ilk kayıt olduğu için rekor kartı çıkmaz (DgFit kuralı: önceki kayıt yoksa rekor yok); denemeler günlükte
  await p.getByTestId('summary').waitFor()
  if (!/100 ?kg|100 × 1|100×1/.test(await p.locator('body').innerText())) fail('özette 100 kg deneme yok')
  if (!(await p.getByTestId('summary').innerText()).includes('Rekor denemesi')) fail('özet adı Rekor denemesi değil')

  // 4) Canlı antrenmandaki plaka hesaplayıcı yeni görünümle
  await p.goto(BASE + '/fitness/antrenman?hareket=' + exId)
  const live = p.locator('section[data-testid="live-exercise"]:not([hidden])'); await live.waitFor()
  await live.getByRole('button', { name: /seçenekleri$/ }).click()
  await p.getByRole('button', { name: 'Plaka hesapla' }).click()
  const pc = p.getByTestId('plate-calc'); await pc.getByTestId('bar-load').waitFor().catch(() => fail('plaka hesaplayıcıda bar görünümü yok'))
  await pc.locator('#pc-kg').fill('60'); if ((await pc.getByTestId('bar-load').getAttribute('data-plates')) !== '20') fail('60 kg → her tarafa 20 bekleniyordu')
  await shot('05-plaka-hesap')
  await p.keyboard.press('Escape')
  await p.getByRole('button', { name: 'Bitir' }).click(); await p.keyboard.press('Escape')
  console.log('REKOR E2E OK user=', u, 'ısınma soruları:', asked)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('REKOR E2E FAIL', e.message); process.exit(1) })
