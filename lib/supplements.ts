// Kullanıcının kendi takviyeleri (saf; testli). Değerler porsiyon başına girilir; günlüğe "1 porsiyon" olarak yazılır.

export const SUPP_UNITS = ['ölçek', 'kapsül', 'tablet', 'şase', 'damla', 'ml', 'g', 'porsiyon'] as const
export type SuppUnit = (typeof SUPP_UNITS)[number]
export const EXTRA_UNITS = ['mg', 'g', 'µg', 'IU'] as const
export type ExtraUnit = (typeof EXTRA_UNITS)[number]
/** Hızlı eklenen yaygın içerikler (varsayılan birimiyle). */
export const COMMON_EXTRAS: { name: string; unit: ExtraUnit }[] = [
  { name: 'Kafein', unit: 'mg' }, { name: 'Kreatin', unit: 'g' }, { name: 'D3 vitamini', unit: 'IU' }, { name: 'Omega-3 (EPA+DHA)', unit: 'mg' },
  { name: 'Magnezyum', unit: 'mg' }, { name: 'Çinko', unit: 'mg' }, { name: 'C vitamini', unit: 'mg' }, { name: 'B12 vitamini', unit: 'µg' },
  { name: 'Demir', unit: 'mg' }, { name: 'Kolajen', unit: 'g' }, { name: 'BCAA', unit: 'g' }, { name: 'Lif', unit: 'g' },
]

export interface Extra { name: string; amount: number; unit: string }
export interface SuppInput {
  name: string; brand: string | null; unit: SuppUnit; servingG: number | null
  kcal: number; protein: number; carb: number; fat: number; extras: Extra[]; daily: number | null
}

/** Porsiyon etiketi: g/ml biriminde miktarın kendisi ("5 g"), diğerlerinde "1 ölçek". */
export function servingLabel(unit: string, servingG: number | null): string {
  return (unit === 'g' || unit === 'ml') && servingG ? `${String(servingG).replace('.', ',')} ${unit}` : `1 ${unit}`
}

/**
 * Porsiyon başına değerleri besin satırına çevirir. Uygulamadaki besinler 100 g başına tutulur;
 * gramı bilinmeyen birimlerde (kapsül, tablet…) 1 porsiyon = 1 "sanal gram" sayılır, böylece günlükteki gram = porsiyon sayısı × porsiyon gramı.
 */
export function suppToFood(i: SuppInput) {
  const g = i.servingG && i.servingG > 0 ? i.servingG : 1
  const f = 100 / g
  const r1 = (x: number) => Math.round(x * f * 10) / 10
  const per100 = { kcal: r1(i.kcal), protein: r1(i.protein), carb: r1(i.carb), fat: r1(i.fat) }
  return { per100, kcal: per100.kcal, protein: per100.protein, carb: per100.carb, fat: per100.fat, portions: [{ label: servingLabel(i.unit, i.servingG), g }], servingGrams: g }
}

/** Bir porsiyonun makroları (porsiyon başına girilen değerler). */
export function perServing(per100: { kcal: number; protein: number; carb: number; fat: number }, servingGrams: number) {
  const k = servingGrams / 100
  return { kcal: Math.round(per100.kcal * k), protein: Math.round(per100.protein * k * 10) / 10, carb: Math.round(per100.carb * k * 10) / 10, fat: Math.round(per100.fat * k * 10) / 10 }
}

/** Bugün alınan takviyelerin ek içerik toplamı (ad + birim bazında). */
export function sumExtras(items: { extras: Extra[]; count: number }[]): Extra[] {
  const m = new Map<string, Extra>()
  for (const it of items) for (const e of it.extras) {
    const key = e.name.trim().toLocaleLowerCase('tr-TR') + '|' + e.unit
    const cur = m.get(key)
    if (cur) cur.amount += e.amount * it.count
    else m.set(key, { name: e.name.trim(), amount: e.amount * it.count, unit: e.unit })
  }
  return [...m.values()].filter((e) => e.amount > 0).map((e) => ({ ...e, amount: Math.round(e.amount * 100) / 100 }))
}

/** Yetişkin için güvenli kabul edilen günlük üst sınırlar (EFSA). Aşılırsa uyarı; tıbbi tavsiye değildir. */
export const UPPER_LIMITS: { match: RegExp; unit: string; max: number; label: string }[] = [
  { match: /kafein/i, unit: 'mg', max: 400, label: 'kafein günde 400 mg' },
  { match: /^d3?\s*vitamin|d vitamini|d3 vitamini/i, unit: 'IU', max: 4000, label: 'D vitamini günde 4.000 IU' },
  { match: /çinko/i, unit: 'mg', max: 25, label: 'çinko günde 25 mg' },
  { match: /magnezyum/i, unit: 'mg', max: 250, label: 'takviyeden magnezyum günde 250 mg' },
  { match: /b6/i, unit: 'mg', max: 12, label: 'B6 vitamini günde 12 mg' },
]
export function limitWarnings(totals: Extra[]): string[] {
  const out: string[] = []
  for (const l of UPPER_LIMITS) {
    const t = totals.filter((e) => l.match.test(e.name) && e.unit === l.unit).reduce((a, e) => a + e.amount, 0)
    if (t > l.max) out.push(`Bugün ${l.label} sınırının üstündesin (${Math.round(t)} ${l.unit}).`)
  }
  return out
}

/** Girilen değerleri doğrular; hata metni ya da null. */
export function suppError(i: SuppInput): string | null {
  if (i.name.trim().length < 2) return 'Takviyenin adını yaz'
  if (!SUPP_UNITS.includes(i.unit)) return 'Porsiyon birimini seç'
  if ((i.unit === 'g' || i.unit === 'ml') && i.servingG === null) return `1 porsiyon kaç ${i.unit}? Miktarı yaz (ör. 5)`
  if (i.servingG !== null && !(i.servingG > 0 && i.servingG <= 500)) return '1 porsiyonun miktarı 0–500 arasında olmalı'
  for (const [k, v] of [['Kalori', i.kcal], ['Protein', i.protein], ['Karbonhidrat', i.carb], ['Yağ', i.fat]] as const) if (!(v >= 0 && v <= (k === 'Kalori' ? 2000 : 300))) return `${k} değeri geçersiz`
  if (i.protein * 4 + i.carb * 4 + i.fat * 9 > i.kcal * 1.3 + 15) return 'Makrolar kaloriyle uyuşmuyor; etiketteki porsiyon değerlerini kontrol et'
  if (i.extras.length > 12) return 'En fazla 12 ek içerik'
  for (const e of i.extras) if (e.name.trim().length < 2 || !(e.amount > 0 && e.amount < 1e6) || !(EXTRA_UNITS as readonly string[]).includes(e.unit)) return 'Ek içeriklerde ad, miktar ve birimi kontrol et'
  if (i.daily !== null && !(Number.isInteger(i.daily) && i.daily >= 1 && i.daily <= 20)) return 'Günlük hedef 1–20 porsiyon'
  return null
}
