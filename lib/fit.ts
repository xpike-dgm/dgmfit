// Fit motoru — kalori dengeleme, kalori bankası, adaptif harcama, tahmin. Saf ve testli (tests/fit.test.ts).
// Spesifikasyon 5.3 (dengeleme), 5.4 (adaptif TDEE), 5.5 (kilo trendi/tahmin).
import { KCAL_PER_KG } from './calc.ts'
import { recompDayKcal } from './body-comp.ts'

export const WINDOW_DAYS = 7
export const MAX_UNDER_CREDIT = 300 // eksik yenen günden en fazla bu kadar kalori sonraki günlere eklenir
export const INCOMPLETE_RATIO = 0.6 // hedefin %60'ından az kayıt = eksik kayıt sayılır
export const BALANCED_BAND = 50
export const CHECKIN_MAX_STEP = 150

/** Bir günün dengeleme yüzünden en fazla oynayabileceği miktar: tabanın %10'u ile 250 kcal'in küçüğü. */
export function dayCap(base: number): number {
  return Math.max(50, Math.min(Math.round(base * 0.1), 250))
}

export type ClosureKind = 'untracked' | 'incomplete' | 'balanced' | 'over' | 'under'

/**
 * Gün kapanışı: dağıtılacak fark. Hiç kayıt yoksa ya da kayıt hedefin %60'ının altındaysa
 * (büyük olasılıkla eksik kayıt) dengeleme yapılmaz. Az yenen günün yalnızca 300 kcal'i sonraki günlere eklenir.
 * diff > 0: fazla yendi (sonraki günlerden düşülür), diff < 0: az yendi (eklenir).
 */
export function closureDiff(i: { eaten: number; target: number; burned: number; items: number }): { kind: ClosureKind; diff: number; raw: number } {
  const budget = i.target + i.burned
  const raw = Math.round(i.eaten - budget)
  if (i.items === 0) return { kind: 'untracked', diff: 0, raw }
  if (i.eaten < budget * INCOMPLETE_RATIO) return { kind: 'incomplete', diff: 0, raw }
  if (Math.abs(raw) <= BALANCED_BAND) return { kind: 'balanced', diff: 0, raw }
  if (raw > 0) return { kind: 'over', diff: raw, raw }
  return { kind: 'under', diff: -Math.min(-raw, MAX_UNDER_CREDIT), raw }
}

export interface PlanDay { day: string; base: number; current: number; protected?: boolean }
export interface Adjustment { day: string; kcal: number }

/**
 * Farkı sonraki günlere dağıtır: yakın günler daha fazla pay alır (1,0 / 0,9 / 0,8 …), hiçbir gün
 * tavanı aşmaz, hedef kalori tabanının altına inmez. Sığmayan kısım `leftover` olarak döner.
 */
export function distributeDiff(diff: number, days: PlanDay[], floor: number): { adjustments: Adjustment[]; leftover: number } {
  const sign = diff > 0 ? -1 : 1
  let remaining = Math.abs(Math.round(diff))
  const alloc = days.map(() => 0)
  const weight = (i: number) => (days[i].protected ? 0 : Math.max(0.4, 1 - 0.1 * i))
  const capacity = (i: number) => {
    const d = days[i]
    const cap = dayCap(d.base)
    const used = sign * (d.current) // aynı yöndeki mevcut düzeltme kapasiteyi azaltır
    let c = cap - Math.max(0, used) - alloc[i]
    if (sign < 0) c = Math.min(c, d.base + d.current - alloc[i] - floor)
    return Math.max(0, c)
  }
  for (let pass = 0; pass < 20 && remaining > 0.5; pass++) {
    const open = days.map((_, i) => i).filter((i) => weight(i) > 0 && capacity(i) > 0.5)
    if (!open.length) break
    const wsum = open.reduce((a, i) => a + weight(i), 0)
    let given = 0
    for (const i of open) {
      const want = (remaining * weight(i)) / wsum
      const g = Math.min(want, capacity(i))
      alloc[i] += g
      given += g
    }
    remaining -= given
    if (given < 0.5) break
  }
  // tamsayıya yuvarla, toplamı koru (en büyük kalan yöntemi)
  const total = Math.round(Math.abs(diff) - Math.max(0, remaining))
  const floors = alloc.map(Math.floor)
  let rest = total - floors.reduce((a, b) => a + b, 0)
  const order = alloc.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r)
  for (const o of order) { if (rest <= 0) break; if (capacity(o.i) >= 0 && alloc[o.i] > 0) { floors[o.i]++; rest-- } }
  const adjustments = days.map((d, i) => ({ day: d.day, kcal: sign * floors[i] })).filter((a) => a.kcal !== 0)
  return { adjustments, leftover: Math.round(sign * -Math.max(0, Math.abs(diff) - total)) }
}

/** İstisna günü: dağıtmak yerine kalan fazla, hedef tarihe gün olarak eklenir (en fazla 3). */
export function exceptionDays(excessKcal: number, dailyDeficit: number): number {
  if (excessKcal <= 0 || dailyDeficit <= 0) return 0
  return Math.min(3, Math.ceil(excessKcal / dailyDeficit))
}

/**
 * Kalori bankası: etkinlik gününe ekstra kalori için, yarından etkinlikten önceki güne kadar (en fazla 5 gün)
 * her günden eşit miktar biriktirilir. Toplam sıfırdır.
 */
export function planBank(i: { today: string; eventDay: string; extra: number; days: PlanDay[]; floor: number }): { adjustments: Adjustment[]; perDay: number } | { error: string } {
  if (i.eventDay <= i.today) return { error: 'Etkinlik günü yarından sonra olmalı' }
  if (!(i.extra >= 100 && i.extra <= 1500)) return { error: 'Ekstra kalori 100–1500 arasında olmalı' }
  const save = i.days.filter((d) => d.day > i.today && d.day < i.eventDay).slice(-5)
  if (!save.length) return { error: 'Biriktirmek için en az 1 gün olmalı (etkinlik en erken yarından sonraki gün)' }
  const perDay = Math.ceil(i.extra / save.length)
  for (const d of save) {
    if (perDay > dayCap(d.base) - Math.max(0, -d.current)) return { error: `Günlük birikim ${perDay} kcal, ${dayCap(d.base)} kcal sınırını aşıyor. Daha az ekstra seç ya da etkinliği daha ileri bir güne koy.` }
    if (d.base + d.current - perDay < i.floor) return { error: 'Biriktirme günlerinde hedef kalori güvenli tabanın altına iner.' }
  }
  const adjustments = save.map((d) => ({ day: d.day, kcal: -perDay }))
  adjustments.push({ day: i.eventDay, kcal: perDay * save.length })
  return { adjustments, perDay }
}

/** Günlük hedef değişince protein sabit kalır; fark %60 karbonhidrat, %40 yağ olarak dağıtılır. */
export function scaleMacros(base: { kcal: number; protein: number; carb: number; fat: number }, kcal: number) {
  const d = kcal - base.kcal
  let carb = base.carb + (d * 0.6) / 4
  let fat = base.fat + (d * 0.4) / 9
  // karbonhidrat sıfırın altına inemiyorsa eksik kısım yağdan düşülür (makrolar toplamı hedefle tutarlı kalsın — simülasyon bulgusu)
  if (carb < 0) { fat += (carb * 4) / 9; carb = 0 }
  fat = Math.max(0, Math.round(fat))
  // karbonhidrat kalan kaloriden: yuvarlama hatası check-in'ler boyunca birikmez (simülasyon: 50 haftada ~90 kcal sapma)
  carb = Math.round((kcal - base.protein * 4 - fat * 9) / 4)
  if (carb < 0) { fat = Math.max(0, Math.round((kcal - base.protein * 4) / 9)); carb = 0 }
  return { kcal, protein: base.protein, carb, fat }
}

export interface TdeeDay { day: string; intake: number | null; kg: number | null }

/** En küçük kareler eğimi (kg/gün). */
function slopePerDay(pts: { day: string; kg: number }[]): number {
  const x0 = Date.parse(pts[0].day)
  const xs = pts.map((p) => (Date.parse(p.day) - x0) / 86400000)
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = pts.reduce((a, p) => a + p.kg, 0) / n
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  return sxx === 0 ? 0 : xs.reduce((a, x, i) => a + (x - mx) * (pts[i].kg - my), 0) / sxx
}

/**
 * Adaptif harcama: kaydı tam günlerin ortalama alımı − (kilo değişimi × 7.700 / gün).
 * Kilo değişimi tartılara uydurulan doğrusal eğimden gelir (üssel trendin uç noktaları gecikmeli olduğu için
 * harcamayı olduğundan düşük gösterir). En az 14 günlük aralık, 10 tam kayıtlı gün ve 5 tartı gerekir.
 */
export function adaptiveTdee(days: TdeeDay[]): { tdee: number | null; confidence: 'yok' | 'düşük' | 'orta' | 'yüksek'; loggedDays: number; spanDays: number; trendChange: number | null } {
  const weighed = days.filter((d) => d.kg !== null).map((d) => ({ day: d.day, kg: d.kg! }))
  const logged = days.filter((d) => d.intake !== null)
  const spanDays = weighed.length ? Math.round((Date.parse(weighed.at(-1)!.day) - Date.parse(weighed[0].day)) / 86400000) : 0
  if (spanDays < 14 || logged.length < 10 || weighed.length < 5) return { tdee: null, confidence: 'yok', loggedDays: logged.length, spanDays, trendChange: null }
  const avgIntake = logged.reduce((a, d) => a + d.intake!, 0) / logged.length
  const perDay = slopePerDay(weighed)
  const tdee = Math.round(avgIntake - perDay * KCAL_PER_KG)
  const ratio = logged.length / Math.max(1, spanDays)
  const confidence = spanDays >= 28 && ratio >= 0.8 && weighed.length >= 12 ? 'yüksek' : ratio >= 0.65 ? 'orta' : 'düşük'
  return { tdee, confidence, loggedDays: logged.length, spanDays, trendChange: Math.round(perDay * spanDays * 100) / 100 }
}

/** Son 21 günün trend kilosuna doğrusal eğim (kg/gün) ile hedef tarih tahmini; yön yanlışsa null. */
export function forecastDay(series: { day: string; kg: number }[], targetKg: number, today: string): { day: string | null; kgPerWeek: number | null } {
  const pts = series.filter((p) => p.day <= today).slice(-21)
  if (pts.length < 5) return { day: null, kgPerWeek: null }
  const x0 = Date.parse(pts[0].day)
  const xs = pts.map((p) => (Date.parse(p.day) - x0) / 86400000)
  const ys = pts.map((p) => p.kg)
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  if (sxx === 0) return { day: null, kgPerWeek: null }
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx
  const last = ys.at(-1)!
  const kgPerWeek = Math.round(slope * 7 * 100) / 100
  const need = targetKg - last
  if (Math.abs(need) < 0.05) return { day: today, kgPerWeek }
  if (slope === 0 || Math.sign(slope) !== Math.sign(need)) return { day: null, kgPerWeek }
  const daysLeft = Math.ceil(need / slope)
  if (daysLeft > 1500) return { day: null, kgPerWeek }
  const d = new Date(Date.parse(today + 'T12:00:00Z') + daysLeft * 86400000)
  return { day: d.toISOString().slice(0, 10), kgPerWeek }
}

/**
 * Haftalık check-in: ölçülen harcamaya ve kalan hedefe göre yeni günlük kalori. Bir check-in'de en fazla
 * ±150 kcal değişir ve kalori tabanının altına inmez.
 */
export function checkinProposal(i: { currentKcal: number; measuredTdee: number; trendKg: number; targetKg: number; daysLeft: number; floor: number; goal: 'lose' | 'gain' | 'recomp' }): { kcal: number; delta: number; reason: string } {
  let wanted: number
  if (i.goal === 'recomp') {
    // koruyup kas: bakım + hedef kiloya hafif çekim (kas kazanırken tartı yukarı kayarsa yağdan yakılır; ±250 kcal)
    wanted = Math.round(i.measuredTdee + Math.max(-250, Math.min(250, ((i.targetKg - i.trendKg) * KCAL_PER_KG) / 90)))
  } else if (i.daysLeft <= 0) wanted = Math.round(i.measuredTdee)
  else wanted = Math.round(i.measuredTdee + ((i.targetKg - i.trendKg) * KCAL_PER_KG) / i.daysLeft)
  // Faz 8: hedef yönünün tersine itilmez — kas/kilo almak isteyen hedefi aşsa bile bakımın altına, kilo veren bakımın üstüne çekilmez
  // (simülasyon: kas hedefli kullanıcıların %17'si hedefe ulaşınca açığa sokuluyordu). Sonraki adımı kullanıcı seçer.
  if (i.goal === 'gain') wanted = Math.max(wanted, Math.round(i.measuredTdee))
  if (i.goal === 'lose') wanted = Math.min(wanted, Math.round(i.measuredTdee))
  // ölü bant: 60 kcal'den küçük fark ölçüm gürültüsüdür, plan değişmez (hedef etrafında zikzak olmasın)
  if (Math.abs(wanted - i.currentKcal) < 60) wanted = i.currentKcal
  const clamped = Math.max(i.floor, Math.min(i.currentKcal + CHECKIN_MAX_STEP, Math.max(i.currentKcal - CHECKIN_MAX_STEP, wanted)))
  const kcal = Math.round(clamped / 5) * 5
  const delta = kcal - i.currentKcal
  const reason = Math.abs(delta) < 5 ? 'Planın ölçülen harcamanla uyumlu; değişiklik gerekmiyor.'
    : `Ölçülen harcaman ${i.measuredTdee.toLocaleString('tr-TR')} kcal. Hedef tarihe yetişmek için günlük hedef ${delta > 0 ? '+' : '−'}${Math.abs(delta)} kcal${Math.abs(wanted - i.currentKcal) > CHECKIN_MAX_STEP ? ' (haftalık en fazla 150 kcal değişir)' : ''}.`
  return { kcal, delta, reason }
}

/**
 * Kalori uyumu (hafta halkaları için): hedefin ±%10'u tam puan, dışına çıktıkça doğrusal azalır
 * (±%60'ta sıfır). Hiç kayıt yoksa 0.
 */
export function kcalAdherence(eaten: number, target: number): number {
  if (eaten <= 0 || target <= 0) return 0
  const off = Math.abs(eaten / target - 1)
  if (off <= 0.1) return 1
  return Math.max(0, Math.round((1 - (off - 0.1) * 2) * 100) / 100)
}

/** Gün kapanışında farkın dağıtılacağı pencere: yarından (geçmişe değil) en fazla 7 gün, hedef tarihi aşmadan. */
export function balanceWindow(day: string, today: string, endDate: string): { first: string; last: string } | null {
  const plus = (d: string, n: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
  const last = plus(day, WINDOW_DAYS) < endDate ? plus(day, WINDOW_DAYS) : endDate
  const first = plus(day, 1) > today ? plus(day, 1) : today
  return first <= last ? { first, last } : null
}

/** Gün başına son tartıdan üssel trend (α=0,15); tartı olmayan günler trendi taşır. */
export function trendSeries(byDay: Map<string, number>, from: string, to: string): { day: string; raw: number | null; trend: number | null }[] {
  const plus = (d: string) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10) }
  const first = [...byDay.keys()].sort()[0]
  const out: { day: string; raw: number | null; trend: number | null }[] = []
  let t: number | null = null
  const start = first && first < from ? first : from
  for (let d = start; d <= to; d = plus(d)) {
    const raw = byDay.get(d) ?? null
    if (raw !== null) t = t === null ? raw : t + 0.15 * (raw - t)
    if (d >= from) out.push({ day: d, raw, trend: t === null ? null : Math.round(t * 100) / 100 })
  }
  return out
}

export interface CheckinGoal { type: 'lose' | 'gain' | 'recomp'; startWeightKg: number; targetWeightKg: number; startDate: string; endDate: string; dailyKcal: number; /** son kullanılan harcama tahmini (kurulum formülü ya da önceki check-in) */ tdee?: number | null }

/**
 * Haftalık check-in hesabının saf hâli (veritabanı katmanı ve simülasyon aynısını kullanır).
 * `series`: son 28 gün (tartı + trend), `intakeBy`: kapanmış ve sayılan günlerin yenen kalorisi.
 */
export function checkinCompute(i: { goal: CheckinGoal; series: { day: string; raw: number | null; trend: number | null }[]; intakeBy: Map<string, number | null>; today: string; lastCheckin: string; floor: number }) {
  const days = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000)
  const tdee = adaptiveTdee(i.series.map((s) => ({ day: s.day, intake: i.intakeBy.get(s.day) ?? null, kg: s.raw })))
  const trendNow = i.series.filter((s) => s.trend !== null).at(-1)?.trend ?? i.goal.startWeightKg
  const forecast = forecastDay(i.series.filter((s) => s.trend !== null).map((s) => ({ day: s.day, kg: s.trend! })), i.goal.targetWeightKg, i.today)
  const due = days(i.lastCheckin, i.today) >= 7
  // Faz 8: ölçülen harcama haftadan haftaya ±100–200 kcal oynar; öncekiyle yarı yarıya karıştırılır (zikzak olmasın)
  const smooth = tdee.tdee && i.goal.tdee ? Math.round((tdee.tdee + i.goal.tdee) / 2) : tdee.tdee
  const proposal = smooth ? checkinProposal({ currentKcal: i.goal.dailyKcal, measuredTdee: smooth, trendKg: trendNow, targetKg: i.goal.targetWeightKg, daysLeft: days(i.today, i.goal.endDate), floor: i.floor, goal: i.goal.type }) : null
  return { tdee, smoothTdee: smooth, trendNow, forecast, due, proposal }
}

/**
 * Günün etkin kalori hedefi: plan tabanı + dengeleme düzeltmesi, güvenli tabanın altına inmez.
 * (Check-in tabanı düşürdüğünde önceden yazılmış eksi düzeltmeler hedefi tabanın altına itebiliyordu — simülasyon bulgusu.)
 */
export function targetKcal(base: number, adjustment: number, floor: number): number {
  return Math.max(Math.min(base, floor), base + adjustment)
}

/**
 * Faz 8: hedefe ulaşıp "kilomu koruyup kas kazanmak" seçilince yeni aşama: hedef tarih aynı kalır (14 günden azsa 90 gün),
 * kalori ölçülen/son harcama (bakım), güvenli tabanın altına inmez.
 */
export function goalAfterReach(i: { endDate: string; today: string; tdee: number; floor: number }): { endDate: string; kcal: number } {
  const plus = (d: string, n: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
  const endDate = i.endDate > plus(i.today, 13) ? i.endDate : plus(i.today, 89)
  return { endDate, kcal: Math.max(i.floor, Math.round(i.tdee / 5) * 5) }
}

/**
 * Faz 8: hedef tarih geldi ama hedefe ulaşılmadı → "süreyi uzat": kalan farkı planın haftalık temposuyla bitirecek
 * yeni tarih (en az 14, en çok 365 gün).
 */
export function extendEndDate(i: { trendKg: number; targetKg: number; weeklyKg: number; today: string }): string {
  const plus = (d: string, n: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
  const rate = Math.max(0.1, i.weeklyKg)
  const days = Math.ceil((Math.abs(i.targetKg - i.trendKg) / rate) * 7)
  return plus(i.today, Math.max(14, Math.min(365, days)))
}

/** Haftalık antrenman günü sayısından varsayılan günler (0 = Pazar). Karb döngüsü günleri seçiliyse onlar kullanılır. */
export function trainingWeekdays(n: number | null | undefined, custom?: number[] | null): number[] {
  if (custom?.length) return custom
  const map: Record<number, number[]> = { 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] }
  return map[Math.max(1, Math.min(7, n ?? 3))]
}

/**
 * Günün plan tabanı. Koruyup kas kazanma (recomp) hedefinde antrenman günü fazla, dinlenme günü az kalori
 * (haftalık ortalama plan kalorisi); diğer hedeflerde her gün aynı.
 */
export function dayBaseKcal(goalType: string, dailyKcal: number, weekday: number, weekdays: number[], floor: number): number {
  if (goalType !== 'recomp' || !weekdays.length || weekdays.length >= 7) return dailyKcal
  // dinlenme günü güvenli tabanın altına inmez (simülasyon bulgusu: tabandaki kullanıcıda 1165 < 1200)
  return Math.max(Math.min(dailyKcal, floor), recompDayKcal(dailyKcal, weekdays.includes(weekday), weekdays.length))
}

/** Uzatma temposu: son haftalarda hedef yönünde gerçekten ilerliyorsa o hız (gerçekçi), yoksa planın temposu. */
export function extensionRate(observedKgPerWeek: number | null, plannedKgPerWeek: number, needKg: number): number {
  if (observedKgPerWeek !== null && Math.sign(observedKgPerWeek) === Math.sign(needKg) && Math.abs(observedKgPerWeek) >= 0.1) return Math.min(Math.abs(observedKgPerWeek), Math.max(0.1, plannedKgPerWeek) * 1.5)
  return Math.max(0.1, plannedKgPerWeek)
}

/**
 * Faz 7-2: haftalık tek karar — kalori dışında kardiyo ve antrenman sayısı önerisi (check-in ekranında).
 * Kalori değişikliğini checkinProposal yapar; bu fonksiyon onun yetmediği yerleri söyler.
 */
export function planAdvice(i: {
  goal: 'lose' | 'gain' | 'recomp'; weeklyKg: number | null; plannedWeeklyKg: number; atFloor: boolean
  cardioMinWeek: number; workoutsWeek: number; targetTrainDays: number | null
}): string[] {
  const out: string[] = []
  const w = i.weeklyKg
  if (i.goal === 'lose' && w !== null) {
    if (w > 0.15) out.push('Son haftalarda kilon artıyor. Kayıtların eksik olabilir (atıştırmalar, içecekler, yağ); birkaç gün her şeyi tartarak kaydetmeyi dene.')
    else if (i.atFloor && Math.abs(w) < i.plannedWeeklyKg * 0.6) out.push(`Kalori güvenli tabanda ve tempo planın gerisinde. Kaloriyi daha düşürmek yerine haftaya ${i.cardioMinWeek < 90 ? '90–150' : '60'} dk tempolu yürüyüş ya da kardiyo ekle (yaklaşık ${i.cardioMinWeek < 90 ? '400–700' : '300'} kcal).`)
  }
  if (i.goal === 'gain' && w !== null && w < 0.05 && i.workoutsWeek < 3) out.push(`Bu hafta ${i.workoutsWeek} ağırlık antrenmanı yaptın. Kas kazanımı için haftada en az 3 antrenman gerekli; fazla kalori tek başına kas yapmaz.`)
  if (i.goal === 'recomp' && i.workoutsWeek < 3) out.push(`Kilonu koruyup kas kazanmak için haftada en az 3 ağırlık antrenmanı gerekli (bu hafta ${i.workoutsWeek}).`)
  if (i.targetTrainDays && i.workoutsWeek < i.targetTrainDays - 1 && i.goal !== 'lose') out.push(`Hedefin haftada ${i.targetTrainDays} antrenman; bu hafta ${i.workoutsWeek}.`)
  if (i.goal === 'lose' && i.workoutsWeek === 0) out.push('Kilo verirken haftada 2–3 ağırlık antrenmanı kas kaybını önler; kaybın yağdan gelmesini sağlar.')
  return out
}
