// AI koç uçtan uca testi (Faz 4b) — sahte Claude (:3190) ve OpenAI (:3191) sunucuları.
// İçgörü kartı (başlangıç → güvenlik destek kartı; ikinci kullanıcıda AI ifadeli "kayıt boşluğu"), koç sohbeti (bağlam, geçmiş, kişilik),
// "ne olur" kartı (veritabanı + Fit motoru), onaylı eylemler (hedef tarihi, programa hareket, su), güvenlik (riskli ifade → destek, eylem yok),
// kota, haftalık rapor (AI özeti + motor istatistikleri), sohbet silme. Yalnızca yerel; canlıda kanca olmadığı için atlanır.
const { chromium, devices } = require('playwright')
const http = require('http')
const BASE = process.env.BASE || 'http://localhost:3100'
const OUT = process.env.OUT || require('os').tmpdir()
const fail = (m) => { throw new Error(m) }
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
const CLAUDE_KEY = 'sk-ant-test-' + 'c'.repeat(24) + 'k0c1'

const state = { calls: [], exercise: 'Plank' }
const lastUserText = (body) => { const m = body.messages.at(-1); return typeof m.content === 'string' ? m.content : m.content.find((c) => c.type === 'text')?.text ?? '' }
const A = (o) => ({ type: 'log_water', weeks: null, programDay: null, exercise: null, sets: null, repMin: null, repMax: null, ml: null, drink: null, ...o })
function coachReply(body) {
  const t = lastUserText(body), sys = body.system
  const day = (sys.match(/Günler: "([^"]+)"/) || [])[1] ?? null
  if (/pizza/i.test(t)) return { reply: 'Kalan bütçene göre kartta etkisini görebilirsin.', actions: [], whatIf: [{ name: 'pizza', grams: 300 }], safety: 'yok' }
  if (/uzat/i.test(t)) return { reply: 'Hedefini 2 hafta uzatmak tempoyu rahatlatır.', actions: [A({ type: 'goal_date', weeks: 2 })], whatIf: [], safety: 'yok' }
  if (/kısalt/i.test(t)) return { reply: 'Deneyelim.', actions: [A({ type: 'goal_date', weeks: -2 })], whatIf: [], safety: 'yok' }
  if (/hareket ekle/i.test(t)) return { reply: 'Programına bir hareket önerdim.', actions: [A({ type: 'add_exercise', programDay: day, exercise: state.exercise, sets: 3, repMin: 1, repMax: 1 })], whatIf: [], safety: 'yok' }
  if (/su ekle/i.test(t)) return { reply: 'Su kaydını hazırladım.', actions: [A({ type: 'log_water', ml: 300, drink: 'water' })], whatIf: [], safety: 'yok' }
  // riskli mesajda model eylem önerse bile sunucu kaldırmalı
  if (/kusuyorum/i.test(t)) return { reply: 'Bunu paylaştığın için teşekkürler.', actions: [A({ type: 'goal_date', weeks: -2 })], whatIf: [{ name: 'elma', grams: 100 }], safety: 'yok' }
  return { reply: 'Merhaba! Verilerine baktım.', actions: [], whatIf: [], safety: 'yok' }
}
function route(body) {
  const props = Object.keys(body.output_config?.format?.schema?.properties ?? {})
  if (props.includes('reply')) return { task: 'coach', out: coachReply(body) }
  if (props.includes('summary')) return { task: 'weekly', out: { summary: 'Test haftalık özet: düzenli kayıt tuttun.', suggestions: ['Öğünlerine protein ekle.', 'Akşamları su şişeni yanında tut.'] } }
  if (props.includes('title')) {
    const allowed = (lastUserText(body).match(/İzinli sayılar: ([^\n]*)/) || [])[1] ?? ''
    const n = allowed.split(',')[0].trim()
    return { task: 'insight', out: { title: 'Test içgörü', body: `Son ${n} gündür kayıt yok; bugün bir öğünle başla.` } }
  }
  return { task: 'other', out: { items: [], note: null } }
}
function fake(port, handler) {
  return new Promise((res) => {
    const s = http.createServer((req, rsp) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { const r = handler(req, b ? JSON.parse(b) : {}); rsp.writeHead(r.status, { 'Content-Type': 'application/json' }); rsp.end(JSON.stringify(r.body)) }) })
    s.listen(port, '127.0.0.1', () => res(s))
  })
}

;(async () => {
  const hookCheck = await fetch(BASE + '/api/test/coach', { method: 'POST' }).catch(() => null)
  if (!hookCheck || hookCheck.status === 404) { console.log('KOÇ E2E ATLANDI (canlı: test kancası yok, sahte sağlayıcı kullanılamaz)'); return }
  const sc = await fake(3190, (req, body) => {
    if (req.url !== '/v1/messages' && req.url !== '/v1/messages?beta=true') return { status: 404, body: {} }
    const r = route(body)
    state.calls.push({ task: r.task, model: body.model, system: body.system, messages: body.messages })
    return { status: 200, body: { id: 'msg_t', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify(r.out) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 900, output_tokens: 120 } } }
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
  const signup = async (p, u) => {
    await p.goto(BASE + '/kayit')
    await p.fill('#username', u); await p.fill('#email', u + '@gmail.com'); await p.fill('#password', 'Deneme1234'); await p.fill('#confirm', 'Deneme1234'); await p.check('input[name=terms]')
    await p.waitForTimeout(500); await p.getByRole('button', { name: 'Hesabı oluştur' }).click(); await p.waitForURL('**/kurulum')
    await p.getByRole('button', { name: /Başlayalım/ }).waitFor(); await p.waitForTimeout(500)
    await p.evaluate(() => localStorage.setItem('dgfit:onboarding:v1', JSON.stringify({ step: 10, sex: 'female', birthDate: '1992-03-03', heightCm: 165, weightKg: 70, activity: 'light', goal: 'lose', targetWeightKg: 64, tempo: 'balanced', customDays: 90, experience: 'new', trainingDays: 3, dietPref: null, allergies: [], wakeTime: '07:30', sleepTime: '23:30' })))
    await p.reload(); await p.getByRole('button', { name: /Planı başlat/ }).click(); await p.waitForURL(BASE + '/')
    // Bugün ekranının ilk içgörü isteği bitsin (yoksa test kancasındaki sıfırlamadan sonra 'start' içgörüsünü yazabilir)
    await p.getByTestId('coach-card').locator('[aria-busy=true]').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {})
  }
  const hook = (p, body) => p.evaluate(async (b) => (await fetch('/api/test/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).json(), body)
  const p = await mk()
  const shot = (n) => p.screenshot({ path: `${OUT}/coach-${n}.png`, fullPage: true })
  const u = 'test_aico' + Date.now().toString(36) // DGFIT_ADMINS='test_ai*' → anahtarı kendisi girer
  await signup(p, u)

  // 0) Anahtar (yalnızca Claude; OpenAI sahtesi 503)
  await p.goto(BASE + '/yonetim/ai')
  const sec = p.getByTestId('provider-claude')
  const rs = sec.getByRole('button', { name: 'Beklemeyi sıfırla' }); if (await rs.count()) { await rs.click(); await p.waitForTimeout(500) }
  await sec.locator('#claude-key').fill(CLAUDE_KEY); await sec.getByRole('button', { name: 'Kaydet' }).click()
  await sec.getByRole('status').filter({ hasText: 'Kaydedildi' }).waitFor()

  // 1) Bugün: veri yokken başlangıç içgörüsü (AI çağrılmaz), kapatılabilir
  await p.goto(BASE + '/')
  await p.getByTestId('insight').waitFor({ timeout: 15000 }).catch(() => fail('içgörü kartı gelmedi'))
  if ((await p.getByTestId('insight').getAttribute('data-key')) !== 'start') fail('ilk içgörü "start" olmalı')
  if (state.calls.some((c) => c.task === 'insight')) fail('başlangıç içgörüsü için AI çağrılmamalı')
  await p.getByTestId('coach-card').getByRole('button', { name: 'Kapat' }).click()
  await p.reload(); await p.getByTestId('coach-card').waitFor(); await p.waitForTimeout(1500)
  if (await p.getByTestId('insight').count()) fail('kapatılan içgörü yeniden göründü')

  // 2) Son 3 gün çok düşük kalori (2 × 300 kcal) → güvenlik destek kartı (içgörünün yerine)
  await hook(p, { reset: true, meals: [{ offset: 1, kcal: 600, items: 2 }, { offset: 2, kcal: 600, items: 2 }, { offset: 3, kcal: 600, items: 2 }, { offset: 9, kcal: 1500, items: 3 }] })
  await p.reload()
  await p.getByTestId('insight').waitFor({ timeout: 15000 })
  if ((await p.getByTestId('insight').getAttribute('data-key')) !== 'safety_low_intake') fail('düşük kalori destek kartı bekleniyordu: ' + (await p.getByTestId('insight').getAttribute('data-key')))
  await p.getByTestId('coach-card').getByText('Kendine nazik ol').waitFor()
  await shot('01-destek')

  // 3) Program (Full Body, 3 gün) — eylem testi için
  await p.goto(BASE + '/fitness/programlar/olustur'); await p.selectOption('#gen-env', 'gym')
  await p.locator('fieldset', { hasText: 'Haftada kaç gün?' }).getByRole('button', { name: '3', exact: true }).click()
  await p.getByRole('button', { name: 'Programı oluştur' }).click(); await p.waitForURL(/\/fitness\/programlar\/[0-9a-f-]{36}$/)
  const programUrl = p.url()
  const firstDay = (await p.getByTestId('program-day').first().locator('h2, h3, [data-testid=day-name]').first().innerText().catch(() => '')).trim()

  // 4) Koç: ilk mesaj → bağlam motor sayılarıyla gider
  await p.goto(BASE + '/koc')
  const left0 = num(await p.getByTestId('coach-left').innerText())
  const ask = async (q, wait = true) => {
    const n = await p.getByTestId('msg-coach').count()
    await p.fill('#coach-input', q); await p.getByRole('button', { name: 'Gönder' }).click()
    if (wait) await p.getByTestId('msg-coach').nth(n).waitFor({ timeout: 20000 }).catch(() => fail('koç cevap vermedi: ' + q))
    return p.getByTestId('msg-coach').nth(n)
  }
  await ask('Merhaba koç, bu hafta nasıl gidiyorum?')
  const c1 = state.calls.filter((c) => c.task === 'coach').at(-1)
  if (!c1) fail('koç isteği gitmedi')
  if (c1.model !== 'claude-haiku-5-5') fail('koç Haiku ile gitmeli: ' + c1.model)
  for (const needle of ['BAĞLAM', 'Güvenli kalori tabanı 1200 kcal', 'son 7 günde 3 gün çok düşük kalori', 'Aktif program:', 'Kişilik: destekleyici', 'Sayı uydurma']) if (!c1.system.includes(needle)) fail('bağlamda yok: ' + needle)
  if (c1.messages.length !== 1) fail('ilk mesajda geçmiş olmamalı')

  // 5) Ne olur: pizza 300 g → kalori veritabanından, kalan bütçe Fit motoru
  const pz = (await p.evaluate(async () => (await (await fetch('/api/food/search?q=pizza')).json()).results[0]))
  const m2 = await ask('Bu akşam pizza yersem ne olur?')
  const c2 = state.calls.filter((c) => c.task === 'coach').at(-1)
  if (c2.messages.length !== 3) fail('geçmiş (önceki 2 mesaj) modele gitmeli: ' + c2.messages.length)
  await m2.getByTestId('whatif').waitFor().catch(() => fail('ne olur kartı yok'))
  const k = Math.round((pz.per100.kcal * 300) / 100)
  const wtxt = await m2.getByTestId('whatif').innerText()
  if (!wtxt.includes(String(k).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' kcal')) fail(`pizza kalorisi ${k} kartta yok: ${wtxt}`)
  const before = num(wtxt.match(/bütçe: ([\d.−-]+)/)[1].replace('−', '-'))
  const after = num((await m2.getByTestId('whatif-after').innerText()).replace('−', '-'))
  if (after !== before - k) fail(`kalan bütçe ${before} − ${k} ≠ ${after}`)
  await shot('02-ne-olur')

  // 6) Hedef tarihini 2 hafta uzat → onay → Bugün'de tarih +14 gün
  await p.goto(BASE + '/'); const endBefore = (await p.getByText('Hedef tarih').locator('b').innerText()).trim()
  await p.goto(BASE + '/koc')
  const m3 = await ask('Hedef tarihimi 2 hafta uzat')
  const act = m3.getByTestId('coach-action')
  if ((await act.getAttribute('data-status')) !== 'pending') fail('eylem beklemede olmalı')
  await act.getByRole('button', { name: 'Onayla' }).click()
  await m3.locator('[data-testid=coach-action][data-status=done]').waitFor().catch(() => fail('hedef eylemi uygulanmadı'))
  await p.goto(BASE + '/'); const endAfter = (await p.getByText('Hedef tarih').locator('b').innerText()).trim()
  if (endAfter === endBefore) fail('hedef tarihi değişmedi: ' + endAfter)

  // 7) Kısaltma güvenlik bayrağı varken reddedilir (onay düğmesi yok)
  await p.goto(BASE + '/koc')
  const m4 = await ask('Hedefimi 2 hafta kısalt')
  if ((await m4.getByTestId('coach-action').getAttribute('data-status')) !== 'invalid') fail('kısaltma güvenlik bayrağında reddedilmeli')
  await m4.getByText(/hızlandırmayı şu an önermiyoruz/).waitFor()

  // 8) Programa hareket ekle → onay → program sayfasında görünür
  const m5 = await ask('Programıma bir hareket ekle')
  const label = await m5.getByTestId('coach-action').innerText()
  if (!label.includes(state.exercise)) fail('hareket etiketi: ' + label)
  await m5.getByTestId('coach-action').getByRole('button', { name: 'Onayla' }).click()
  await m5.locator('[data-testid=coach-action][data-status=done]').waitFor().catch(async () => fail('hareket eklenmedi: ' + (await m5.getByTestId('coach-action').innerText())))
  await p.goto(programUrl)
  await p.getByTestId('program-day').first().getByText(state.exercise, { exact: true }).first().waitFor().catch(() => fail(`${state.exercise} ilk güne eklenmedi (${firstDay})`))

  // 9) Su ekle → onay → Bugün su 300 ml
  await p.goto(BASE + '/koc')
  const m6 = await ask('300 ml su ekle')
  await m6.getByTestId('coach-action').getByRole('button', { name: 'Onayla' }).click()
  await m6.locator('[data-testid=coach-action][data-status=done]').waitFor()
  await p.goto(BASE + '/')
  if (num(await p.locator('section[aria-label="Su"] .num').first().innerText()) !== 300) fail('koçtan eklenen su 300 ml değil')

  // 10) Riskli ifade → destek kartı, eylem ve ne olur kartı yok
  await p.goto(BASE + '/koc')
  const m7 = await ask('Yemekten sonra kusuyorum, ne yapmalıyım')
  await m7.getByTestId('support-card').waitFor().catch(() => fail('destek kartı yok'))
  if (await m7.getByTestId('coach-action').count()) fail('riskli mesajda eylem önerilmemeli')
  if (await m7.getByTestId('whatif').count()) fail('riskli mesajda ne olur kartı olmamalı')
  if (!state.calls.filter((c) => c.task === 'coach').at(-1).system.includes('yeme bozukluğu işareti')) fail('modele güvenlik uyarısı gitmedi')
  await shot('03-destek-sohbet')

  // 11) Kişilik: disiplinli → sonraki istekte
  await p.getByRole('button', { name: 'Koç ayarları' }).click()
  await p.getByRole('radio', { name: /Disiplinli/ }).check(); await p.getByRole('button', { name: 'Kaydet' }).click()
  await p.waitForTimeout(800)
  await ask('Merhaba yine')
  if (!state.calls.filter((c) => c.task === 'coach').at(-1).system.includes('Kişilik: disiplinli')) fail('kişilik değişmedi')
  // kota: 8 koç çağrısı yapıldı
  await p.reload()
  const used = state.calls.filter((c) => c.task === 'coach').length
  if (num(await p.getByTestId('coach-left').innerText()) !== left0 - used + 0) fail(`kalan hak ${left0} − ${used} olmalı`)

  // 12) Haftalık rapor: 9 gün önceki hafta hazır → AI özeti + motor istatistikleri + güvenlik kartı yok (o haftada düşük gün yok ya da var)
  const d9 = new Date(Date.now() + 3 * 3600000 - 9 * 86400000).toISOString().slice(0, 10)
  await p.goto(`${BASE}/rapor?hafta=${d9}`)
  await p.getByTestId('report-summary').getByText('Test haftalık özet').waitFor({ timeout: 20000 }).catch(() => fail('AI haftalık özeti yok'))
  const wk = state.calls.filter((c) => c.task === 'weekly').at(-1)
  if (!wk || !lastUserText({ messages: wk.messages }).includes('İzinli sayılar')) fail('haftalık istek istatistiksiz gitti')
  await p.getByTestId('report-stats').getByText('Kalori uyumu').waitFor()
  await shot('04-rapor')
  const nWeekly = state.calls.filter((c) => c.task === 'weekly').length
  await p.reload(); await p.getByTestId('report-summary').getByText('Test haftalık özet').waitFor()
  if (state.calls.filter((c) => c.task === 'weekly').length !== nWeekly) fail('kayıtlı rapor yeniden üretildi')

  // 13) Sohbeti sil
  await p.goto(BASE + '/koc')
  await p.getByRole('button', { name: 'Sohbetler' }).click()
  await p.getByRole('button', { name: /sohbetini sil$/ }).first().click()
  await p.waitForURL('**/koc?yeni=1'); await p.waitForTimeout(500)
  if (await p.getByTestId('msg-user').count()) fail('silinen sohbet hâlâ görünüyor')

  // 14) İkinci kullanıcı: 2 gündür kayıt yok → AI ile ifade edilen "kayıt boşluğu" içgörüsü (sayı denetiminden geçer)
  const q = await mk(); await signup(q, 'test_co' + Date.now().toString(36))
  await hook(q, { reset: true, meals: [{ offset: 3, kcal: 1700, items: 3 }, { offset: 4, kcal: 1700, items: 3 }] })
  await q.goto(BASE + '/')
  await q.getByTestId('insight').waitFor({ timeout: 20000 })
  if ((await q.getByTestId('insight').getAttribute('data-key')) !== 'logging_gap') fail('kayıt boşluğu içgörüsü bekleniyordu')
  await q.getByTestId('insight').getByText('Test içgörü').waitFor().catch(() => fail('AI ifadesi kullanılmadı'))
  if (!state.calls.some((c) => c.task === 'insight')) fail('içgörü AI isteği gitmedi')

  if (errors.length) fail('Tarayıcı hataları:\n' + errors.join('\n'))
  await b.close(); sc.close(); so.close()
  console.log('KOÇ E2E OK', u)
})().catch((e) => { console.error('KOÇ E2E FAIL:', e.message); process.exit(1) })
