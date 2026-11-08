// Y1: kişisel gün döngüsü. Profil → Günün bitişi (seçim kaydedilir). Kancalı (yerel) modda gün sınırı şu anki saatin
// ötesine alınır → API rotası, Bugün sayfası ve su ekleme (sunucu aksiyonu) "dün"ü kullanır; sınır 0'a dönünce kayıt
// dünün sayfasında görünür. Canlıda (kanca 404) yalnızca ayar adımı çalışır.
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
const trDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d)
const trMin = (d) => { const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).split(':').map(Number); return (h % 24) * 60 + m }
const longTr = (day) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(day + 'T12:00:00Z'))

;(async () => {
  const b = await chromium.launch()
  const errors = []
  const ctx = await b.newContext({ ...devices['Pixel 7'], hasTouch: false, isMobile: false, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  const u = 'test_dy' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'female', birthDate: '1995-05-05', heightCm: 165, weightKg: 70, activity: 'light', goal: 'lose', targetWeightKg: 64, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  // 1) Ayar: Profil → Günün bitişi (varsayılan 04.00) → 02.00 seç
  await p.goto(BASE + '/profil')
  const link = p.getByTestId('day-start-link'); await link.waitFor()
  if (!/04\.00/.test(await link.innerText())) fail('varsayılan gün sınırı 04.00 görünmüyor: ' + await link.innerText())
  await link.click(); await p.getByTestId('day-start').waitFor()
  if ((await p.locator('[data-day-start="240"]').getAttribute('aria-checked')) !== 'true') fail('04.00 seçili değil')
  await p.locator('[data-day-start="120"]').click(); await p.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor()
  await p.screenshot({ path: `${OUT}/day-01-ayar.png` })
  await p.goto(BASE + '/profil'); if (!/02\.00/.test(await p.getByTestId('day-start-link').innerText())) fail('02.00 kaydedilmedi')

  // 2) Kancalı mod: sınırı şu anki saatin 30 dk ötesine al → her yerde "dün"
  const probe = await p.request.get(BASE + '/api/test/day')
  if (probe.status() === 404) { console.log('canlı mod (kanca 404): gün kayması adımları atlanır') }
  else {
    const now = new Date(), m = trMin(now)
    if (m > 1400) console.log('gece yarısına çok yakın: kayma adımı atlandı')
    else {
      const today = trDay(now), yest = trDay(new Date(Date.now() - 86400000))
      await p.request.post(BASE + '/api/test/day', { data: { min: m + 30 } })
      const j = await (await p.request.get(BASE + '/api/test/day')).json()
      if (j.day !== yest || j.calendar !== today) fail(`API rotası mantıksal günü vermedi: ${JSON.stringify(j)} (beklenen ${yest})`)
      await p.goto(BASE + '/'); await p.getByTestId('today-state').waitFor()
      const head = await p.getByTestId('today-state').innerText()
      if (!head.toLocaleLowerCase('tr').includes(longTr(yest).toLocaleLowerCase('tr'))) fail('Bugün başlığı dünü göstermiyor: ' + head.slice(0, 120))
      await p.getByTestId('late-day').waitFor().catch(() => fail('gece notu yok'))
      await p.screenshot({ path: `${OUT}/day-02-gece.png` })
      // su (zaman damgalı): sınır açıkken su ekranı dünü gösterir ve eklenen su orada toplanır
      await p.goto(BASE + '/su'); await p.getByRole('button', { name: /^250 ml ekle/ }).click(); await p.waitForTimeout(1500)
      await p.reload(); const ml = Number((await p.locator('[aria-live=polite]').first().innerText()).replace(/\D/g, ''))
      if (ml !== 250) fail('gece eklenen su mantıksal günde görünmüyor: ' + ml)
      // öğün (gün sütunlu, sunucu aksiyonu): hızlı kalori → sınır 0'a dönünce dünün günlüğünde kalır
      await p.goto(BASE + '/yemek'); await p.getByRole('button', { name: /Hızlı kalori/ }).first().click()
      await p.fill('#q-kcal', '321'); await p.getByRole('button', { name: /· ekle$/ }).click(); await p.waitForTimeout(1500)
      await p.request.post(BASE + '/api/test/day', { data: { min: 0 } })
      await p.goto(BASE + '/yemek?gun=' + yest); await p.waitForTimeout(500)
      if (!(await p.getByText('Elle girilen kalori').count())) fail('gece eklenen öğün dünün günlüğünde yok')
      await p.goto(BASE + '/yemek'); await p.waitForTimeout(500)
      if (await p.getByText('Elle girilen kalori').count()) fail('gece eklenen öğün bugüne yazılmış')
      await p.goto(BASE + '/'); if (await p.getByTestId('late-day').count()) fail('sınır 0 iken gece notu görünüyor')
    }
  }
  if (errors.length) fail('hatalar: ' + errors.join(' | '))
  console.log('GÜN DÖNGÜSÜ E2E OK user=', u)
  await b.close()
})().catch((e) => { console.error('GÜN DÖNGÜSÜ E2E FAIL:', e.message); process.exit(1) })
