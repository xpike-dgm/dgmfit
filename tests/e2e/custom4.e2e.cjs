// Özelleştirme Ö1b-4: Kendi panom (/panom: modüller arası kartlar, alt bara sekme olarak eklenir, en çok 6 sekme) ve kart yığını
// (✎ → alttaki kartla yığ → noktalarla gezilir → ayır). Canlıda da çalışır (kanca gerekmez).
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
  const u = 'test_c4' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1988-03-03', heightCm: 180, weightKg: 85, activity: 'moderate', goal: 'lose', targetWeightKg: 78, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  const order = () => p.$$eval('[data-card]', (els) => els.map((e) => e.getAttribute('data-card')))
  const editOrder = () => p.$$eval('[data-edit-card]', (els) => els.map((e) => e.getAttribute('data-edit-card')))
  const tabs = () => p.$$eval('[data-testid=bottom-nav] > *', (els) => els.map((e) => e.getAttribute('data-tab') ?? '+'))

  // 1) Panom: varsayılan kartlar; alt barda yok
  if ((await tabs()).includes('mine')) fail('panom varsayılan olarak alt barda')
  await p.goto(BASE + '/panom'); await p.getByTestId('panom').waitFor()
  const o1 = await order()
  for (const id of ['mine.header', 'mine.water', 'mine.weight', 'mine.macros']) if (!o1.includes(id)) fail('panomda yok: ' + id + ' ' + o1)
  await p.screenshot({ path: `${OUT}/custom4-01-panom.png`, fullPage: true })

  // 2) Alt bar: 6 sekme doluyken Panom açılamaz; Sosyal gizlenince açılır → sekme panoya gider
  await p.goto(BASE + '/profil/ozellestirme/alt-bar'); await p.getByTestId('nav-editor').waitFor()
  await p.locator('[data-nav-row=mine] [data-testid=nav-show]').click()
  await p.getByRole('status').filter({ hasText: 'en çok 6' }).waitFor().catch(() => fail('6 sekme sınırı uyarısı yok'))
  await p.locator('[data-nav-row=social] [data-testid=nav-show]').click(); await p.locator('[data-nav-row=mine] [data-testid=nav-show]').click()
  await p.getByTestId('nav-save').click(); await p.getByRole('status').filter({ hasText: 'kaydedildi' }).waitFor()
  await p.goto(BASE + '/')
  const t2 = await tabs()
  if (!t2.includes('mine') || t2.includes('social')) fail('panom sekmesi eklenmedi: ' + t2)
  await p.locator('[data-testid=bottom-nav] [data-tab=mine]').click(); await p.waitForURL(BASE + '/panom')
  if ((await p.locator('[data-testid=bottom-nav] [data-tab=mine]').getAttribute('aria-current')) !== 'page') fail('panom sekmesi seçili görünmüyor')

  // 3) Panoya çekmeceden "Bugünkü öğünler" ekle
  await p.goto(BASE + '/panom?duzenle=1'); await p.getByTestId('card-editor').waitFor()
  await p.getByTestId('open-drawer').click(); const dr = p.getByTestId('card-drawer'); await dr.waitFor(); await p.waitForTimeout(400)
  await dr.getByRole('button', { name: 'Bugünkü öğünler ekle' }).click()
  await p.getByTestId('edit-done').click(); await p.waitForURL(BASE + '/panom'); await p.getByTestId('card-board').waitFor()
  if (!(await order()).includes('mine.meals')) fail('panoya kart eklenmedi')

  // 4) Yığın: Bugün'de Fit + Su → yığ → noktalarla gez → ayır
  await p.goto(BASE + '/?duzenle=1'); await p.getByTestId('card-editor').waitFor()
  const e0 = await editOrder()
  if (e0[e0.indexOf('today.fit') + 1] !== 'today.water') fail('fit ve su yan yana değil: ' + e0)
  await p.locator('[data-edit-card="today.fit"] button[aria-label$="düzenle"]').click()
  let sh = p.getByTestId('card-sheet'); await sh.waitFor(); await sh.getByTestId('card-stack').click(); await sh.getByRole('button', { name: 'Tamam' }).click()
  if ((await editOrder()).includes('today.water')) fail('su yığına girmedi')
  await p.locator('[data-edit-card="today.fit"]').getByTestId('stack-badge').waitFor()
  await p.getByTestId('edit-done').click(); await p.waitForURL(BASE + '/'); await p.getByTestId('card-board').waitFor()
  await p.reload(); await p.getByTestId('card-board').waitFor()
  const st = p.locator('[data-card="today.fit"][data-stack="2"]'); await st.waitFor().catch(() => fail('yığın görünmüyor'))
  if (!(await st.locator('[data-stack-card="today.water"]').count())) fail('yığında su kartı yok')
  await st.getByTestId('stack-dot').nth(1).click(); await p.waitForTimeout(700)
  if ((await st.getByTestId('stack-dot').nth(1).getAttribute('aria-selected')) !== 'true') fail('yığında ikinci karta geçilmedi')
  await p.screenshot({ path: `${OUT}/custom4-02-yigin.png` })
  await p.goto(BASE + '/?duzenle=1'); await p.getByTestId('card-editor').waitFor()
  await p.locator('[data-edit-card="today.fit"] button[aria-label$="düzenle"]').click()
  sh = p.getByTestId('card-sheet'); await sh.waitFor(); await sh.getByTestId('card-unstack').click(); await sh.getByRole('button', { name: 'Tamam' }).click()
  await p.getByTestId('edit-done').click(); await p.waitForURL(BASE + '/'); await p.getByTestId('card-board').waitFor()
  await p.reload(); await p.getByTestId('card-board').waitFor()
  if (!(await order()).includes('today.water') || (await p.locator('[data-stack]').count())) fail('yığın ayrılmadı')

  console.log('ÖZELLEŞTİRME-4 E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('ÖZELLEŞTİRME-4 E2E FAIL', e.message); process.exit(1) })
