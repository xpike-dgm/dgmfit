// Özelleştirme Ö1b-2: hedefe göre varsayılan notu, alt bar (gizle + taşı), tek el modu, eğer–ise kuralı (göster/gizle,
// düzenlemede uygulanmaz, kapatınca geri döner), boş yere basılı tutunca "Ekranı düzenle". Canlıda da çalışır (kanca gerekmez).
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
  const u = 'test_c2' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1990-02-02', heightCm: 178, weightKg: 72, activity: 'moderate', goal: 'gain', targetWeightKg: 78, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  const order = () => p.$$eval('[data-card]', (els) => els.map((e) => e.getAttribute('data-card')))
  const tabs = () => p.$$eval('[data-testid=bottom-nav] > *', (els) => els.map((e) => e.getAttribute('data-tab') ?? '+'))

  // 1) Hedefe göre varsayılan: kilo alma → antrenman kartı başlığın hemen altında
  const o0 = await order()
  if (o0[1] !== 'today.training') fail('kilo alma hedefinde antrenman kartı öne alınmadı: ' + o0)
  if (JSON.stringify(await tabs()) !== JSON.stringify(['today', 'plan', 'water', '+', 'food', 'fitness', 'social'])) fail('varsayılan alt bar beklenmedik: ' + (await tabs()))
  await p.goto(BASE + '/profil/ozellestirme'); await p.getByTestId('goal-note').waitFor().catch(() => fail('stüdyoda hedef notu yok'))
  await p.screenshot({ path: `${OUT}/custom2-00-studyo.png`, fullPage: true })

  // 2) Alt bar: Sosyal'i gizle, Yemek'i iki yukarı taşı → kaydet → alt bar değişir
  await p.getByTestId('studio-nav').click(); await p.getByTestId('nav-editor').waitFor()
  await p.locator('[data-nav-row=social] [data-testid=nav-show]').click()
  await p.locator('[data-nav-row=food] [data-testid=nav-up]').click(); await p.locator('[data-nav-row=food] [data-testid=nav-up]').click()
  if (!(await p.locator('[data-nav-row=today] [data-testid=nav-show]').isDisabled())) fail('Bugün gizlenebiliyor')
  await p.screenshot({ path: `${OUT}/custom2-01-alt-bar.png` })
  await p.getByTestId('nav-save').click(); await p.getByRole('status').filter({ hasText: 'kaydedildi' }).waitFor()
  await p.goto(BASE + '/')
  const t1 = await tabs()
  if (JSON.stringify(t1) !== JSON.stringify(['today', 'food', '+', 'plan', 'water', 'fitness'])) fail('alt bar kaydedilmedi: ' + t1)

  // 3) Tek el (sol): + başa geçer, bant düğmeleri sola
  await p.goto(BASE + '/profil/ozellestirme'); await p.getByTestId('use-prefs').getByRole('radio', { name: 'Sol el' }).click()
  await p.waitForTimeout(900); await p.goto(BASE + '/')
  if ((await tabs())[0] !== '+') fail('sol el modunda + başta değil: ' + (await tabs()))
  const dir = await p.locator('[data-card="today.header"] .band-head').evaluate((e) => getComputedStyle(e).flexDirection)
  if (dir !== 'row-reverse') fail('sol elde bant başlığı ters değil: ' + dir)
  await p.screenshot({ path: `${OUT}/custom2-02-sol-el.png` })
  await p.goto(BASE + '/profil/ozellestirme'); await p.getByTestId('use-prefs').getByRole('radio', { name: 'Kapalı' }).click(); await p.waitForTimeout(900)

  // 4) Kural: her gün → Seriler göster + Su gizle
  await p.getByTestId('studio-rules').click(); await p.getByTestId('rules').waitFor()
  if (!(await p.getByTestId('rule-presets').getByText('Antrenman günü').count())) fail('hazır kurallar yok')
  await p.getByTestId('rule-new').click(); const bd = p.getByTestId('rule-builder'); await bd.waitFor()
  await bd.locator('#rule-name').fill('Her gün testi')
  for (const d of ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']) await bd.getByRole('group', { name: 'Günler' }).getByRole('button', { name: d, exact: true }).click()
  await bd.getByTestId('act-card').selectOption('today.streaks'); await bd.getByRole('radio', { name: 'Göster' }).click(); await bd.getByTestId('act-add').click()
  await bd.getByTestId('act-card').selectOption('today.water'); await bd.getByRole('radio', { name: 'Gizle' }).click(); await bd.getByTestId('act-add').click()
  await p.screenshot({ path: `${OUT}/custom2-03-kural.png` })
  await bd.getByTestId('rule-save').click(); await p.getByRole('status').filter({ hasText: 'Kural kaydedildi' }).waitFor()
  if (!(await p.locator('[data-rule]').filter({ hasText: 'ŞU AN' }).count())) fail('kural şu an etkin görünmüyor')
  await p.goto(BASE + '/')
  const o2 = await order()
  if (!o2.includes('today.streaks') || o2.includes('today.water')) fail('kural uygulanmadı: ' + o2)
  await p.getByTestId('rule-applied').filter({ hasText: 'Her gün testi' }).waitFor().catch(() => fail('kural notu görünmüyor'))
  await p.screenshot({ path: `${OUT}/custom2-04-kural-bugun.png`, fullPage: true })
  // düzenlemede kayıtlı düzen görünür (kural uygulanmaz)
  await p.goto(BASE + '/?duzenle=1'); await p.getByTestId('card-editor').waitFor()
  if (!(await p.locator('[data-edit-card="today.water"]').count())) fail('düzenlemede kural uygulanmış')
  await p.getByRole('button', { name: 'Vazgeç' }).click(); await p.waitForURL(BASE + '/')
  // kuralı kapat → su geri gelir
  await p.goto(BASE + '/profil/ozellestirme/kurallar'); await p.locator('[data-rule] [data-testid=rule-on]').first().click(); await p.getByRole('status').filter({ hasText: 'Kural kapatıldı' }).waitFor()
  await p.goto(BASE + '/')
  if (!(await order()).includes('today.water')) fail('kapalı kural hâlâ uygulanıyor')

  // 5) Boş yere basılı tut → "Ekranı düzenle" → düzenleme
  const h1 = await p.locator('[data-card="today.header"] h1').boundingBox()
  await p.mouse.move(h1.x + 20, h1.y + h1.height / 2); await p.mouse.down(); await p.waitForTimeout(800); await p.mouse.up()
  await p.getByTestId('hold-edit').click().catch(() => fail('basılı tutunca düzenle balonu çıkmadı'))
  await p.getByTestId('card-editor').waitFor()
  await p.getByRole('button', { name: 'Vazgeç' }).click(); await p.waitForURL(BASE + '/')
  // kapatılınca çıkmaz
  await p.goto(BASE + '/profil/ozellestirme'); await p.getByTestId('hold-edit-toggle').click(); await p.waitForTimeout(900); await p.goto(BASE + '/')
  const h2 = await p.locator('[data-card="today.header"] h1').boundingBox()
  await p.mouse.move(h2.x + 20, h2.y + h2.height / 2); await p.mouse.down(); await p.waitForTimeout(800); await p.mouse.up()
  if (await p.getByTestId('hold-edit').count()) fail('kapalıyken basılı tutunca balon çıktı')

  // 6) Alt bar varsayılana
  await p.goto(BASE + '/profil/ozellestirme/alt-bar'); await p.getByRole('button', { name: 'Varsayılana dön' }).click(); await p.getByRole('status').filter({ hasText: 'kaydedildi' }).waitFor()
  await p.goto(BASE + '/')
  if ((await tabs()).length !== 7) fail('alt bar varsayılana dönmedi: ' + (await tabs()))

  console.log('ÖZELLEŞTİRME-2 E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('ÖZELLEŞTİRME-2 E2E FAIL', e.message); process.exit(1) })
