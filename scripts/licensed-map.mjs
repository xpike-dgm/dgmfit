// Lisanslı içerik paketi (Ağırsağlam, DgFit'e özel izin: memory/DECISIONS.md) → DgFit hareket satırları.
// Saf eşleme kuralları; hem migrate.mjs (sunucuda içe aktarma) hem birim testler kullanır. İçeriğin kendisi depoda DEĞİL.

/** Ağırsağlam kas anahtarı → DgFit (free-exercise-db) kas adı. Kalça bükücüler karşılığı olmadığı için yalnızca puan olarak tutulur. */
export const AG_MUSCLE = {
  abs: 'abdominals', obliques: 'abdominals', biceps: 'biceps', forearms: 'forearms', tricepsLong: 'triceps', tricepsLateral: 'triceps',
  anteriorDeltoid: 'shoulders', middleDeltoid: 'shoulders', posteriorDeltoid: 'shoulders', rotatorCuff: 'shoulders',
  pectoralisClavicular: 'chest', pectoralisSternal: 'chest', lats: 'lats', upperTraps: 'traps', lowerTraps: 'middle back',
  spinalErectors: 'lower back', glutes: 'glutes', quads: 'quadriceps', hams: 'hamstrings', adductors: 'adductors', calves: 'calves',
  hipFlexors: null, neckFlexors: 'neck',
}
export const AG_EQUIPMENT = {
  bodyWeight: 'body only', dumbbell: 'dumbbell', barbell: 'barbell', cable: 'cable', machine: 'machine', band: 'bands', pullUpBar: 'body only',
  smithMachine: 'machine', kettlebell: 'kettlebells', specialtyBarbell: 'barbell', ezBar: 'e-z curl bar', medicineBall: 'medicine ball',
}
export const AG_LEVEL = { beginner: 'beginner', experienced: 'intermediate', advanced: 'expert' }
const PUSH = new Set(['chest', 'shoulders', 'triceps'])
const PULL = new Set(['lats', 'middle back', 'biceps', 'traps', 'forearms', 'neck', 'lower back'])
const LEGS = new Set(['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'])

export function normalizeSearch(s) {
  return s.toLocaleLowerCase('tr-TR').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[âà]/g, 'a').replace(/[îì]/g, 'i').replace(/[ûù]/g, 'u').replace(/[^a-z0-9%]+/g, ' ').trim()
}
const tight = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
/** Gevşek ad: "- Medium Grip", "the/with", çoğul eki ve tire farkları yok sayılır. */
export function looseName(s) {
  let t = s.toLowerCase().replace(/\s*-\s*(medium|wide|close)\s*grip/g, '').replace(/\b(the|with)\b/g, '').replace(/dumbbells/g, 'dumbbell').replace(/ups\b/g, 'up').replace(/-/g, ' ')
  return tight(t)
}

/** Kütüphanedeki hareketlerle ad eşleşmesi: önce birebir, sonra gevşek. Dönen: eşleşen key ya da null. */
export function buildMatcher(rows) {
  const exact = new Map(), loose = new Map()
  for (const r of rows) { if (!exact.has(tight(r.name))) exact.set(tight(r.name), r.key); if (!loose.has(looseName(r.name))) loose.set(looseName(r.name), r.key) }
  return (name) => exact.get(tight(name)) ?? loose.get(looseName(name)) ?? null
}

/** Açıklama gerçek mi? Deneme/boş metinler gösterilmez. */
export function cleanDesc(s) {
  const t = (s ?? '').trim()
  if (t.length < 25 || /^(test|deneme|lorem)\b/i.test(t) || /(test ){2,}/i.test(t)) return ''
  return t
}

export const videoFile = (url) => {
  const m = /\/([A-Za-z0-9_.-]+\.mp4)$/.exec(url ?? '')
  return m ? m[1] : null
}

/** Ağırsağlam hareketi → DgFit satırı + lisanslı ek veri. */
export function agToExercise(x) {
  const name = String(x.parameters?.name ?? x.document_id ?? '').trim()
  const ratings = Object.fromEntries((x.musclesTrains ?? []).filter((m) => m && m.muscleGroup && m.rating > 0).map((m) => [m.muscleGroup, Number(m.rating)]))
  const mapped = Object.entries(ratings).map(([k, r]) => [AG_MUSCLE[k] ?? null, r]).filter(([m]) => m)
  const best = new Map()
  for (const [m, r] of mapped) best.set(m, Math.max(best.get(m) ?? 0, r))
  const sorted = [...best.entries()].sort((a, b) => b[1] - a[1])
  let primary = sorted.filter(([, r]) => r >= 7).map(([m]) => m)
  if (!primary.length && sorted.length) primary = [sorted[0][0]]
  const secondary = sorted.filter(([m, r]) => r >= 4 && !primary.includes(m)).map(([m]) => m)
  const equipment = AG_EQUIPMENT[x.equipment] ?? 'other'
  const kind = /\b(hold|isometric|plank|wall sit|hang)\b/i.test(name) ? 'time'
    : /\bassisted\b/i.test(name) ? 'assisted'
    : ['bodyWeight', 'pullUpBar', 'band'].includes(x.equipment) ? 'bodyweight' : 'weight_reps'
  const m0 = primary[0]
  const pattern = m0 === 'abdominals' ? 'core' : PUSH.has(m0) ? 'push' : PULL.has(m0) ? 'pull' : LEGS.has(m0) ? 'legs' : 'other'
  const strong = sorted.filter(([, r]) => r >= 6).length
  return {
    key: `ag-${x.id}`, name, nameEn: name, equipment, level: AG_LEVEL[x.level] ?? null, primary, secondary, kind, pattern,
    mechanic: strong >= 2 ? 'compound' : 'isolation', category: 'strength', search: normalizeSearch(name),
    licensed: {
      src: 'agirsaglam', id: x.id, muscles: ratings, cns: typeof x.cnsFatingScore === 'number' ? x.cnsFatingScore : null,
      features: Array.isArray(x.specialFeature) ? x.specialFeature : [],
      video: { right: videoFile(x.rightVideo), wrong: videoFile(x.wrongVideo) },
      desc: { tr: cleanDesc(x.descriptions?.tr), en: cleanDesc(x.descriptions?.en) },
    },
  }
}
