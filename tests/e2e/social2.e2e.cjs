// Sosyal genişleme uçtan uca testi (Faz 5b) — üç arkadaş (A yönetici). Yalnızca yerel (test kancaları); canlıda atlanır.
// Meydan okuma (hacim, kayıtlardan), düello, grup (davet, sohbet + uygunsuz mesaj, DOTS ve tutarlılık sıralaması, katılım izni),
// birebir mesaj + gönderi paylaşımı, dürtme sınırı, antrenman partneri (bildirim + ortak program), 24 saatlik kart, şüpheli PR (sıralama dışı → 2 tanık → doğrulandı).
const { chromium, devices } = require('playwright')
const path = require('path')
const BASE = process.env.BASE || 'http://localhost:3100'
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))

;(async () => {
  const hookCheck = await fetch(BASE + '/api/test/social', { method: 'POST' }).catch(() => null)
  if (!hookCheck || hookCheck.status === 404) { console.log('SOSYAL-2 E2E ATLANDI (canlı: test kancası yok)'); return }
  const R = await import(path.join(__dirname, '../../lib/social-rank.ts'))
  const b = await chromium.launch()
  const errors = []
  const mk = async () => {
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('dialog', (d) => d.accept())
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
    return p
  }
  const signup = async (p, u) => {
    await p.goto(BASE + '/kayit')
    await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
    await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
    await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
    await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1991-01-01', heightCm: 178, weightKg: 82, activity: 'moderate', goal: 'lose', targetWeightKg: 76, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
    await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  }
  const post = (p, url, body) => p.evaluate(async ([u, x]) => (await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(x) })).json(), [url, body])
  const status = (p, url) => p.evaluate(async (u) => (await fetch(u)).status, url)
  const ts = Date.now().toString(36)
  const [A, B, C] = ['test_aisx' + ts, 'test_sxb' + ts, 'test_sxc' + ts]
  const pa = await mk(), pb = await mk(), pc = await mk()
  const shot = (p, n) => p.screenshot({ path: `${OUT}/social2-${n}.png`, fullPage: true })
  await signup(pa, A); await signup(pb, B); await signup(pc, C)
  const befriend = async (p, q, other) => {
    await p.goto(`${BASE}/sosyal/ara?q=${other}`); await p.getByTestId('search-row').filter({ hasText: other }).getByRole('button', { name: 'Arkadaş ekle' }).click(); await p.getByText('İstek gönderildi').waitFor()
    await q.goto(BASE + '/sosyal/arkadaslar'); await q.getByTestId('incoming').getByRole('button', { name: 'Kabul et' }).first().click(); await q.waitForTimeout(700)
  }
  await befriend(pb, pa, A); await befriend(pc, pa, A); await befriend(pb, pc, C)

  // Veri: A bugün 120×5×3 (1800 kg hacim); B'nin squat geçmişi 60 kg (10 gün önce) → bugün 100 kg = şüpheli rekor
  await post(pa, '/api/test/fitness', { key: 'Barbell_Squat', sessions: [{ daysAgo: 0, kg: 120, reps: 5, sets: 3 }] })
  await post(pa, '/api/test/social', { records: [{ key: 'Barbell_Squat', kg: 140 }, { key: 'Barbell_Bench_Press_-_Medium_Grip', kg: 100 }, { key: 'Barbell_Deadlift', kg: 180 }], program: true })
  await post(pb, '/api/test/social', { records: [{ key: 'Barbell_Squat', kg: 60 }] })
  await post(pb, '/api/test/fitness', { key: 'Barbell_Squat', sessions: [{ daysAgo: 10, kg: 60, reps: 5, sets: 3 }] })

  // 1) Antrenman partneri: karşılıklı → B'nin antrenmanı bitince A'ya bildirim
  await pa.goto(`${BASE}/u/${B}`); await pa.getByTestId('friend-tools').getByRole('button', { name: 'Partner yap' }).click()
  await pa.getByTestId('partner-status').getByText(/isteğin gönderildi/).waitFor()
  await pb.goto(`${BASE}/u/${A}`); await pb.getByTestId('friend-tools').getByRole('button', { name: 'Partner ol' }).click()
  await pb.getByTestId('partner-status').getByText('Antrenman partnerisiniz').waitFor().catch(() => fail('karşılıklı partner olmadı'))
  const fw = await post(pb, '/api/test/social', { finishWorkout: { key: 'Barbell_Squat', kg: 100, reps: 5, sets: 3 } })
  if (!fw.workout?.prs?.some((x) => x.suspect)) fail('100 kg (7 günde 60\'tan) şüpheli işaretlenmedi: ' + JSON.stringify(fw.workout?.prs))
  await pa.goto(BASE + '/sosyal/bildirimler'); await pa.locator('[data-testid=notification][data-kind=partner_workout]').waitFor().catch(() => fail('partner bildirimi yok'))
  await pb.goto(`${BASE}/u/${A}`); await pb.getByRole('button', { name: 'Ortak program: kopyala' }).click()
  await pb.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/); await pb.getByText(/Full Body.*\(/).first().waitFor().catch(() => fail('partner programı kopyalanmadı'))

  // 2) Meydan okuma: "Haftalık en çok hacim" (A davet eder; B katılır, C reddeder) — ilerleme kayıtlardan
  await pa.goto(BASE + '/sosyal/meydan')
  const nc = pa.getByTestId('new-challenge')
  await nc.getByRole('button', { name: 'Haftalık en çok hacim' }).click()
  await nc.getByRole('group', { name: 'Davet edilecekler' }).getByRole('button', { name: B }).click(); await nc.getByRole('group', { name: 'Davet edilecekler' }).getByRole('button', { name: C }).click()
  await nc.getByRole('button', { name: 'Başlat' }).click(); await pa.waitForURL(/\/sosyal\/meydan\/[0-9a-f-]{36}$/)
  const chUrl = pa.url()
  await pb.goto(BASE + '/sosyal/bildirimler'); await pb.locator('[data-testid=notification][data-kind=challenge_invite]').first().click(); await pb.waitForURL('**/sosyal/meydan**')
  await pb.goto(chUrl); await pb.getByRole('button', { name: 'Katıl' }).click(); await pb.waitForTimeout(800)
  await pc.goto(chUrl); await pc.getByRole('button', { name: 'Reddet' }).click(); await pc.waitForURL('**/sosyal/meydan')
  if ((await status(pc, chUrl.replace(BASE, ''))) !== 404) fail('reddeden meydan okumayı görmeye devam ediyor')
  await pa.goto(chUrl)
  const rows = await pa.getByTestId('board-row').allInnerTexts()
  if (rows.length !== 2 || !rows[0].includes(A) || num(rows[0].split(A)[1]) !== 1800 || num(rows[1].split(B)[1]) !== 1500) fail('hacim sıralaması: ' + rows.join(' | '))
  await shot(pa, '01-meydan')

  // 3) Düello: B → A (antrenman günü, 7 gün); ikisinin de bugün antrenmanı var → berabere
  await pb.goto(BASE + '/sosyal/meydan')
  const nd = pb.getByTestId('new-challenge')
  await nd.getByRole('button', { name: /Düello/ }).click(); await nd.getByLabel('Ölçüt').selectOption('training_days')
  await nd.getByRole('group', { name: 'Davet edilecekler' }).getByRole('button', { name: A }).click()
  await nd.getByRole('button', { name: 'Düelloya davet et' }).click(); await pb.waitForURL(/\/sosyal\/meydan\/[0-9a-f-]{36}$/)
  const duelUrl = pb.url()
  await pb.getByTestId('duel-result').getByText('Rakip henüz katılmadı').waitFor()
  await pa.goto(duelUrl); await pa.getByRole('button', { name: 'Katıl' }).click(); await pa.waitForTimeout(800); await pa.reload()
  await pa.getByTestId('duel-result').getByText('Berabere').waitFor().catch(() => fail('düello berabere değil'))

  // 4) Grup: A kurar, B ve C'yi davet eder; sohbet; sıralamaya katılım; DOTS motorla aynı
  await pa.goto(BASE + '/sosyal/gruplar'); await pa.fill('#g-name', 'Sabah salonu ' + ts); await pa.getByRole('button', { name: 'Grup oluştur' }).click()
  await pa.waitForURL(/\/sosyal\/gruplar\/[0-9a-f-]{36}$/); const gUrl = pa.url()
  for (const x of [B, C]) { await pa.getByRole('group', { name: 'Arkadaş davet et' }).getByRole('button', { name: `+ ${x}` }).click(); await pa.waitForTimeout(600) }
  for (const p of [pb, pc]) { await p.goto(gUrl); await p.getByRole('button', { name: 'Katıl', exact: true }).click(); await p.waitForTimeout(800) }
  await pb.goto(gUrl); await pb.fill('#g-msg', 'Selam grup'); await pb.getByTestId('group-chat').getByRole('button', { name: 'Gönder', exact: true }).click(); await pb.waitForTimeout(600)
  await pb.fill('#g-msg', 'sen bir aptalsın değil, aptal'); await pb.getByTestId('group-chat').getByRole('button', { name: 'Gönder', exact: true }).click(); await pb.waitForTimeout(600)
  await pa.goto(gUrl); await pa.getByTestId('group-msg').getByText('Selam grup').waitFor()
  await pa.getByTestId('group-msg').getByRole('button', { name: /Uygunsuz olabilir/ }).waitFor().catch(() => fail('uygunsuz grup mesajı işaretlenmedi'))
  if ((await pa.getByTestId('dots-board').getByText(A).count())) fail('katılmayan sıralamada göründü')
  await pa.getByRole('button', { name: 'Sıralamada görün' }).click(); await pa.waitForTimeout(800)
  await pb.goto(gUrl); await pb.getByRole('button', { name: 'Sıralamada görün' }).click(); await pb.waitForTimeout(800)
  await pa.goto(gUrl)
  const expA = R.dots(Math.round(140 * 1.17) + Math.round(100 * 1.17) + Math.round(180 * 1.17), 82, 'male')
  const dotsTxt = await pa.getByTestId('dots-board').innerText()
  if (!dotsTxt.includes(A) || !dotsTxt.includes(expA.toFixed(1).replace('.', ','))) fail(`A DOTS ${expA}: ${dotsTxt}`)
  // B'nin şüpheli squat'ı (120 e1RM) sayılmaz: önceki 70 ile puanlanır
  const expBbefore = R.dots(70, 82, 'male'), expBafter = R.dots(120, 82, 'male')
  if (!dotsTxt.includes(expBbefore.toFixed(1).replace('.', ','))) fail(`B şüpheli rekor hariç DOTS ${expBbefore} bekleniyordu: ${dotsTxt}`)
  await pa.getByTestId('cons-board').getByText(A).waitFor()
  await shot(pa, '02-grup')

  // 5) PR doğrulama: A ve C tanıklık eder → doğrulanır → B'nin DOTS'u 120 ile
  await pb.goto(`${BASE}/u/${B}`); await pb.getByTestId('pending-prs').getByText(/PR vitrinini arkadaşlarına aç/).waitFor().catch(() => fail('sahibine vitrin ipucu yok'))
  await pb.goto(BASE + '/sosyal/ayarlar/gorunenler'); await pb.getByLabel('PR vitrini', { exact: true }).selectOption('friends'); await pb.getByRole('button', { name: 'Kaydet', exact: true }).click(); await pb.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor()
  await pa.goto(`${BASE}/u/${B}`); const pend = pa.getByTestId('pending-pr').first()
  await pend.waitFor().catch(() => fail('arkadaş şüpheli rekoru görmüyor'))
  await pend.getByRole('button', { name: 'Tanığım' }).click(); await pa.getByRole('status').filter({ hasText: 'Tanıklığın kaydedildi' }).waitFor()
  await pc.goto(`${BASE}/u/${B}`); await pc.getByTestId('pending-pr').first().getByRole('button', { name: 'Tanığım' }).click()
  await pc.getByRole('status').filter({ hasText: 'doğrulandı' }).waitFor().catch(() => fail('2. tanıkta doğrulanmadı'))
  await pa.goto(gUrl)
  if (!(await pa.getByTestId('dots-board').innerText()).includes(expBafter.toFixed(1).replace('.', ','))) fail('doğrulanan rekor sıralamaya girmedi')
  await pb.goto(BASE + '/sosyal/bildirimler'); await pb.locator('[data-testid=notification][data-kind=pr_witness]').first().waitFor()

  // 6) Mesaj + gönderi paylaşımı
  await pa.goto(`${BASE}/sosyal/mesaj/${B}`); await pa.fill('#dm-input', 'Merhaba B ' + ts); await pa.getByRole('button', { name: 'Gönder', exact: true }).click(); await pa.waitForTimeout(600)
  await pb.goto(BASE + '/sosyal'); await pb.getByTestId('dm-link').getByText('1').waitFor().catch(() => fail('okunmamış mesaj sayısı yok'))
  await pb.goto(`${BASE}/sosyal/mesaj/${A}`); await pb.getByTestId('dm').getByText('Merhaba B ' + ts).waitFor()
  await pa.goto(BASE + '/sosyal/yeni'); await pa.fill('#post-body', 'Mesajla paylaşılacak ' + ts); await pa.getByRole('button', { name: 'Paylaş', exact: true }).click(); await pa.waitForURL(/\/sosyal\/p\//)
  await pa.getByRole('button', { name: 'Gönderi menüsü' }).click(); await pa.getByRole('menuitem', { name: 'Mesajla gönder' }).click()
  await pa.getByTestId('share-dm').getByRole('button', { name: B }).click(); await pa.getByTestId('share-dm').getByText(`✓ ${B}`).waitFor()
  await pb.goto(`${BASE}/sosyal/mesaj/${A}`); await pb.getByTestId('dm-post').getByText('Mesajla paylaşılacak ' + ts).waitFor().catch(() => fail('paylaşılan gönderi mesajda yok'))

  // 7) Dürtme: günde tür başına 1
  await pb.goto(`${BASE}/u/${A}`)
  await pb.getByRole('button', { name: 'Su dürt 💧' }).click(); await pb.getByRole('status').filter({ hasText: 'Dürttün' }).waitFor()
  await pb.getByRole('button', { name: 'Su dürt 💧' }).click(); await pb.getByRole('status').filter({ hasText: 'zaten' }).waitFor().catch(() => fail('ikinci dürtme engellenmedi'))
  await pa.goto(BASE + '/sosyal/bildirimler'); await pa.locator('[data-testid=notification][data-kind=nudge]').waitFor()

  // 8) 24 saatlik kart: A (bugün antrenmanı var) → C görür, antrenman özetiyle
  await pa.goto(BASE + '/sosyal'); await pa.getByTestId('stories').getByRole('button', { name: /Salondaydım/ }).click()
  await pa.fill('#story-body', 'Bacak günü bitti'); await pa.getByRole('button', { name: 'Kartı paylaş' }).click(); await pa.waitForTimeout(800)
  await pc.goto(BASE + '/sosyal'); await pc.getByRole('button', { name: `${A} kartları` }).click()
  await pc.getByTestId('story-view').getByText('Bacak günü bitti').waitFor(); await pc.getByTestId('story-view').getByText(/Tohum · 40 dk|· \d+ dk/).first().waitFor().catch(() => fail('kartta antrenman özeti yok'))
  await shot(pc, '03-kart')

  if (errors.length) fail('Tarayıcı hataları:\n' + errors.join('\n'))
  await b.close()
  console.log('SOSYAL-2 E2E OK', A, B, C)
})().catch((e) => { console.error('SOSYAL-2 E2E FAIL:', e.message); process.exit(1) })
