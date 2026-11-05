// Haftalık rapor ve koç bağlamı için gün özetleri — saf, testli (tests/coach.test.ts).
// Tüm sayılar burada hesaplanır; dil modeli yalnızca bu sayıları yorumlar (spesifikasyon 10, 5.6).
import { BALANCED_BAND, kcalAdherence } from './fit.ts'

/** Bir günün tüm modüllerden özeti (sunucuda doldurulur). */
export interface DayFacts {
  day: string // YYYY-MM-DD
  target: number // düzeltilmiş kalori hedefi
  eaten: number
  items: number // öğün kalemi sayısı
  protein: number
  proteinTarget: number
  burned: number // egzersiz net kcal (güç + kardiyo)
  waterMl: number // etkili ml
  waterGoal: number
  workouts: number // güç antrenmanı
  cardioMin: number
  volumeKg: number
}

export const WEEKDAY = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
export const dow = (day: string) => new Date(day + 'T12:00:00Z').getUTCDay()
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const r0 = (n: number) => Math.round(n)
const r1 = (n: number) => Math.round(n * 10) / 10

/** Kayıtlı gün: en az 1 öğün kalemi ve hedefin %30'undan fazla (yarım kalmış kayıt ortalamayı bozmasın). */
export const isLogged = (d: DayFacts) => d.items > 0 && d.eaten >= d.target * 0.3

/** Tartılar üzerinde üssel trend (α=0.15, Bugün ekranıyla aynı); her tartı gününde trend değeri. */
export function trendSeries(weights: { day: string; kg: number }[], alpha = 0.15): { day: string; trend: number }[] {
  const s = [...weights].sort((a, b) => (a.day < b.day ? -1 : 1))
  const out: { day: string; trend: number }[] = []
  let t: number | null = null
  for (const w of s) { t = t === null ? w.kg : t + alpha * (w.kg - t); out.push({ day: w.day, trend: Math.round(t * 100) / 100 }) }
  return out
}

export interface WeekStats {
  from: string
  to: string
  loggedDays: number
  avgKcal: number | null
  avgTarget: number | null
  adherencePct: number | null // kayıtlı günlerde kcalAdherence ortalaması
  proteinPct: number | null
  hardest: { day: string; weekday: string; over: number }[] // hedefi en çok aşılan en fazla 2 gün
  weekendDiff: number | null // hafta sonu ort. − hafta içi ort. (kcal)
  weightChange: number | null // trend kg (hafta sonu − hafta öncesi)
  weightLast: number | null
  waterAvg: number | null
  waterGoalDays: number
  waterDays: number
  workouts: number
  cardioMin: number
  volumeKg: number
  burned: number
  prs: number
}

/**
 * Haftalık istatistik. `days` haftanın günleri (en fazla 7, eskiden yeniye); `weights` hafta öncesini de içeren tartılar
 * (trend için en az 2–3 hafta geriye). Kilo değişimi: hafta içindeki son tartının trendi − hafta başlamadan önceki son trend.
 */
export function weekStats(days: DayFacts[], weights: { day: string; kg: number }[], prs = 0): WeekStats {
  const from = days[0]?.day ?? '', to = days.at(-1)?.day ?? ''
  const logged = days.filter(isLogged)
  const hardest = logged.map((d) => ({ day: d.day, weekday: WEEKDAY[dow(d.day)], over: r0(d.eaten - d.target) }))
    .filter((h) => h.over > BALANCED_BAND).sort((a, b) => b.over - a.over).slice(0, 2)
  const we = logged.filter((d) => [0, 6].includes(dow(d.day))), wd = logged.filter((d) => ![0, 6].includes(dow(d.day)))
  const tr = trendSeries(weights)
  const before = tr.filter((t) => t.day < from).at(-1), inWeek = tr.filter((t) => t.day >= from && t.day <= to).at(-1)
  const waterDays = days.filter((d) => d.waterMl > 0)
  const pDays = logged.filter((d) => d.proteinTarget > 0)
  return {
    from, to,
    loggedDays: logged.length,
    avgKcal: logged.length ? r0(avg(logged.map((d) => d.eaten))) : null,
    avgTarget: logged.length ? r0(avg(logged.map((d) => d.target))) : null,
    adherencePct: logged.length ? r0(avg(logged.map((d) => kcalAdherence(d.eaten, d.target))) * 100) : null,
    proteinPct: pDays.length ? r0(avg(pDays.map((d) => Math.min(1.5, d.protein / d.proteinTarget))) * 100) : null,
    hardest,
    weekendDiff: we.length >= 1 && wd.length >= 2 ? r0(avg(we.map((d) => d.eaten)) - avg(wd.map((d) => d.eaten))) : null,
    weightChange: before && inWeek ? r1(inWeek.trend - before.trend) : null,
    weightLast: inWeek ? r1(inWeek.trend) : null,
    waterAvg: waterDays.length ? r0(avg(waterDays.map((d) => d.waterMl))) : null,
    waterGoalDays: days.filter((d) => d.waterGoal > 0 && d.waterMl >= d.waterGoal).length,
    waterDays: waterDays.length,
    workouts: days.reduce((a, d) => a + d.workouts, 0),
    cardioMin: r0(days.reduce((a, d) => a + d.cardioMin, 0)),
    volumeKg: r0(days.reduce((a, d) => a + d.volumeKg, 0)),
    burned: r0(days.reduce((a, d) => a + d.burned, 0)),
    prs,
  }
}

/** AI yokken ya da yanıtı reddedildiğinde kullanılan kural tabanlı öneriler (en fazla 3). */
export function ruleSuggestions(s: WeekStats, goal: 'lose' | 'gain' | 'recomp'): string[] {
  const out: string[] = []
  if (s.loggedDays < 4) out.push(`Bu hafta ${s.loggedDays} gün tam kayıt var; yorumların güvenilir olması için en az 5 gün kaydetmeyi dene.`)
  if (s.weekendDiff !== null && s.weekendDiff >= 300) out.push(`Hafta sonları hafta içine göre ortalama ${s.weekendDiff} kcal fazla. Cumartesi için önceden plan yapmak ya da kalori bankasını kullanmak işe yarayabilir.`)
  if (s.proteinPct !== null && s.proteinPct < 80) out.push(`Protein hedefinin ortalama %${s.proteinPct}'ine ulaştın. Her öğüne bir protein kaynağı eklemek kolay bir adım.`)
  if (s.waterDays >= 3 && s.waterGoalDays <= 2) out.push(`Su hedefi 7 günün ${s.waterGoalDays} gününde tamamlandı. Öğleden sonraya bir hatırlatma eklemeyi düşün.`)
  if (goal !== 'recomp' && s.weightChange !== null && ((goal === 'lose' && s.weightChange > 0.2) || (goal === 'gain' && s.weightChange < -0.2)))
    out.push(`Trend kilo bu hafta ${s.weightChange > 0 ? '+' : ''}${String(s.weightChange).replace('.', ',')} kg. Tek haftalık dalgalanma normal; iki hafta sürerse Fit check-in'i hedefini günceller.`)
  if (s.workouts === 0 && s.cardioMin < 30) out.push('Bu hafta antrenman kaydı yok. Kısa bir tam vücut seansı bile haftayı canlandırır.')
  if (!out.length) out.push('Hafta dengeli geçti. Aynı düzeni sürdürmek en iyi plan.')
  return out.slice(0, 3)
}

/** Dil modelinin metnindeki sayıların izinli sayılardan geldiğini doğrular (uydurma sayı → kural metnine dönülür). */
export function numbersAllowed(text: string, allowed: number[]): boolean {
  const ok = new Set<string>()
  for (const n of allowed) {
    for (const v of [n, Math.abs(n)]) { ok.add(String(Math.round(v))); ok.add(String(Math.round(v * 10) / 10).replace('.', ',')); ok.add(String(Math.round(v * 10) / 10)) }
  }
  // 1–7 arası gün/hafta sayıları ve yaygın küçük sayılar serbest
  for (let i = 0; i <= 7; i++) ok.add(String(i))
  const found = text.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').match(/\d+(?:[.,]\d+)?/g) ?? []
  return found.every((f) => ok.has(f) || ok.has(f.replace(',', '.')))
}
