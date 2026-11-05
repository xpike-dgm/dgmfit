// Faz 5h-1: lisanslı içerik (Ağırsağlam, DgFit'e özel izin). Paket yoksa (taze ortam) atlanır.
// Oturumsuz dosya 401; yeni hareket (yalnızca Ağırsağlam'da) kütüphanede + kas etkisi + MSS + kaynak notu; eşleşen harekete video (Range 206).
const { chromium, devices } = require('playwright')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
;(async () => {
  const anon = await fetch(BASE + '/api/lisansli/videos/BarbellSquatRight.mp4')
  if (anon.status !== 401) fail('oturumsuz lisanslı dosya ' + anon.status)
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
  const errors = []
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()) })
  const u = 'test_lc' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1990-03-03', heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'lose', targetWeightKg: 76, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')

  await p.goto(BASE + '/fitness/hareketler?q=arnold press')
  const ag = p.getByRole('link', { name: /^Arnold Press/ })
  if (!(await ag.count())) { console.log('LİSANSLI E2E ATLANDI (paket yok)'); await b.close(); return }
  await ag.first().click(); await p.getByTestId('ex-licensed').waitFor()
  if (!(await p.getByTestId('ag-source').innerText()).includes('Ağırsağlam')) fail('kaynak notu yok')
  if (!/MSS yükü \d+\/10/.test(await p.getByTestId('ex-cns').innerText())) fail('MSS puanı yok')
  await p.screenshot({ path: `${OUT}/licensed-01-yeni-hareket.png`, fullPage: true })

  // Eşleşen kütüphane hareketi: video + yanlış yapılış sekmesi + ileri sarma (Range)
  await p.goto(BASE + '/fitness/hareketler?q=barbell squat')
  await p.getByRole('link', { name: /^Barbell Squat/ }).filter({ has: p.getByTestId('video-badge') }).first().click()
  await p.getByTestId('ex-videos').waitFor()
  const src = await p.getByTestId('ex-video').getAttribute('src')
  const r = await p.evaluate(async (s) => { const x = await fetch(s, { headers: { Range: 'bytes=0-99' } }); return [x.status, x.headers.get('content-range'), (await x.arrayBuffer()).byteLength] }, src)
  if (r[0] !== 206 || !/^bytes 0-99\/\d+$/.test(r[1]) || r[2] !== 100) fail('video Range: ' + JSON.stringify(r))
  const ok = await p.getByTestId('ex-video').evaluate((v) => new Promise((res) => { if (v.readyState >= 1) return res(true); v.onloadedmetadata = () => res(true); v.onerror = () => res(false); setTimeout(() => res(v.readyState >= 1), 8000) }))
  if (!ok) fail('video oynatılamadı')
  await p.getByRole('tab', { name: 'Yanlış yapılış' }).click()
  if (!(await p.getByTestId('ex-video').getAttribute('src')).includes('Wrong')) fail('yanlış yapılış videosu açılmadı')
  const bad = await p.evaluate(async () => (await fetch('/api/lisansli/videos/..%2F..%2Fexercises.json')).status)
  if (bad !== 404) fail('yol dışına çıkılabiliyor: ' + bad)
  await p.screenshot({ path: `${OUT}/licensed-02-video.png`, fullPage: true })
  console.log('LİSANSLI E2E OK user=', u)
  console.log(errors.length ? 'KONSOL HATALARI:\n' + errors.join('\n') : 'no console errors')
  await b.close()
  if (errors.length) process.exit(1)
})().catch((e) => { console.error('LİSANSLI E2E FAIL', e.message); process.exit(1) })
