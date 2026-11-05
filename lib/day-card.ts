// Günlük özet görseli için saf hesaplar (testli): mikro besin referansları, satır seçimi, renk tonu.
import { NUTRIENT_INFO, type NutrientKey } from './nutrition.ts'

/**
 * Yetişkin günlük referansları. `min`: hedeflenen en az değer (AB beslenme referans değerleri, NRV; lif EFSA 25 g).
 * `max`: aşılmaması önerilen üst değer (şeker DSÖ %10 ≈ 50 g, doymuş yağ 20 g, sodyum DSÖ/EFSA 2.000 mg, kolesterol 300 mg).
 */
export const MICRO_REF: Partial<Record<NutrientKey, { ref: number; kind: 'min' | 'max' }>> = {
  fiber: { ref: 25, kind: 'min' }, sugar: { ref: 50, kind: 'max' }, sodium: { ref: 2000, kind: 'max' }, satFat: { ref: 20, kind: 'max' },
  ca: { ref: 800, kind: 'min' }, fe: { ref: 14, kind: 'min' }, k: { ref: 2000, kind: 'min' }, mg: { ref: 375, kind: 'min' },
  vitC: { ref: 80, kind: 'min' }, vitD: { ref: 5, kind: 'min' }, zn: { ref: 10, kind: 'min' }, vitA: { ref: 800, kind: 'min' },
  b12: { ref: 2.5, kind: 'min' }, b6: { ref: 1.4, kind: 'min' }, chol: { ref: 300, kind: 'max' },
}
/** Gösterim önceliği: önce sınırlar ve lif, sonra mineraller ve vitaminler. */
export const MICRO_ORDER: NutrientKey[] = ['fiber', 'sugar', 'sodium', 'satFat', 'ca', 'fe', 'k', 'mg', 'vitC', 'vitD', 'zn', 'vitA', 'b12', 'b6', 'chol']

export type Tone = 'good' | 'warn' | 'bad'
export interface MicroRow { key: NutrientKey; label: string; value: number; unit: string; ref: number; kind: 'min' | 'max'; pct: number; tone: Tone }

/** Hedef türü (en az): %100 ve üstü iyi, altı uyarı. Sınır türü (en çok): %75 altı iyi, %75–100 uyarı, aşım kötü. */
export function toneFor(kind: 'min' | 'max', pct: number): Tone {
  if (kind === 'min') return pct >= 100 ? 'good' : 'warn'
  return pct > 100 ? 'bad' : pct >= 75 ? 'warn' : 'good'
}

/** Günün mikro toplamından görselde gösterilecek satırlar (değeri olanlar, öncelik sırasıyla, en fazla `limit`). */
export function microRows(micro: Record<string, number>, limit: number): MicroRow[] {
  const out: MicroRow[] = []
  for (const key of MICRO_ORDER) {
    const v = micro[key]
    const r = MICRO_REF[key]
    if (v === undefined || !r || !(v > 0)) continue
    const pct = Math.round((v / r.ref) * 100)
    out.push({ key, label: NUTRIENT_INFO[key].label, value: v, unit: NUTRIENT_INFO[key].unit, ref: r.ref, kind: r.kind, pct, tone: toneFor(r.kind, pct) })
    if (out.length >= limit) break
  }
  return out
}

/** Görsel türleri. */
export const CARD_KINDS = {
  a: { label: 'Kart', hint: 'Koyu · 1080×1350 · gönderi', w: 1080, h: 1350, micro: 10 },
  b: { label: 'Hikâye', hint: 'Açık · 1080×1920 · story', w: 1080, h: 1920, micro: 6 },
} as const
export type CardKind = keyof typeof CARD_KINDS
export const isCardKind = (s: string | null | undefined): s is CardKind => s === 'a' || s === 'b'
