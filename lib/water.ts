// Su modülü hesap motoru — saf fonksiyonlar, test edilir (tests/water.test.ts).
// Zamanlar "gün içi dakika" (0–1439, Europe/Istanbul) olarak işlenir.

export type DrinkId = 'water' | 'mineral' | 'tea' | 'coffee' | 'ayran' | 'juice' | 'other'

export const DRINKS: Record<DrinkId, { label: string; hydration: number; color: string }> = {
  water: { label: 'Su', hydration: 1, color: 'var(--color-water)' },
  mineral: { label: 'Maden suyu', hydration: 1, color: '#8FD8FF' },
  tea: { label: 'Çay', hydration: 0.9, color: '#E8A465' },
  coffee: { label: 'Kahve', hydration: 0.8, color: '#C08A5B' },
  ayran: { label: 'Ayran', hydration: 0.9, color: '#E9EEF2' },
  juice: { label: 'Meyve suyu', hydration: 0.85, color: '#FFB45C' },
  other: { label: 'Diğer', hydration: 0.8, color: '#A3A99B' },
}

export const DEFAULT_BUTTONS = [50, 100, 150, 200, 250, 500]
export const DEFAULT_SIP_ML = 25
export const DUPLICATE_WINDOW_MIN = 2
export const MAX_ML_PER_HOUR = 1000 // aşırı tüketim uyarı eşiği

export function effectiveMl(ml: number, drink: DrinkId): number {
  return Math.round(ml * (DRINKS[drink]?.hydration ?? 1))
}

export function parseHm(hm: string | null | undefined, fallback: number): number {
  if (!hm || !/^\d{2}:\d{2}$/.test(hm)) return fallback
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

export function fmtHm(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`
}

/** Uyku saati gece yarısını geçiyorsa (örn. 00:30) ertesi güne taşır. */
export function awakeWindow(wake: number, sleep: number): [number, number] {
  return sleep <= wake ? [wake, sleep + 1440] : [wake, sleep]
}

/**
 * İdeal eğri: suyun uyanıştan uykudan 1 saat öncesine kadar doğrusal dağılması.
 * Döndürdüğü değer, verilen dakikada içilmiş olması beklenen ml.
 */
export function idealAt(goal: number, wake: number, sleep: number, at: number): number {
  const [w, s0] = awakeWindow(wake, sleep)
  const s = Math.max(w + 60, s0 - 60)
  const t = at < w && s0 > 1440 ? at + 1440 : at
  if (t <= w) return 0
  if (t >= s) return goal
  return Math.round((goal * (t - w)) / (s - w))
}

export interface DayLog { at: number; ml: number } // at = gün içi dakika, ml = efektif

export function cumulativeAt(logs: DayLog[], at: number): number {
  let s = 0
  for (const l of logs) if (l.at <= at) s += l.ml
  return s
}

/** Uyanıştan bu yana saat başına ml. */
export function pacePerHour(total: number, wake: number, now: number): number {
  const h = (now - wake) / 60
  return h > 0.25 ? Math.round(total / h) : 0
}

export interface Prediction {
  endTotal: number
  goalAt: number | null // gün içi dakika; hedefe ulaşılamayacaksa null
  confidence: 'düşük' | 'orta' | 'yüksek'
  basis: 'geçmiş' | 'tempo'
  /** Geçmiş günlere göre şu saatteki fark (+ önde, − geride); geçmiş yoksa null */
  vsHistory: number | null
}

/**
 * Gün sonu tahmini. Yeterli geçmiş varsa: bugünkü toplam + geçmiş günlerde bu saatten
 * sonra içilen ortalama miktar. Yoksa: mevcut tempo × kalan uyanık süre × 0,8.
 */
export function predict(today: DayLog[], past: DayLog[][], goal: number, wake: number, sleep: number, now: number): Prediction {
  const total = cumulativeAt(today, now)
  const [, s] = awakeWindow(wake, sleep)
  const usable = past.filter((d) => d.length > 0)
  const confidence = usable.length >= 21 ? 'yüksek' : usable.length >= 7 ? 'orta' : 'düşük'
  let endTotal: number
  let basis: Prediction['basis']
  let vsHistory: number | null = null
  let profile: (t: number) => number

  if (usable.length >= 3) {
    const after = usable.map((d) => d.reduce((a, l) => a + l.ml, 0) - cumulativeAt(d, now))
    const avgAfter = after.reduce((a, b) => a + b, 0) / after.length
    const avgAt = usable.reduce((a, d) => a + cumulativeAt(d, now), 0) / usable.length
    vsHistory = Math.round(total - avgAt)
    endTotal = Math.round(total + Math.max(0, avgAfter))
    basis = 'geçmiş'
    // ortalama gün profilinin bu saatten sonraki birikimi
    profile = (t: number) => total + usable.reduce((a, d) => a + Math.max(0, cumulativeAt(d, t) - cumulativeAt(d, now)), 0) / usable.length
  } else {
    const pace = pacePerHour(total, wake, now)
    const remainingH = Math.max(0, (s - now) / 60)
    endTotal = Math.round(total + pace * remainingH * 0.8)
    basis = 'tempo'
    profile = (t: number) => total + pace * 0.8 * Math.max(0, (t - now) / 60)
  }

  let goalAt: number | null = null
  if (total >= goal) goalAt = now
  else if (endTotal >= goal) {
    for (let t = now; t <= s; t += 5) if (profile(t) >= goal) { goalAt = t; break }
  }
  return { endTotal, goalAt, confidence, basis, vsHistory }
}

/**
 * Dağılım skoru (0–100): suyun gün içine ne kadar dengeli yayıldığı.
 * Her uyanık saat için gerçekleşen kümülatif oran ile ideal oran farkının ortalaması.
 */
export function distributionScore(logs: DayLog[], wake: number, sleep: number, until?: number): number | null {
  const total = logs.reduce((a, l) => a + l.ml, 0)
  if (total <= 0) return null
  const [w, s] = awakeWindow(wake, sleep)
  const end = Math.min(until ?? s, s)
  if (end - w < 120) return null
  let dev = 0, n = 0
  const totalUntil = cumulativeAt(logs, end)
  for (let t = w + 60; t <= end; t += 60) {
    const actual = cumulativeAt(logs, t) / Math.max(1, totalUntil)
    const ideal = (t - w) / (end - w)
    dev += Math.abs(actual - ideal); n++
  }
  return Math.max(0, Math.min(100, Math.round(100 * (1 - (2 * dev) / Math.max(1, n)))))
}

/** Son N gündeki kayıtlardan, şu saate yakın kullanılanlara ağırlık vererek en sık 3 miktar. */
export function frequentAmounts(logs: { ml: number; at: number; daysAgo: number }[], now: number, k = 3): number[] {
  const score = new Map<number, number>()
  for (const l of logs) {
    if (l.ml <= 0) continue
    const recency = Math.max(0.2, 1 - l.daysAgo / 30)
    const near = Math.abs(l.at - now) <= 120 ? 1.5 : 1
    score.set(l.ml, (score.get(l.ml) ?? 0) + recency * near)
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, k).map(([ml]) => ml)
}

/** Aynı miktar kısa süre içinde tekrar girildiyse olası çift kayıt. */
export function isLikelyDuplicate(ml: number, atMs: number, recent: { ml: number; atMs: number }[]): boolean {
  return recent.some((r) => r.ml === ml && Math.abs(r.atMs - atMs) <= DUPLICATE_WINDOW_MIN * 60000)
}

/** Son 60 dakikada (yeni kayıt dahil) içilen ham miktar eşik üstündeyse uyarı. */
export function overHourlyLimit(ml: number, atMs: number, recent: { ml: number; atMs: number }[]): boolean {
  const sum = recent.filter((r) => atMs - r.atMs >= 0 && atMs - r.atMs < 3600000).reduce((a, r) => a + r.ml, 0)
  return sum + ml > MAX_ML_PER_HOUR
}

export interface DayTotal { day: string; total: number; goal: number }

export interface StreakInfo {
  current: number
  best: number
  frozenThisMonth: number
  freezesLeft: number
  todayDone: boolean
}

/**
 * Esnek seri: hedefe ulaşılmayan bir gün, o takvim ayında 2 dondurma hakkı varsa seriyi bozmaz
 * (seri sayısına eklenmez ama kırılmaz). Bugün henüz bitmediği için hedef tutmadıysa seri kırılmaz.
 * days: eskiden yeniye, ardışık günler; son eleman bugün.
 */
export function computeStreak(days: DayTotal[], freezesPerMonth = 2): StreakInfo {
  const met = (d: DayTotal) => d.goal > 0 && d.total >= d.goal
  let best = 0, run = 0
  const used = new Map<string, number>()
  let current = 0
  for (let i = 0; i < days.length; i++) {
    const d = days[i]
    const isToday = i === days.length - 1
    const month = d.day.slice(0, 7)
    if (met(d)) { run++ }
    else if (isToday) { /* gün bitmedi */ }
    else if (run > 0 && (used.get(month) ?? 0) < freezesPerMonth) { used.set(month, (used.get(month) ?? 0) + 1) }
    else { run = 0 }
    best = Math.max(best, run)
  }
  current = run
  const thisMonth = days.at(-1)?.day.slice(0, 7) ?? ''
  const frozen = used.get(thisMonth) ?? 0
  return { current, best, frozenThisMonth: frozen, freezesLeft: Math.max(0, freezesPerMonth - frozen), todayDone: days.length ? met(days.at(-1)!) : false }
}

/** Gün içindeki en uzun içmeden geçen süre (dakika), uyanık pencerede ve şu ana kadar. */
export function longestGap(logs: DayLog[], wake: number, now: number): { minutes: number; from: number; to: number } {
  const pts = [wake, ...logs.map((l) => l.at).filter((t) => t >= wake && t <= now).sort((a, b) => a - b), now]
  let best = { minutes: 0, from: wake, to: wake }
  for (let i = 1; i < pts.length; i++) if (pts[i] - pts[i - 1] > best.minutes) best = { minutes: pts[i] - pts[i - 1], from: pts[i - 1], to: pts[i] }
  return best
}

/** Saatlik kova (0–23) toplamları. */
export function hourlyBuckets(logs: DayLog[]): number[] {
  const b = Array(24).fill(0)
  for (const l of logs) b[Math.floor((((l.at % 1440) + 1440) % 1440) / 60)] += l.ml
  return b
}

/** Haftanın günü (0=Pazar) için hedef: gün özel hedef > taban. */
export function goalForWeekday(base: number, weekday: (number | null)[] | null | undefined, dow: number): number {
  const v = weekday?.[dow]
  return v && v > 0 ? v : base
}

export function sipMl(calibrated: number | null | undefined): number {
  return calibrated && calibrated > 0 ? calibrated : DEFAULT_SIP_ML
}

export function calibrateSip(volumeMl: number, sips: number): number {
  if (!(volumeMl > 0) || !(sips > 0)) throw new Error('geçersiz kalibrasyon')
  return Math.max(5, Math.min(80, Math.round(volumeMl / sips)))
}

export interface GoalRow { effectiveFrom: string; baseMl: number; weekday: (number | null)[] | null }

/** Bir günün hedefi: effectiveFrom ≤ gün olan en son kayıt (yoksa en eski kayıt). */
export function goalForDay(history: GoalRow[], day: string): number {
  if (!history.length) return 2500
  const sorted = [...history].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  let row = sorted[0]
  for (const h of sorted) if (h.effectiveFrom <= day) row = h
  const dow = new Date(day + 'T12:00:00Z').getUTCDay()
  return goalForWeekday(row.baseMl, row.weekday, dow)
}
