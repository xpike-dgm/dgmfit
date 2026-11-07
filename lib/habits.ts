// P-7 hızlı kayıt: "her zamanki kahvaltın" — geçmiş kayıtlardan öğün alışkanlığı (saf; testleri tests/habits.test.ts).

export interface LoggedItem { foodId: number; name: string; grams: number; kcal: number }
export interface UsualMeal { items: LoggedItem[]; kcal: number; days: number }

/**
 * Bir öğün için son günlerdeki kayıtlardan alışkanlık: öğünün kaydedildiği günlerin en az yarısında ve en az 3 günde
 * görülen besinler, gramı medyan. En az 3 gün kayıt yoksa ya da ortak besin yoksa null.
 * `days`: gün başına o öğünün kalemleri (aynı gün aynı besin birden çoksa gramlar toplanır).
 */
export function usualMeal(days: LoggedItem[][], opts: { minDays?: number; share?: number; maxItems?: number } = {}): UsualMeal | null {
  const minDays = opts.minDays ?? 3, share = opts.share ?? 0.5, maxItems = opts.maxItems ?? 6
  const logged = days.filter((d) => d.length > 0)
  if (logged.length < minDays) return null
  const seen = new Map<number, { name: string; grams: number[]; kcalPerG: number[] }>()
  for (const d of logged) {
    const perDay = new Map<number, LoggedItem>()
    for (const it of d) {
      const p = perDay.get(it.foodId)
      perDay.set(it.foodId, p ? { ...p, grams: p.grams + it.grams, kcal: p.kcal + it.kcal } : { ...it })
    }
    for (const it of perDay.values()) {
      const s = seen.get(it.foodId) ?? { name: it.name, grams: [], kcalPerG: [] }
      s.grams.push(it.grams); if (it.grams > 0) s.kcalPerG.push(it.kcal / it.grams)
      seen.set(it.foodId, s)
    }
  }
  const need = Math.max(minDays, Math.ceil(logged.length * share))
  const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
  const items = [...seen.entries()].filter(([, s]) => s.grams.length >= need)
    .sort((a, b) => b[1].grams.length - a[1].grams.length)
    .slice(0, maxItems)
    .map(([foodId, s]) => { const grams = Math.round(median(s.grams)); return { foodId, name: s.name, grams, kcal: Math.round(grams * median(s.kcalPerG.length ? s.kcalPerG : [0])) } })
  if (!items.length) return null
  return { items, kcal: items.reduce((a, x) => a + x.kcal, 0), days: Math.min(...items.map((x) => seen.get(x.foodId)!.grams.length)) }
}

/** Öğünün alışkanlık saati: son günlerde o öğünün ilk kaydının dakikası (medyan). En az `minDays` gün yoksa null. */
export function habitMinute(firstLogMinutes: number[], minDays = 5): number | null {
  if (firstLogMinutes.length < minDays) return null
  const s = [...firstLogMinutes].sort((a, b) => a - b)
  const m = s.length >> 1
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2)
}

/**
 * Akıllı öğün hatırlatması: alışkanlık saatinden `late` dk sonra hâlâ kayıt yoksa, öğün başına günde bir,
 * en geç alışkanlık + 3 saate kadar (sonrası artık geç; hatırlatma rahatsız eder). Gönderilecek öğün ya da null.
 */
export function decideMealReminder(i: { now: number; habit: Partial<Record<string, number | null>>; logged: Set<string>; sent: Set<string>; late?: number }): string | null {
  const late = i.late ?? 60
  for (const [meal, h] of Object.entries(i.habit)) {
    if (h === null || h === undefined || i.logged.has(meal) || i.sent.has(meal)) continue
    if (i.now >= h + late && i.now <= h + 180) return meal
  }
  return null
}
