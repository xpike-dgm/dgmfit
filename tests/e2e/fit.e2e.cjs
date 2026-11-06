// Fit modülü uçtan uca testi. Beklenen dengeleme/banka değerleri lib/fit.ts'teki test edilmiş fonksiyonlarla hesaplanır.
// Test kancası (DGFIT_TEST_HOOKS=1) varsa geçmiş 20 gün tohumlanır; canlıda kanca 404 döner ve yalnızca veri gerektirmeyen akışlar denenir.
const { chromium, devices } = require('playwright')
const path = require('path')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
const istDay = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() + offset * 86400000))

;(async () => {
  const fit = await import(path.join(__dirname, '../../lib/fit.ts'))
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 14'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage()
  p.setDefaultNavigationTimeout(60000)
  const errors = []
  let acceptDialog = false
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('dialog', (d) => { if (acceptDialog) { acceptDialog = false; d.accept(); return } errors.push('dialog: ' + d.message()); d.dismiss() })
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
  const shot = (n) => p.screenshot({ path: `${OUT}/fit-${n}.png`, fullPage: true })
  const todayTarget = async () => num(await p.getByTestId('today-target').innerText())
  const status = (re) => p.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout: 15000 }).catch(() => fail('durum mesajı yok: ' + re))

  const u = 'test_fit' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1995-05-05', heightCm: 177, weightKg: 78.4, activity: 'moderate', goal: 'lose', targetWeightKg: 72, tempo: 'balanced', customDays: 90, experience: null, trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:30', sleepTime: '23:30' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  // Sadeleştirme (2026-11-06): bu test Gelişmiş mod araçlarını kullanır
  await p.goto(BASE + '/profil/gorunum'); await p.getByTestId('ui-advanced').check(); await p.waitForTimeout(300)
  await p.waitForFunction(() => { const c = document.querySelector('[data-testid=ui-advanced]'); return c && c.checked && !c.disabled })

  const hook = await p.request.post(BASE + '/api/test/fit', { data: { days: 20, kgPerDay: 0.08, yesterdayExtra: 400 } })
  const seeded = hook.status() === 200
  console.log(seeded ? 'tohumlu mod' : `canlı mod (kanca ${hook.status()})`)

  await p.goto(BASE + '/fit')
  await p.getByTestId('roadmap').waitFor()
  const base = seeded ? (await hook.json()).dailyKcal : await todayTarget()

  if (seeded) {
    // 1) Dünkü +400 kcal, bugünden başlayan 7 güne dağıtıldı
    const days = Array.from({ length: 7 }, (_, i) => ({ day: istDay(i), base, current: 0 }))
    const expected = fit.distributeDiff(400, days, 1500)
    const adjToday = expected.adjustments[0].kcal
    if ((await todayTarget()) !== base + adjToday) fail(`bugünkü hedef ${await todayTarget()} beklenen ${base + adjToday}`)
    await p.getByTestId('balance-card').getByText(/400 kcal üstündeydin/).waitFor().catch(() => fail('dengeleme kartında 400 kcal fazla yok'))
    await p.getByTestId('forecast').getByText(/kg\/hafta/).waitFor().catch(() => fail('tahmin metni yok'))
    // Ölçülen harcama ≈ ortalama alım + kayıp × 7.700 (tartılar 0,1 kg'a yuvarlı → ±80 kcal pay)
    const trueTdee = base + 400 / 20 + 0.08 * 7700
    const measured = num(await p.locator('div.card', { hasText: 'Ölçülen harcama' }).locator('.num').innerText())
    if (Math.abs(measured - trueTdee) > 80) fail(`ölçülen harcama ${measured}, gerçek ${trueTdee}`)
    // Araçlar ayrı sayfalarda: düğmeden açılır, geri düğmesi Fit'e döner
    await p.getByRole('link', { name: /Önümüzdeki 7 gün/ }).click(); await p.waitForURL('**/fit/gunler')
    const chips = await p.getByTestId('next-days').getByText(/Dengeleme/).count()
    if (chips !== 7) fail('7 günde dengeleme etiketi beklendi: ' + chips)
    await p.getByRole('link', { name: 'Geri' }).click(); await p.waitForURL(BASE + '/fit')
    await shot('01-plan')

    // 2) Bugün ve Yemek ekranları düzeltilmiş hedefi açıklar
    await p.goto(BASE + '/')
    await p.getByText(new RegExp(`Akıllı dengeleme −${-adjToday} kcal`)).waitFor().catch(() => fail('Bugün ekranında dengeleme açıklaması yok'))
    await p.goto(BASE + '/yemek')
    const note = await p.getByTestId('adjust-note').innerText()
    if (!note.includes(`− ${-adjToday} dengeleme`)) fail('Yemek açıklaması: ' + note)

    // 3) İstisna say → bugünden itibaren dengeleme kalkar, hedef tarih uzar
    await p.goto(BASE + '/fit')
    await p.getByRole('button', { name: 'İstisna say' }).click()
    await status(/İstisna sayıldı; hedef tarih \d gün uzadı/)
    await p.waitForTimeout(500)
    if ((await todayTarget()) !== base) fail('istisna sonrası bugünkü hedef plana dönmedi: ' + (await todayTarget()))

    // 4) Haftalık check-in: ölçülen harcama hesaplandı, öneri ±150 içinde
    await p.goto(BASE + '/fit/checkin')
    const ci = p.getByTestId('checkin')
    await ci.getByText(/Ölçülen harcama \d+ günlük trend/).waitFor().catch(() => fail('check-in verisi yok'))
    if (await ci.getByRole('button', { name: 'Uygula' }).count()) {
      const shown = num((await ci.locator('.num').first().innerText()).split('→')[1])
      await ci.getByRole('button', { name: 'Uygula' }).click()
      await status(new RegExp(`Yeni günlük hedef ${shown.toLocaleString('tr-TR')} kcal`))
      if (Math.abs(shown - base) > 150) fail('check-in adımı 150 kcal\'i aştı')
    }
    await shot('02-checkin')
  }

  // 5) Kalori bankası: 4. seçenek (bugün+5) için 500 kcal → 4 gün biriktirme
  await p.goto(BASE + '/fit')
  const cur = await todayTarget()
  await p.goto(BASE + '/fit/banka')
  await p.getByRole('button', { name: 'Etkinlik ekle' }).click()
  const evDay = await p.locator('#bank-day').inputValue()
  if (evDay !== istDay(5)) fail('varsayılan etkinlik günü ' + evDay)
  await p.fill('#bank-note', 'Düğün')
  const plan = fit.planBank({ today: istDay(0), eventDay: evDay, extra: 500, days: [1, 2, 3, 4, 5].map((i) => ({ day: istDay(i), base: cur, current: 0 })), floor: 1500 })
  if (plan.error) fail('beklenen banka hesaplanamadı: ' + plan.error)
  await p.getByRole('button', { name: 'Biriktirmeye başla' }).click()
  await status(new RegExp(`Hazır: 4 gün boyunca günde ${plan.perDay} kcal`))
  await p.getByTestId('bank-item').getByText(/Düğün/).waitFor()
  await shot('03-banka')
  await p.goto(BASE + '/fit/gunler')
  if ((await p.getByTestId('next-days').getByText(/Banka birikimi/).count()) !== 4) fail('4 biriktirme günü görünmüyor')
  await p.goto(BASE + '/fit/banka')
  acceptDialog = true
  await p.getByTestId('bank-item').getByRole('button', { name: 'İptal' }).click()
  await p.getByTestId('bank-item').waitFor({ state: 'detached' }).catch(() => fail('banka iptal edilmedi'))

  // 6) Günü kapat / yeniden aç (500 kcal kayıt hedefin %60'ının altında → eksik kayıt)
  await p.goto(BASE + '/yemek')
  await p.getByRole('button', { name: /Hızlı kalori/ }).first().click()
  await p.fill('#q-kcal', '500'); await p.getByRole('button', { name: /· ekle$/ }).click()
  await p.waitForTimeout(800)
  await p.goto(BASE + '/fit')
  await p.getByRole('button', { name: 'Günü kapat' }).click()
  await status(/eksik kayıt sayıldı/)
  await p.getByTestId('day-closed').waitFor()
  await p.getByRole('button', { name: 'Yeniden aç' }).click()
  await p.getByRole('button', { name: 'Günü kapat' }).waitFor().catch(() => fail('gün yeniden açılmadı'))

  // 7) Tartı
  await p.fill('#fit-kg', '77,6'); await p.getByRole('button', { name: 'Kaydet' }).click()
  await status(/Tartı kaydedildi/)
  await shot('04-son')

  if (errors.length) fail('Tarayıcı hataları:\n' + errors.join('\n'))
  await b.close()
  console.log('FIT E2E OK', u)
})().catch((e) => { console.error('FIT E2E FAIL:', e.message); process.exit(1) })
