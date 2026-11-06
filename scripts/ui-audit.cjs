// Arayüz yoğunluk ölçümü (sadeleştirme 2026-11-06): verili bir test kullanıcısıyla ana ekranları gezer,
// her ekranda görünen kelime, metin bloğu, küçük açıklama cümlesi, kart, etkileşimli öğe ve sayfa boyunu ölçer; tam ekran görüntüsü alır.
// Kullanım: BASE=http://localhost:3100 DGFIT_E2E_INVITE=... OUT=/klasör node scripts/ui-audit.cjs   (yalnızca yerel/test; kullanıcı açar)
const { chromium, devices } = require('playwright')
const fs = require('fs')
const BASE = process.env.BASE || 'http://localhost:3100'
const INVITE = process.env.DGFIT_E2E_INVITE ? '?davet=' + encodeURIComponent(process.env.DGFIT_E2E_INVITE) : ''
const OUT = process.env.OUT || require('os').tmpdir()
fs.mkdirSync(OUT, { recursive: true })

/** Sayfa içinde çalışır: alt menü ve gizli öğeler hariç ölçüm. */
function measure() {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden],nav[aria-label="Ana menü"],dialog:not([open])') }
  let words = 0, blocks = 0, help = 0
  const helpSamples = []
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || ['SCRIPT', 'STYLE', 'svg', 'path'].includes(el.tagName)) continue
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim()
    if (!own) continue
    blocks++
    const w = own.split(/\s+/).filter(Boolean).length
    words += w
    const fsz = parseFloat(getComputedStyle(el).fontSize)
    // küçük puntolu, cümle uzunluğunda metin = açıklama/yardım yazısı
    if (fsz <= 13.5 && w >= 6) { help++; if (helpSamples.length < 6) helpSamples.push(own.slice(0, 90)) }
  }
  const q = (s) => [...document.querySelectorAll(s)].filter(vis).length
  return {
    words, blocks, help, helpSamples,
    cards: q('.card'),
    interactive: q('button, a[href], input, select, textarea'),
    screens: Math.round((document.scrollingElement.scrollHeight / innerHeight) * 10) / 10,
  }
}

;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'tr-TR', timezoneId: 'Europe/Istanbul' })
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(60000)
  p.on('dialog', (d) => d.accept())
  // 1) Kullanıcı + gerçekçi veri (yemek, su, antrenman, program)
  const u = 'test_ui' + Date.now().toString(36)
  await p.goto(BASE + '/kayit' + INVITE)
  await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
  await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
  await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
  await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'male', birthDate: '1990-03-03', heightCm: 180, weightKg: 80, activity: 'moderate', goal: 'lose', targetWeightKg: 76, tempo: 'balanced', customDays: 120, experience: 'mid', trainingDays: 4, dietPref: null, allergies: [], wakeTime: '07:00', sleepTime: '23:00' })))
  await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
  await p.goto(BASE + '/yemek/ekle?ogun=lunch'); await p.fill('#food-q', 'mercimek çorbası'); await p.getByRole('button', { name: /^Mercimek çorbası/ }).first().click(); await p.getByRole('button', { name: 'Öğle yemeğine ekle' }).click(); await p.waitForTimeout(800)
  await p.goto(BASE + '/su'); await p.getByRole('button', { name: /^250 ml ekle/ }).click(); await p.waitForTimeout(800)
  await p.goto(BASE + '/fitness/programlar/sablonlar/fullbody'); await p.getByRole('button', { name: 'Bu şablonu kullan' }).click(); await p.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/)
  const programUrl = p.url()
  const dayHref = await p.getByRole('link', { name: 'Antrenmana Başla' }).first().getAttribute('href')
  await p.goto(BASE + dayHref)
  const live = p.locator('section[data-testid="live-exercise"]:not([hidden])').first(); await live.waitFor()
  await live.getByLabel('Set 1 ağırlık (kg)', { exact: true }).fill('60'); await live.getByLabel('Set 1 tekrar', { exact: true }).fill('8'); await live.getByRole('button', { name: 'Set 1 tamamla' }).click()
  const skip = p.getByTestId('rest-timer').getByRole('button', { name: 'Atla' }); if (await skip.isVisible().catch(() => false)) await skip.click()
  await p.screenshot({ path: `${OUT}/ui-canli.png`, fullPage: true })
  const liveM = await p.evaluate(measure)
  await p.getByRole('button', { name: 'Bitir' }).click(); await p.getByRole('button', { name: 'Kaydet ve özete geç' }).click(); await p.waitForURL(/\/fitness\/antrenman\/[0-9a-f-]{36}\?yeni=1/)
  const summaryUrl = p.url().split('?')[0]
  const exHref = await p.locator('a[href^="/fitness/hareketler/"]').first().getAttribute('href')

  // 2) Ölçüm
  const screens = [
    ['bugun', '/'], ['fit', '/fit'], ['su', '/su'], ['yemek', '/yemek'], ['fitness', '/fitness'],
    ['program', programUrl.replace(BASE, '')], ['ozet', summaryUrl.replace(BASE, '')], ['hareket', exHref],
    ['istatistik', '/fitness/istatistik'], ['sosyal', '/sosyal'], ['profil', '/profil'],
  ]
  const out = { user: u, at: new Date().toISOString(), screens: { canli: liveM } }
  for (const [k, path] of screens) {
    await p.goto(BASE + path); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(600)
    out.screens[k] = await p.evaluate(measure)
    await p.screenshot({ path: `${OUT}/ui-${k}.png`, fullPage: true })
  }
  fs.writeFileSync(`${OUT}/ui-audit.json`, JSON.stringify(out, null, 2))
  const row = (k, m) => `${k.padEnd(11)} kelime ${String(m.words).padStart(4)} · blok ${String(m.blocks).padStart(3)} · açıklama ${String(m.help).padStart(2)} · kart ${String(m.cards).padStart(2)} · etkileşim ${String(m.interactive).padStart(3)} · ekran ${m.screens}`
  for (const [k, m] of Object.entries(out.screens)) console.log(row(k, m))
  await b.close()
})().catch((e) => { console.error('UI AUDIT FAIL', e.message); process.exit(1) })
