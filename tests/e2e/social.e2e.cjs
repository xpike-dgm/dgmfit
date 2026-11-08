// Sosyal uçtan uca testi (Faz 5a) — üç kullanıcı (A yönetici), sahte Claude (:3190) yalnızca moderasyon için.
// Profil + gizlilik, arama, arkadaşlık isteği/kabul + bildirim, PR vitrini/istatistik görünürlüğü, gönderi türleri (antrenman → kopyala, tarif → kaydet/öğün),
// kitle (arkadaşlar/seçilen/herkese açık + takip), tepki/yorum, fotoğraf erişimi, moderasyon (kural, AI engeli, yeme bozukluğu desteği, yönetici), şikayet, engelleme.
const { chromium, devices } = require('playwright')
const http = require('http')
const zlib = require('zlib')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
const CLAUDE_KEY = 'sk-ant-test-' + 's'.repeat(24) + 's0c1'
function png() {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2
  const px = () => [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)]
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from([0, ...px(), ...px(), 0, ...px(), ...px()]))), chunk('IEND', Buffer.alloc(0))])
}
const state = { mod: 0 }
function fake(port, handler) {
  return new Promise((res) => {
    const s = http.createServer((req, rsp) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { const r = handler(req, b ? JSON.parse(b) : {}); rsp.writeHead(r.status, { 'Content-Type': 'application/json' }); rsp.end(JSON.stringify(r.body)) }) })
    s.listen(port, '127.0.0.1', () => res(s))
  })
}

;(async () => {
  const hookCheck = await fetch(BASE + '/api/test/social', { method: 'POST' }).catch(() => null)
  if (!hookCheck || hookCheck.status === 404) { console.log('SOSYAL E2E ATLANDI (canlı: test kancası yok)'); return }
  const sc = await fake(3190, (req, body) => {
    const props = Object.keys(body.output_config?.format?.schema?.properties ?? {})
    const m = body.messages.at(-1).content
    const text = typeof m === 'string' ? m : m.filter((c) => c.type === 'text').map((c) => c.text).join(' ')
    let out = { items: [], note: null }
    if (props.includes('verdict')) { state.mod++; out = /çıplak/.test(text) ? { verdict: 'block', categories: ['cinsel'], reason: 'test' } : { verdict: 'ok', categories: [], reason: null } }
    return { status: 200, body: { id: 'm', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify(out) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 50, output_tokens: 20 } } }
  })
  const so = await fake(3191, () => ({ status: 503, body: { error: { message: 'kapalı', code: 'server_is_overloaded' } } }))
  const b = await chromium.launch()
  const errors = []
  const mk = async () => {
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('dialog', (d) => d.accept())
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
    return p
  }
  const signup = async (p, u, goal = 'lose') => {
    await p.goto(BASE + '/kayit' + INVITE)
    await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
    await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
    await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
    await p.evaluate((g) => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1991-01-01', heightCm: 178, weightKg: 82, activity: 'moderate', goal: g, targetWeightKg: g === 'lose' ? 76 : 86, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })), goal)
    await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  }
  const post = (p, url, body) => p.evaluate(async ([u, x]) => (await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(x) })).json(), [url, body])
  const ts = Date.now().toString(36)
  const [A, B, C] = ['test_aiso' + ts, 'test_sob' + ts, 'test_soc' + ts]
  const pa = await mk(), pb = await mk(), pc = await mk()
  const shot = (p, n) => p.screenshot({ path: `${OUT}/social-${n}.png`, fullPage: true })
  await signup(pa, A); await signup(pb, B); await signup(pc, C)

  // 0) Yönetici A: AI anahtarı (moderasyon sahte Claude'a)
  await pa.goto(BASE + '/yonetim/ai')
  const sec = pa.getByTestId('provider-claude')
  const rs = sec.getByRole('button', { name: 'Beklemeyi sıfırla' }); if (await rs.count()) { await rs.click(); await pa.waitForTimeout(500) }
  await sec.locator('#claude-key').fill(CLAUDE_KEY); await sec.getByRole('button', { name: 'Kaydet' }).click(); await sec.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor()

  // 1) A: rekorlar + profil (biyografi, salon, avatar, PR/istatistik arkadaşlara, vitrin)
  await post(pa, '/api/test/social', { records: [{ key: 'Barbell_Squat', kg: 120 }, { key: 'Barbell_Bench_Press_-_Medium_Grip', kg: 90 }] })
  // ayarlar menüsü: her satır kendi sayfasını açar
  await pa.goto(BASE + '/sosyal/ayarlar'); await pa.getByRole('link', { name: /Profil bilgileri/ }).click(); await pa.waitForURL('**/sosyal/ayarlar/profil')
  await pa.fill('#sp-bio', 'Bench sever, sabah sporcusu'); await pa.fill('#sp-gym', 'Salon ' + ts)
  await pa.getByTestId('avatar-input').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: png() }); await pa.waitForTimeout(1200)
  await pa.getByRole('button', { name: 'Kaydet', exact: true }).click(); await pa.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor()
  await pa.goto(BASE + '/sosyal/ayarlar/gorunenler')
  await pa.getByLabel('PR vitrini', { exact: true }).selectOption('friends'); await pa.getByLabel('İstatistik kartları').selectOption('friends')
  await pa.getByRole('button', { name: 'Barbell Squat' }).click()
  await pa.getByRole('button', { name: 'Kaydet', exact: true }).click(); await pa.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor()
  // ayrı sayfada kaydetmek diğer sayfanın verisini bozmaz
  await pa.goto(BASE + '/sosyal/ayarlar/profil'); if ((await pa.inputValue('#sp-bio')) !== 'Bench sever, sabah sporcusu') fail('biyografi kayboldu')
  await pa.goto(BASE + '/sosyal/ayarlar/davet')
  await pa.getByTestId('invite-link').getByText(`/u/${A}?davet=1`).waitFor().catch(() => fail('davet linki yok'))
  await pa.getByRole('img', { name: 'Davet QR kodu' }).locator('svg').waitFor().catch(() => fail('QR yok'))
  // C gizli profil
  await pc.goto(BASE + '/sosyal/ayarlar/gizlilik'); await pc.getByRole('radio', { name: /Gizli/ }).check(); await pc.getByRole('button', { name: 'Kaydet', exact: true }).click(); await pc.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor()

  // 2) Arama: B, A'yı bulur; C (gizli) bulunmaz
  await pb.goto(`${BASE}/sosyal/ara?q=${C}`)
  if (await pb.getByTestId('search-row').count()) fail('gizli profil aramada göründü')
  await pb.goto(`${BASE}/sosyal/ara?q=${A}`)
  await pb.getByTestId('search-row').filter({ hasText: A }).getByRole('button', { name: 'Arkadaş ekle' }).click()
  await pb.getByText('İstek gönderildi').waitFor()
  // C, A'nın yalnızca temel profilini görür (arkadaş değil)
  await pc.goto(`${BASE}/u/${A}`)
  await pc.getByText('yalnızca arkadaşları görür').waitFor().catch(() => fail('yabancı ayrıntıyı görmemeli'))
  if (await pc.getByTestId('showcase').count()) fail('yabancı PR vitrinini gördü')

  // 3) A: bildirim + kabul; B: kabul bildirimi
  await pa.goto(BASE + '/sosyal')
  await pa.getByTestId('notif-bell').getByText('1').waitFor().catch(() => fail('A bildirim sayısı 1 değil'))
  await pa.goto(BASE + '/sosyal/arkadaslar'); await pa.getByTestId('incoming').getByRole('button', { name: 'Kabul et' }).click()
  await pa.getByTestId('friends').getByText(B).waitFor()
  await pb.goto(BASE + '/sosyal/bildirimler'); await pb.locator('[data-testid=notification][data-kind=friend_accept]').waitFor().catch(() => fail('kabul bildirimi yok'))

  // 4) B, A'nın profilinde vitrin (Squat 120 kg), istatistik, hedef rozeti, biyografi görür
  await pb.goto(`${BASE}/u/${A}`)
  await pb.getByTestId('showcase').getByText('120 kg').waitFor().catch(() => fail('vitrin görünmüyor'))
  await pb.getByTestId('stat-cards').waitFor(); await pb.getByTestId('goal-badge').getByText('Kilo veriyor').waitFor(); await pb.getByText('Bench sever').waitFor()
  await shot(pb, '01-profil')

  // 5) A antrenman gönderisi (arkadaşlar) → B tepki + yorum + kopyala
  await post(pa, '/api/test/fitness', { key: 'Barbell_Squat', sessions: [{ daysAgo: 0, kg: 100, reps: 5, sets: 3 }] })
  await pa.goto(BASE + '/sosyal/yeni?tur=workout')
  await pa.getByLabel('Paylaşılacak kayıt').selectOption({ index: 1 })
  await pa.fill('#post-body', 'Bugün bacak günü 💪'); await pa.getByRole('button', { name: 'Paylaş', exact: true }).click()
  await pa.waitForURL(/\/sosyal\/p\/[0-9a-f-]{36}$/); const workoutPost = pa.url().split('/').pop()
  await pa.getByTestId('post-workout').getByText('Barbell Squat').waitFor()
  await pb.goto(BASE + '/sosyal?g=kronolojik')
  const wp = pb.locator(`[data-testid=post][data-id="${workoutPost}"]`)
  await wp.waitFor().catch(() => fail('B akışında A\'nın antrenmanı yok'))
  await wp.getByTestId('react-open').click(); await wp.getByRole('button', { name: 'Tepki 💪' }).click(); await pb.waitForTimeout(400)
  await pb.goto(`${BASE}/sosyal/p/${workoutPost}`)
  await pb.fill('#comment-input', 'Harika!'); await pb.getByRole('button', { name: 'Gönder', exact: true }).click()
  await pb.getByTestId('comment').getByText('Harika!').waitFor()
  await pb.getByRole('button', { name: 'Bu antrenmanı kopyala' }).click()
  await pb.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/); await pb.getByText('Barbell Squat').first().waitFor().catch(() => fail('kopyalanan programda squat yok'))
  await pa.goto(BASE + '/sosyal/bildirimler')
  await pa.locator('[data-testid=notification][data-kind=reaction]').waitFor(); await pa.locator('[data-testid=notification][data-kind=comment]').waitFor()

  // 5b) Program paylaşımı: A şablondan program kurar, paylaşır → B "Programlarıma kaydet" ile tüm günleri alır
  await pa.goto(BASE + '/fitness/programlar/sablonlar/ppl'); await pa.getByRole('button', { name: 'Bu şablonu kullan' }).click(); await pa.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/)
  await pa.getByRole('link', { name: 'Paylaş', exact: true }).click(); await pa.waitForURL('**/sosyal/yeni?tur=program*')
  if (!(await pa.getByLabel('Paylaşılacak kayıt').inputValue())) fail('program önceden seçili değil')
  await pa.getByRole('button', { name: 'Paylaş', exact: true }).click(); await pa.waitForURL(/\/sosyal\/p\/[0-9a-f-]{36}$/)
  const progPost = pa.url().split('/').pop()
  await pa.getByTestId('post-program').getByText(/3 gün/).waitFor().catch(() => fail('program gönderisinde 3 gün yok'))
  await pb.goto(`${BASE}/sosyal/p/${progPost}`); await pb.getByRole('button', { name: 'Programlarıma kaydet' }).click()
  await pb.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/)
  if ((await pb.getByTestId('program-day').count()) !== 3) fail('kaydedilen programda 3 gün olmalı')
  await pb.getByText(/paylaşımından kaydedildi/).first().waitFor().catch(() => fail('kaynak notu yok'))

  // 6) Tarif gönderisi → B kaydeder ve öğün olarak ekler
  const { recipeId } = await post(pa, '/api/test/social', { recipe: true })
  await pa.goto(`${BASE}/sosyal/yeni?tur=recipe&ref=${recipeId}`); await pa.getByRole('button', { name: 'Paylaş', exact: true }).click(); await pa.waitForURL(/\/sosyal\/p\//)
  const recipePost = pa.url().split('/').pop()
  await pb.goto(`${BASE}/sosyal/p/${recipePost}`)
  await pb.getByRole('button', { name: 'Tariflerime kaydet' }).click(); await pb.getByRole('status').filter({ hasText: 'Tariflerine kaydedildi' }).waitFor()
  await pb.getByRole('button', { name: 'Öğün olarak ekle' }).click(); await pb.getByRole('status').filter({ hasText: /Öğün olarak eklendi · 300 kcal/ }).waitFor().catch(() => fail('tarif öğün olarak eklenmedi (250 g × 1,2 = 300 kcal)'))

  // 7) Fotoğraflı gönderi: arkadaş görür (200), yabancı 404
  await pa.goto(BASE + '/sosyal/yeni')
  await pa.getByTestId('post-photo').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: png() }); await pa.waitForTimeout(1000)
  await pa.fill('#post-body', 'Salon selfiesi'); await pa.getByRole('button', { name: 'Paylaş', exact: true }).click(); await pa.waitForURL(/\/sosyal\/p\//)
  const photoPost = pa.url().split('/').pop()
  if (state.mod < 1) fail('fotoğraflı gönderi AI moderasyonuna gitmedi')
  const st = (p) => p.evaluate(async (u) => (await fetch(u)).status, `/api/social/media/${photoPost}/0`)
  if ((await st(pb)) !== 200) fail('arkadaş fotoğrafı göremiyor')
  if ((await st(pc)) !== 404) fail('yabancı fotoğrafa erişti')
  if ((await pc.evaluate(async (u) => (await fetch(u)).status, `/sosyal/p/${photoPost}`)) !== 404) fail('yabancı arkadaş gönderisini açtı')

  // 8) Seçilen kitle: yalnızca B
  await pa.goto(BASE + '/sosyal/yeni'); await pa.fill('#post-body', 'Yalnızca seçilenlere')
  await pa.locator('fieldset').getByRole('button', { name: 'Seçilenler' }).click()
  await pa.getByRole('group', { name: 'Seçilen arkadaşlar' }).getByRole('button', { name: B }).click()
  await pa.getByRole('button', { name: 'Paylaş', exact: true }).click(); await pa.waitForURL(/\/sosyal\/p\//)
  const selPost = pa.url().split('/').pop()
  await pb.goto(`${BASE}/sosyal/p/${selPost}`); await pb.getByText('Yalnızca seçilenlere').waitFor().catch(() => fail('seçilen kişi göremedi'))

  // 9) Herkese açık profil + takip: C takip eder, yalnızca herkese açık gönderiyi görür
  await pa.goto(BASE + '/sosyal/ayarlar/gizlilik'); await pa.getByRole('radio', { name: /Herkese açık/ }).check(); await pa.getByRole('button', { name: 'Kaydet', exact: true }).click(); await pa.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor()
  await pa.goto(BASE + '/sosyal/yeni'); await pa.fill('#post-body', 'Herkese açık gönderi ' + ts)
  await pa.locator('fieldset').getByRole('button', { name: 'Herkese açık' }).click(); await pa.getByRole('button', { name: 'Paylaş', exact: true }).click(); await pa.waitForURL(/\/sosyal\/p\//)
  const pubPost = pa.url().split('/').pop()
  await pc.goto(`${BASE}/u/${A}`); await pc.getByTestId('profile-actions').getByRole('button', { name: 'Takip et' }).click(); await pc.waitForTimeout(800)
  await pc.goto(`${BASE}/u/${A}`)
  if (await pc.getByTestId('showcase').count()) fail('takipçi arkadaşlara açık vitrini gördü')
  await pc.getByTestId('profile-actions').getByRole('button', { name: 'Takibi bırak' }).waitFor().catch(() => fail('takip edilmedi'))
  await pc.goto(BASE + '/sosyal?g=kronolojik')
  await pc.locator(`[data-testid=post][data-id="${pubPost}"]`).waitFor().catch(() => fail('takipçi herkese açık gönderiyi görmedi'))
  if (await pc.locator(`[data-testid=post][data-id="${workoutPost}"]`).count()) fail('takipçi arkadaşlara özel gönderiyi gördü')
  if (await pc.locator(`[data-testid=post][data-id="${selPost}"]`).count()) fail('takipçi seçilenlere özel gönderiyi gördü')
  await shot(pc, '02-akis-takipci')

  // 10) Moderasyon: hakaret → bekler (yalnızca yazar), AI engeli → gizli, yeme bozukluğu → destek
  await pb.goto(BASE + '/sosyal/yeni'); await pb.fill('#post-body', 'Sen tam bir şişko ' + ts); await pb.getByRole('button', { name: 'Paylaş', exact: true }).click(); await pb.waitForURL(/\/sosyal\/p\//)
  const badPost = pb.url().split('/').pop()
  await pb.getByTestId('post-pending').waitFor().catch(() => fail('hakaret içeren gönderi beklemeye düşmedi'))
  if ((await pa.evaluate(async (u) => (await fetch(u)).status, `/sosyal/p/${badPost}`)) !== 404) fail('bekleyen gönderi arkadaşa göründü')
  await pb.goto(BASE + '/sosyal/yeni'); await pb.fill('#post-body', 'çıplak test'); await pb.getByRole('button', { name: 'Paylaş', exact: true }).click(); await pb.waitForURL(/\/sosyal\/p\//)
  await pb.getByTestId('post-pending').getByText(/gizlendi/).waitFor().catch(() => fail('AI engeli uygulanmadı'))
  await pb.goto(BASE + '/sosyal/yeni'); await pb.fill('#post-body', 'Yemekten sonra kusuyorum'); await pb.getByRole('button', { name: 'Paylaş', exact: true }).click()
  await pb.getByTestId('post-support').waitFor().catch(() => fail('yeme bozukluğu destek kartı yok'))

  // 11) Şikayet → yönetici kuyruğu; yönetici bekleyen gönderiyi gizler
  await pc.goto(`${BASE}/sosyal/p/${pubPost}`)
  await pc.getByRole('button', { name: 'Gönderi menüsü' }).click(); await pc.getByRole('menuitem', { name: 'Şikayet: spam' }).click()
  await pc.getByRole('status').filter({ hasText: 'Şikayetin alındı' }).waitFor()
  await pa.goto(BASE + '/yonetim/moderasyon')
  await pa.getByTestId('mod-report').filter({ hasText: C }).waitFor().catch(() => fail('şikayet kuyrukta yok'))
  const mp = pa.getByTestId('mod-post').filter({ hasText: 'Sen tam bir şişko ' + ts })
  await mp.getByRole('button', { name: 'Gizle' }).click(); await pa.waitForTimeout(600)
  await shot(pa, '03-moderasyon')

  // 12) Engelleme: A, C'yi engeller → C profili ve gönderileri göremez, takip düşer
  await pa.goto(`${BASE}/u/${C}`).catch(() => {})
  const prof = await pa.evaluate(async (u) => (await fetch(u)).status, `/u/${C}`)
  if (prof !== 404) fail('gizli profil yabancıya açıldı: ' + prof)
  await pc.goto(`${BASE}/u/${A}`); await pc.getByTestId('profile-actions').getByRole('button', { name: 'Engelle' }).click(); await pc.getByTestId('confirm-ok').click(); await pc.waitForTimeout(800)
  await pa.goto(BASE + '/sosyal/arkadaslar')
  if (await pa.getByText(C).count()) fail('engelleyen takipçi listede kaldı')
  if ((await pc.evaluate(async (u) => (await fetch(u)).status, `/sosyal/p/${pubPost}`)) !== 404) fail('engelleyen engellenenin gönderisini açtı')
  await pc.goto(`${BASE}/u/${A}`); await pc.getByText('Bu kişiyi engelledin.').waitFor().catch(() => fail('engelleyen için engel ekranı yok'))
  if ((await pa.evaluate(async (u) => (await fetch(u)).status, `/u/${C}`)) !== 404) fail('engellenen engelleyeni gördü')

  if (errors.length) fail('Tarayıcı hataları:\n' + errors.join('\n'))
  await b.close(); sc.close(); so.close()
  console.log('SOSYAL E2E OK', A, B, C)
})().catch((e) => { console.error('SOSYAL E2E FAIL:', e.message); process.exit(1) })
