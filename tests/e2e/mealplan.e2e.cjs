// Y2: Kalanıma göre öner (öğün kurucu). Yemek → bağlantı → kalan değerler + öneriler; "en çok 20 g protein" sınırıyla
// yeniden öner → tüm öneriler sınırda; "Öğüne ekle" → günlükte kalemler. Canlıda da çalışır (AI gerekmez).
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }

;(async () => {
  const b = await chromium.launch()
  const errors = []
  const ctx = await b.newContext({ ...devices['Pixel 7'], hasTouch: false, isMobile: false, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  const u = 'test_mp' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1995-05-05', heightCm: 178, weightKg: 62, activity: 'light', goal: 'gain', targetWeightKg: 75, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  await p.goto(BASE + '/yemek'); await p.getByTestId('meal-suggest-link').click(); await p.waitForURL('**/yemek/oneri**')
  await p.getByTestId('mp-remaining').waitFor()
  const n0 = await p.getByTestId('mp-meal').count()
  if (n0 < 2) fail('en az 2 öneri bekleniyordu: ' + n0)
  // sınır: en çok 20 g protein
  await p.getByTestId('mp-lim-protein').fill('20'); await p.getByTestId('mp-recalc').click(); await p.waitForTimeout(1500)
  const totals = await p.getByTestId('mp-totals').allInnerTexts()
  if (!totals.length) fail('sınırla öneri yok')
  for (const t of totals) { const pr = Number(t.split('\n')[0].replace(/\D/g, '')); if (!(pr <= 22)) fail('protein sınırı aşıldı: ' + t.replace(/\n/g, ' ')) }
  await p.screenshot({ path: `${OUT}/mealplan-01.png`, fullPage: true })
  // öğüne ekle → günlükte kalemler
  const first = (await p.getByTestId('mp-meal').first().locator('li').allInnerTexts()).map((x) => x.split('\n')[0].trim())
  await p.getByRole('radio', { name: 'Ara öğün' }).click()
  await p.getByTestId('mp-add').first().click(); await p.getByRole('status').filter({ hasText: 'eklendi' }).waitFor().catch(() => fail('öğüne eklenmedi'))
  await p.goto(BASE + '/yemek'); await p.waitForTimeout(500)
  const sec = p.locator('section[aria-label="Ara öğün"]')
  for (const name of first) if (!(await sec.getByText(name, { exact: false }).count())) fail(`eklenen "${name}" ara öğünde yok`)
  if (errors.length) fail('hatalar: ' + errors.join(' | '))
  console.log('ÖĞÜN KURUCU E2E OK user=', u)
  await b.close()
})().catch((e) => { console.error('ÖĞÜN KURUCU E2E FAIL:', e.message); process.exit(1) })
