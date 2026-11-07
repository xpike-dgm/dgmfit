// Özelleştirme Ö1b-3: düzen sihirbazı (5 soru → Bugün düzeni + alt bar + tek el), hızlı eylem (✎ → Su +500 ml, Antrenman →
// Kardiyo), kaydırma hareketleri (sola kaydır → bugünlük gizle + geri al, üste sabitle → başlığın altında, ✎'den kaldır).
// Canlıda da çalışır (kanca gerekmez).
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
  const u = 'test_c3' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'female', birthDate: '1995-05-05', heightCm: 165, weightKg: 70, activity: 'light', goal: 'lose', targetWeightKg: 64, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  const order = () => p.$$eval('[data-card]', (els) => els.map((e) => e.getAttribute('data-card')))
  const tabs = () => p.$$eval('[data-testid=bottom-nav] > *', (els) => els.map((e) => e.getAttribute('data-tab') ?? '+'))

  // 1) Sihirbaz: kuvvet → antrenman + su → sade → sol el → gün boyu
  await p.goto(BASE + '/profil/ozellestirme'); await p.getByTestId('studio-wizard').click(); await p.getByTestId('wizard').waitFor()
  await p.getByRole('radio', { name: 'Kuvvet ve kas' }).click()
  await p.locator('[data-wizard-step="1"]').waitFor()
  await p.getByRole('button', { name: 'Antrenman' }).click(); await p.getByRole('button', { name: 'Su', exact: true }).click(); await p.getByTestId('wizard-next').click()
  await p.getByRole('radio', { name: /Sade/ }).click()
  await p.getByRole('radio', { name: 'Sol' }).click()
  await p.getByRole('radio', { name: 'Gün boyu' }).click()
  await p.getByTestId('wizard-preview').waitFor()
  await p.screenshot({ path: `${OUT}/custom3-01-sihirbaz.png`, fullPage: true })
  await p.getByTestId('wizard-apply').click(); await p.waitForURL(BASE + '/'); await p.getByTestId('card-board').waitFor()
  const o1 = await order()
  if (o1[1] !== 'today.training') fail('sihirbaz: antrenman öne gelmedi: ' + o1)
  if (o1.includes('today.streaks')) fail('sihirbaz sade: seriler görünüyor')
  const t1 = await tabs()
  if (t1[0] !== '+' || t1[1] !== 'today' || t1[2] !== 'fitness' || t1[3] !== 'water') fail('sihirbaz: alt bar/tek el beklenmedik: ' + t1)

  // 2) Hızlı eylem: ✎ Su → +500 ml; ✎ Antrenman → Kardiyo ekle
  await p.goto(BASE + '/?duzenle=1'); await p.getByTestId('card-editor').waitFor()
  await p.locator('[data-edit-card="today.water"] button[aria-label$="düzenle"]').click()
  await p.getByTestId('card-studio').waitFor(); if (await p.getByTestId('card-layout-tab').count()) await p.getByTestId('card-layout-tab').click(); let sh = p.getByTestId('card-sheet'); await sh.waitFor()
  await sh.getByTestId('quick-pick').getByRole('radio', { name: /\+500 ml/ }).click(); await p.getByTestId('color-done').click()
  await p.locator('[data-edit-card="today.training"] button[aria-label$="düzenle"]').click()
  await p.getByTestId('card-studio').waitFor(); if (await p.getByTestId('card-layout-tab').count()) await p.getByTestId('card-layout-tab').click(); sh = p.getByTestId('card-sheet'); await sh.waitFor()
  await sh.getByTestId('quick-pick').getByRole('radio', { name: 'Kardiyo ekle' }).click()
  await p.screenshot({ path: `${OUT}/custom3-02-hizli-eylem.png` })
  await p.getByTestId('color-done').click()
  await p.getByTestId('edit-done').click(); await p.waitForURL(BASE + '/'); await p.getByTestId('card-board').waitFor()
  await p.reload(); await p.getByTestId('card-board').waitFor()
  if (!(await p.getByRole('button', { name: '500 ml su ekle' }).count())) fail('su kartı +500 ml değil')
  if ((await p.getByTestId('quick-training').innerText()).trim() !== 'Kardiyo ekle') fail('antrenman hızlı eylemi değişmedi')
  if (!(await p.getByTestId('today-training').getAttribute('href')).endsWith('/fitness/kardiyo')) fail('antrenman kartı kardiyoya gitmiyor')

  // 3) Kaydırma: makroları sola kaydır → Bugünlük gizle → kaybolur → Geri al → döner
  const swipe = async (id) => {
    const c = p.locator(`[data-card="${id}"]`); await c.scrollIntoViewIfNeeded(); const bx = await c.boundingBox()
    const y = bx.y + Math.min(30, bx.height / 2), x0 = bx.x + bx.width - 20
    await p.mouse.move(x0, y); await p.mouse.down()
    for (let i = 1; i <= 10; i++) { await p.mouse.move(x0 - i * 17, y); await p.waitForTimeout(16) }
    await p.mouse.up(); await p.waitForTimeout(250)
  }
  await swipe('today.macros')
  await p.getByTestId('swipe-hide').waitFor().catch(() => fail('kaydırınca eylemler açılmadı'))
  await p.screenshot({ path: `${OUT}/custom3-03-kaydir.png` })
  if (p.url() !== BASE + '/') fail('kaydırma bir bağlantıyı açtı: ' + p.url())
  await p.getByTestId('swipe-hide').click()
  await p.getByTestId('swipe-toast').filter({ hasText: 'bugünlük gizlendi' }).waitFor()
  await p.waitForTimeout(800); await p.reload(); await p.getByTestId('card-board').waitFor()
  if ((await order()).includes('today.macros')) fail('bugünlük gizlenen kart yenilemede görünüyor')
  // geri al: yeniden gizle ve hemen geri al
  await swipe('today.fit'); await p.getByTestId('swipe-hide').click(); await p.getByTestId('swipe-undo').click()
  await p.waitForTimeout(900); await p.reload(); await p.getByTestId('card-board').waitFor()
  if (!(await order()).includes('today.fit')) fail('geri al çalışmadı')

  // 4) Üste sabitle: Koç kartı → başlığın hemen altında; düzenlemede SABİT; ✎'den kaldır
  await swipe('today.coach'); await p.getByTestId('swipe-pin').click()
  await p.getByTestId('swipe-toast').filter({ hasText: 'üste sabitlendi' }).waitFor()
  await p.waitForTimeout(800); await p.reload(); await p.getByTestId('card-board').waitFor()
  const o4 = await order()
  if (o4[1] !== 'today.coach') fail('sabitlenen kart üstte değil: ' + o4)
  await p.goto(BASE + '/?duzenle=1'); await p.getByTestId('card-editor').waitFor()
  if (!(await p.locator('[data-edit-card="today.coach"]').getByText('SABİT').count())) fail('düzenlemede SABİT etiketi yok')
  await p.locator('[data-edit-card="today.coach"] button[aria-label$="düzenle"]').click()
  await p.getByTestId('card-studio').waitFor(); if (await p.getByTestId('card-layout-tab').count()) await p.getByTestId('card-layout-tab').click(); sh = p.getByTestId('card-sheet'); await sh.waitFor(); await sh.getByTestId('card-pin').click(); await p.waitForTimeout(700); await p.getByTestId('color-done').click()
  await p.getByRole('button', { name: 'Vazgeç' }).click(); await p.waitForURL(BASE + '/'); await p.reload(); await p.getByTestId('card-board').waitFor()
  if ((await order())[1] === 'today.coach') fail('sabitleme kaldırılamadı')

  console.log('ÖZELLEŞTİRME-3 E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('ÖZELLEŞTİRME-3 E2E FAIL', e.message); process.exit(1) })
