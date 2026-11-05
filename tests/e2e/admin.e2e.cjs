// Faz 5e: beyaz liste (davetsiz kayıt onay bekler), yönetim panosu, kullanıcı yönetimi (onay, AI kotası, veri sıfırlama, askı, silme),
// geri bildirim (kullanıcı gönderir + ekran görüntüsü → yönetici yanıtlar → kullanıcı görür), davet kodu (tek kullanımlık), 320 px taşma.
// Yönetici öneki (test_ai*) yalnızca test kancalı yerel sunucuda geçerli; canlıda atlanır.
const { chromium, devices } = require('playwright')
const zlib = require('zlib')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
function png() {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 200, 30, 30, 30, 200, 30, 0, 30, 30, 200, 200, 200, 30]))), chunk('IEND', Buffer.alloc(0))])
}

;(async () => {
  const hook = await fetch(BASE + '/api/test/fit', { method: 'POST' }).catch(() => null)
  if (!hook || hook.status === 404) { console.log('YÖNETİM E2E ATLANDI (canlı: test kancası yok, yönetici öneki kullanılamaz)'); return }
  const b = await chromium.launch()
  const errors = []
  const mk = async () => {
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('dialog', (d) => d.accept())
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
    return p
  }
  const register = async (p, u, query) => {
    await p.goto(BASE + '/kayit' + query)
    await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
    await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click()
  }
  const onboard = async (p) => {
    await p.waitForURL('**/kurulum'); await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
    await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'female', birthDate: '1994-04-04', heightCm: 166, weightKg: 64, activity: 'moderate', goal: 'lose', targetWeightKg: 60, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
    await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  }
  const status = (p, re) => p.getByRole('status').filter({ hasText: re }).first().waitFor()
  const ts = Date.now().toString(36)
  const [A, B, C, D] = ['test_aiad' + ts, 'test_adb' + ts, 'test_adc' + ts, 'test_add' + ts]
  const pa = await mk(), pb = await mk(), pc = await mk(), pd = await mk()
  const shot = (p, n) => p.screenshot({ path: `${OUT}/admin-${n}.png`, fullPage: true })

  // 1) Davetsiz kayıt onay bekler; uygulamanın hiçbir yerine giremez
  await register(pa, A, INVITE); await onboard(pa)
  await register(pb, B, ''); await pb.waitForURL('**/beklemede')
  if ((await pb.getByTestId('waiting').getAttribute('data-status')) !== 'pending') fail('bekleme durumu pending olmalı')
  await shot(pb, '01-bekliyor')
  for (const u of ['/', '/kurulum', '/su', '/giris', '/profil/geri-bildirim']) { await pb.goto(BASE + u); if (!pb.url().endsWith('/beklemede')) fail(`onaysız kullanıcı ${u} → ${pb.url()}`) }
  const api = await pb.evaluate(async () => (await fetch('/api/food/search?q=elma')).status); if (api !== 401) fail('onaysız kullanıcı API kullanabiliyor: ' + api)

  // 2) Yönetici panosu: özet + kartlar; onay kartı → bekleyenler → hızlı onay
  await pa.goto(BASE + '/profil'); await pa.getByTestId('admin-link').filter({ hasText: /onay/ }).waitFor().catch(() => fail('profilde bekleyen onay rozeti yok'))
  await pa.getByTestId('admin-link').click(); await pa.waitForURL('**/yonetim')
  await pa.getByTestId('admin-stats').waitFor(); await pa.getByTestId('activity-chart').waitFor()
  for (const c of ['card-pending', 'card-users', 'card-feedback', 'card-moderation', 'card-ai', 'card-invites']) if (!(await pa.getByTestId(c).count())) fail('panoda kart yok: ' + c)
  await shot(pa, '02-pano')
  await pa.getByTestId('card-pending').click(); await pa.waitForURL('**/yonetim/kullanicilar?durum=pending')
  const rowB = pa.locator(`[data-testid=user-row][data-username="${B}"]`); await rowB.waitFor()
  await shot(pa, '03-bekleyenler')
  await rowB.getByTestId('quick-approve').click(); await rowB.waitFor({ state: 'detached' })
  await pb.goto(BASE + '/beklemede'); await onboard(pb)

  // 3) Geri bildirim: kullanıcı gönderir (ekran görüntüsüyle) → yönetici görür, yanıtlar → kullanıcı yanıtı görür
  await pb.goto(BASE + '/profil'); await pb.getByTestId('feedback-link').click(); await pb.waitForURL('**/profil/geri-bildirim')
  await pb.getByRole('radio', { name: /Hata/ }).click(); await pb.getByRole('button', { name: 'Su', exact: true }).click()
  const body = 'Su ekranında kap eklerken liste kayıyor ' + ts
  await pb.fill('#fb-body', body)
  await pb.getByTestId('feedback-photo').setInputFiles({ name: 'e.png', mimeType: 'image/png', buffer: png() }); await pb.getByText('Ekran görüntüsü eklendi').waitFor()
  await pb.getByRole('button', { name: 'Gönder', exact: true }).click(); await status(pb, /Teşekkürler/)
  await pb.getByTestId('feedback-item').filter({ hasText: body }).waitFor()
  await shot(pb, '04-geri-bildirim')
  await pa.goto(BASE + '/yonetim'); await pa.getByTestId('card-feedback').click(); await pa.waitForURL('**/yonetim/geri-bildirim')
  await pa.getByTestId('fb-row').filter({ hasText: ts }).click(); await pa.waitForURL(/geri-bildirim\/[0-9a-f-]{36}$/)
  if (!(await pa.getByTestId('fb-body').innerText()).includes(body)) fail('geri bildirim metni yöneticide görünmüyor')
  const imgOk = await pa.locator('img[alt="Ekran görüntüsü"]').evaluate((i) => new Promise((r) => (i.complete ? r(i.naturalWidth > 0) : (i.onload = () => r(i.naturalWidth > 0), i.onerror = () => r(false)))))
  if (!imgOk) fail('ekran görüntüsü yöneticide açılmıyor')
  const other = await pc.goto(BASE + pa.url().replace(BASE, '').replace('/yonetim/geri-bildirim/', '/api/feedback/') + '/image'); if (other.status() !== 404) fail('oturumsuz istek ekran görüntüsünü açabiliyor: ' + other.status())
  await pa.fill('#fb-reply', 'Teşekkürler, düzelttik ' + ts); await pa.getByRole('button', { name: 'Yanıtı gönder' }).click(); await status(pa, /Yanıt gönderildi/)
  await shot(pa, '05-yanit')
  await pb.goto(BASE + '/profil'); await pb.getByTestId('feedback-link').filter({ hasText: /1 yanıt/ }).waitFor().catch(() => fail('profilde yanıt rozeti yok'))
  await pb.getByTestId('feedback-link').click(); await pb.getByTestId('feedback-reply').filter({ hasText: 'düzelttik ' + ts }).waitFor()
  if (!(await pb.getByTestId('feedback-status').first().innerText()).includes('Çözüldü')) fail('yanıtlanan geri bildirim çözüldü görünmüyor')

  // 4) Kullanıcı detayı: arama → kişiye özel AI kotası 0 → koç ekranında 0 hak
  await pa.goto(BASE + '/yonetim/kullanicilar?q=' + B); await pa.locator(`[data-testid=user-row][data-username="${B}"] a`).first().click(); await pa.waitForURL(/kullanicilar\/[0-9a-f-]{36}$/)
  const userUrl = pa.url()
  await pa.fill('#user-ai-daily', '0'); await pa.getByRole('button', { name: 'Kaydet', exact: true }).click(); await status(pa, /AI bu hesapta kapatıldı/)
  await shot(pa, '06-kullanici')
  await pb.goto(BASE + '/koc'); if (!/bugün 0 AI hakkı/.test(await pb.getByTestId('coach-left').innerText())) fail('kişiye özel kota koç ekranına yansımadı')

  // 5) Verileri sıfırla → kullanıcı kurulumdan başlar
  await pa.goto(userUrl); await pa.getByRole('textbox', { name: 'Sıfırlama onayı' }).fill(B); await pa.getByTestId('reset-data').click(); await status(pa, /Veriler sıfırlandı/)
  await pb.goto(BASE + '/'); await pb.waitForURL('**/kurulum')

  // 6) Askıya al → oturum kapanır; yeniden girişte askı ekranı
  await pa.getByTestId('suspend').click(); await status(pa, /Askıya alındı/)
  await pa.locator('[data-testid=admin-user][data-status=suspended]').waitFor({ timeout: 8000 }).catch(() => fail('durum askıda olmalı'))
  await pb.goto(BASE + '/'); if (!pb.url().includes('/giris')) fail('askıya alınan oturum kapanmadı: ' + pb.url())
  await pb.fill('#login', B); await pb.fill('#password', 'Deneme1234'); await pb.getByRole('button', { name: /Giriş yap/ }).click(); await pb.waitForURL('**/beklemede')
  if ((await pb.getByTestId('waiting').getAttribute('data-status')) !== 'suspended') fail('askı ekranı görünmedi')

  // 7) Tek kullanımlık davet kodu: ilk kayıt onaysız girer, ikinci kayıt reddedilir (davetsiz devam eder → onay bekler)
  await pa.goto(BASE + '/yonetim'); await pa.getByTestId('card-invites').click(); await pa.waitForURL('**/yonetim/davetler')
  await pa.fill('#inv-uses', '1'); await pa.getByTestId('create-invite').click()
  const code = (await pa.getByTestId('new-code').innerText()).trim(); if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) fail('davet kodu biçimi: ' + code)
  await shot(pa, '07-davet')
  await register(pc, C, '?davet=' + code); await onboard(pc)
  await register(pd, D, '?davet=' + code); await pd.getByText('Bu davet kodu geçersiz').waitFor().catch(() => fail('kullanılmış davet kodu kabul edildi'))
  await pd.fill('#invite', ''); await pd.fill('#password', 'Deneme1234'); await pd.fill('#confirm', 'Deneme1234'); await pd.waitForTimeout(300)
  await pd.getByRole('button', { name: 'Hesabı oluştur' }).click(); await pd.waitForURL('**/beklemede')
  await pa.reload(); await pa.getByTestId('invite-row').filter({ hasText: code }).filter({ hasText: 'Bitti' }).waitFor().catch(() => fail('kullanılan kod bitti görünmüyor'))

  // 8) Hesabı sil
  await pa.goto(BASE + '/yonetim/kullanicilar?q=' + C); await pa.locator(`[data-testid=user-row][data-username="${C}"] a`).first().click(); await pa.waitForURL(/kullanicilar\/[0-9a-f-]{36}$/)
  await pa.getByRole('textbox', { name: 'Silme onayı' }).fill(C); await pa.getByTestId('delete-user').click(); await pa.waitForURL(/\/yonetim\/kullanicilar$/)
  await pc.goto(BASE + '/'); if (!pc.url().includes('/giris')) fail('silinen hesabın oturumu açık kaldı')
  // yönetici kendini silemez / engelleyemez: kendi sayfasında silme bölümü yok
  await pa.goto(BASE + '/yonetim/kullanicilar?q=' + A); await pa.locator(`[data-testid=user-row][data-username="${A}"] a`).first().click(); await pa.waitForURL(/kullanicilar\/[0-9a-f-]{36}$/)
  if (await pa.getByTestId('delete-user').count() || await pa.getByTestId('suspend').count()) fail('yönetici kendini silebiliyor/askıya alabiliyor')

  // 9) 320 px: yönetim sayfaları taşmaz
  await pa.setViewportSize({ width: 320, height: 640 })
  for (const path of ['/yonetim', '/yonetim/kullanicilar', userUrl.replace(BASE, ''), '/yonetim/geri-bildirim', '/yonetim/davetler', '/yonetim/ai', '/yonetim/moderasyon', '/profil/geri-bildirim']) {
    await pa.goto(BASE + path); await pa.waitForTimeout(300)
    const r = await pa.evaluate(() => ({ sw: document.documentElement.scrollWidth, out: [...document.querySelectorAll('button, a, input')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > 321 && !e.closest('.overflow-x-auto') }).map((e) => (e.getAttribute('aria-label') || e.textContent || e.id || '').trim().slice(0, 30)) }))
    if (r.sw > 320 || r.out.length) fail(`320 px taşma ${path}: genişlik ${r.sw}, dışarıda: ${r.out.join(' | ')}`)
  }
  await pa.goto(BASE + '/yonetim'); await shot(pa, '08-pano-320')

  console.log('YÖNETİM E2E OK admin=', A)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('YÖNETİM E2E FAIL', e.message); process.exit(1) })
