// Özelleştirme Ö4: kart kullanım ölçümü (görülme kendiliğinden kaydolur), kullanım haritası, koç önerisi (üste al → uygula,
// kaldır → şimdi değil), düzen deneyi raporu. Canlıda da çalışır (kanca gerekmez; kullanım uç noktası oturumla).
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
  const u = 'test_c10' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1993-03-03', heightCm: 181, weightKg: 79, activity: 'moderate', goal: 'lose', targetWeightKg: 74, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  const order = () => p.$$eval('[data-card]', (els) => els.map((e) => e.getAttribute('data-card')))
  const status = (t) => p.getByRole('status').filter({ hasText: t }).first().waitFor()

  // 1) Görülme kendiliğinden kaydolur (4 sn'de bir gönderim)
  await p.getByTestId('card-board').waitFor(); await p.waitForTimeout(5000)
  await p.goto(BASE + '/profil/ozellestirme/kullanim'); await p.getByTestId('usage').waitFor()
  if (!(await p.locator('[data-usage-screen=today]').count())) fail('Bugün kartlarının görülmesi kaydolmadı')

  // 2) Kullanım verisi: Antrenman sık dokunuluyor (aşağıda), Koç hiç dokunulmuyor
  const sent = await p.evaluate(async () => {
    let ok = 0
    for (let i = 0; i < 4; i++) {
      const events = [...Array(5).fill({ card: 'today.training', kind: 'view' }), { card: 'today.training', kind: 'tap' }, { card: 'today.training', kind: 'tap' }, ...Array(5).fill({ card: 'today.coach', kind: 'view' })]
      const r = await fetch('/api/cards/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events }) }); if (r.status === 204) ok++
    }
    const bad = await fetch('/api/cards/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [{ card: 'x', kind: 'zap' }] }) })
    return { ok, bad: bad.status }
  })
  if (sent.ok !== 4 || sent.bad !== 400) fail('kullanım uç noktası beklenmedik: ' + JSON.stringify(sent))
  const anon = await (await b.newContext()).request.post(BASE + '/api/cards/usage', { data: { events: [{ card: 'today.coach', kind: 'view' }] } })
  if (anon.status() !== 401) fail('oturumsuz kullanım kaydı kabul edildi: ' + anon.status())
  await p.reload(); await p.getByTestId('usage').waitFor()
  if (Number(await p.locator('[data-usage-card="today.training"] [data-testid=usage-taps]').innerText()) < 8) fail('dokunmalar haritada yok')
  await p.screenshot({ path: `${OUT}/custom10-01-kullanim.png`, fullPage: true })

  // 3) Koç önerisi: Antrenmanı üste al → uygula; Koçu kaldır → şimdi değil
  await p.goto(BASE + '/profil/ozellestirme'); await p.getByTestId('suggestions').waitFor().catch(() => fail('koç önerisi yok'))
  await p.screenshot({ path: `${OUT}/custom10-02-oneri.png` })
  await p.locator('[data-suggestion="up:today.training"] [data-testid=suggestion-apply]').click(); await status('uygulandı')
  await p.goto(BASE + '/'); const o = await order()
  if (o[1] !== 'today.training') fail('öneri uygulanmadı: ' + o)
  await p.goto(BASE + '/profil/ozellestirme')
  await p.locator('[data-suggestion="remove:today.coach"] [data-testid=suggestion-dismiss]').click(); await status('göstermeyeceğiz')
  await p.reload(); await p.getByTestId('studio').waitFor()
  if (await p.locator('[data-suggestion="remove:today.coach"]').count()) fail('reddedilen öneri geri geldi')
  if (!(await order().then(() => true))) fail('')

  // 4) Düzen deneyi raporu: son değişiklik görünür (henüz erken)
  await p.goto(BASE + '/profil/ozellestirme/kullanim')
  if (!/Son değişiklik: .*Bugün düzeni/.test(await p.getByTestId('experiment').innerText())) fail('deney raporunda son değişiklik yok')

  console.log('ÖZELLEŞTİRME-10 E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('ÖZELLEŞTİRME-10 E2E FAIL', e.message); process.exit(1) })
