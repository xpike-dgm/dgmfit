// Faz 7-1: ekranlar arası tutarlılık. Antrenman + kardiyo + yemek + su sonrası Bugün, Yemek ve Su aynı sayıları gösterir;
// su hedefine antrenman eki yansır ve açıklanır; antrenman sonrası protein kartı çıkar.
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
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|play\(\)/.test(m.text())) errors.push('console: ' + m.text()) })
  const u = 'test_in' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1990-03-03', heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'lose', targetWeightKg: 76, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  const state = async (path, tid) => { await p.goto(BASE + path); const el = p.getByTestId(tid); await el.waitFor(); return el }
  const num = async (el, a) => Number(await el.getAttribute(a))
  const water0 = await num(await state('/', 'today-state'), 'data-water-goal')

  // 1) ağırlık antrenmanı (1 set) + 60 dk kardiyo
  await p.goto(BASE + '/fitness/hareketler?q=barbell bench press')
  const href = await p.getByRole('link', { name: /^Barbell Bench Press/ }).first().getAttribute('href')
  await p.goto(BASE + '/fitness/antrenman?hareket=' + href.split('/').pop())
  const s = p.locator('section[data-testid="live-exercise"]:not([hidden])').first(); await s.waitFor()
  await s.getByLabel('Set 1 ağırlık (kg)', { exact: true }).fill('60'); await s.getByLabel('Set 1 tekrar', { exact: true }).fill('8'); await s.getByRole('button', { name: 'Set 1 tamamla' }).click()
  await p.getByRole('button', { name: 'Bitir' }).click(); await p.getByRole('button', { name: 'Kaydet ve özete geç' }).click(); await p.waitForURL(/\/fitness\/antrenman\/[0-9a-f-]{36}/)
  await p.goto(BASE + '/fitness/kardiyo'); await p.fill('#c-min', '60'); await p.fill('#c-km', '8'); await p.getByRole('button', { name: 'Kaydet' }).click()
  await p.getByRole('status').filter({ hasText: /net \d+ kcal/ }).waitFor({ timeout: 15000 })

  // 2) yemek + su
  await p.goto(BASE + '/yemek/ekle?ogun=breakfast'); await p.fill('#food-q', 'simit'); await p.getByRole('button', { name: /^Simit/ }).first().click()
  await p.getByRole('button', { name: 'Kahvaltıya ekle' }).click(); await p.getByText(/Simit · \d+ kcal/).waitFor()
  await p.getByTestId('impact-line').filter({ hasText: /Kalan .* kcal · protein %\d+ · su %\d+/ }).waitFor().catch(() => fail('kayıttan sonra etki satırı yok'))
  await p.goto(BASE + '/'); await p.getByRole('button', { name: /ml su ekle$/ }).first().click(); await p.waitForTimeout(1200)

  // 3) aynı sayılar: Bugün = Yemek (kalan kcal, bütçe); Bugün = Su (su hedefi, ek dahil)
  const today = await state('/', 'today-state')
  const tLeft = await num(today, 'data-left'), tBudget = await num(today, 'data-budget'), tWater = await num(today, 'data-water-goal')
  const diary = await state('/yemek', 'diary-state')
  if ((await num(diary, 'data-left')) !== tLeft || (await num(diary, 'data-budget')) !== tBudget) fail(`Yemek kalan/bütçe (${await num(diary, 'data-left')}/${await num(diary, 'data-budget')}) ≠ Bugün (${tLeft}/${tBudget})`)
  const water = await state('/su', 'water-state')
  if ((await num(water, 'data-goal')) !== tWater) fail(`Su hedefi ${await num(water, 'data-goal')} ≠ Bugün ${tWater}`)
  if (!(tWater - water0 >= 500)) fail(`60 dk kardiyo + antrenman su hedefini artırmadı (${water0} → ${tWater})`)
  await p.getByTestId('water-bonus').waitFor().catch(() => fail('Su ekranında antrenman eki açıklaması yok'))
  await p.screenshot({ path: `${OUT}/integration-01-su.png` })

  // 4) antrenman sonrası protein kartı (protein açığı büyük)
  await p.goto(BASE + '/'); await p.getByTestId('post-workout-protein').waitFor().catch(() => fail('antrenman sonrası protein kartı yok'))
  await p.screenshot({ path: `${OUT}/integration-02-bugun.png` })

  console.log('INTEGRATION E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('INTEGRATION E2E FAIL', e.message); process.exit(1) })
