// Fitness inceleme düzeltmeleri (2026-11-06): silinen antrenmanın rekoru kalmaz; yarım taslak sessizce silinmez;
// "bu hareketle başlat" açık taslağa hareketi ekler; program gününde sil + ekle sırası kararlı; hatalı sayı girişi.
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
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|play\(\)/.test(m.text())) errors.push('console: ' + m.text()) })
  p.on('dialog', (d) => d.accept())
  const u = 'test_fx2' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1990-03-03', heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'lose', targetWeightKg: 76, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  const idOf = async (q, name) => { await p.goto(BASE + '/fitness/hareketler?q=' + encodeURIComponent(q)); const l = p.getByRole('link', { name: new RegExp('^' + name) }).first(); return [(await l.getAttribute('href')).split('/').pop(), (await l.locator('span.font-semibold').first().innerText()).trim()] }
  const [bench, BENCH] = await idOf('barbell bench press', 'Barbell Bench Press'), [squat] = await idOf('barbell squat', 'Barbell Squat')
  const sec = (n) => p.locator('section[data-testid="live-exercise"]:not([hidden])', { hasText: n }).first()
  const oneSet = async (name, kg, reps) => {
    const s = sec(name); await s.waitFor()
    await s.getByLabel('Set 1 ağırlık (kg)', { exact: true }).fill(kg); await s.getByLabel('Set 1 tekrar', { exact: true }).fill(reps)
    await s.getByRole('button', { name: 'Set 1 tamamla' }).click()
  }
  const finish = async () => { await p.getByRole('button', { name: 'Bitir' }).click(); await p.getByRole('button', { name: 'Kaydet ve özete geç' }).click(); await p.waitForURL(/\/fitness\/antrenman\/[0-9a-f-]{36}\?yeni=1/) }

  // 1) Rekor: 100 → 500 (yanlış giriş, rekor) → sil → 105 yine rekor (önceki 100)
  await p.goto(BASE + '/fitness/antrenman?hareket=' + bench); await oneSet('Barbell Bench Press', '100', '5'); await finish()
  await p.goto(BASE + '/fitness/antrenman?hareket=' + bench); await oneSet('Barbell Bench Press', '500', '5'); await finish()
  await p.getByTestId('prs').waitFor().catch(() => fail('500 kg rekor sayılmadı'))
  await p.getByRole('button', { name: 'Antrenmanı sil' }).click(); await p.getByRole('button', { name: 'Evet, sil' }).click(); await p.waitForURL(BASE + '/fitness')
  await p.goto(BASE + '/fitness/antrenman?hareket=' + bench); await oneSet('Barbell Bench Press', '105', '5'); await finish()
  const prs = p.getByTestId('prs'); await prs.waitFor().catch(() => fail('silinen 500 kg yüzünden 105 kg rekor sayılmadı'))
  if (!/105 kg.*\(100\)/.test(await prs.innerText())) fail('rekor önceki değeri 100 değil: ' + (await prs.innerText()))
  // hareket sayfasındaki rekorlar kalan antrenmanlardan yeniden hesaplandı: en ağır 105, 500 yok
  await p.goto(BASE + '/fitness/hareketler/' + bench); { const t = await p.locator('body').innerText(); if (!/En ağır\s*105 kg/.test(t) || /500 kg/.test(t)) fail('hareket rekorları yeniden hesaplanmadı') }

  // 2) Hatalı sayı: "60.5.2" yazınca tek ayırıcı kalır
  await p.goto(BASE + '/fitness/antrenman?hareket=' + bench)
  const kgIn = sec('Barbell Bench Press').getByLabel('Set 1 ağırlık (kg)', { exact: true }); await kgIn.fill(''); await kgIn.pressSequentially('60.5.2')
  if ((await kgIn.inputValue()) !== '60.52') fail('ağırlık alanı temizlenmedi: ' + (await kgIn.inputValue()))
  await kgIn.fill('60'); await sec('Barbell Bench Press').getByLabel('Set 1 tekrar', { exact: true }).fill('8'); await sec('Barbell Bench Press').getByRole('button', { name: 'Set 1 tamamla' }).click()
  // 3) Açık serbest taslağa "bu hareketle başlat": squat eklenir ve seçilir, bench seti korunur
  await p.goto(BASE + '/fitness/antrenman?hareket=' + squat)
  await p.getByTestId('live-strip').getByRole('tab', { name: 'Barbell Squat', exact: true }).waitFor().catch(() => fail('açık taslağa squat eklenmedi'))
  if ((await p.getByTestId('live-strip').getByRole('tab', { name: 'Barbell Squat', exact: true }).getAttribute('aria-selected')) !== 'true') fail('eklenen hareket seçili değil')
  await p.getByTestId('live-strip').getByRole('tab', { name: BENCH, exact: true }).click()
  await sec('Barbell Bench Press').getByRole('button', { name: 'Set 1 geri al' }).waitFor().catch(() => fail('bench seti kayboldu'))

  // 4) Program günü: başka güne geçince yarım taslak için soru; devam et → taslak geri gelir
  await p.goto(BASE + '/fitness/programlar/bos'); await p.fill('#empty-name', 'Sıra testi'); await p.getByRole('button', { name: 'Oluştur', exact: true }).click(); await p.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/)
  const prog = p.url()
  const addEx = async (q, name) => { await p.getByRole('button', { name: 'Hareket ekle' }).first().click(); await p.fill('#ex-q', q); await p.getByRole('button', { name: new RegExp('^' + name) }).first().click(); await p.getByTestId('program-ex').filter({ hasText: name }).first().waitFor() }
  await addEx('barbell bench press', 'Barbell Bench Press'); await addEx('barbell squat', 'Barbell Squat')
  const dayHref = await p.getByRole('link', { name: 'Antrenmana Başla' }).first().getAttribute('href')
  await p.goto(BASE + dayHref)
  await p.getByTestId('draft-conflict').waitFor().catch(() => fail('yarım taslak sorulmadan silindi'))
  await p.screenshot({ path: `${OUT}/fixes-01-taslak-sorusu.png` })
  await p.getByRole('button', { name: 'Ona devam et' }).click(); await p.waitForURL(/\/fitness\/antrenman$/)
  await p.getByTestId('live-strip').getByRole('tab', { name: BENCH, exact: true }).click()
  await sec('Barbell Bench Press').getByRole('button', { name: 'Set 1 geri al' }).waitFor().catch(() => fail('devam edince taslak gelmedi'))
  await p.goto(BASE + dayHref); await p.getByTestId('draft-conflict').waitFor()
  await p.getByRole('button', { name: 'Sil ve yenisini başlat' }).click()
  await p.getByTestId('live-strip').waitFor(); if (await p.getByTestId('draft-conflict').count()) fail('yeni antrenman başlamadı')
  await p.getByRole('button', { name: 'Bitir' }).click(); await p.keyboard.press('Escape')

  // 5) Program sırası: ilk hareketi sil, yenisini ekle → sıra bench yok, squat, deadlift (yenilemede aynı)
  await p.goto(prog)
  await p.getByRole('button', { name: BENCH + ' düzenle' }).click(); await p.getByRole('button', { name: 'Programdan çıkar' }).click(); await p.getByTestId('program-ex').filter({ hasText: BENCH }).waitFor({ state: 'detached' })
  await addEx('barbell deadlift', 'Barbell Deadlift')
  for (let i = 0; i < 2; i++) {
    await p.reload()
    const names = (await p.getByTestId('program-ex').allInnerTexts()).map((t) => t.split('\n')[0].trim())
    if (names.length !== 2 || !names[0].startsWith('Barbell Squat') || !names[1].startsWith('Barbell Deadlift')) fail('program sırası kararsız: ' + names.join('|'))
  }
  console.log('FIXES E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('FIXES E2E FAIL', e.message); process.exit(1) })
