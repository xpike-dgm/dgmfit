// data/exercises-src.json (free-exercise-db, Unlicense) + data/exercises-tr.json → data/exercises-seed.json.gz
// Kullanım: node --experimental-strip-types scripts/data/build_exercises.mjs
import fs from 'node:fs'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { normalizeSearch } from '../../lib/nutrition.ts'

const src = JSON.parse(fs.readFileSync('data/exercises-src.json', 'utf8'))
const tr = JSON.parse(fs.readFileSync('data/exercises-tr.json', 'utf8'))
const errors = []
const byName = new Map(src.map((x) => [x.name, x]))
for (const k of Object.keys(tr.curated)) if (!byName.has(k)) errors.push(`curated adı kaynakta yok: ${k}`)

const gloss = [...tr.glossary].sort((a, b) => b[0].length - a[0].length)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function autoName(en) {
  let s = en.replace(/\s+-\s+/g, ' – ')
  for (const [a, b] of gloss) s = s.replace(new RegExp(`(?<![A-Za-z])${esc(a)}(?![A-Za-z])`, 'gi'), b)
  s = s.replace(/\s+/g, ' ').trim()
  // Türkçe yazım: yalnızca ilk harf büyük; kaynaktaki kısaltmalar (EZ, TRX, SMR) ve Smith korunur
  s = s.split(' ').map((w) => (/^[A-Z0-9-]{2,4}$/.test(w) || w === 'Smith' ? w : w.toLocaleLowerCase('tr-TR'))).join(' ')
  return s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1)
}

const PUSH = new Set(['chest', 'shoulders', 'triceps'])
const PULL = new Set(['lats', 'middle back', 'biceps', 'traps', 'forearms', 'neck', 'lower back'])
const LEGS = new Set(['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'])
function kindOf(x) {
  if (x.category === 'cardio') return 'distance_time'
  if (x.category === 'stretching') return 'time'
  if (/plank|hold|wall sit|isometric|static/i.test(x.name)) return 'time'
  if (/assisted/i.test(x.name)) return 'assisted'
  if (!x.equipment || x.equipment === 'body only') return 'bodyweight'
  return 'weight_reps'
}
function patternOf(x) {
  if (x.category === 'cardio') return 'cardio'
  const m = x.primaryMuscles[0]
  if (m === 'abdominals') return 'core'
  if (PUSH.has(m)) return 'push'
  if (PULL.has(m)) return 'pull'
  if (LEGS.has(m)) return 'legs'
  return 'other'
}

const items = []
const seen = new Set()
for (const x of src) {
  if (seen.has(x.id)) { errors.push('yinelenen id: ' + x.id); continue }
  seen.add(x.id)
  for (const m of [...x.primaryMuscles, ...x.secondaryMuscles]) if (!tr.muscles[m]) errors.push(`kas çevirisi yok: ${m} (${x.id})`)
  if (x.equipment && !tr.equipment[x.equipment]) errors.push(`ekipman çevirisi yok: ${x.equipment}`)
  if (!tr.category[x.category]) errors.push(`kategori çevirisi yok: ${x.category}`)
  const c = tr.curated[x.name]
  const nameTr = c?.name ?? autoName(x.name)
  const aliases = c?.aliases ?? []
  items.push({
    key: x.id, nameEn: x.name, nameTr, aliases, category: x.category, equipment: x.equipment ?? 'body only', level: x.level,
    force: x.force ?? null, mechanic: x.mechanic ?? null, primary: x.primaryMuscles, secondary: x.secondaryMuscles,
    kind: kindOf(x), pattern: patternOf(x), images: x.images, steps: c?.steps ?? [], mistakes: c?.mistakes ?? [], curated: !!c,
    search: normalizeSearch([nameTr, x.name, ...aliases].join(' ')),
  })
}
if (errors.length) { console.error('HATALAR:\n' + errors.join('\n')); process.exit(1) }
const body = JSON.stringify(items)
const version = crypto.createHash('sha256').update(body).digest('hex').slice(0, 12)
fs.writeFileSync('data/exercises-seed.json.gz', zlib.gzipSync(JSON.stringify({ version, items })))
const curatedN = items.filter((i) => i.curated).length
console.log(`hareket: ${items.length}, küratörlü: ${curatedN}, sürüm ${version}`)
console.log('tür dağılımı:', JSON.stringify(Object.entries(items.reduce((a, i) => ((a[i.kind] = (a[i.kind] ?? 0) + 1), a), {}))))
console.log('örnek otomatik adlar:', items.filter((i) => !i.curated).slice(0, 12).map((i) => `${i.nameEn} → ${i.nameTr}`).join(' | '))
