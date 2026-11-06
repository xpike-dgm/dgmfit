// Faz 8: hedef zekâsı — hedefe ulaşınca Bugün'de seçim kartı ("kilomu koruyup kas kazanayım" → yeni aşama),
// hedef tarih geçince "süreyi uzat", yağ oranı (Donanma formülü) ve detaylı besin hedefleri, kazanım kalitesi kartı.
// Geçmiş tartıları yazmak için yerel test kancası gerekir (canlıda kendini atlar).
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }

;(async () => {
  const b = await chromium.launch()
  const errors = []
  const user = async (prefix, ob) => {
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
    const u = prefix + Date.now().toString(36)
    await p.goto(BASE + '/kayit' + INVITE)
    await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
    await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
    await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
    await p.evaluate((o) => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify(o)), ob)
    await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
    return { p, u }
  }
  const hook = (p, body) => p.evaluate(async (b) => { const r = await fetch('/api/test/fit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, json: await r.json().catch(() => null) } }, body)

  // 1) Kas hedefli kullanıcı 70 → 72 kg; 30 günde 73,5'e çıkar (hedefi aşar)
  const A = await user('test_gl', { step: 10, sex: 'male', birthDate: '1998-02-02', heightCm: 178, weightKg: 70, activity: 'moderate', goal: 'gain', targetWeightKg: 72, tempo: 'balanced', customDays: 120, experience: 'new', trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })
  const h = await hook(A.p, { days: 30, kgPerDay: -0.12 })
  if (h.status === 404) { console.log('HEDEF E2E ATLANDI (canlı: test kancası yok)'); await b.close(); return }
  await A.p.goto(BASE + '/')
  const card = A.p.getByTestId('goal-choice'); await card.waitFor().catch(() => fail('hedefe ulaşınca seçim kartı çıkmadı'))
  if ((await card.getAttribute('data-kind')) !== 'reached') fail('kart türü reached değil')
  await A.p.screenshot({ path: `${OUT}/goal-01-ulasti.png` })
  await card.getByTestId('choice-recomp').click(); await card.waitFor({ state: 'detached', timeout: 15000 }).catch(() => fail('seçimden sonra kart kapanmadı'))
  await A.p.goto(BASE + '/profil/hedef'); await A.p.getByText(/kg koru/).first().waitFor().catch(() => fail('yeni aşama koruma hedefi değil'))
  // Fit: kazanım kalitesi kartı
  await A.p.goto(BASE + '/fit'); await A.p.getByTestId('quality-card').waitFor().catch(() => fail('kalite kartı yok'))
  // yağ oranı: ölçülerden hesapla → makrolar güncellenir
  await A.p.goto(BASE + '/profil/vucut'); await A.p.getByTestId('bodyfat-form').waitFor()
  await A.p.fill('#bf-neck', '37'); await A.p.fill('#bf-waist', '82')
  if (!/%\d/.test(await A.p.getByTestId('bf-preview').innerText())) fail('Donanma önizlemesi yok')
  await A.p.getByRole('button', { name: 'Kaydet' }).click(); await A.p.getByRole('status').filter({ hasText: /Kaydedildi: %/ }).waitFor().catch(() => fail('yağ oranı kaydedilmedi'))
  await A.p.reload(); const bf = Number(await A.p.getByTestId('bodyfat-now').getAttribute('data-bf'))
  if (!(bf > 8 && bf < 22)) fail('yağ oranı mantıksız: ' + bf)
  await A.p.screenshot({ path: `${OUT}/goal-02-yag-orani.png` })
  // Yemek: detaylı hedefler
  await A.p.goto(BASE + '/yemek'); const nd = A.p.getByTestId('nutrition-detail'); await nd.waitFor()
  await nd.locator('summary').click(); if ((await nd.getByTestId('nd-row').count()) < 10) fail('detaylı besin satırları eksik')
  await A.p.screenshot({ path: `${OUT}/goal-03-detayli-hedef.png`, fullPage: true })

  // 2) Kilo veren kullanıcı: hedef tarih geçti, hedefe ulaşılmadı → süreyi uzat
  const B = await user('test_gm', { step: 10, sex: 'female', birthDate: '1992-05-05', heightCm: 165, weightKg: 70, activity: 'light', goal: 'lose', targetWeightKg: 66, tempo: 'balanced', customDays: 56, experience: null, trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })
  await hook(B.p, { days: 70, kgPerDay: 0.02, shiftEnd: true })
  await B.p.goto(BASE + '/'); const c2 = B.p.getByTestId('goal-choice'); await c2.waitFor().catch(() => fail('hedef tarih geçince kart çıkmadı'))
  if ((await c2.getAttribute('data-kind')) !== 'ended') fail('kart türü ended değil')
  await B.p.screenshot({ path: `${OUT}/goal-04-tarih-gecti.png` })
  await c2.getByTestId('choice-extend').click(); await c2.waitFor({ state: 'detached', timeout: 15000 }).catch(() => fail('uzatınca kart kapanmadı'))

  console.log('HEDEF E2E OK users=', A.u, B.u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('HEDEF E2E FAIL', e.message); process.exit(1) })
