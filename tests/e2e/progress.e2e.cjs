// Fitness gelişim (Faz 3b) uçtan uca testi: e1RM grafiği + plato + kuvvet seviyesi + alternatif, istatistik + ısı haritası,
// ölçüler, şifreli fotoğraf (sahip dışı 404), GZCLP kademe ilerlemesi, DUP periyodizasyonu, canlı modda alternatif, çevrimdışı açılış.
// Beklenen değerler lib/progress.ts ve lib/training.ts'ten hesaplanır.
const { chromium, devices } = require('playwright')
const path = require('path')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

async function register(b, prefix) {
  const ctx = await b.newContext({ ...devices['iPhone 14'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
  const u = prefix + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  return { ctx, p, u }
}

;(async () => {
  const P = await import(path.join(__dirname, '../../lib/progress.ts'))
  const T = await import(path.join(__dirname, '../../lib/training.ts'))
  const b = await chromium.launch()
  const { ctx, p, u } = await register(b, 'test_pg')
  const errors = []
  let offline = false
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('dialog', (d) => d.accept())
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()) && !(offline && /fetch|network|INTERNET/i.test(m.text()))) errors.push('console: ' + m.text()) })
  p.on('response', (r) => { if (r.status() >= 400 && !offline && !new URL(r.url()).pathname.startsWith('/media/')) errors.push(`yanıt ${r.status()}: ${r.url()}`) })
  const shot = (n) => p.screenshot({ path: `${OUT}/progress-${n}.png`, fullPage: true })
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1995-05-05', heightCm: 177, weightKg: 78.4, activity: 'moderate', goal: 'recomp', targetWeightKg: 78.4, tempo: 'balanced', customDays: 90, experience: 'mid', trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:30', sleepTime: '23:30' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const dayOf = (n) => new Date(Date.parse(today + 'T12:00:00Z') - n * 86400000).toISOString().slice(0, 10)
  // 1) Bench geçmişi (plato) → detay: grafik, plato, kuvvet seviyesi, alternatifler
  const sessions = [{ daysAgo: 35, kg: 95, reps: 6 }, { daysAgo: 28, kg: 97.5, reps: 6 }, { daysAgo: 21, kg: 97.5, reps: 6 }, { daysAgo: 14, kg: 95, reps: 7 }, { daysAgo: 7, kg: 97.5, reps: 5 }, { daysAgo: 0, kg: 97.5, reps: 6 }].map((s) => ({ ...s, sets: 3 }))
  const seed = await p.request.post(BASE + '/api/test/fitness', { data: { key: 'Barbell_Bench_Press_-_Medium_Grip', sessions } })
  const seeded = seed.status() === 200
  console.log(seeded ? 'tohumlu mod' : `canlı mod (kanca ${seed.status()}): geçmiş gerektiren 1–2. adımlar atlanır`)
  if (seeded) {
  const benchId = (await seed.json()).exerciseId
  const series = sessions.map((s) => ({ day: dayOf(s.daysAgo), e1rm: T.e1rm(s.kg, s.reps, 0) }))
  const pl = P.detectPlateau(series, today, { repMin: 8, repMax: 12 })
  if (!pl.plateau) fail('test verisi plato üretmiyor')
  const best = Math.max(...series.map((s) => s.e1rm))
  const lvl = P.strengthLevel('bench', best, 78.4, 'male')
  await p.goto(BASE + `/fitness/hareketler/${benchId}`)
  await p.getByTestId('e1rm-chart').waitFor().catch(() => fail('e1RM grafiği yok'))
  if ((await p.getByTestId('e1rm-chart').locator('circle').count()) !== 6) fail('grafikte 6 seans bekleniyordu')
  await p.getByTestId('plateau').getByText(`${pl.weeks} haftadır ilerleme yok`).waitFor().catch(() => fail('plato kartı ' + pl.weeks))
  await p.getByTestId('strength-level').getByText(lvl.level, { exact: false }).first().waitFor().catch(() => fail('kuvvet seviyesi ' + lvl.level))
  if (!(await p.getByTestId('alternatives').getByRole('link').count())) fail('alternatif yok')
  await shot('01-detay')

  // 2) İstatistik + ısı haritası
  await p.goto(BASE + '/fitness/istatistik')
  await p.getByTestId('volume-chart').waitFor()
  const cells = await p.getByTestId('calendar').locator('span.bg-acc').count()
  if (cells < 5) fail('takvimde en az 5 antrenman günü bekleniyordu: ' + cells)
  await p.getByTestId('body-map').waitFor()
  await p.getByTestId('weekly-sets').getByText('Göğüs').waitFor().catch(() => fail('kas başına sette göğüs yok'))
  await p.getByLabel('Toparlanma tablosu').getByText('Dinlendir').first().waitFor().catch(() => fail('bugün çalışan göğüs "Dinlendir" olmalı'))
  await shot('02-istatistik')
  }

  // 3) Ölçüler
  await p.goto(BASE + '/fitness/olcumler')
  await p.fill('#m-day', dayOf(14)); await p.fill('#m-waistCm', '90'); await p.fill('#m-armCm', '36,5'); await p.getByRole('button', { name: 'Kaydet' }).click()
  await p.getByRole('status').filter({ hasText: 'Ölçüler kaydedildi' }).waitFor()
  await p.fill('#m-day', today); await p.fill('#m-waistCm', '88'); await p.getByRole('button', { name: 'Kaydet' }).click()
  await p.getByTestId('measures').getByText(/Bel\s*−2/).waitFor({ timeout: 10000 }).catch(() => fail('bel farkı −2 görünmüyor'))

  // 4) Şifreli fotoğraf: yükle, göster, kıyasla; başka kullanıcı göremez
  const imgs = p.getByTestId('photos').locator('ul img')
  for (const [i, pose] of ['ön', 'yan'].entries()) {
    await p.selectOption('#ph-pose', pose)
    await p.getByTestId('photo-input').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG })
    // önceki "eklendi" mesajı ekranda kalabilir: galerideki sayının artmasını bekle
    await p.waitForFunction((n) => document.querySelectorAll('[data-testid="photos"] ul img').length === n, i + 1, { timeout: 30000 }).catch(() => fail(`${i + 1}. fotoğraf yüklenmedi`))
  }
  if ((await imgs.count()) !== 2) fail('2 fotoğraf bekleniyordu')
  await p.waitForFunction(() => [...document.querySelectorAll('[data-testid="photos"] ul img')].every((i) => i.complete && i.naturalWidth > 0)).catch(() => fail('fotoğraf çözülüp gösterilmedi'))
  const photoUrl = await imgs.first().getAttribute('src')
  await p.getByTestId('photos').locator('ul button[aria-pressed]').nth(0).click(); await p.getByTestId('photos').locator('ul button[aria-pressed]').nth(1).click()
  await p.getByTestId('compare').waitFor().catch(() => fail('yan yana kıyas yok'))
  const other = await register(b, 'test_pgo')
  const leak = await other.p.request.get(BASE + photoUrl)
  if (leak.status() !== 404) fail('başka kullanıcı fotoğrafı görebildi: ' + leak.status())
  await other.ctx.close()
  const anon = await (await b.newContext()).request.get(BASE + photoUrl)
  if (anon.status() !== 401) fail('oturumsuz fotoğraf isteği 401 değil: ' + anon.status())
  await shot('03-olcu')

  // 5) GZCLP: ilk seans ağırlığı belirler, başarı +5 (alt vücut), başarısızlık 6×2
  await p.goto(BASE + '/fitness/programlar/sablonlar')
  await p.getByTestId('template-item').filter({ hasText: /^GZCLP/ }).first().click(); await p.getByTestId('template-day').first().waitFor()
  await p.getByRole('button', { name: 'Bu şablonu kullan' }).click()
  await p.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/)
  const gzUrl = p.url()
  const d1 = p.getByTestId('program-day').first()
  await d1.getByTestId('gz-row').first().getByText('T1 · ilk seans').waitFor().catch(() => fail('GZCLP T1 ilk seans görünmüyor'))
  const runSquat = async (fill) => {
    await p.goto(gzUrl); await p.getByTestId('program-day').first().getByRole('link', { name: /Başla|Bu günü yap/ }).click(); await p.waitForURL('**/fitness/antrenman?gun=*')
    const sq = p.locator('section[data-testid="live-exercise"]', { hasText: 'Barbell Squat' }).first()
    await fill(sq)
    await p.getByRole('button', { name: 'Bitir' }).click(); await p.getByRole('button', { name: 'Kaydet ve özete geç' }).click()
    await p.waitForURL(/\/fitness\/antrenman\/[0-9a-f-]{36}\?yeni=1/)
  }
  const tick = async (sq, i) => { await sq.getByRole('button', { name: `Set ${i} tamamla` }).click(); const s = p.getByTestId('rest-timer').getByRole('button', { name: 'Atla' }); if (await s.isVisible().catch(() => false)) await s.click() }
  await runSquat(async (sq) => {
    await sq.getByTestId('target-chip').getByText(/GZCLP T1 · ilk seans/).waitFor()
    if ((await sq.getByTestId('set-row').count()) !== 5) fail('T1 ilk seans 5 set olmalı')
    await sq.getByLabel('Set 1 ağırlık (kg)', { exact: true }).fill('100'); await sq.getByLabel('Set 1 tekrar', { exact: true }).fill('3')
    for (const i of [1, 2, 3, 4, 5]) await tick(sq, i)
  })
  await p.goto(gzUrl)
  await p.getByTestId('program-day').first().getByText('T1 · 5×3+ · 105 kg').waitFor().catch(() => fail('GZCLP başarı sonrası 105 kg değil'))
  await runSquat(async (sq) => {
    await sq.getByTestId('target-chip').getByText('GZCLP T1 · 5×3+').waitFor()
    for (const i of [1, 2, 3, 4]) await tick(sq, i)
    await sq.getByLabel('Set 5 tekrar', { exact: true }).fill('2'); await tick(sq, 5)
  })
  await p.goto(gzUrl)
  await p.getByTestId('program-day').first().getByText('T1 · 6×2+ · 105 kg').waitFor().catch(() => fail('GZCLP başarısızlık sonrası 6×2 değil'))
  await shot('04-gzclp')

  // 6) DUP periyodizasyonu: squat'ın 3. seansı → hafif gün
  await p.goto(BASE + '/fitness/programlar/sablonlar/fullbody')
  await p.getByRole('button', { name: 'Bu şablonu kullan' }).click()
  await p.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/)
  await p.getByTestId('period-settings').getByRole('button', { name: /Dalgalı/ }).click()
  await p.getByTestId('period-settings').getByRole('button', { name: 'Kaydet' }).click()
  await p.waitForTimeout(800)
  const tgt = P.periodTarget({ scheme: 'dup', week: 0, session: 2, base: { sets: 3, repMin: 6, repMax: 10, rir: 2 }, deloadEvery: 0 })
  await p.getByTestId('program-day').first().getByRole('link', { name: /Başla|Bu günü yap/ }).click(); await p.waitForURL('**/fitness/antrenman?gun=*')
  const liveUrl = p.url()
  const sq = p.locator('section[data-testid="live-exercise"]', { hasText: 'Barbell Squat' }).first()
  await sq.getByTestId('target-chip').getByText(tgt.label).waitFor().catch(() => fail('DUP etiketi ' + tgt.label))
  await sq.getByText(`Hedef ${tgt.sets} × ${tgt.repMin}–${tgt.repMax} · ${tgt.rir} tekrar yedek`).waitFor().catch(() => fail('DUP hedefi'))

  // 7) Canlı modda alternatif: bench → listeden ilk alternatif
  await p.getByRole('button', { name: 'Barbell Bench Press - Medium Grip seçenekleri' }).click()
  await p.getByRole('button', { name: /İstasyon dolu/ }).click()
  const alt = p.getByTestId('alt-list').getByRole('button').first()
  await alt.waitFor().catch(() => fail('alternatif listesi boş'))
  const altName = (await alt.locator('span').first().innerText()).trim()
  await alt.click()
  await p.locator('section[data-testid="live-exercise"]', { hasText: altName }).first().waitFor().catch(() => fail('alternatif harekete geçilmedi: ' + altName))
  if (await p.locator('section[data-testid="live-exercise"]', { hasText: 'Barbell Bench Press - Medium Grip' }).count()) fail('bench kartı değiştirilmedi')

  // 8) Çevrimdışı: canlı antrenman sayfası önbellekten açılır, taslak sürer
  await p.reload(); await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller)
  await p.goto(liveUrl); await p.getByText('Kaldığın yerden devam ediyorsun').waitFor()
  offline = true; await ctx.setOffline(true)
  await p.reload()
  await p.locator('section[data-testid="live-exercise"]').first().waitFor({ timeout: 15000 }).catch(() => fail('çevrimdışı canlı antrenman açılmadı'))
  await p.locator('section[data-testid="live-exercise"]', { hasText: altName }).first().waitFor().catch(() => fail('çevrimdışı taslak (alternatif) korunmadı'))
  await ctx.setOffline(false); offline = false
  await shot('05-canli')

  // 9) Dinlenme push ucu: abonelik yoksa planlanmaz; oturumsuz 401
  const rp = await p.request.post(BASE + '/api/push/rest', { data: { seconds: 30, next: 'x' } })
  if ((await rp.json()).scheduled !== false) fail('abonelik yokken push planlandı')
  const ra = await (await b.newContext()).request.post(BASE + '/api/push/rest', { data: { seconds: 30 } })
  if (ra.status() !== 401) fail('oturumsuz dinlenme ucu 401 değil')

  if (errors.length) fail('Tarayıcı hataları:\n' + errors.join('\n'))
  await b.close()
  console.log('PROGRESS E2E OK', u)
})().catch((e) => { console.error('PROGRESS E2E FAIL:', e.message); process.exit(1) })
