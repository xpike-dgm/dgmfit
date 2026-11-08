// G1 (kullanıcı geri bildirimi): içecek için ml birimli kendi besini + Besinlerim'den düzenleme; alt bar yalnız sekme ana
// sayfalarında; uygulama içi onay penceresi (tarayıcı penceresi çıkmaz); düzenleme modunda sürükle-bırak bir sıra kayar
// (en alta fırlamaz, kartlar kaybolmaz); sola kaydırınca küçük eylem düğmeleri. Canlıda da çalışır (kanca gerekmez).
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
  p.on('dialog', (d) => { errors.push('tarayıcı penceresi: ' + d.message()); d.dismiss() })
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  const u = 'test_g1' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1995-05-05', heightCm: 178, weightKg: 62, activity: 'light', goal: 'gain', targetWeightKg: 75, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  // 1) Alt bar: sekme ana sayfasında var, iç sayfada yok
  if (!(await p.getByTestId('bottom-nav').count())) fail('Bugün ekranında alt bar yok')
  await p.goto(BASE + '/profil'); await p.waitForTimeout(400)
  if (await p.getByTestId('bottom-nav').count()) fail('Profil (iç sayfa) alt barı gösteriyor')
  await p.goto(BASE + '/yemek'); if (!(await p.getByTestId('bottom-nav').count())) fail('Yemek ekranında alt bar yok')

  // 2) İçecek: ml birimli kendi besini, porsiyon 1 kutu (330 ml)
  await p.goto(BASE + '/yemek/besin/yeni?ogun=snack')
  await p.getByTestId('unit-ml').click()
  await p.fill('#cf-name', 'Test kola'); await p.fill('#cf-kcal', '42'); await p.fill('#cf-protein', '0'); await p.fill('#cf-carb', '10,6'); await p.fill('#cf-fat', '0')
  await p.fill('#cf-servingG', '330'); await p.fill('#cf-sl', '1 kutu')
  await p.getByRole('button', { name: 'Besini kaydet' }).click(); await p.waitForURL('**/yemek/ekle**')
  await p.getByRole('button', { name: 'Besinlerim' }).click()
  const row = p.locator('li[data-food-row]').filter({ hasText: 'Test kola' })
  await row.waitFor()
  if (!/kcal\/100 ml/.test(await row.innerText())) fail('Besinlerim satırında "kcal/100 ml" yok: ' + await row.innerText())
  await p.screenshot({ path: `${OUT}/g1-01-besinlerim.png` })

  // 3) Düzenle: kalori 45 → listede 45
  await row.getByTestId('food-edit').click(); await p.waitForURL('**/yemek/besin/**')
  if ((await p.inputValue('#cf-kcal')) !== '42') fail('düzenleme formu eski kaloriyi göstermiyor: ' + await p.inputValue('#cf-kcal'))
  if ((await p.getByTestId('unit-ml').getAttribute('aria-checked')) !== 'true') fail('düzenleme formunda ml seçili değil')
  if ((await p.inputValue('#cf-servingG')) !== '330') fail('porsiyon 330 ml değil')
  await p.fill('#cf-kcal', '45'); await p.getByRole('button', { name: 'Değişiklikleri kaydet' }).click(); await p.waitForURL('**/yemek/ekle**')
  const row2 = p.locator('li[data-food-row]').filter({ hasText: 'Test kola' })
  await row2.waitFor(); if (!/45/.test(await row2.innerText())) fail('düzenlenen kalori listede yok: ' + await row2.innerText())

  // 4) Besine dokun → miktar ml ile; 1 kutu ekle → günlükte "1 × 1 kutu"
  await row2.locator('button').first().click()
  const sheet = p.getByRole('dialog', { name: 'Test kola' }); await sheet.waitFor()
  if (!(await sheet.getByRole('button', { name: 'Mililitre' }).count())) fail('besin penceresinde "Mililitre" seçeneği yok')
  if (!(await sheet.getByText('100 ml:').count())) fail('besin penceresi 100 ml başına değerleri göstermiyor')

  // 4b) Veritabanındaki içecek (Ayran): listede kcal/100 ml, pencerede Mililitre + ml seçili; gram'a çevrilebilir
  await p.goto(BASE + '/yemek/ekle?ogun=snack')
  await p.fill('#food-q', 'ayran'); const ay = p.getByRole('button', { name: /^Ayran/ }).first(); await ay.waitFor()
  if (!/kcal\/100 ml/.test(await ay.innerText())) fail('Ayran listede ml ile görünmüyor: ' + await ay.innerText())
  await ay.click(); const ays = p.getByRole('dialog', { name: /^Ayran/ }); await ays.waitFor()
  if (!(await ays.getByRole('button', { name: 'Mililitre' }).count())) fail('Ayran penceresinde "Mililitre" yok')
  await ays.getByRole('button', { name: 'Mililitre' }).click()
  if ((await ays.getByTestId('fs-unit-ml').getAttribute('aria-checked')) !== 'true') fail('Ayran ml seçili açılmadı')
  await ays.getByTestId('fs-unit-g').click(); if ((await ays.getByTestId('fs-unit-g').getAttribute('aria-checked')) !== 'true') fail('gram seçilemedi')
  await p.screenshot({ path: `${OUT}/g1-01b-ayran.png` })

  // 5) Uygulama içi onay: Besinlerim'den sil → onay penceresi → Vazgeç → satır duruyor
  await p.goto(BASE + '/yemek/ekle?ogun=snack&sekme=mine')
  await p.locator('li[data-food-row]').filter({ hasText: 'Test kola' }).getByTestId('food-delete').click()
  const dlg = p.getByTestId('confirm'); await p.getByTestId('confirm-message').waitFor()
  if (!/silinsin mi/.test(await p.getByTestId('confirm-message').innerText())) fail('onay iletisi yanlış')
  if ((await p.getByTestId('confirm-ok').innerText()).trim() !== 'Sil') fail('onay düğmesi "Sil" değil')
  await p.screenshot({ path: `${OUT}/g1-02-onay.png` })
  await p.getByTestId('confirm-cancel').click(); await p.waitForTimeout(400)
  if (!(await p.locator('li[data-food-row]').filter({ hasText: 'Test kola' }).count())) fail('Vazgeç sonrası besin silinmiş')
  if (await dlg.evaluate((d) => d.open)) fail('onay penceresi kapanmadı')

  // 6) Düzenleme modu: bir kartı biraz aşağı sürükle → bir-iki sıra kayar, en alta fırlamaz; kartlar görünür kalır
  await p.goto(BASE + '/?duzenle=1'); await p.getByTestId('card-editor').waitFor(); await p.waitForTimeout(600)
  const order = () => p.$$eval('[data-edit-card]', (els) => els.map((e) => e.getAttribute('data-edit-card')))
  const before = await order()
  const i0 = before.findIndex((id, i) => i > 0 && i < before.length - 3)
  const src = p.locator(`[data-edit-card="${before[i0]}"]`); const next = p.locator(`[data-edit-card="${before[i0 + 1]}"]`)
  await src.evaluate((e) => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300)
  const sb = await src.boundingBox(), nb = await next.boundingBox()
  await p.mouse.move(sb.x + 30, sb.y + 16); await p.mouse.down(); await p.waitForTimeout(600)
  const target = sb.y + 16 + (nb.y + nb.height - (sb.y + sb.height)) + 8
  for (let k = 1; k <= 12; k++) { await p.mouse.move(sb.x + 30, sb.y + 16 + ((target - sb.y - 16) * k) / 12); await p.waitForTimeout(25) }
  await p.waitForTimeout(400)
  const hidden = await p.$$eval('[data-edit-card]', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 140 && r.top < innerHeight - 40 }).filter((e) => e.getAnimations().length === 0 && Math.abs(e.getBoundingClientRect().top - e.offsetTop - e.offsetParent.getBoundingClientRect().top) > 2).length)
  if (hidden) fail('sürüklerken yerinden kaymış (kaybolan) kart var: ' + hidden)
  await p.mouse.up(); await p.waitForTimeout(500)
  const after = await order(), i1 = after.indexOf(before[i0])
  if (i1 <= i0) fail(`kart aşağı taşınmadı (${i0} → ${i1})`)
  if (i1 === after.length - 1 && after.length - 1 - i0 > 2) fail(`kart en alta fırladı (${i0} → ${i1})`)
  await p.screenshot({ path: `${OUT}/g1-03-surukle.png` })

  // 7) Varsayılana döndür: tarayıcı penceresi değil, uygulama içi onay
  await p.getByTestId('edit-reset').scrollIntoViewIfNeeded(); await p.getByTestId('edit-reset').click()
  await p.getByTestId('confirm-message').filter({ hasText: 'varsayılan düzene' }).waitFor()
  if ((await p.getByTestId('confirm-ok').innerText()).trim() !== 'Döndür') fail('varsayılan onay düğmesi "Döndür" değil')
  await p.getByTestId('confirm-cancel').click()
  await p.getByRole('button', { name: 'Vazgeç' }).first().click()
  await p.getByTestId('confirm-message').filter({ hasText: 'kaydedilmeden' }).waitFor().catch(() => fail('değişiklik varken Vazgeç onay sormadı'))
  await p.getByTestId('confirm-ok').click(); await p.waitForURL(BASE + '/')

  // 8) Kaydırma eylemi: küçük yuvarlak düğmeler (kart boyu değil)
  const card = p.locator('[data-card]').nth(2); await card.scrollIntoViewIfNeeded()
  const cb = await card.boundingBox()
  await p.mouse.move(cb.x + cb.width - 20, cb.y + 30); await p.mouse.down(); await p.mouse.move(cb.x + cb.width - 220, cb.y + 34, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(400)
  const pin = p.getByTestId('swipe-pin').first(); await pin.waitFor()
  const pb = await pin.boundingBox()
  if (pb.height > 90 || pb.width > 90) fail(`kaydırma eylemi çok büyük: ${Math.round(pb.width)}×${Math.round(pb.height)}`)
  await p.screenshot({ path: `${OUT}/g1-04-kaydir.png` })

  if (errors.length) fail('hatalar: ' + errors.join(' | '))
  console.log('G1 E2E OK', u)
  await b.close()
})().catch((e) => { console.error('G1 E2E FAIL:', e.message); process.exit(1) })
