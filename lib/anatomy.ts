// Anatomi haritası için saf yardımcılar (testli). Görseller ve bölge koordinatları lisanslı pakette (Ağırsağlam).

export type Gender = 'male' | 'female'
export type Side = 'front' | 'back'
export const viewKey = (g: Gender, s: Side) => `${g}_${s}` as const

/** Kapalı çokgeni Catmull-Rom eğrisiyle yumuşatılmış SVG yoluna çevirir (köşeli kenarlar yerine kasın doğal hatları). */
export function smoothPath(points: [number, number][], tension = 0.5): string {
  const n = points.length
  if (n < 3) return ''
  const p = (i: number) => points[(i + n) % n]
  const r = (v: number) => Math.round(v * 10) / 10
  let d = `M${r(p(0)[0])} ${r(p(0)[1])}`
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
    const c1 = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3]
    const c2 = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3]
    d += `C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(p2[0])} ${r(p2[1])}`
  }
  return d + 'Z'
}

/** Kas puanı (1–10) → etki kademesi (1 düşük … 6 kusursuz). Etiketler paketteki ekran metinlerinden okunur. */
export function activationLevel(r: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (r >= 10) return 6
  if (r >= 8) return 5
  if (r >= 6) return 4
  if (r >= 4) return 3
  if (r >= 2) return 2
  return 1
}
/** Kademe renkleri (DgFit paleti): kırmızıdan turkuaza; seçili kas her zaman kırmızı. */
export const LEVEL_COLOR: Record<number, string> = { 6: '#C62828', 5: '#E5533D', 4: '#F08A3E', 3: '#E3C14B', 2: '#3BB3A6', 1: '#2C7C86' }
export const SELECT_COLOR = '#E53935'

/** MSS puanı (2–10) → açıklama kademesi (1–4). */
export function cnsBucket(cns: number): 1 | 2 | 3 | 4 {
  if (cns <= 3) return 1
  if (cns <= 5) return 2
  if (cns <= 7) return 3
  return 4
}

const LOWER = new Set(['glutes', 'quads', 'hams', 'adductors', 'calves', 'hipFlexors'])
const BACK_ONLY = new Set(['posteriorDeltoid', 'rotatorCuff', 'lowerTraps', 'spinalErectors', 'tricepsLong', 'hams'])
/** Kasın en iyi görüldüğü yüz. */
export const sideOf = (key: string): Side => (BACK_ONLY.has(key) || key === 'lats' || key === 'glutes' ? 'back' : 'front')
/** Küçük figürün kırpma alanı (1200×2873 görsel üzerinde): üst gövde ya da bacaklar. */
export function cropFor(keys: string[]): { x: number; y: number; w: number; h: number } {
  const lower = keys.filter((k) => LOWER.has(k)).length > keys.length / 2
  return lower ? { x: 150, y: 1150, w: 900, h: 1650 } : { x: 120, y: 120, w: 960, h: 1150 }
}

/** Bir hareketin kas puanlarından küçük figür için yüz seçimi: en yüksek puanlı kasın yüzü. */
export function bestSide(ratings: Record<string, number>): Side {
  const top = Object.entries(ratings).sort((a, b) => b[1] - a[1])[0]
  return top ? sideOf(top[0]) : 'front'
}
