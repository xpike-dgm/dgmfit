// Simülasyon için tohumlu, tekrarlanabilir rastgele sayı üreteci (mulberry32 + Box-Muller).
export interface Rng { next(): number; normal(mean?: number, sd?: number): number; pick<T>(xs: readonly T[]): T; chance(p: number): boolean; int(lo: number, hi: number): number }

export function rng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  let spare: number | null = null
  const normal = (mean = 0, sd = 1) => {
    if (spare !== null) { const s = spare; spare = null; return mean + sd * s }
    let u = 0, v = 0
    while (u === 0) u = next()
    while (v === 0) v = next()
    const r = Math.sqrt(-2 * Math.log(u))
    spare = r * Math.sin(2 * Math.PI * v)
    return mean + sd * r * Math.cos(2 * Math.PI * v)
  }
  return {
    next, normal,
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    chance: (p) => next() < p,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
  }
}

/** Metinden tohum (senaryo kimliği → aynı sonuç). */
export function seedOf(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
