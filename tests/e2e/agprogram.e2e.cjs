// Faz 5h-4: Ağırsağlam ücretsiz programları (şablon listesi + süzgeç + ayrıntı + kaynak) → programı kullan → süperset bloğu
// → canlı antrenmanda süperset akışı (A seti → dinlenmeden B, B seti → dinlenme + A'ya dönüş) → editörde süperseti boz/bağla.
// Lisanslı paket yoksa atlanır. Program/hareket adları paketten okunur, test dosyasında içerik yok.
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
  const u = 'test_ap' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1990-03-03', heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'lose', targetWeightKg: 76, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  const shot = (n) => p.screenshot({ path: `${OUT}/agprogram-${n}.png`, fullPage: n.includes('tam') })

  // 1) Şablonlar: Ağırsağlam bölümü, süzgeç, kaynak satırı
  await p.goto(BASE + '/fitness/programlar/sablonlar')
  const items = p.getByTestId('ag-template-item')
  if (!(await items.count())) { console.log('AG PROGRAM E2E ATLANDI (paket yok)'); await b.close(); return }
  const total = await items.count(); if (total < 30) fail('ücretsiz program sayısı az: ' + total)
  await p.getByTestId('ag-source').waitFor()
  await shot('01-liste')
  await p.getByRole('link', { name: 'Tek antrenman', exact: true }).click(); await p.waitForURL('**?f=tek')
  const days = await items.evaluateAll((xs) => xs.map((x) => Number(x.getAttribute('data-days'))))
  if (!days.length || days.some((d) => d !== 1)) fail('Tek antrenman süzgeci: ' + days.join(','))
  // süpersetli tek antrenmanlık ilk program
  const pick = items.and(p.locator(':not([data-ss="0"])')).first()
  const name = await pick.getAttribute('data-name'); if (!name) fail('süpersetli tek antrenman bulunamadı')
  await pick.click(); await p.waitForURL('**/sablonlar/ag-*')
  await p.getByTestId('superset-block').first().waitFor()
  if ((await p.getByTestId('ag-template-ex').count()) < 3) fail('ayrıntıda az hareket')
  await p.getByTestId('ag-source').waitFor()
  await shot('02-detay-tam')

  // 2) Programı kullan → editörde süperset bloğu
  await p.getByRole('button', { name: 'Bu şablonu kullan' }).click(); await p.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/)
  const progUrl = p.url()
  await p.getByRole('heading', { name }).waitFor()
  await p.getByTestId('program-ex').first().waitFor()
  const blocks = await p.getByTestId('superset-block').count(); if (!blocks) { await shot('03-hata'); fail('editörde süperset bloğu yok: ' + p.url()) }
  const firstBlock = p.getByTestId('superset-block').first()
  const members = await firstBlock.getByTestId('program-ex').locator('button.flex-1 > span:first-child').allInnerTexts()
  if (members.length < 2) fail('süperset bloğunda 2+ hareket yok')
  const [A, B] = members.map((x) => x.trim())
  await shot('03-program')

  // 3) Canlı: A'nın 1. seti → dinlenme yok, B seçilir; B'nin 1. seti → dinlenme, A'ya dönüş
  await p.getByRole('link', { name: 'Antrenmana Başla' }).first().click(); await p.waitForURL('**/fitness/antrenman?gun=*')
  const strip = p.getByTestId('live-strip')
  const tab = (n) => strip.getByRole('tab', { name: n, exact: true }).first()
  const sec = (n) => p.locator('section[data-testid="live-exercise"]:not([hidden])', { hasText: n }).first()
  const doSet = async (n) => {
    await tab(n).click(); const s = sec(n); await s.waitFor()
    const kg = s.getByLabel('Set 1 ağırlık (kg)', { exact: true }); if (await kg.count()) await kg.fill('10')
    const reps = s.getByLabel('Set 1 tekrar', { exact: true }); if (await reps.count()) await reps.fill('10')
    await s.getByRole('button', { name: 'Set 1 tamamla' }).click()
  }
  await tab(A).click(); await sec(A).getByTestId('superset-chip').waitFor()
  if (!(await sec(A).getByTestId('superset-chip').innerText()).includes(B)) fail('süperset çipinde sonraki hareket yok')
  await shot('04-canli-superset')
  const selected = (n) => p.waitForFunction((x) => document.querySelector(`[data-testid=live-strip] [role=tab][aria-label="${x}"]`)?.getAttribute('aria-selected') === 'true', n, { timeout: 4000 })
  const all = members.map((x) => x.trim())
  for (const [k, m] of all.entries()) {
    await doSet(m)
    if (k < all.length - 1) {
      await selected(all[k + 1]).catch(() => fail(`${m} setinden sonra ${all[k + 1]} seçilmedi`))
      if (await p.getByTestId('rest-timer').isVisible().catch(() => false)) fail('süperset içinde dinlenme başladı')
    }
  }
  await p.getByTestId('rest-timer').waitFor().catch(() => fail('tur sonunda dinlenme başlamadı'))
  if (!(await p.getByTestId('rest-timer').innerText()).includes(A)) fail('dinlenmede sıradaki A değil')
  await selected(A).catch(() => fail('tur sonunda A\'ya dönülmedi'))
  await p.getByTestId('rest-timer').getByRole('button', { name: 'Atla' }).click()
  await p.getByRole('button', { name: 'Bitir' }).click(); await p.getByRole('button', { name: 'Kaydet ve özete geç' }).click()
  await p.waitForURL(/\/fitness\/antrenman\/[0-9a-f-]{36}\?yeni=1/)

  // 4) Editör: süperseti boz → blok azalır; yeniden bağla → geri gelir
  await p.goto(progUrl)
  await p.getByRole('button', { name: `${A} düzenle` }).first().click()
  const tg = p.getByTestId('superset-toggle'); await tg.waitFor()
  if (!/Süperseti boz/.test(await tg.innerText())) fail('düzenle penceresinde "Süperseti boz" yok')
  await tg.click(); await p.waitForTimeout(1200)
  const after = await p.getByTestId('superset-block').count()
  const stillTogether = await p.getByTestId('superset-block').first().innerText().then((t) => t.includes(A) && t.includes(B)).catch(() => false)
  if (stillTogether && after >= blocks) fail('süperset bozulmadı')
  await p.getByRole('button', { name: `${A} düzenle` }).first().click()
  await p.getByTestId('superset-toggle').click(); await p.waitForTimeout(1200)
  if ((await p.getByTestId('superset-block').count()) !== blocks) fail('süperset yeniden bağlanmadı')

  console.log('AG PROGRAM E2E OK user=', u, 'program:', name, 'süperset:', A, '+', B, 'toplam:', total)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('AG PROGRAM E2E FAIL', e.message); process.exit(1) })
