// Uzun dönem senaryo simülasyonu (Faz 9).
// Kullanım: node --experimental-strip-types scripts/sim.mjs [fast|full] [--update] [--report dosya.html] [--only kimlik]
//   fast: ~300 senaryo (verify.sh'te), full: ~4000 senaryo (faz sonu ve yayın öncesi)
//   --update: altın dosyayı yeniden yazar (bilinçli değişiklikten sonra). Değişen senaryolar her zaman listelenir.
import fs from 'node:fs'
import { scenarioSet } from '../lib/sim/scenarios.ts'
import { runScenario, goldenOf } from '../lib/sim/run.ts'

const args = process.argv.slice(2)
const set = args.includes('full') ? 'full' : 'fast'
const update = args.includes('--update')
const reportAt = args.indexOf('--report')
const onlyAt = args.indexOf('--only')
const N = set === 'full' ? 4000 : 300
const goldenPath = `tests/sim/golden-${set}.json`

const t0 = Date.now()
let scenarios = scenarioSet(N, set === 'full' ? 'f' : 's')
if (onlyAt >= 0) scenarios = scenarios.filter((s) => s.id === args[onlyAt + 1])
const results = scenarios.map((s) => ({ s, r: runScenario(s, reportAt >= 0 || onlyAt >= 0) }))
const ms = Date.now() - t0

const errors = results.flatMap(({ r }) => r.findings.filter((f) => f.severity === 'error').map((f) => ({ id: r.id, ...f })))
const byCode = new Map()
for (const { r } of results) for (const f of r.findings) {
  const e = byCode.get(f.code) ?? { code: f.code, severity: f.severity, n: 0, examples: [] }
  e.n++; if (e.examples.length < 3) e.examples.push(`${r.id}: ${f.detail}`)
  byCode.set(f.code, e)
}

// altın dosya karşılaştırması
const now = Object.fromEntries(results.map(({ r }) => [r.id, goldenOf(r)]))
let changed = []
if (fs.existsSync(goldenPath) && onlyAt < 0) {
  const old = JSON.parse(fs.readFileSync(goldenPath, 'utf8'))
  for (const [id, v] of Object.entries(now)) if (old[id] !== v) changed.push({ id, old: old[id] ?? '(yeni)', now: v })
  for (const id of Object.keys(old)) if (!(id in now)) changed.push({ id, old: old[id], now: '(silindi)' })
}
if (update && onlyAt < 0) { fs.mkdirSync('tests/sim', { recursive: true }); fs.writeFileSync(goldenPath, JSON.stringify(now, null, 0).replace(/","/g, '",\n"') + '\n') }

const coop = results.filter(({ r }) => r.cooperative).length
console.log(`SİM ${set}: ${results.length} senaryo (${coop} iş birlikçi) · ${(ms / 1000).toFixed(1)} sn · ${results.reduce((a, { r }) => a + r.planDays, 0)} plan günü`)
for (const e of [...byCode.values()].sort((a, b) => (a.severity === b.severity ? b.n - a.n : a.severity === 'error' ? -1 : 1))) {
  console.log(`  ${e.severity === 'error' ? 'HATA' : 'uyarı'} ${e.code}: ${e.n} senaryo`)
  for (const x of e.examples) console.log(`      ${x}`)
}
if (changed.length) {
  console.log(`  ALTIN DOSYADAN FARKLI: ${changed.length} senaryo${update ? ' (güncellendi)' : ''}`)
  for (const c of changed.slice(0, 15)) console.log(`      ${c.id}: ${c.old} → ${c.now}`)
}
if (onlyAt >= 0 && results[0]) {
  const r = results[0].r
  console.log(JSON.stringify({ ...r, days: undefined }, null, 1))
  for (const d of r.days.filter((d) => d.i % 7 === 0 || d.checkin !== null)) console.log(`  gün ${d.i}: hedef ${d.target} yenen ${d.intake} kayıt ${d.logged ?? '-'} tartı ${d.weighed ?? '-'} trend ${d.trend ?? '-'} gerçek ${d.trueKg} yağ%${d.fatPct}${d.checkin !== null ? ` check-in ${d.checkin > 0 ? '+' : ''}${d.checkin}` : ''}`)
}
if (reportAt >= 0) fs.writeFileSync(args[reportAt + 1], report(results, [...byCode.values()], set, ms))

const fail = errors.length > 0 || (changed.length > 0 && !update)
console.log(fail ? `SİM BAŞARISIZ (${errors.length} hata, ${changed.length} değişen)` : 'SİM OK')
process.exit(fail ? 1 : 0)

function report(results, codes, set, ms) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  const rows = results.map(({ s, r }) => `<tr class="${r.findings.some((f) => f.severity === 'error') ? 'err' : r.findings.length ? 'warn' : ''}"><td>${esc(r.id)}</td><td>${s.sex === 'male' ? 'E' : 'K'} ${s.age}</td><td>${r.goal}</td><td>${r.startKg} → ${r.targetKg}</td><td>${r.planDays}</td><td>${s.adherence}${r.cooperative ? ' ✓' : ''}</td><td>${r.endTrend ?? '-'}</td><td>${r.reachedDay ?? '-'}</td><td>${r.leanChange} / ${r.fatChange}</td><td>${r.minTarget}–${r.maxTarget}</td><td>${r.checkins}</td><td>${esc(r.findings.map((f) => f.code).join(', '))}</td></tr>`).join('')
  return `<!doctype html><meta charset="utf-8"><title>DgFit simülasyon</title><style>body{font:13px system-ui;margin:16px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:3px 6px;text-align:left}tr.err{background:#fde2e2}tr.warn{background:#fff6dc}</style>
<h1>DgFit senaryo simülasyonu (${set})</h1><p>${results.length} senaryo · ${(ms / 1000).toFixed(1)} sn</p>
<h2>Bulgular</h2><ul>${codes.map((c) => `<li><b>${c.severity === 'error' ? 'HATA' : 'uyarı'} ${c.code}</b>: ${c.n} senaryo<br>${c.examples.map(esc).join('<br>')}</li>`).join('')}</ul>
<h2>Senaryolar</h2><table><tr><th>kimlik</th><th>kişi</th><th>hedef</th><th>kilo</th><th>gün</th><th>uyum</th><th>plan sonu trend</th><th>ulaşma günü</th><th>yağsız / yağ Δ</th><th>hedef kcal</th><th>check-in</th><th>bulgular</th></tr>${rows}</table>`
}
