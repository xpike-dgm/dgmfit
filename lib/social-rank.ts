// Meydan okuma, sıralama, PR doğrulama ve dürtme kuralları — saf, testli (tests/social2.test.ts). Spesifikasyon 8.4–8.6.
import type { DayFacts } from './weekly.ts'
import { liftOf } from './progress.ts'

// ───────── DOTS ─────────
// Kaynak: OpenPowerlifting crates/coefficients/src/dots.rs + lib.rs (poly4 = A·x⁴ + B·x³ + C·x² + D·x + E), 2026-11-05 okundu.
// Vücut ağırlığı erkekte 40–210, kadında 40–150 kg aralığına sabitlenir.
const DOTS = {
  male: { a: -0.000001093, b: 0.0007391293, c: -0.1918759221, d: 24.0900756, e: -307.75076, min: 40, max: 210 },
  female: { a: -0.0000010706, b: 0.0005158568, c: -0.1126655495, d: 13.6175032, e: -57.96288, min: 40, max: 150 },
} as const
export function dots(totalKg: number, bodyKg: number, sex: 'male' | 'female'): number {
  if (totalKg <= 0 || bodyKg <= 0) return 0
  const k = DOTS[sex]
  const x = Math.min(k.max, Math.max(k.min, bodyKg))
  const poly = k.a * x ** 4 + k.b * x ** 3 + k.c * x ** 2 + k.d * x + k.e
  return Math.round(((totalKg * 500) / poly) * 100) / 100
}

// ───────── Tutarlılık ─────────
/** Son haftalarda haftalık antrenman hedefinin karşılanma oranı (hafta başına en fazla %100), 0–100. */
export function consistency(perWeek: number[], target: number): number {
  if (!perWeek.length || target <= 0) return 0
  return Math.round((perWeek.reduce((a, n) => a + Math.min(1, n / target), 0) / perWeek.length) * 100)
}

// ───────── Meydan okumalar ─────────
export const METRICS = {
  water_days: { label: 'Su hedefi günü', unit: 'gün', param: 'ml' },
  training_days: { label: 'Antrenman günü', unit: 'gün', param: null },
  volume: { label: 'Toplam hacim', unit: 'kg', param: null },
  protein_days: { label: 'Protein hedefi günü', unit: 'gün', param: null },
  cardio_minutes: { label: 'Kardiyo süresi', unit: 'dk', param: null },
} as const
export type Metric = keyof typeof METRICS

export const TEMPLATES = [
  { key: 'su30', title: '30 gün 2,5 litre su', metric: 'water_days' as Metric, param: 2500, target: 30, days: 30 },
  { key: 'antrenman16', title: 'Ayda 16 antrenman', metric: 'training_days' as Metric, param: null, target: 16, days: 30 },
  { key: 'hacim7', title: 'Haftalık en çok hacim', metric: 'volume' as Metric, param: null, target: null, days: 7 },
  { key: 'protein7', title: '7 gün protein hedefi', metric: 'protein_days' as Metric, param: null, target: 7, days: 7 },
]

/** Bir kullanıcının meydan okuma süresindeki ilerlemesi, motorun gün özetlerinden (kayıt dışı veri sayılmaz). */
export function progressOf(metric: Metric, param: number | null, days: DayFacts[]): number {
  switch (metric) {
    case 'water_days': return days.filter((d) => d.waterMl >= (param ?? d.waterGoal) && d.waterMl > 0).length
    case 'training_days': return days.filter((d) => d.workouts > 0 || d.cardioMin >= 20).length
    case 'volume': return Math.round(days.reduce((a, d) => a + d.volumeKg, 0))
    case 'protein_days': return days.filter((d) => d.proteinTarget > 0 && d.protein >= d.proteinTarget).length
    case 'cardio_minutes': return Math.round(days.reduce((a, d) => a + d.cardioMin, 0))
  }
}

/** Sıralama: değer büyükten küçüğe; eşitlikte önce hedefe ulaşan / adına göre. Hedef varsa tamamlanma yüzdesi. */
export function rankBoard<T extends { userId: string; name: string; value: number }>(rows: T[], target: number | null): (T & { rank: number; pct: number | null; done: boolean })[] {
  const s = [...rows].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'tr'))
  let rank = 0, prev: number | null = null
  return s.map((r, i) => {
    if (prev === null || r.value !== prev) rank = i + 1
    prev = r.value
    return { ...r, rank, pct: target ? Math.min(100, Math.round((r.value / target) * 100)) : null, done: target ? r.value >= target : false }
  })
}

/** Düello sonucu: süre bittiyse kazanan (beraberlik null), bitmediyse önde olan. */
export function duelResult(a: { userId: string; value: number }, b: { userId: string; value: number }, ended: boolean): { leader: string | null; winner: string | null } {
  const leader = a.value === b.value ? null : a.value > b.value ? a.userId : b.userId
  return { leader, winner: ended ? leader : null }
}

// ───────── PR doğrulama ─────────
// Yaklaşık "elit" e1RM / vücut ağırlığı oranının %30 üstü olağandışı sayılır (lib/progress.ts eşikleri, yaklaşık).
const ELITE: Record<'male' | 'female', Record<string, number>> = {
  male: { squat: 2.5, bench: 2.0, deadlift: 3.0, ohp: 1.25, row: 1.6 },
  female: { squat: 1.8, bench: 1.2, deadlift: 2.2, ohp: 0.85, row: 1.1 },
}
export const JUMP = 0.3
/**
 * Şüpheli rekor: (a) 7 gün önceki en iyi değere göre %30'dan fazla artış (spesifikasyon 8.6 örneği) ya da
 * (b) temel kaldırışlarda e1RM/vücut ağırlığı yaklaşık elit oranın 1,3 katını aşıyor.
 */
export function prSuspicious(i: { type: string; value: number; best7dAgo: number | null; exerciseKey: string; bodyKg: number | null; sex: 'male' | 'female' }): string | null {
  if (!['kg', 'e1rm', 'rm3', 'rm5', 'rm10'].includes(i.type) || i.value <= 0) return null
  if (i.best7dAgo && i.best7dAgo > 0 && i.value > i.best7dAgo * (1 + JUMP)) return `1 haftada %${Math.round((i.value / i.best7dAgo - 1) * 100)} artış`
  const lift = liftOf(i.exerciseKey)
  if (lift && i.bodyKg && i.bodyKg > 0 && i.value / i.bodyKg > ELITE[i.sex][lift] * 1.3) return 'vücut ağırlığına göre olağandışı'
  return null
}
export const WITNESSES_NEEDED = 2

// ───────── Dürtme ─────────
export const NUDGE = { water: 'Bugün su içtin mi? 💧', workout: 'Antrenman zamanı! 💪' } as const
export type NudgeKind = keyof typeof NUDGE
export const NUDGE_PER_DAY = 10
/** Çift başına tür başına günde 1, gönderen başına günde 10. `sentToday`: gönderenin bugün gönderdikleri. */
export function nudgeAllowed(sentToday: { to: string; kind: string }[], to: string, kind: NudgeKind): string | null {
  if (sentToday.length >= NUDGE_PER_DAY) return 'Bugünkü dürtme hakkın doldu'
  if (sentToday.some((n) => n.to === to && n.kind === kind)) return 'Bugün bu kişiyi zaten dürttün'
  return null
}

export const STORY_HOURS = 24
export const storyAlive = (createdAt: number, now: number) => now - createdAt < STORY_HOURS * 3600_000
