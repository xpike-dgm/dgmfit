// Fitness gelişim fonksiyonları — saf. Testler: tests/progress.test.ts
// Spesifikasyon 4.1 (alternatif), 4.2 (periyodizasyon), 4.4 (plato), 4.5 (set/kas, ısı haritası, standartlar).

export const DAY_MS = 86400000
const days = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY_MS)

// ───────── Plato ─────────
export interface Plateau { plateau: boolean; weeks: number; best: number; recentBest: number; suggestions: string[] }

/**
 * Plato: son 21 günün en iyi e1RM'i, öncesindeki en iyiyi %0,5'ten fazla geçemiyorsa (en az 2 yeni seans ve 21+ günlük veri).
 * "weeks": önceki en iyinin üzerinden geçen hafta.
 */
export function detectPlateau(series: { day: string; e1rm: number }[], today: string, repRange?: { repMin: number; repMax: number }): Plateau {
  const s = series.filter((x) => x.e1rm > 0).sort((a, b) => a.day.localeCompare(b.day))
  const none: Plateau = { plateau: false, weeks: 0, best: 0, recentBest: 0, suggestions: [] }
  if (s.length < 3 || days(s[0].day, today) < 21) return none
  const recent = s.filter((x) => days(x.day, today) < 21)
  const prior = s.filter((x) => days(x.day, today) >= 21)
  if (recent.length < 2 || !prior.length) return none
  const priorBest = prior.reduce((a, b) => (b.e1rm > a.e1rm ? b : a))
  const recentBest = Math.max(...recent.map((x) => x.e1rm))
  if (recentBest > priorBest.e1rm * 1.005) return { ...none, best: recentBest, recentBest }
  const weeks = Math.floor(days(priorBest.day, today) / 7)
  const r = repRange ?? { repMin: 8, repMax: 12 }
  const other = r.repMax <= 6 ? '8–12' : r.repMin >= 8 ? '5–8' : '10–15'
  return {
    plateau: true, weeks, best: priorBest.e1rm, recentBest,
    suggestions: [
      `Varyasyon: aynı kası çalıştıran bir alternatife 3–4 hafta geç.`,
      `Tekrar aralığını değiştir: ${r.repMin}–${r.repMax} yerine ${other}.`,
      `Hacmi artır: bu harekete haftada +1–2 set ekle (kas başına 20 seti aşmadan).`,
    ],
  }
}

// ───────── Alternatif hareket ─────────
export interface ExLite { id: number; nameTr: string; primary: string[]; secondary: string[]; equipment: string; kind: string; pattern: string; mechanic: string | null; curated: boolean; category: string }

/** "İstasyon dolu": aynı birincil kas ve hareket tipi, farklı ekipman öncelikli. En fazla `limit` sonuç. */
export function alternatives(target: ExLite, pool: ExLite[], available?: Set<string>, limit = 5): ExLite[] {
  const p0 = target.primary[0]
  const loadable = (k: string) => k === 'weight_reps' || k === 'bodyweight' || k === 'assisted'
  return pool
    .filter((x) => x.id !== target.id && x.primary[0] === p0 && x.pattern === target.pattern && x.category !== 'stretching' && (loadable(target.kind) ? loadable(x.kind) : x.kind === target.kind))
    .filter((x) => !available || x.equipment === 'body only' || available.has(x.equipment))
    .map((x) => {
      let score = 0
      score += x.secondary.filter((m) => target.secondary.includes(m)).length
      if (x.mechanic && x.mechanic === target.mechanic) score += 2
      if (x.equipment !== target.equipment) score += 2
      if (x.curated) score += 3
      return { x, score }
    })
    .sort((a, b) => b.score - a.score || a.x.nameTr.localeCompare(b.x.nameTr, 'tr'))
    .slice(0, limit).map((r) => r.x)
}

// ───────── Kuvvet standartları ─────────
// DgFit yaklaşık rehberi: e1RM / vücut ağırlığı oranı. Yayımlanmış bir tablodan alınmadı; antrenörlerin yaygın kullandığı
// kaba eşiklerdir ve ekranda "yaklaşık" olarak gösterilir.
export const LIFTS: Record<string, { label: string; keys: string[] }> = {
  squat: { label: 'Squat', keys: ['Barbell_Squat'] },
  bench: { label: 'Bench press', keys: ['Barbell_Bench_Press_-_Medium_Grip'] },
  deadlift: { label: 'Deadlift', keys: ['Barbell_Deadlift'] },
  ohp: { label: 'Overhead press', keys: ['Standing_Military_Press'] },
  row: { label: 'Barbell row', keys: ['Bent_Over_Barbell_Row'] },
}
export const LEVELS = ['Başlangıç', 'Orta', 'İleri', 'Elit'] as const
const RATIOS: Record<'male' | 'female', Record<string, [number, number, number, number]>> = {
  male: { squat: [0.75, 1.25, 1.75, 2.5], bench: [0.5, 1.0, 1.5, 2.0], deadlift: [1.0, 1.5, 2.0, 3.0], ohp: [0.35, 0.65, 0.9, 1.25], row: [0.5, 0.85, 1.2, 1.6] },
  female: { squat: [0.5, 0.9, 1.3, 1.8], bench: [0.3, 0.6, 0.9, 1.2], deadlift: [0.6, 1.1, 1.6, 2.2], ohp: [0.2, 0.4, 0.6, 0.85], row: [0.3, 0.55, 0.8, 1.1] },
}
export function liftOf(key: string): string | null {
  for (const [k, v] of Object.entries(LIFTS)) if (v.keys.includes(key)) return k
  return null
}
/** Seviye: oranın geçtiği en yüksek eşik; bir sonraki seviye için gereken e1RM. */
export function strengthLevel(lift: string, oneRm: number, bodyKg: number, sex: 'male' | 'female'): { level: string; ratio: number; next: { level: string; kg: number } | null; thresholds: number[] } | null {
  const t = RATIOS[sex][lift]
  if (!t || bodyKg <= 0 || oneRm <= 0) return null
  const ratio = Math.round((oneRm / bodyKg) * 100) / 100
  let idx = -1
  for (let i = 0; i < t.length; i++) if (ratio >= t[i]) idx = i
  const level = idx < 0 ? 'Başlangıç altı' : LEVELS[idx]
  const next = idx + 1 < t.length ? { level: LEVELS[idx + 1], kg: Math.ceil((t[idx + 1] * bodyKg) / 2.5) * 2.5 } : null
  return { level, ratio, next, thresholds: t.map((r) => Math.round(r * bodyKg)) }
}

// ───────── Kas başına haftalık set ─────────
/** Çalışma seti başına birincil kas 1, ikincil kas 0,5 set. */
export function setsByMuscle(sets: { primary: string[]; secondary: string[] }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of sets) {
    for (const m of s.primary) out[m] = (out[m] ?? 0) + 1
    for (const m of s.secondary) if (!s.primary.includes(m)) out[m] = (out[m] ?? 0) + 0.5
  }
  return out
}
export const SET_BAND = { min: 10, max: 20 }
export function setBandStatus(n: number): 'az' | 'iyi' | 'çok' { return n < SET_BAND.min ? 'az' : n > SET_BAND.max ? 'çok' : 'iyi' }

// ───────── Toparlanma ─────────
/**
 * DgFit kuralı (yaygın 48–72 saat rehberi): son 24 saatte çalışan ya da son 48 saatte 4+ set çalışan kas kırmızı,
 * 72 saatten az önce çalışan sarı, diğerleri yeşil.
 */
export function recovery(hoursAgo: number | null, recentSets: number): 'kırmızı' | 'sarı' | 'yeşil' {
  if (hoursAgo === null) return 'yeşil'
  if (hoursAgo < 24 || (hoursAgo < 48 && recentSets >= 4)) return 'kırmızı'
  if (hoursAgo < 72) return 'sarı'
  return 'yeşil'
}

// ───────── Periyodizasyon ─────────
export type Periodization = 'linear' | 'dup' | 'block'
export const PERIODIZATION: Record<Periodization, { label: string; hint: string }> = {
  linear: { label: 'Lineer', hint: 'Her hafta aynı hedefler; ağırlık çift aşamalı kuralla artar.' },
  dup: { label: 'Dalgalı (DUP)', hint: 'Aynı hareket seanstan seansa ağır / orta / hafif döner.' },
  block: { label: 'Blok', hint: '4 hafta birikim (daha çok set), 4 hafta yoğunlaşma (daha az tekrar, daha ağır).' },
}
export interface BaseTarget { sets: number; repMin: number; repMax: number; rir: number }
export interface PeriodTarget extends BaseTarget { label: string; loadPct: number; deload: boolean }

export const weekIndex = (startDay: string, today: string) => Math.max(0, Math.floor(days(startDay, today) / 7))
export const isDeloadWeek = (week: number, every: number) => every > 0 && (week + 1) % every === 0

/**
 * Haftaya ve seans sırasına göre hedef. Deload haftası: setler yarıya (yukarı yuvarlı), RIR +2 (en çok 4), yük %90.
 * DUP: seans sırası 0 ağır (tekrar −3, RIR −1), 1 orta (taban), 2 hafif (tekrar üst sınırdan +4, RIR +1).
 * Blok: 4 haftalık bloklar; çift blok birikim (+1 set), tek blok yoğunlaşma (tekrar −3, RIR −1).
 * Bu dağılımlar DgFit tasarımıdır (yaygın periyodizasyon ilkelerinin basit uygulaması).
 */
export function periodTarget(i: { scheme: Periodization; week: number; session: number; base: BaseTarget; deloadEvery: number }): PeriodTarget {
  const b = i.base
  if (isDeloadWeek(i.week, i.deloadEvery)) return { sets: Math.max(1, Math.ceil(b.sets / 2)), repMin: b.repMin, repMax: b.repMax, rir: Math.min(4, b.rir + 2), label: 'Deload haftası', loadPct: 0.9, deload: true }
  if (i.scheme === 'dup') {
    const k = ((i.session % 3) + 3) % 3
    if (k === 0) { const lo = Math.max(3, b.repMin - 3); return { sets: b.sets, repMin: lo, repMax: Math.max(lo + 1, b.repMin - 1), rir: Math.max(1, b.rir - 1), label: 'Ağır gün', loadPct: 1, deload: false } }
    if (k === 2) return { sets: b.sets, repMin: b.repMax, repMax: b.repMax + 4, rir: Math.min(4, b.rir + 1), label: 'Hafif gün', loadPct: 1, deload: false }
    return { ...b, label: 'Orta gün', loadPct: 1, deload: false }
  }
  if (i.scheme === 'block') {
    const effWeek = i.deloadEvery > 0 ? i.week - Math.floor((i.week + 1) / i.deloadEvery) : i.week
    if (Math.floor(effWeek / 4) % 2 === 0) return { ...b, sets: b.sets + 1, label: 'Birikim bloğu', loadPct: 1, deload: false }
    const lo = Math.max(3, b.repMin - 3)
    return { sets: b.sets, repMin: lo, repMax: Math.max(lo + 1, b.repMin - 1), rir: Math.max(1, b.rir - 1), label: 'Yoğunlaşma bloğu', loadPct: 1, deload: false }
  }
  return { ...b, label: 'Lineer', loadPct: 1, deload: false }
}
