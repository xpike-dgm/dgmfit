// P-7 ölçü/fotoğraf karşılaştırma: iki tarih arasındaki değişim (saf; tests/progress-compare.test.ts).

export interface Snap { day: string; values: Record<string, number | null> }
export interface CompareResult { days: number; weight: number | null; deltas: { key: string; delta: number }[] }

const dist = (a: string, b: string) => Math.abs(Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000

/** Tarihe en yakın kayıt (±maxDays içinde). */
export function nearest<T extends { day: string }>(rows: T[], day: string, maxDays = 7): T | null {
  let best: T | null = null
  for (const r of rows) if (dist(r.day, day) <= maxDays && (!best || dist(r.day, day) < dist(best.day, day))) best = r
  return best
}

/** Erken (a) → geç (b) tarih arası: gün farkı, kilo farkı (tartı), ölçü farkları (her iki uçta da değer varsa). */
export function compareDays(a: string, b: string, measures: Snap[], weights: { day: string; kg: number }[]): CompareResult {
  const [from, to] = a <= b ? [a, b] : [b, a]
  const wa = nearest(weights, from), wb = nearest(weights, to)
  const ma = nearest(measures, from), mb = nearest(measures, to)
  const deltas: CompareResult['deltas'] = []
  if (ma && mb && ma !== mb) for (const k of Object.keys(ma.values)) {
    const x = ma.values[k], y = mb.values[k]
    if (x !== null && x !== undefined && y !== null && y !== undefined) deltas.push({ key: k, delta: Math.round((y - x) * 10) / 10 })
  }
  return { days: Math.round(dist(from, to)), weight: wa && wb && wa !== wb ? Math.round((wb.kg - wa.kg) * 10) / 10 : null, deltas }
}
