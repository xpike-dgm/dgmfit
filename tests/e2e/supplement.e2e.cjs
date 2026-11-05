// Faz 5f: kendi takviyen — tanımla (porsiyon başına değer, birim, ek içerik, günlük hedef) → Yemek ekranında +/− ile porsiyon işaretle →
// kalori/protein günlüğe girer, öğün listelerine karışmaz, kafein üst sınırı uyarısı, düzenle/sil, besin aramasında çıkmaz, 320 px taşma yok.
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
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('dialog', (d) => d.accept())
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  const u = 'test_sp' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1992-02-02', heightCm: 180, weightKg: 85, activity: 'moderate', goal: 'lose', targetWeightKg: 80, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  const shot = (n) => p.screenshot({ path: `${OUT}/supp-${n}.png`, fullPage: true })
  const status = (re) => p.getByRole('status').filter({ hasText: re }).first().waitFor()

  // 1) Boş kart → yeni takviye formu
  await p.goto(BASE + '/yemek'); await p.getByTestId('supplements').waitFor()
  await p.getByTestId('supp-add').click(); await p.waitForURL('**/yemek/takviyeler/yeni')
  const add = async (o) => {
    await p.goto(BASE + '/yemek/takviyeler/yeni')
    await p.fill('#supp-name', o.name); await p.selectOption('#supp-unit', o.unit)
    if (o.g) await p.fill('#supp-g', String(o.g))
    for (const k of ['kcal', 'protein', 'carb', 'fat']) if (o[k] !== undefined) await p.fill('#supp-' + k, String(o[k]).replace('.', ','))
    for (const [n, a] of o.extras ?? []) { await p.getByRole('button', { name: n, exact: true }).click(); await p.getByTestId('supp-extra').last().getByLabel('Miktar').fill(String(a)) }
    if (o.daily) await p.fill('#supp-daily', String(o.daily))
    await p.getByTestId('supp-save').click(); await p.waitForURL(/\/yemek\/takviyeler$/)
  }
  // makro-kalori tutarsızlığı kaydı engeller
  await p.fill('#supp-name', 'Bozuk'); await p.fill('#supp-kcal', '10'); await p.fill('#supp-protein', '30')
  await status(/uyuşmuyor/); if (!(await p.getByTestId('supp-save').isDisabled())) fail('tutarsız makro kaydedilebiliyor')
  await shot('01-form')
  await add({ name: 'Whey', unit: 'ölçek', g: 30, kcal: 120, protein: 24, carb: 3, fat: 1.5 })
  await add({ name: 'Kreatin', unit: 'g', g: 5, extras: [['Kreatin', 5]], daily: 1 })
  await add({ name: 'Pre-workout', unit: 'ölçek', g: 10, kcal: 10, carb: 2, extras: [['Kafein', 250]] })
  if ((await p.getByTestId('supp-item').count()) !== 3) fail('3 takviye listelenmeli')

  // 2) Yemek ekranında işaretle
  await p.goto(BASE + '/yemek')
  const row = (n) => p.locator(`[data-testid=supp-row][data-name="${n}"]`)
  const count = async (n) => (await row(n).getByTestId('supp-count').innerText()).trim()
  const plus = async (n, times = 1) => { for (let i = 0; i < times; i++) { await row(n).getByRole('button', { name: `${n} bir porsiyon ekle` }).click(); await p.waitForTimeout(700) } }
  await plus('Whey', 2); await p.getByTestId('supplements').filter({ hasText: 'Bugün 240 kcal · 48 g protein' }).waitFor().catch(() => fail('whey ×2 günlüğe 240 kcal / 48 g olarak girmedi'))
  if ((await count('Whey')) !== '2') fail('whey sayacı 2 olmalı: ' + (await count('Whey')))
  // öğün listelerinde görünmez ama günün toplamına girer
  for (const m of ['Kahvaltı', 'Öğle yemeği', 'Akşam yemeği', 'Ara öğün']) { const sec = p.getByRole('region', { name: m, exact: true }); if ((await sec.count()) && (await sec.innerText()).includes('Whey')) fail('takviye öğün listesine karıştı: ' + m) }
  if (!(await p.locator('body').innerText()).includes('240')) fail('günlük toplamda 240 kcal yok')
  await plus('Kreatin'); if ((await count('Kreatin')) !== '1/1') fail('kreatin hedefi 1/1 olmalı: ' + (await count('Kreatin')))
  await plus('Pre-workout', 2); await p.getByRole('alert').filter({ hasText: /kafein/ }).waitFor().catch(() => fail('500 mg kafein uyarısı yok'))
  await p.getByTestId('supp-extras').filter({ hasText: 'Kafein 500 mg' }).waitFor()
  await shot('02-kart')
  await row('Pre-workout').getByRole('button', { name: 'Pre-workout bir porsiyon azalt' }).click(); await p.waitForTimeout(900)
  if (await p.getByRole('alert').filter({ hasText: /kafein/ }).count()) fail('geri alınca kafein uyarısı kalktı değil')
  await p.reload(); if ((await count('Pre-workout')) !== '1') fail('azaltma kalıcı olmadı')

  // 3) Düzenle + sil; besin aramasında takviye çıkmaz
  await p.getByTestId('supp-manage').click(); await p.waitForURL('**/yemek/takviyeler')
  await p.getByTestId('supp-item').filter({ hasText: 'Whey' }).click(); await p.waitForURL(/takviyeler\/\d+$/)
  if ((await p.inputValue('#supp-protein')) !== '24') fail('düzenlemede eski protein yok: ' + (await p.inputValue('#supp-protein')))
  await p.fill('#supp-protein', '25'); await p.getByTestId('supp-save').click(); await p.waitForURL(/\/yemek\/takviyeler$/)
  await p.getByTestId('supp-item').filter({ hasText: 'P 25' }).waitFor().catch(() => fail('düzenleme listeye yansımadı'))
  await p.getByTestId('supp-item').filter({ hasText: 'Kreatin' }).click(); await p.getByRole('button', { name: 'Takviyeyi sil' }).click(); await p.waitForURL(/\/yemek\/takviyeler$/)
  if ((await p.getByTestId('supp-item').count()) !== 2) fail('silinen takviye listede')
  const search = await p.evaluate(async () => (await (await fetch('/api/food/search?q=whey')).json()))
  if (JSON.stringify(search).includes('user-supplement')) fail('takviye besin aramasında çıkıyor')

  // 4) 320 px
  await p.setViewportSize({ width: 320, height: 640 })
  for (const path of ['/yemek', '/yemek/takviyeler', '/yemek/takviyeler/yeni']) {
    await p.goto(BASE + path); await p.waitForTimeout(300)
    if (path.endsWith('yeni')) { await p.getByRole('button', { name: 'Kafein', exact: true }).click() }
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, out: [...document.querySelectorAll('button, a, input, select')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > 321 && !e.closest('.overflow-x-auto') }).map((e) => (e.getAttribute('aria-label') || e.textContent || e.id || '').trim().slice(0, 30)) }))
    if (r.sw > 320 || r.out.length) fail(`320 px taşma ${path}: genişlik ${r.sw}, dışarıda: ${r.out.join(' | ')}`)
  }
  await shot('03-form-320')
  console.log('TAKVİYE E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('TAKVİYE E2E FAIL', e.message); process.exit(1) })
