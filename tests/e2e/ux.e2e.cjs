// Faz 5d kullanılabilirlik testi: 320 px'te taşma yok, alt pencere aşağı çekilince kapanır, geri düğmesi geldiği sayfaya döner,
// profilden hedef değiştirme planı bugünden yeniden kurar, boş programda gün silinir, şablon incelenir.
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 14'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
  const errors = []
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
  p.on('dialog', (d) => d.accept())
  const u = 'test_ux' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1995-05-05', heightCm: 177, weightKg: 78.4, activity: 'moderate', goal: 'lose', targetWeightKg: 72, tempo: 'balanced', customDays: 90, experience: null, trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:30', sleepTime: '23:30' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  // 1) Hızlı ekle: tutamaçtan aşağı çekince kapanır; az çekince yerinde kalır
  await p.getByRole('button', { name: 'Hızlı ekle' }).click()
  const dlg = p.getByRole('dialog', { name: 'Hızlı ekle' }); await dlg.waitFor(); await p.waitForTimeout(400) // açılış animasyonu bitsin
  const h = await dlg.getByTestId('sheet-handle').boundingBox()
  const drag = async (dy) => { await p.mouse.move(h.x + h.width / 2, h.y + 10); await p.mouse.down(); await p.mouse.move(h.x + h.width / 2, h.y + 10 + dy, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400) }
  await drag(30); if (!(await dlg.isVisible())) fail('az çekince pencere kapanmamalı')
  await drag(220); if (await dlg.isVisible()) fail('aşağı çekince pencere kapanmadı')
  await p.getByRole('button', { name: 'Hızlı ekle' }).click(); await dlg.getByRole('button', { name: 'Kapat' }).click(); await p.waitForTimeout(400)
  if (await dlg.isVisible()) fail('Kapat düğmesi çalışmadı')

  // 2) Geri: Su → Düzenle (kaplar) → Geri = Su; doğrudan açılan alt sayfada geri = üst sayfa
  await p.goto(BASE + '/su'); await p.getByRole('link', { name: 'Düzenle', exact: true }).click(); await p.waitForURL('**/su/ayarlar/kaplar')
  await p.getByRole('link', { name: 'Geri' }).click(); await p.waitForURL(BASE + '/su')
  const fresh = await ctx.newPage(); await fresh.goto(BASE + '/su/ayarlar/kaplar'); await fresh.getByRole('link', { name: 'Geri' }).click(); await fresh.waitForURL('**/su/ayarlar'); await fresh.close()

  // 3) Hedef değiştir: 120 gün → plan bugünden yeniden kurulur
  await p.goto(BASE + '/profil/hedef'); await p.fill('#pf-d', '120')
  await p.getByTestId('plan-preview').waitFor()
  await p.getByRole('button', { name: 'Planı güncelle' }).click(); await p.getByRole('status').filter({ hasText: 'Planın güncellendi' }).waitFor()
  await p.reload(); await p.getByText(/Gün 1 \/ 120/).waitFor().catch(() => fail('yeni hedef süresi 120 gün görünmüyor'))
  // aşırı hızlı hedef engellenir
  await p.fill('#pf-d', '14'); if (!(await p.getByRole('button', { name: 'Planı güncelle' }).isDisabled())) fail('haftada 1,5 kg üstü hedef kaydedilebiliyor')
  // boy/aktivite düzenleme
  await p.goto(BASE + '/profil/hesap'); await p.selectOption('#pf-a', 'light'); await p.getByRole('button', { name: 'Planı güncelle' }).click(); await p.getByRole('status').filter({ hasText: 'Planın güncellendi' }).waitFor()
  await p.reload(); await p.getByText('Az hareketli', { exact: true }).waitFor().catch(() => fail('aktivite güncellenmedi'))

  // 4) Şablon incele, boş program: gün ekle → hareket düzenle/sil düğmeleri → gün sil
  await p.goto(BASE + '/fitness/programlar/sablonlar'); await p.getByTestId('template-item').filter({ hasText: /^Push \/ Pull/ }).click(); await p.waitForURL('**/sablonlar/ppl'); await p.getByTestId('template-day').first().waitFor()
  if ((await p.getByTestId('template-day').count()) !== 3) fail('PPL şablonunda 3 gün görünmeli')
  await p.goto(BASE + '/fitness/programlar/bos'); await p.fill('#empty-name', 'Testim'); await p.getByRole('button', { name: 'Oluştur', exact: true }).click()
  await p.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/)
  const nDays = () => p.getByTestId('program-day').count()
  const n0 = await nDays() // boş program "Gün 1" ile başlar
  await p.fill('#day-name', 'Gün A'); await p.getByRole('button', { name: 'Gün ekle' }).click(); await p.getByRole('region', { name: 'Gün A' }).waitFor()
  await p.fill('#day-name', 'Gün B'); await p.getByRole('button', { name: 'Gün ekle' }).click(); await p.getByRole('region', { name: 'Gün B' }).waitFor()
  if ((await nDays()) !== n0 + 2) fail('iki gün eklenmedi')
  await p.getByRole('button', { name: 'Gün A gününü sil' }).click(); await p.getByTestId('confirm-ok').click()
  await p.getByRole('region', { name: 'Gün A' }).waitFor({ state: 'detached' }).catch(() => fail('gün silinmedi'))
  if ((await nDays()) !== n0 + 1 || !(await p.getByRole('region', { name: 'Gün B' }).count())) fail('yanlış gün silindi')

  // 5) 320 px: sayfalar yatay taşmaz, satır düğmeleri ekranın içinde
  const programUrl = p.url()
  await p.setViewportSize({ width: 320, height: 568 })
  for (const path of ['/', '/fit', '/su', '/su/ayarlar/kaplar', '/fitness/programlar/bos', programUrl.replace(BASE, ''), '/yemek', '/fitness/kardiyo', '/sosyal']) {
    await p.goto(BASE + path); await p.waitForTimeout(400)
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, out: [...document.querySelectorAll('button, a, input')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > 321 && !e.closest('.overflow-x-auto, [data-testid=day-picker]') }).map((e) => (e.getAttribute('aria-label') || e.textContent || e.id || '').trim().slice(0, 30)) }))
    if (r.sw > 320 || r.out.length) fail(`320 px taşma ${path}: genişlik ${r.sw}, dışarıda: ${r.out.join(' | ')}`)
  }
  await p.screenshot({ path: `${OUT}/ux-320.png` })
  console.log('UX E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('UX E2E FAIL', e.message); process.exit(1) })
