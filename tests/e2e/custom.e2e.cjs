// Özelleştirme (Ö1a): Profil → Özelleştirme → Bugün düzenleme modu: kaldır / geri al, basılı tutup sürükle,
// ✎ ile boyut ve sıra, çekmeceden ekle, Bitti → kalıcı, stüdyodan varsayılana dön. Canlıda da çalışır (kanca gerekmez).
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
  const u = 'test_cu' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'female', birthDate: '1993-04-04', heightCm: 166, weightKg: 68, activity: 'light', goal: 'lose', targetWeightKg: 63, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  const order = () => p.$$eval('[data-card]', (els) => els.map((e) => e.getAttribute('data-card')))
  const editOrder = () => p.$$eval('[data-edit-card]', (els) => els.map((e) => e.getAttribute('data-edit-card')))
  const o0 = await order()
  if (o0[0] !== 'today.header' || !o0.includes('today.water') || !o0.includes('today.fit')) fail('varsayılan düzen beklenmedik: ' + o0)

  // 1) Profil → Özelleştirme → Düzenlemeye başla
  await p.goto(BASE + '/profil'); await p.getByTestId('studio-link').click(); await p.getByTestId('studio').waitFor()
  await p.screenshot({ path: `${OUT}/custom-01-studyo.png` })
  await p.getByTestId('studio-edit').click(); await p.getByTestId('card-editor').waitFor()
  if (await p.locator('nav[aria-label="Ana menü"]').isVisible()) fail('düzenlemede alt menü görünüyor')
  if (await p.locator('[data-edit-card="today.header"] [data-testid=card-remove]').count()) fail('sabit başlık kaldırılabiliyor')
  await p.screenshot({ path: `${OUT}/custom-02-duzenleme.png` })

  // 2) Su'yu kaldır → geri al → yeniden kaldır
  await p.locator('[data-edit-card="today.water"] [data-testid=card-remove]').click()
  if ((await editOrder()).includes('today.water')) fail('su kartı kaldırılmadı')
  await p.getByRole('button', { name: 'Geri al' }).click()
  if (!(await editOrder()).includes('today.water')) fail('geri al çalışmadı')
  await p.locator('[data-edit-card="today.water"] [data-testid=card-remove]').click()

  // 3) Basılı tutup sürükle: Fit kartını Koç kartının yerine
  const fit = await p.locator('[data-edit-card="today.fit"]').boundingBox()
  await p.locator('[data-edit-card="today.coach"]').scrollIntoViewIfNeeded()
  const fit2 = await p.locator('[data-edit-card="today.fit"]').boundingBox()
  const coach = await p.locator('[data-edit-card="today.coach"]').boundingBox()
  if (!fit || !fit2 || !coach) fail('kart kutuları yok')
  await p.mouse.move(fit2.x + fit2.width / 2, fit2.y + fit2.height / 2); await p.mouse.down(); await p.waitForTimeout(500)
  for (let i = 1; i <= 12; i++) { await p.mouse.move(fit2.x + fit2.width / 2, fit2.y + fit2.height / 2 + ((coach.y + coach.height / 2) - (fit2.y + fit2.height / 2)) * i / 12); await p.waitForTimeout(30) }
  await p.waitForTimeout(150); await p.mouse.up()
  const e1 = await editOrder()
  if (e1.indexOf('today.fit') < e1.indexOf('today.training')) fail('sürükleme sırayı değiştirmedi: ' + e1)

  // 4) ✎ Antrenman → yarım boyut, bir yukarı
  await p.locator('[data-edit-card="today.training"] button[aria-label$="düzenle"]').click()
  const sh = p.getByTestId('card-sheet'); await sh.waitFor()
  await sh.getByRole('radio', { name: 'Yarım' }).click(); await sh.getByTestId('card-up').click()
  await sh.getByRole('button', { name: 'Tamam' }).click()

  // 5) Çekmeceden "Seriler" ekle (su da çekmecede görünmeli)
  await p.getByTestId('open-drawer').click(); const dr = p.getByTestId('card-drawer'); await dr.waitFor()
  if (!(await dr.locator('[data-drawer-card="today.water"]').count())) fail('kaldırılan su çekmecede yok')
  await p.waitForTimeout(450); await p.screenshot({ path: `${OUT}/custom-03-cekmece.png` })
  await dr.getByRole('button', { name: 'Seriler ekle' }).click()
  if (!(await editOrder()).includes('today.streaks')) fail('seriler eklenmedi')

  // 6) Bitti → kalıcı
  const want = await editOrder()
  await p.getByTestId('edit-done').click(); await p.waitForURL(BASE + '/'); await p.getByTestId('card-board').waitFor()
  await p.reload(); await p.getByTestId('card-board').waitFor()
  const o1 = await order()
  const exp = want.filter((id) => !['today.goal-choice', 'today.week-brief', 'today.partner', 'today.post-protein'].includes(id))
  if (JSON.stringify(o1) !== JSON.stringify(exp)) fail('kaydedilen düzen farklı: ' + o1 + ' ≠ ' + exp)
  if (await p.locator('[data-card="today.training"]').evaluate((e) => e.classList.contains('col-span-2'))) fail('antrenman yarım boyutta değil')
  await p.getByTestId('streaks-card').waitFor().catch(() => fail('seriler kartı görünmüyor'))
  await p.screenshot({ path: `${OUT}/custom-04-yeni-duzen.png`, fullPage: true })

  // 7) Stüdyodan varsayılana dön
  await p.goto(BASE + '/profil/ozellestirme'); p.once('dialog', (d) => d.accept()); await p.getByTestId('studio-reset').click()
  await p.waitForTimeout(800); await p.goto(BASE + '/')
  if (JSON.stringify(await order()) !== JSON.stringify(o0)) fail('varsayılana dönmedi: ' + (await order()))

  console.log('ÖZELLEŞTİRME E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('ÖZELLEŞTİRME E2E FAIL', e.message); process.exit(1) })
