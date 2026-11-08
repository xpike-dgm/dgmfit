// Özelleştirme Ö3c: yarışma (yönetici tema açar → katıl → başka kullanıcı oy verir), tasarımcı profili + takip, grup teması,
// link + QR + girişsiz önizleme, yönetimden varsayılan düzen ve duyuru kartı. Yönetici adımları yalnız test kullanıcısı
// yöneticiyse (yerel: DGFIT_ADMINS='test_ai*') çalışır; canlıda atlanır ve küresel ayarlar değişmez. Küresel ayarlar her
// durumda sonunda geri alınır.
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }

async function signup(b, u, errors) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], hasTouch: false, isMobile: false, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
  p.on('pageerror', (e) => errors.push(u + ' pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(u + ' console: ' + m.text()) })
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'female', birthDate: '1990-10-10', heightCm: 170, weightKg: 68, activity: 'light', goal: 'lose', targetWeightKg: 63, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  return p
}

;(async () => {
  const b = await chromium.launch()
  const errors = []
  const sfx = Date.now().toString(36)
  const A = 'test_ai_c9' + sfx, B = 'test_c9b' + sfx, tname = 'Yarisma ' + sfx
  const pa = await signup(b, A, errors)
  const status = (p, t) => p.getByRole('status').filter({ hasText: t }).first().waitFor()
  const order = (p) => p.$$eval('[data-card]', (els) => els.map((e) => e.getAttribute('data-card')))
  let admin = false, setDefault = false, annTitle = null

  try {
    // 1) A: düzenle (su yok) → şablon paylaş
    await pa.goto(BASE + '/?duzenle=1'); await pa.getByTestId('card-editor').waitFor()
    await pa.locator('[data-edit-card="today.water"] [data-testid=card-remove]').click()
    await pa.getByTestId('edit-done').click(); await pa.waitForURL(BASE + '/')
    await pa.goto(BASE + '/profil/ozellestirme/tasarimlar')
    await pa.locator('[data-design="Benim düzenim"]').getByRole('button', { name: /seçenekleri/ }).click()
    await pa.getByTestId('design-publish').click(); const f = pa.getByTestId('publish-form'); await f.waitFor()
    await f.getByTestId('pub-name').fill(tname); await f.getByTestId('pub-feed').uncheck(); await f.getByTestId('pub-submit').click()
    await pa.waitForURL(/\/sablonlar\/[0-9a-f-]{36}$/); const tUrl = pa.url(), tId = tUrl.split('/').pop()
    // link + QR
    await pa.getByTestId('share-link').waitFor()
    if (!(await pa.getByTestId('share-url').innerText()).endsWith('/t/' + tId)) fail('girişsiz önizleme bağlantısı yanlış')
    if (!(await pa.locator('[data-testid=share-link] svg').count())) fail('QR yok')

    // 2) Yönetici adımları (yalnız yöneticiyse)
    const r = await pa.goto(BASE + '/yonetim/tasarim'); admin = r.status() === 200 && (await pa.getByTestId('admin-design').count()) > 0
    if (admin) {
      await pa.getByTestId('contest-theme').fill('Kırmızı test ' + sfx); await pa.getByTestId('contest-save').click(); await status(pa, 'kaydedildi')
      annTitle = 'Test duyuru ' + sfx
      await pa.getByTestId('ann-title').fill(annTitle); await pa.getByTestId('ann-body').fill('Yeni şablonlara göz at'); await pa.getByTestId('ann-save').click(); await status(pa, 'yayında')
      await pa.locator('[data-default-screen=today] [data-testid=default-set]').click(); await pa.getByTestId('confirm-ok').click(); await status(pa, 'varsayılanı güncellendi'); setDefault = true
      await pa.screenshot({ path: `${OUT}/custom9-01-yonetim.png`, fullPage: true })
      // A yarışmaya katılır
      await pa.goto(BASE + '/profil/ozellestirme/yarisma'); await pa.getByTestId('contest-current').waitFor()
      await pa.getByTestId('contest-join').click(); await status(pa, 'katıldın')
    }

    // 3) B: varsayılan düzen + duyuru (yöneticiyse), oy, tasarımcı + takip, girişsiz önizleme
    const pb = await signup(b, B, errors)
    if (admin) {
      if ((await order(pb)).includes('today.water')) fail('yönetim varsayılanı yeni kullanıcıya gelmedi')
      await pb.getByTestId('announcement').filter({ hasText: annTitle }).waitFor().catch(() => fail('duyuru görünmüyor'))
      await pb.screenshot({ path: `${OUT}/custom9-02-duyuru.png` })
      await pb.getByTestId('announcement-close').click(); await pb.waitForTimeout(800); await pb.reload(); await pb.getByTestId('card-board').waitFor()
      if (await pb.getByTestId('announcement').count()) fail('kapatılan duyuru geri geldi')
      await pb.goto(BASE + '/profil/ozellestirme/yarisma'); await pb.locator(`[data-entry="${tname}"]`).waitFor()
      await pb.locator(`[data-entry="${tname}"] [data-testid=contest-vote]`).click(); await pb.locator(`[data-entry="${tname}"]`).getByText('Oyun burada').waitFor()
      await pb.reload(); if ((await pb.locator(`[data-entry="${tname}"] [data-testid=entry-votes]`).innerText()).trim() !== '1') fail('oy sayılmadı')
      await pb.screenshot({ path: `${OUT}/custom9-03-yarisma.png`, fullPage: true })
    }
    await pb.goto(tUrl); await pb.getByTestId('tpl-designer').click(); await pb.getByTestId('designer').waitFor()
    if (!/1 şablon/.test(await pb.getByTestId('designer-stats').innerText())) fail('tasarımcı istatistiği yanlış')
    await pb.getByTestId('designer-follow').click(); await status(pb, 'Takip ediyorsun')
    // girişsiz önizleme
    const anon = await (await b.newContext()).newPage()
    await anon.goto(BASE + '/t/' + tId); await anon.getByTestId('public-template').waitFor().catch(() => fail('girişsiz önizleme açılmadı'))
    if (!(await anon.getByRole('heading', { name: tname }).count())) fail('girişsiz önizlemede ad yok')
    await anon.screenshot({ path: `${OUT}/custom9-04-girissiz.png`, fullPage: true })
    const nf = await anon.goto(BASE + '/t/00000000-0000-4000-8000-000000000000'); if (nf.status() !== 404) fail('olmayan şablon 404 değil: ' + nf.status())

    // 4) Grup teması: A grup kurar → şablonu grup teması yapar → grup sayfasında görünür
    await pa.goto(BASE + '/sosyal/gruplar'); await pa.fill('#g-name', 'Tema grubu ' + sfx); await pa.getByRole('button', { name: 'Grup oluştur' }).click()
    await pa.waitForURL(/\/sosyal\/gruplar\/[0-9a-f-]{36}$/); const gUrl = pa.url()
    await pa.goto(tUrl); await pa.getByTestId('group-theme').waitFor(); await pa.getByTestId('set-group-theme').click(); await status(pa, 'Grup teması ayarlandı')
    await pa.goto(gUrl); await pa.getByTestId('group-theme-card').filter({ hasText: tname }).waitFor().catch(() => fail('grup teması görünmüyor'))

    // A: takip bildirimi
    await pa.goto(BASE + '/sosyal/bildirimler'); if (!(await pa.locator('[data-testid=notification][data-kind=designer_follow]').count())) fail('tasarımcı takip bildirimi yok')
  } finally {
    // küresel ayarları geri al (diğer testler etkilenmesin)
    if (admin) {
      await pa.goto(BASE + '/yonetim/tasarim'); await pa.getByTestId('admin-design').waitFor()
      if (setDefault && await pa.locator('[data-default-screen=today] [data-testid=default-reset]').count()) { await pa.locator('[data-default-screen=today] [data-testid=default-reset]').click(); await status(pa, 'varsayılana döndü') }
      if (annTitle && await pa.locator(`[data-ann="${annTitle}"] [data-testid=ann-close]`).count()) { await pa.locator(`[data-ann="${annTitle}"] [data-testid=ann-close]`).click(); await status(pa, 'kapatıldı') }
    }
  }

  console.log(admin ? 'ÖZELLEŞTİRME-9 E2E OK users=' : 'ÖZELLEŞTİRME-9 E2E (kısmi) OK — yönetici adımları atlandı users=', A, B)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('ÖZELLEŞTİRME-9 E2E FAIL', e.message); process.exit(1) })
