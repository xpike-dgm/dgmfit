// Sadeleştirme (2026-11-06): yeni hesap Sade modda başlar — ileri araçlar gizli, açıklamalar "i" içinde;
// Profil → Görünüm → Gelişmiş mod açılınca araçlar görünür, kapatınca yine gizlenir.
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
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  const u = 'test_sd' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1990-03-03', heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'lose', targetWeightKg: 76, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  const has = async (path, loc) => { await p.goto(BASE + path); await p.waitForLoadState('networkidle').catch(() => {}); return (await loc().count()) > 0 }
  const tools = () => p.getByRole('navigation', { name: 'Plan araçları' })
  const prLink = () => p.getByTestId('pr-link')
  const aiLinks = () => p.getByTestId('ai-plan-links')

  // 1) Sade (varsayılan)
  if (await has('/fit', tools)) fail('sade modda Fit araçları görünüyor')
  if (await p.getByText('Tahmin için en az 5 günlük tartı').count()) fail('sade modda tahmin cümlesi açık')
  await p.getByTestId('info-tip').first().click()
  await p.getByRole('note').filter({ hasText: /Trend|Tahmin/ }).waitFor().catch(() => fail('"i" açıklaması açılmadı'))
  await p.screenshot({ path: `${OUT}/sade-01-fit.png` })
  await p.keyboard.press('Escape'); if (await p.getByRole('note').count()) fail('"i" Escape ile kapanmadı')
  if (await has('/fitness', prLink)) fail('sade modda rekor denemesi görünüyor')
  if (!(await p.getByTestId('anatomy-link').count())) fail('kas haritası sade modda olmalı')
  if (await has('/yemek', aiLinks)) fail('sade modda AI planlama görünüyor')
  if (await p.getByTestId('supplements').count()) fail('boş takviye kartı sade modda görünüyor')

  // 2) Gelişmiş aç → araçlar görünür
  await p.goto(BASE + '/profil/gorunum'); await p.getByTestId('ui-advanced').check(); await p.waitForTimeout(300)
  await p.waitForFunction(() => { const c = document.querySelector('[data-testid=ui-advanced]'); return c && c.checked && !c.disabled })
  await p.reload(); if (!(await p.getByTestId('ui-advanced').isChecked())) fail('gelişmiş mod kaydedilmedi')
  if (!(await has('/fit', tools))) fail('gelişmiş modda Fit araçları yok')
  if (!(await has('/fitness', prLink))) fail('gelişmiş modda rekor denemesi yok')
  if (!(await has('/yemek', aiLinks))) fail('gelişmiş modda AI planlama yok')
  // 3) Kapat → yine sade
  await p.goto(BASE + '/profil/gorunum'); await p.getByTestId('ui-advanced').uncheck(); await p.waitForTimeout(300)
  await p.waitForFunction(() => { const c = document.querySelector('[data-testid=ui-advanced]'); return c && !c.checked && !c.disabled })
  if (await has('/fit', tools)) fail('gelişmiş kapatınca Fit araçları gizlenmedi')
  // 4) Sosyal: arkadaş yokken tek kart, bant kutuları menü, tek paylaşım balonu, profil → kaydedilenler
  await p.goto(BASE + '/sosyal'); await p.getByTestId('no-friends').waitFor().catch(() => fail('arkadaş yokken "Arkadaşlarını ekle" kartı yok'))
  if (await p.getByRole('navigation', { name: 'Sosyal bölümler' }).count()) fail('eski 4\'lü menü duruyor')
  await p.screenshot({ path: `${OUT}/sade-02-sosyal.png` })
  await p.getByTestId('meydan-link').click(); await p.waitForURL('**/sosyal/meydan')
  await p.goto(BASE + '/sosyal'); await p.getByTestId('groups-link').click(); await p.waitForURL('**/sosyal/gruplar')
  await p.goto(BASE + '/sosyal'); await p.getByTestId('share-bubble').click()
  await p.getByTestId('share-choice').getByRole('link', { name: /Gönderi/ }).click(); await p.waitForURL('**/sosyal/yeni')
  await p.goto(BASE + '/sosyal'); await p.getByTestId('my-profile').click(); await p.getByTestId('saved-posts').click(); await p.waitForURL('**/sosyal?g=kaydedilen')
  await p.getByText('Kaydettiğin gönderi yok.').waitFor()
  console.log('SADE E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('SADE E2E FAIL', e.message); process.exit(1) })
