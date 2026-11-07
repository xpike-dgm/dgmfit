// Özelleştirme Ö3a: Tasarımlarım (varsayılandan yeni tasarım → kullan → düzen değişir, kişisel birimler taşınır, eskisine dön,
// sil) ve sürümler ("Başlangıç"a geri yükle). Canlıda da çalışır (kanca gerekmez).
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
  const u = 'test_c7' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'female', birthDate: '1994-08-08', heightCm: 164, weightKg: 62, activity: 'light', goal: 'lose', targetWeightKg: 58, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  const order = () => p.$$eval('[data-card]', (els) => els.map((e) => e.getAttribute('data-card')))
  const status = (t) => p.getByRole('status').filter({ hasText: t }).waitFor()

  // 1) Bugün'de Su'yu kaldır (tasarım + sürümler oluşur), birimi lb yap (kişisel)
  await p.goto(BASE + '/?duzenle=1'); await p.getByTestId('card-editor').waitFor()
  await p.locator('[data-edit-card="today.water"] [data-testid=card-remove]').click()
  await p.getByTestId('edit-done').click(); await p.waitForURL(BASE + '/'); await p.getByTestId('card-board').waitFor()
  await p.goto(BASE + '/profil/ozellestirme/stil/daha'); await p.getByTestId('st-weight').getByRole('radio', { name: 'lb', exact: true }).click(); await status('Kaydedildi')

  // 2) Tasarımlarım: varsayılandan yeni tasarım → kullan → su geri gelir, lb korunur
  await p.goto(BASE + '/profil/ozellestirme'); await p.getByTestId('studio-designs').click(); await p.getByTestId('designs').waitFor()
  if (!(await p.locator('[data-design="Benim düzenim"]').getByText('ETKİN').count())) fail('etkin tasarım görünmüyor')
  await p.getByTestId('design-new').click(); await status('oluşturuldu')
  await p.locator('[data-design="Yeni tasarım"] [data-testid=design-activate]').click(); await status('etkin')
  await p.screenshot({ path: `${OUT}/custom7-01-tasarimlar.png`, fullPage: true })
  await p.goto(BASE + '/')
  if (!(await order()).includes('today.water')) fail('yeni (varsayılan) tasarımda su yok')
  if (!(await p.locator('[data-card="today.fit"]').innerText()).includes('lb')) fail('kişisel birim yeni tasarıma taşınmadı')

  // 3) Eskisine dön → su yine yok
  await p.goto(BASE + '/profil/ozellestirme/tasarimlar')
  await p.locator('[data-design="Benim düzenim"] [data-testid=design-activate]').click(); await status('etkin')
  await p.goto(BASE + '/')
  if ((await order()).includes('today.water')) fail('eski tasarıma dönülmedi')

  // 4) Sürümler: Başlangıç'a geri yükle → su geri gelir
  await p.goto(BASE + '/profil/ozellestirme/tasarimlar'); await p.getByTestId('versions').waitFor()
  for (const n of ['Başlangıç', 'Bugün düzeni']) if (!(await p.locator(`[data-version="${n}"]`).count())) fail('sürüm yok: ' + n)
  p.once('dialog', (d) => d.accept()); await p.locator('[data-version="Başlangıç"] [data-testid=version-restore]').click(); await status('geri yüklendi')
  await p.screenshot({ path: `${OUT}/custom7-02-surumler.png`, fullPage: true })
  await p.goto(BASE + '/')
  if (!(await order()).includes('today.water')) fail('sürüm geri yüklenmedi')
  if (!(await p.locator('[data-card="today.fit"]').innerText()).includes('lb')) fail('geri yüklemede kişisel birim kayboldu')

  // 5) Yeni tasarımı sil
  await p.goto(BASE + '/profil/ozellestirme/tasarimlar')
  await p.locator('[data-design="Yeni tasarım"]').getByRole('button', { name: /seçenekleri/ }).click()
  p.once('dialog', (d) => d.accept()); await p.getByTestId('design-delete').click(); await status('Silindi')
  await p.locator('[data-design="Yeni tasarım"]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => fail('tasarım silinmedi'))

  console.log('ÖZELLEŞTİRME-7 E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('ÖZELLEŞTİRME-7 E2E FAIL', e.message); process.exit(1) })
