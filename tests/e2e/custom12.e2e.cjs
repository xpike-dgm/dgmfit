// Özelleştirme Ö5b: odak modları (Hastalık: düzen + mod kartı + Fitness'ta sıradaki antrenman gizli; Tatil: geçmiş başlangıçla
// dengeleme durur — test kancası yalnız yerelde) ve Ramazan modu (Bugün'de oruç/iftar kartı, Yemek'te Sahur / İftar). Canlıda da çalışır.
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
  const u = 'test_c12' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1988-08-08', heightCm: 178, weightKg: 84, activity: 'moderate', goal: 'lose', targetWeightKg: 78, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  const msg = (t) => p.getByTestId('modes-msg').filter({ hasText: t }).waitFor({ timeout: 15000 }).catch(() => fail('mod mesajı yok: ' + t))
  const order = () => p.$$eval('[data-card]', (els) => els.map((e) => e.getAttribute('data-card')))
  const ist = (ms) => new Date(Date.now() + ms).toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul' }) // "YYYY-MM-DD HH:MM:SS"
  const today = ist(0).slice(0, 10)

  // 1) Stüdyo → Modlar → Hastalık
  await p.goto(BASE + '/profil/ozellestirme'); await p.getByTestId('studio-modes').click(); await p.getByTestId('modes').waitFor()
  await p.getByTestId('mode-sick').click(); await msg('Hastalık modu açıldı')
  await p.goto(BASE + '/'); await p.getByTestId('card-board').waitFor()
  if (!(await p.locator('[data-testid=mode-card] [data-mode=sick]').count())) fail('Bugün’de hastalık mod kartı yok')
  if (!/Hastalık modu/.test(await p.getByTestId('mode-applied').innerText())) fail('mod notu yok')
  const o = await order()
  if (o.includes('today.training')) fail('hastalıkta antrenman kartı görünüyor')
  if (o[1] !== 'today.water') fail('hastalıkta su öne alınmadı: ' + o)
  await p.screenshot({ path: `${OUT}/custom12-01-hastalik.png`, fullPage: true })
  await p.goto(BASE + '/fitness'); if (await p.locator('[data-card="fitness.next"]').count()) fail('hastalıkta sıradaki antrenman görünüyor')
  // düzenlemede kayıtlı düzen görünür (mod uygulanmaz)
  await p.goto(BASE + '/?duzenle=1'); await p.locator('[data-edit-card="today.training"]').waitFor({ timeout: 15000 }).catch(() => fail('düzenlemede kayıtlı düzen yok'))

  // 2) Tatil, 3 gün önce başladı → dün fazla yenen kalori dağıtılmaz (yalnız test kancası olan yerelde)
  await p.goto(BASE + '/profil/ozellestirme/modlar'); await p.getByTestId('mode-off').click(); await msg('kapatıldı')
  await p.getByTestId('mode-vacation').click(); await msg('Tatil modu açıldı')
  await p.getByTestId('mode-from').fill(ist(-3 * 86400000).slice(0, 10)); await msg('Başlangıç kaydedildi')
  const hook = await p.evaluate(async () => (await fetch('/api/test/fit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: 3, yesterdayExtra: 900 }) })).status)
  let partial = false
  if (hook === 404) partial = true
  else {
    if (hook !== 200) fail('fit kancası ' + hook)
    await p.goto(BASE + '/profil/gorunum'); await p.getByTestId('ui-advanced').check(); await p.waitForFunction(() => { const c = document.querySelector('[data-testid=ui-advanced]'); return c && c.checked && !c.disabled })
    await p.goto(BASE + '/fit'); const bal = await p.getByTestId('balance-card').innerText().catch(() => '')
    if (!/tatil \/ hastalık modundaydın/.test(bal)) fail('dengeleme duraklatılmadı: ' + bal.slice(0, 160))
  }
  await p.goto(BASE + '/'); if (!(await p.locator('[data-testid=mode-card] [data-mode=vacation]').count())) fail('tatil mod kartı yok')
  await p.goto(BASE + '/profil/ozellestirme/modlar'); await p.getByTestId('mode-off').click(); await msg('kapatıldı')

  // 3) Ramazan: saatleri şimdiye göre seç (06.00'dan sonra iftar 1 saat önce → iftar sonrası; öncesinde sahura kadar oruçsuz)
  const hhmm = ist(0).slice(11, 16), nowMin = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
  const after = nowMin >= 6 * 60 + 5
  const iftar = after ? ist(-3600000).slice(11, 16) : '23:59', sahur = after ? '04:45' : '06:30'
  await p.getByTestId('ramadan-toggle').click(); await msg('Ramazan modu açıldı')
  await p.getByTestId('ramadan-sahur').fill(sahur); await p.getByTestId('ramadan-iftar').fill(iftar)
  await p.getByTestId('ramadan-save').click(); await msg('Saatler kaydedildi')
  await p.goto(BASE + '/'); await p.getByTestId('ramadan-card').waitFor({ timeout: 15000 }).catch(() => fail('Ramazan kartı yok'))
  const st = await p.getByTestId('ramadan-status').innerText()
  if (!/sahura/.test(st)) fail('oruçsuz saatte durum yanlış: ' + st)
  if (after && !(await p.getByTestId('iftar-protein').count())) fail('iftar sonrası protein kartı yok')
  await p.screenshot({ path: `${OUT}/custom12-02-ramazan.png`, fullPage: true })
  await p.goto(BASE + '/yemek'); const y = await p.locator('body').innerText()
  if (!/Sahur/.test(y) || !/İftar/.test(y)) fail('Yemek’te Sahur / İftar yok')
  // oruç saati: sahur bir saat önce, iftar iki saat sonra (gece yarısını aşmayan saatlerde)
  if (nowMin >= 2 * 60 && nowMin < 21 * 60) {
    await p.goto(BASE + '/profil/ozellestirme/modlar')
    await p.getByTestId('ramadan-sahur').fill(ist(-3600000).slice(11, 16)); await p.getByTestId('ramadan-iftar').fill(ist(2 * 3600000).slice(11, 16))
    await p.getByTestId('ramadan-save').click(); await msg('Saatler kaydedildi')
    await p.goto(BASE + '/'); const f = await p.getByTestId('ramadan-status').innerText()
    if (!/Oruçlusun · iftara/.test(f)) fail('oruç durumu yanlış: ' + f)
  }
  await p.goto(BASE + '/profil/ozellestirme/modlar'); await p.getByTestId('ramadan-toggle').click(); await msg('Ramazan modu kapatıldı')
  await p.goto(BASE + '/'); if (await p.getByTestId('mode-card').count()) fail('mod kapalıyken kart görünüyor')
  const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > 412) fail('yatay taşma: ' + w)

  console.log(partial ? 'ÖZELLEŞTİRME-12 E2E (kısmi) OK — dengeleme kancası atlandı user=' : 'ÖZELLEŞTİRME-12 E2E OK user=', u, 'gün', today)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('ÖZELLEŞTİRME-12 E2E FAIL', e.message); process.exit(1) })
