// Özelleştirme Ö3b: şablon olarak paylaş (A, sosyal akışa da) → kütüphanede ara (B) → beğen, yalnız renkleri kullan (düzen
// aynı kalır), remix → A'ya bildirim → şikayet → A şablonu siler. Kişisel veri paylaşılmaz. Canlıda da çalışır (kanca gerekmez).
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
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1991-09-09', heightCm: 176, weightKg: 77, activity: 'moderate', goal: 'lose', targetWeightKg: 72, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  return p
}

;(async () => {
  const b = await chromium.launch()
  const errors = []
  const sfx = Date.now().toString(36)
  const A = 'test_c8a' + sfx, B = 'test_c8b' + sfx
  const tname = 'Kirmizi su ' + sfx
  const pa = await signup(b, A, errors)
  const status = (p, t) => p.getByRole('status').filter({ hasText: t }).waitFor()
  const order = (p) => p.$$eval('[data-card]', (els) => els.map((e) => e.getAttribute('data-card')))

  // 1) A: Su'yu kaldır, Su modülünü kırmızı yap, birimi lb yap (kişisel) → şablon olarak paylaş
  await pa.goto(BASE + '/?duzenle=1'); await pa.getByTestId('card-editor').waitFor()
  await pa.locator('[data-edit-card="today.water"] [data-testid=card-remove]').click()
  await pa.getByTestId('edit-done').click(); await pa.waitForURL(BASE + '/')
  await pa.goto(BASE + '/profil/ozellestirme/renkler'); await pa.getByTestId('module-color-water').fill('#c81e1e'); await pa.getByTestId('colors-save').click(); await status(pa, 'kaydedildi')
  await pa.goto(BASE + '/profil/ozellestirme/stil'); await pa.getByTestId('st-weight').getByRole('radio', { name: 'lb', exact: true }).click(); await status(pa, 'Kaydedildi')
  await pa.goto(BASE + '/profil/ozellestirme/tasarimlar')
  await pa.locator('[data-design="Benim düzenim"]').getByRole('button', { name: /seçenekleri/ }).click()
  await pa.getByTestId('design-publish').click(); const f = pa.getByTestId('publish-form'); await f.waitFor()
  await f.getByTestId('pub-name').fill(tname); await f.getByTestId('pub-desc').fill('Su kırmızı, sade bir düzen'); await f.getByTestId('pub-category').selectOption('renkli'); await f.getByTestId('pub-tags').fill('kırmızı test')
  await f.getByTestId('pub-submit').click(); await pa.waitForURL(/\/profil\/ozellestirme\/sablonlar\/[0-9a-f-]{36}$/); const tUrl = pa.url()
  await pa.getByTestId('template-detail').waitFor()
  if (await pa.getByTestId('template-status').count()) fail('şablon onaya düştü: ' + (await pa.getByTestId('template-status').innerText()))
  await pa.screenshot({ path: `${OUT}/custom8-01-sablon.png`, fullPage: true })
  // sosyal akışta tasarım gönderisi (kendi akışında görünür)
  await pa.goto(BASE + '/sosyal'); await pa.getByTestId('post-design').first().waitFor().catch(() => fail('akışta tasarım gönderisi yok'))

  // 2) B: kütüphanede ara → beğen → yalnız renkleri kullan (düzen aynı: su durur; kırmızı su gelir; lb gelmez)
  const pb = await signup(b, B, errors)
  await pb.goto(BASE + '/profil/ozellestirme'); await pb.getByTestId('studio-library').click(); await pb.getByTestId('library').waitFor()
  await pb.fill('#tq', sfx); await pb.getByRole('button', { name: 'Ara', exact: true }).click()
  await pb.locator(`[data-template="${tname}"]`).click(); await pb.getByTestId('template-detail').waitFor()
  await pb.screenshot({ path: `${OUT}/custom8-02-kutuphane-detay.png`, fullPage: true })
  await pb.getByTestId('tpl-like').click(); await status(pb, 'Beğendin')
  await pb.getByTestId('tpl-use').click(); await pb.getByTestId('use-sheet').waitFor(); await pb.locator('[data-use-mode=colors]').click()
  await pb.waitForURL(BASE + '/'); await pb.getByTestId('card-board').waitFor()
  if (!(await order(pb)).includes('today.water')) fail('yalnız renkler düzeni değiştirdi')
  if (!(await pb.getByTestId('module-colors').count())) fail('şablon renkleri uygulanmadı')
  if ((await pb.locator('[data-card="today.fit"]').innerText()).includes('lb')) fail('kişisel birim (lb) şablonla geldi')
  // remix → tasarımlarımda kopya
  await pb.goto(tUrl); await pb.getByTestId('tpl-remix').click(); await pb.waitForURL('**/tasarimlar')
  await pb.locator(`[data-design="${tname} (remix)"]`).waitFor().catch(() => fail('remix tasarımlara eklenmedi'))
  // şikayet
  await pb.goto(tUrl); pb.once('dialog', (d) => d.accept('test şikayeti')); await pb.getByTestId('tpl-report').click(); await status(pb, 'Şikayetin alındı')

  // 3) A: bildirimler (beğeni + kullanım), sayaçlar, sil
  await pa.goto(BASE + '/sosyal/bildirimler'); await pa.getByTestId('notifications').waitFor()
  for (const k of ['template_like', 'template_use']) if (!(await pa.locator(`[data-testid=notification][data-kind=${k}]`).count())) fail('bildirim yok: ' + k)
  await pa.goto(tUrl)
  if (!/♥ 1 · 0 kayıt · 1 kullanım/.test(await pa.getByTestId('template-detail').innerText())) fail('sayaçlar yanlış')
  pa.once('dialog', (d) => d.accept()); await pa.getByTestId('tpl-delete').click(); await pa.waitForURL('**/sablonlar')
  await pb.goto(BASE + '/profil/ozellestirme/sablonlar?q=' + sfx); await pb.getByTestId('library').waitFor()
  if (await pb.locator(`[data-template="${tname}"]`).count()) fail('silinen şablon kütüphanede')

  console.log('ÖZELLEŞTİRME-8 E2E OK users=', A, B)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('ÖZELLEŞTİRME-8 E2E FAIL', e.message); process.exit(1) })
