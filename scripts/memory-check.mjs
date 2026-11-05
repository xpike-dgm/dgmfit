#!/usr/bin/env node
// Hafıza ↔ kod doğrulaması. memory/manifest.json'daki her iddiayı gerçek koda karşı kontrol eder.
// İki yönlü: hafızada olup kodda olmayan VE kodda olup hafızada olmayan her şey hata sayılır.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const rel = (p) => path.join(root, p)
const m = JSON.parse(fs.readFileSync(rel('memory/manifest.json'), 'utf8'))
const errors = []
const ok = []

const diff = (label, claimed, actual) => {
  const c = new Set(claimed), a = new Set(actual)
  const missing = [...c].filter((x) => !a.has(x))
  const undocumented = [...a].filter((x) => !c.has(x))
  if (missing.length) errors.push(`${label}: hafızada var, kodda YOK → ${missing.join(', ')}`)
  if (undocumented.length) errors.push(`${label}: kodda var, hafızada YOK → ${undocumented.join(', ')}`)
  if (!missing.length && !undocumented.length) ok.push(`${label}: ${a.size} öğe uyuşuyor`)
}

// 1) Dosyalar
const missingFiles = m.files.filter((f) => !fs.existsSync(rel(f)))
if (missingFiles.length) errors.push('Dosyalar: yok → ' + missingFiles.join(', '))
else ok.push(`Dosyalar: ${m.files.length} dosya mevcut`)

// 2) Tablolar
const schema = fs.readFileSync(rel('lib/db/schema.ts'), 'utf8')
diff('Tablolar', m.tables, [...schema.matchAll(/pgTable\('([a-z_]+)'/g)].map((x) => x[1]))

// 3) Rotalar (route group klasörleri "(...)" URL'ye girmez)
const routes = []
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name === 'page.tsx' || e.name === 'route.ts' || e.name === 'route.tsx') {
      const segs = path.relative(rel('app'), dir).split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s))
      routes.push('/' + segs.join('/'))
    }
  }
}
walk(rel('app'))
diff('Rotalar', m.routes, routes)

// 4) Olay türleri
const ev = fs.readFileSync(rel('lib/events.ts'), 'utf8')
const union = ev.match(/export type EventType =([\s\S]*?)\n\n/)
diff('Olaylar', m.events, union ? [...union[1].matchAll(/'([a-z.]+)'/g)].map((x) => x[1]) : [])

// 5) Export'lar
for (const [file, names] of Object.entries(m.exports)) {
  const src = fs.readFileSync(rel(file), 'utf8')
  const miss = names.filter((n) => !new RegExp(`export\\s+(async\\s+)?(function|const|let|class)\\s+${n}\\b`).test(src))
  if (miss.length) errors.push(`Export ${file}: yok → ${miss.join(', ')}`)
  else ok.push(`Export ${file}: ${names.length} uyuşuyor`)
}

// 6) Bağımlılık ana sürümleri (kurulu paketten)
for (const [pkg, major] of Object.entries(m.dependencies)) {
  try {
    const v = JSON.parse(fs.readFileSync(rel(`node_modules/${pkg}/package.json`), 'utf8')).version
    if (!(v === major || v.startsWith(major + '.'))) errors.push(`Bağımlılık ${pkg}: hafıza ${major}.x, kurulu ${v}`)
    else ok.push(`Bağımlılık ${pkg}@${v}`)
  } catch { errors.push(`Bağımlılık ${pkg}: kurulu değil (npm ci?)`) }
}

// 7) Migration'lar
diff('Migration', m.migrations, fs.readdirSync(rel('drizzle')).filter((f) => f.endsWith('.sql')))

// 8) Hafızada geçen commit hash'leri git'te var mı?
for (const f of ['memory/STATE.md', 'memory/LOG.md']) {
  if (!fs.existsSync(rel(f))) continue
  const hashes = [...new Set([...fs.readFileSync(rel(f), 'utf8').matchAll(/`([0-9a-f]{7,40})`/g)].map((x) => x[1]))]
  const bad = hashes.filter((h) => { try { execSync(`git cat-file -e ${h}^{commit}`, { cwd: root, stdio: 'ignore' }); return false } catch { return true } })
  if (bad.length) errors.push(`${f}: git'te olmayan commit → ${bad.join(', ')}`)
  else ok.push(`${f}: ${hashes.length} commit referansı doğrulandı`)
}

for (const l of ok) console.log('  ✓ ' + l)
for (const l of errors) console.log('  ✗ ' + l)
if (errors.length) { console.log(`\nHAFIZA KONTROLÜ BAŞARISIZ (${errors.length} hata). Önce hafızayı koda göre düzelt.`); process.exit(1) }
console.log('\nHafıza kontrolü geçti.')
