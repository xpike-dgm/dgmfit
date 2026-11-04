// Su modülü uçtan uca testi. Her adımda ekrandaki toplam beklenen değerle karşılaştırılır.
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3100'
const OUT = process.env.OUT || require('os').tmpdir()

const fail = (m) => { throw new Error(m) }
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''))

;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 14'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage()
  p.setDefaultNavigationTimeout(60000)
  const errors = []
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
  const shot = (n) => p.screenshot({ path: `${OUT}/water-${n}.png`, fullPage: true })
  const total = async () => num(await p.locator('[aria-live=polite]').first().innerText())
  const expectTotal = async (v, step) => {
    for (let i = 0; i < 20; i++) { if ((await total()) === v) return; await p.waitForTimeout(150) }
    fail(`${step}: toplam ${await total()} beklenen ${v}`)
  }
  const settle = () => p.waitForTimeout(700)

  // Kayıt + hızlı kurulum (sihirbaz durumunu son adıma hazırlayıp planı başlatır)
  const u = 'test_w' + Date.now().toString(36)
  await p.goto(BASE + '/kayit')
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com')
  await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500)
  await p.getByRole('button', { name: 'Hesabı oluştur' }).click()
  await p.waitForURL('**/kurulum')
  // sihirbaz hidrasyonu bitsin; yoksa kendi ilk durumunu kaydedip bizimkini ezer
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({
    step: 10, sex: 'male', birthDate: '1995-05-05', heightCm: 177, weightKg: 78.4, activity: 'moderate', goal: 'lose',
    targetWeightKg: 72, tempo: 'balanced', customDays: 90, experience: null, trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:30', sleepTime: '23:30',
  })))
  await p.reload()
  await p.getByRole('button', { name: /Planı başlat/ }).click()
  await p.waitForURL(BASE + '/')

  // 1) Su ekranı boş
  await p.goto(BASE + '/su')
  await expectTotal(0, 'başlangıç')
  if (!(await p.getByText('/ 2.600 ml').count())) fail('hedef 2.600 ml görünmüyor (78,4 kg × 33)')

  // 2) Tek dokunuş + geri al
  await p.getByRole('button', { name: /^250 ml ekle/ }).click()
  await expectTotal(250, 'ekle 250')
  await p.getByRole('button', { name: 'Geri al' }).click()
  await settle(); await expectTotal(0, 'geri al')

  // 3) Çift kayıt uyarısı
  await p.getByRole('button', { name: /^250 ml ekle/ }).click(); await settle()
  await expectTotal(250, 'ekle 250 (2)')
  await p.getByRole('button', { name: /^250 ml ekle/ }).click(); await settle()
  if (!(await p.getByRole('alertdialog').count())) fail('çift kayıt uyarısı çıkmadı')
  await shot('01-cift-kayit')
  await p.getByRole('button', { name: 'Evet, ekle' }).click(); await settle()
  await expectTotal(500, 'çift kayıt onayı')

  // 3b) Regresyon: beklemeden art arda iki dokunuş → tek kayıt + soru (canlıda yakalanan yarış hatası)
  await p.getByRole('button', { name: /^100 ml ekle/ }).click()
  await p.getByRole('button', { name: /^100 ml ekle/ }).click()
  await p.getByRole('alertdialog').waitFor({ timeout: 3000 }).catch(() => fail('hızlı çift dokunuşta soru çıkmadı'))
  await p.getByRole('button', { name: 'Hayır, çift kayıt' }).click(); await p.waitForTimeout(1500)
  await p.reload(); await expectTotal(600, 'hızlı çift dokunuş tek kayıt')
  // sonraki adımların beklenen toplamları için 100 ml'yi sil
  await p.locator('li', { hasText: '+100' }).getByRole('button').click()
  await p.getByRole('button', { name: 'Kaydı sil' }).click(); await p.waitForTimeout(1500)
  await p.reload(); await expectTotal(500, 'regresyon temizliği')

  // 4) İçecek türü: kahve 200 ml → 160 ml sayılır
  await p.getByRole('button', { name: /^Kahve/ }).click()
  await p.getByRole('button', { name: /^200 ml ekle/ }).click(); await settle()
  await expectTotal(660, 'kahve')
  await p.getByRole('button', { name: /^Su$/ }).click()

  // 5) Kap + doluluk: termos yarım = 375
  await p.getByRole('button', { name: /Termos/ }).first().click()
  await p.getByRole('button', { name: 'Yarım' }).click()
  await p.getByRole('button', { name: '375 ml ekle' }).click(); await settle()
  await expectTotal(1035, 'termos yarım')

  // 6) Yudum: 3 × 25 = 75
  await p.getByRole('button', { name: 'Yudum', exact: true }).click()
  await p.getByRole('button', { name: '75 ml ekle' }).click(); await settle()
  await expectTotal(1110, 'yudum')

  // 7) Geçmiş saate özel miktar: 09:00'da 300 ml
  await p.getByRole('button', { name: 'Özel', exact: true }).click()
  await p.fill('#c-ml', '300'); await p.fill('#c-time', '09:00')
  await p.getByRole('button', { name: 'Ekle', exact: true }).click(); await settle()
  await expectTotal(1410, 'geçmiş saat')
  if (!(await p.getByText('09.00', { exact: true }).count())) fail('09.00 kaydı zaman çizelgesinde yok')
  await shot('02-su-ekrani')

  // 8) Düzenle: 09.00 kaydı 350 ml
  await p.locator('li', { hasText: '09.00' }).getByRole('button').click()
  await p.fill('#e-ml', '350')
  await p.getByRole('button', { name: 'Kaydet' }).click(); await p.waitForTimeout(1500)
  await expectTotal(1460, 'düzenle')

  // 9) Sil: kahve kaydı
  await p.locator('li', { hasText: 'Kahve' }).getByRole('button').click()
  await p.getByRole('button', { name: 'Kaydı sil' }).click(); await p.waitForTimeout(1500)
  await expectTotal(1300, 'sil')

  // 10) Birleştir: iki kayıt → toplam değişmez, kayıt sayısı 1 azalır
  const countBefore = await p.locator('section[aria-label="Zaman çizelgesi"] li').count()
  await p.getByRole('button', { name: /^Birleştir$/ }).click()
  const rows = p.locator('section[aria-label="Zaman çizelgesi"] li button')
  await rows.nth(0).click(); await rows.nth(1).click()
  await p.getByRole('button', { name: /Birleştir \(2\)/ }).click(); await p.waitForTimeout(1500)
  const countAfter = await p.locator('section[aria-label="Zaman çizelgesi"] li').count()
  if (countAfter !== countBefore - 1) fail(`birleştir: kayıt sayısı ${countBefore} → ${countAfter}`)
  await expectTotal(1300, 'birleştir')

  // 11) Geçmiş gün: dün 10:00'a 500 ml; bugün değişmez
  const y = new Date(Date.now() + 3 * 3600000 - 86400000).toISOString().slice(0, 10)
  await p.goto(`${BASE}/su?gun=${y}`)
  await expectTotal(0, 'dün boş')
  await p.fill('#past-time', '10:00')
  await p.getByRole('button', { name: /^500 ml ekle/ }).click(); await settle()
  await expectTotal(500, 'dün ekle')
  await p.goto(BASE + '/su'); await expectTotal(1300, 'bugün değişmedi')

  // 12) Ayarlar: hedef 3000 → su ekranında görünür
  await p.goto(BASE + '/su/ayarlar')
  await p.fill('#base', '3000')
  await p.getByRole('button', { name: 'Hedefi kaydet' }).click()
  await p.getByText('Kaydedildi').first().waitFor()
  await p.fill('#s-vol', '200'); await p.fill('#s-n', '10')
  await p.getByRole('button', { name: 'Kalibre et' }).click()
  await p.getByText('Yudum hacmin 20 ml').waitFor()
  await p.goto(BASE + '/su')
  if (!(await p.getByText('/ 3.000 ml').count())) fail('yeni hedef 3.000 ml görünmüyor')

  // 13) İstatistik ve Bugün ekranı
  await p.goto(BASE + '/su/istatistik'); await p.getByText('Günlük ortalama').waitFor()
  await shot('03-istatistik')
  await p.goto(BASE + '/su/istatistik?aralik=30'); await p.getByRole('region', { name: 'Takvim' }).waitFor()
  await p.goto(BASE + '/')
  if (!(await p.getByText('1.300', { exact: true }).count())) fail('Bugün ekranında su toplamı 1.300 değil')
  await p.getByRole('button', { name: '250 ml su ekle' }).click(); await p.waitForTimeout(1200)
  // testte 2 dk içinde başka 250 ml kaydı olduğu için çift kayıt sorusu beklenir
  if (await p.getByRole('button', { name: 'Yine ekle' }).count()) { await p.getByRole('button', { name: 'Yine ekle' }).click(); await p.waitForTimeout(1500) }
  else fail('Bugün ekranında çift kayıt sorusu çıkmadı')
  if (!(await p.getByText('1.550', { exact: true }).count())) fail('Bugün ekranından hızlı ekleme çalışmadı')
  await shot('04-bugun')

  // 14) Sesli/yazılı kayıt: "yarım saat önce iki bardak çay içtim" → 400 ml çay (360 ml sayılır)
  await p.goto(BASE + '/su')
  await p.getByRole('button', { name: 'Söyle', exact: true }).click()
  await p.fill('#v-text', 'yarım saat önce iki bardak çay içtim')
  await p.getByText(/Anladığım: 400 ml çay/).waitFor()
  await p.getByRole('button', { name: '400 ml ekle' }).click(); await settle()
  await expectTotal(1910, 'sesli kayıt')
  // 15) İstatistikte rozet ve aylık rapor bölümleri
  await p.goto(BASE + '/su/istatistik')
  await p.getByRole('region', { name: 'Rozetler' }).waitFor()
  if (!(await p.getByText('Kazanıldı').count())) fail('ilk yudum rozeti kazanılmadı')
  await p.getByRole('region', { name: 'Aylık rapor' }).waitFor()

  console.log('WATER E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch(async (e) => { console.error('WATER E2E FAIL', e.message); process.exit(1) })
