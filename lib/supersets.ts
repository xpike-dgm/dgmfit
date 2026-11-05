// Faz 5h-4: süperset grupları (saf; tests/supersets.test.ts). Aynı `superset` numaralı ARDIŞIK hareketler bir gruptur.

export interface SsItem { superset?: number | null }

/** Ardışık gruplar: tek hareketler `group: null` ile kendi bloklarında. */
export function supersetBlocks<T extends SsItem>(xs: T[]): { group: number | null; idx: number[] }[] {
  const out: { group: number | null; idx: number[] }[] = []
  xs.forEach((x, i) => {
    const g = x.superset ?? null
    const last = out.at(-1)
    if (g != null && last && last.group === g) last.idx.push(i)
    else out.push({ group: g, idx: [i] })
  })
  return out.map((b) => (b.idx.length < 2 ? { ...b, group: null } : b))
}

/** `i` numaralı hareketin süperset grubundaki sıra (tek hareketse yalnızca kendisi). */
export function supersetMembers<T extends SsItem>(xs: T[], i: number): number[] {
  return supersetBlocks(xs).find((b) => b.idx.includes(i))?.idx ?? [i]
}

/**
 * Bir set tamamlandıktan SONRAKİ durumdan karar: grupta sırada bitmemiş hareket varsa dinlenmeden ona geç;
 * turun sonundaysa dinlen ve setleri kalan ilk üyeye dön. Süperset değilse `{ focus: null, rest: true }` (eski davranış).
 */
export function afterSupersetSet<T extends SsItem & { sets: { done: boolean }[] }>(xs: T[], i: number): { focus: number | null; rest: boolean } {
  const m = supersetMembers(xs, i)
  if (m.length < 2) return { focus: null, rest: true }
  const open = (j: number) => xs[j].sets.some((s) => !s.done)
  const nextInRound = m.slice(m.indexOf(i) + 1).find(open)
  if (nextInRound != null) return { focus: nextInRound, rest: false }
  return { focus: m.find(open) ?? null, rest: true }
}

/** Programda "sonrakiyle süperset" / "süperseti boz" sonrası yeni grup numaraları (gün içi, idx sırasıyla). */
export function relinkSuperset(groups: (number | null)[], i: number, withNext: boolean): (number | null)[] {
  const g = [...groups]
  if (withNext) {
    if (i + 1 >= g.length) return g
    const id = g[i] ?? g[i + 1] ?? Math.max(0, ...g.map((x) => x ?? 0)) + 1
    const old = g[i + 1]
    g[i] = id; g[i + 1] = id
    // sonraki hareket başka bir gruptaysa o grubun devamı da katılır (ardışıklık bozulmasın)
    if (old != null && old !== id) for (let j = i + 2; j < g.length && g[j] === old; j++) g[j] = id
  } else {
    const id = g[i]
    if (id == null) return g
    // grubu i noktasından ikiye böl: i ve öncesi kalır, sonrası yeni numara alır
    const after = Math.max(0, ...g.map((x) => x ?? 0)) + 1
    for (let j = i + 1; j < g.length && g[j] === id; j++) g[j] = after
  }
  // tek üyeli gruplar çözülür
  const blocks = supersetBlocks(g.map((x) => ({ superset: x })))
  return g.map((s, j) => (blocks.find((b) => b.idx.includes(j))!.group != null ? s : null))
}
