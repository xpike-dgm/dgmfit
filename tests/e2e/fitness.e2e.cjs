// Fitness uçtan uca testi: program üret → düzenle → iki antrenman (öneri + rekor) → Fit/Su entegrasyonu → kütüphane → çevrimdışı kuyruk.
// Beklenen öneri ve kalori değerleri lib/training.ts'ten hesaplanır (elle yazılmaz).
const { chromium, devices } = require('playwright')
const path = require('path')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
const trNum = (v) => v.toLocaleString('tr-TR')

;(async () => {
  const T = await import(path.join(__dirname, '../../lib/training.ts'))
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 14'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage()
  p.setDefaultNavigationTimeout(60000)
  const errors = []
  let offline = false
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('dialog', (d) => d.accept())
  // "Failed to load resource" konsolu URL vermez: yanıtları ayrıca izle; yerelde /media/ (Caddy'nin sunduğu görseller) yoktur, yalnız onlar yok sayılır
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()) && !(offline && /fetch|network|INTERNET/i.test(m.text()))) errors.push('console: ' + m.text()) })
  p.on('response', (r) => { if (r.status() >= 400 && !new URL(r.url()).pathname.startsWith('/media/') && !(offline)) errors.push(`yanıt ${r.status()}: ${r.url()}`) })
  const shot = (n) => p.screenshot({ path: `${OUT}/fitness-${n}.png`, fullPage: true })
  const live = (name) => p.locator('section[data-testid="live-exercise"]', { hasText: name }).first()
  // canlı modda tek hareket görünür: üst şeritten seç (5h-3)
  const focus = async (name) => { await p.getByTestId('live-strip').getByRole('tab', { name, exact: true }).click(); await live(name).waitFor() }
  const volume = async () => num((await p.getByTestId('live-stats').locator('span.num').nth(1).innerText()))
  const expectVolume = async (v, step) => { for (let i = 0; i < 20; i++) { if ((await volume()) === v) return; await p.waitForTimeout(150) } fail(`${step}: hacim ${await volume()} beklenen ${v}`) }
  const done = async (ex, i) => { await ex.getByRole('button', { name: `Set ${i} tamamla` }).click(); const skip = p.getByTestId('rest-timer').getByRole('button', { name: 'Atla' }); if (await skip.isVisible().catch(() => false)) await skip.click() }

  const u = 'test_fx' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1995-05-05', heightCm: 177, weightKg: 78.4, activity: 'moderate', goal: 'lose', targetWeightKg: 72, tempo: 'balanced', customDays: 90, experience: null, trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:30', sleepTime: '23:30' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  // Sadeleştirme (2026-11-06): bu test Gelişmiş mod araçlarını kullanır
  await p.goto(BASE + '/profil/gorunum'); await p.getByTestId('ui-advanced').check(); await p.waitForTimeout(300)
  await p.waitForFunction(() => { const c = document.querySelector('[data-testid=ui-advanced]'); return c && c.checked && !c.disabled })
  const waterTarget = async () => { await p.goto(BASE + '/'); return num((await p.locator('section[aria-label="Su"]').getByText(/\/ .* ml/).innerText()).split('ml')[0]) }
  const water0 = await waterTarget()

  // 1) Otomatik program: 3 gün, yeni başlayan → Full Body A/B/A
  await p.goto(BASE + '/fitness'); await p.getByRole('link', { name: 'Program oluştur' }).click(); await p.waitForURL('**/fitness/programlar')
  await p.getByRole('link', { name: /Benim için oluştur/ }).click(); await p.waitForURL('**/fitness/programlar/olustur')
  // ortam seçilmeden ekipman ve oluştur pasif; ortama göre ekipman listesi gelir
  if (!(await p.getByRole('button', { name: 'Programı oluştur' }).isDisabled())) fail('ortam seçilmeden program oluşturulabiliyor')
  await p.selectOption('#gen-env', 'home'); await p.getByTestId('gen-equipment').locator('summary').click()
  if (await p.getByTestId('gen-equipment').getByText('Makine', { exact: true }).count()) fail('evde ortamında makine listelenmemeli')
  await p.selectOption('#gen-env', 'gym')
  await p.locator('fieldset', { hasText: 'Haftada kaç gün?' }).getByRole('button', { name: '3', exact: true }).click()
  await p.getByRole('button', { name: 'Programı oluştur' }).click(); await p.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/)
  if ((await p.getByTestId('program-day').count()) !== 3) fail('3 program günü bekleniyordu')
  const day1 = p.getByTestId('program-day').first()
  await day1.getByText('Barbell Squat').waitFor().catch(() => fail('ilk hareket barbell squat değil'))

  // 2) Düzenle: squat 3 → 4 set
  await day1.getByRole('button', { name: 'Barbell Squat düzenle' }).click()
  await p.getByRole('button', { name: 'Set artır' }).click()
  if ((await p.getByTestId('edit-sets').innerText()) !== '4') fail('set sayısı 4 olmadı')
  await p.getByRole('button', { name: 'Kaydet' }).click()
  await day1.getByTestId('program-ex').filter({ hasText: 'Barbell Squat' }).getByText('4 set').waitFor().catch(() => fail('düzenleme görünmüyor'))
  await day1.getByTestId('program-ex').filter({ hasText: 'Barbell Squat' }).getByText('6–10 tekrar').waitFor()
  await shot('01-program')

  // 3) İlk antrenman (geçmiş yok → öneri yok)
  await day1.getByRole('link', { name: /Başla|Bu günü yap/ }).click(); await p.waitForURL('**/fitness/antrenman?gun=*')
  const sq = live('Barbell Squat'); const bp = live('Barbell Bench Press - Medium Grip')
  await focus('Barbell Squat')
  await sq.getByText('İlk kez yapıyorsun').waitFor()
  if (await sq.getByTestId('suggestion').count()) fail('ilk seansta öneri olmamalı')
  // geçmiş yokken boş ağırlıkla set tamamlanmaz (0 kg kaydı olmasın)
  await sq.getByRole('button', { name: 'Set 1 tamamla' }).click()
  await p.getByRole('status').filter({ hasText: 'önce ağırlığı gir' }).waitFor().catch(() => fail('boş ağırlık uyarısı yok'))
  if (await sq.getByRole('button', { name: 'Set 1 geri al' }).count()) fail('boş ağırlıkla set tamamlandı')
  await sq.getByLabel('Set 1 ağırlık (kg)', { exact: true }).fill('60'); await sq.getByLabel('Set 1 tekrar', { exact: true }).fill('10')
  await sq.getByRole('button', { name: 'Set 1 tamamla' }).click()
  await p.getByTestId('rest-timer').waitFor().catch(() => fail('dinlenme sayacı başlamadı'))
  await p.getByTestId('rest-timer').getByRole('button', { name: 'Atla' }).click()
  for (const i of [2, 3, 4]) await done(sq, i) // gri değerler 60 × 10'u izler
  await expectVolume(2400, 'squat 4 × 60 × 10')
  await focus('Barbell Bench Press - Medium Grip')
  await bp.getByLabel('Set 1 ağırlık (kg)', { exact: true }).fill('40'); await bp.getByLabel('Set 1 tekrar', { exact: true }).fill('8')
  for (const i of [1, 2, 3]) await done(bp, i)
  await expectVolume(2400 + 960, 'bench 3 × 40 × 8')
  // plaka hesaplayıcı
  await focus('Barbell Squat')
  await p.getByRole('button', { name: 'Barbell Squat seçenekleri' }).click(); await p.getByRole('button', { name: 'Plaka hesapla' }).click()
  await p.fill('#pc-kg', '100'); await p.waitForFunction(() => document.querySelector('[data-testid=plate-calc] [data-testid=bar-load]')?.getAttribute('data-plates') === '25,15', null, { timeout: 5000 }).catch(() => fail('plaka 100 kg: 25 + 15 değil'))
  await p.keyboard.press('Escape')
  // sayfa yenilense de taslak sürer
  await p.reload(); await p.getByText('Kaldığın yerden devam ediyorsun').waitFor(); await expectVolume(3360, 'yeniden yükleme sonrası')
  await shot('02-canli')
  await p.getByRole('button', { name: 'Bitir' }).click(); await p.getByRole('button', { name: 'Kaydet ve özete geç' }).click()
  await p.waitForURL(/\/fitness\/antrenman\/[0-9a-f-]{36}\?yeni=1/)
  await p.getByRole('heading', { name: 'Antrenman tamamlandı' }).waitFor()
  if (num(await p.getByTestId('summary').getByText(/ kg$/).first().innerText()) !== 3360) fail('özet hacmi 3360 değil')
  if (await p.getByTestId('prs').count()) fail('ilk antrenmanda rekor olmamalı')
  // Faz 5h-5: MSS yükü kartı (kütüphane hareketlerinde puan yoksa tahmin)
  await p.getByTestId('cns-card').getByTestId('cns-meter').waitFor().catch(() => fail('özette MSS kartı yok'))

  // 4) İkinci antrenman: aynı gün → öneriler
  await p.goto(BASE + '/fitness/programlar'); await p.getByTestId('program-item').first().getByRole('link').first().click()
  await p.getByTestId('program-day').first().getByRole('link', { name: /Bu günü yap|Başla/ }).click(); await p.waitForURL('**/fitness/antrenman?gun=*')
  const set = (kg, reps, rir = 2) => ({ kg, reps, rir, type: 'normal' })
  const sqSug = T.suggestNext({ history: [{ day: 'd', sets: [set(60, 10), set(60, 10), set(60, 10), set(60, 10)] }], target: { repMin: 6, repMax: 10, rir: 2 }, kind: 'weight_reps', increment: 2.5, deficitKcal: 0 })
  const bpSug = T.suggestNext({ history: [{ day: 'd', sets: [set(40, 8), set(40, 8), set(40, 8)] }], target: { repMin: 6, repMax: 10, rir: 2 }, kind: 'weight_reps', increment: 2.5, deficitKcal: 0 })
  const sq2 = live('Barbell Squat'); const bp2 = live('Barbell Bench Press - Medium Grip')
  await focus('Barbell Squat')
  await sq2.getByTestId('last-time').getByText(/4 × 60 kg × 10 @ RIR 2/).waitFor().catch(() => fail('geçen sefer satırı yok'))
  const sqText = await sq2.getByTestId('suggestion').innerText()
  // plan açığı > 500 kcal ise motor artışı durdurur: beklenen değeri sayfadaki gerekçeye göre değil, açık değerine göre seç
  const cautious = /Kalori açığın büyük/.test(sqText)
  const sqKg = cautious ? 60 : sqSug.kg, sqReps = cautious ? 10 : sqSug.reps
  if (!sqText.includes(`${trNum(sqKg)} kg × ${sqReps}`)) fail(`squat önerisi beklenen ${sqKg} × ${sqReps}: ${sqText}`)
  await focus('Barbell Bench Press - Medium Grip')
  if (!(await bp2.getByTestId('suggestion').innerText()).includes(`${trNum(bpSug.kg)} kg × ${bpSug.reps}`)) fail('bench önerisi ' + bpSug.kg + '×' + bpSug.reps)
  await focus('Barbell Squat')
  await sq2.getByRole('button', { name: 'Öneriyi uygula' }).click()
  for (const i of [1, 2, 3, 4]) await done(sq2, i)
  await focus('Barbell Bench Press - Medium Grip')
  await bp2.getByLabel('Set 1 ağırlık (kg)', { exact: true }).fill('42,5'); await bp2.getByLabel('Set 1 tekrar', { exact: true }).fill('8')
  for (const i of [1, 2, 3]) await done(bp2, i)
  await expectVolume(sqKg * sqReps * 4 + 42.5 * 8 * 3, 'ikinci antrenman')
  await p.getByRole('button', { name: 'Bitir' }).click(); await p.getByRole('button', { name: 'Kaydet ve özete geç' }).click()
  await p.waitForURL(/\/fitness\/antrenman\/[0-9a-f-]{36}\?yeni=1/)
  const prs = await p.getByTestId('prs').innerText().catch(() => '')
  for (const t of ['Barbell Bench Press - Medium Grip · En ağır', 'Barbell Bench Press - Medium Grip · Seans hacmi']) if (!prs.includes(t)) fail('rekor yok: ' + t + ' → ' + prs)
  await p.getByText(/Önceki Tüm vücut A ile/).waitFor().catch(() => fail('önceki aynı günle kıyas yok'))
  await shot('03-ozet')

  // 5) Kardiyo + Fit/Su entegrasyonu
  await p.goto(BASE + '/fitness/kardiyo')
  await p.fill('#c-min', '30'); await p.fill('#c-km', '5'); await p.getByRole('button', { name: 'Kaydet' }).click()
  const ck = T.cardioKcal({ type: 'run', minutes: 30, weightKg: 78.4, distanceKm: 5 })
  await p.getByRole('status').filter({ hasText: `net ${ck.net} kcal` }).waitFor({ timeout: 15000 }).catch(() => fail('kardiyo kalorisi ' + ck.net))
  await p.goto(BASE + '/')
  const ex = num(await p.locator('section[aria-label="Kalori"]').getByText(/^\+/).first().innerText())
  if (!(ex >= ck.net + 2)) fail(`Bugün egzersiz kredisi ${ex}, kardiyo ${ck.net} + iki antrenman bekleniyordu`)
  await p.getByTestId('today-training').getByText(/dk tamamlandı/).waitFor().catch(() => fail('Bugün antrenman kartı güncellenmedi'))
  const water1 = await waterTarget()
  const inc = water1 - water0
  if (!(inc >= 250 && inc <= 400 && inc % 50 === 0)) fail(`su hedefi artışı ${inc} (30 dk kardiyo + iki kısa antrenman → 250–400 ml)`)
  await p.goto(BASE + '/yemek'); await p.getByText(/Bugün antrenman yaptın/).waitFor().catch(() => fail('antrenman sonrası protein önerisi yok'))

  // 6) Kütüphane, detay, özel hareket
  await p.goto(BASE + '/fitness/hareketler?q=benc'); await p.getByRole('link', { name: /Barbell Bench Press - Medium Grip/ }).first().click()
  await p.getByText('Sık yapılan hatalar').waitFor(); await p.getByText('42,5 kg').first().waitFor().catch(() => fail('rekor detayda yok'))
  await p.goto(BASE + '/fitness/hareketler?kas=chest&ekipman=dumbbell')
  if (!(num(await p.getByTestId('lib-count').innerText()) > 5)) fail('göğüs + dumbbell filtresi az sonuç')
  await p.getByRole('button', { name: 'Kendi hareketini ekle' }).click(); await p.fill('#cx-name', 'Test göğüs makinem'); await p.getByRole('button', { name: 'Kaydet' }).click()
  await p.waitForURL(/\/fitness\/hareketler\/\d+$/); await p.getByRole('heading', { name: 'Test göğüs makinem' }).waitFor()
  const customId = p.url().split('/').pop()

  // 7) Çevrimdışı bitir → kuyruk → bağlantı gelince gönderim
  await p.goto(BASE + `/fitness/antrenman?hareket=${customId}`)
  const cx = live('Test göğüs makinem')
  await cx.getByLabel('Set 1 ağırlık (kg)', { exact: true }).fill('30'); await cx.getByLabel('Set 1 tekrar', { exact: true }).fill('12'); await done(cx, 1)
  await p.getByRole('button', { name: 'Bitir' }).click()
  offline = true; await ctx.setOffline(true)
  await p.getByRole('button', { name: 'Kaydet ve özete geç' }).click()
  await p.getByText(/Bağlantı yok: antrenman telefona kaydedildi/).waitFor({ timeout: 15000 }).catch(() => fail('çevrimdışı kuyruk mesajı yok'))
  const queued = await p.evaluate(() => JSON.parse(localStorage.getItem('dgfit:pending-workouts:v1') || '[]').length)
  if (queued !== 1) fail('kuyrukta 1 antrenman bekleniyordu: ' + queued)
  await ctx.setOffline(false); await p.waitForTimeout(500); offline = false
  await p.goto(BASE + '/fitness')
  await p.locator('section[aria-label="Son antrenmanlar"]').getByRole('link', { name: /Serbest antrenman/ }).waitFor({ timeout: 15000 }).catch(() => fail('kuyruktaki antrenman gönderilmedi'))
  for (let i = 0; i < 20 && (await p.evaluate(() => localStorage.getItem('dgfit:pending-workouts:v1'))); i++) await p.waitForTimeout(250)
  if (await p.evaluate(() => localStorage.getItem('dgfit:pending-workouts:v1'))) fail('kuyruk boşalmadı')
  await shot('04-fitness')

  if (errors.length) fail('Tarayıcı hataları:\n' + errors.join('\n'))
  await b.close()
  console.log('FITNESS E2E OK', u)
})().catch((e) => { console.error('FITNESS E2E FAIL:', e.message); process.exit(1) })
