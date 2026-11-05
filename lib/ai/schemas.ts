// AI görevlerinin çıktı şemaları — saf (zod 4). Sağlayıcıya JSON Schema olarak gönderilir, dönen JSON aynı şemayla doğrulanır.
// Kural: model kalori/makro HESAPLAMAZ; yalnızca besin adı ve tahmini gram verir. Etikette yalnızca okuduğu sayıları yazar.
import { z } from 'zod'
import { DRINKS } from '../water.ts'

const drinkIds = Object.keys(DRINKS) as [string, ...string[]]

export const MealItem = z.strictObject({
  name: z.string().min(1).max(80).describe('Besinin Türkçe genel adı (ör. "mercimek çorbası", "simit", "beyaz peynir")'),
  grams: z.number().min(1).max(3000).describe('Tahmini yenen miktar, gram (sıvılarda ml ≈ g)'),
  portion: z.string().max(40).nullable().describe('Kullanıcının söylediği ya da görünen porsiyon (ör. "1 kase"), yoksa null'),
  drink: z.enum(drinkIds).nullable().describe('İçecekse su modülü türü, değilse null'),
  confidence: z.enum(['yüksek', 'orta', 'düşük']),
})
export const MealResult = z.strictObject({
  items: z.array(MealItem).max(15),
  note: z.string().max(200).nullable().describe('Belirsizlik varsa kullanıcıya kısa Türkçe not, yoksa null'),
})
export type MealResult = z.infer<typeof MealResult>

export const LabelResult = z.strictObject({
  name: z.string().max(80).nullable(),
  brand: z.string().max(60).nullable(),
  basis: z.enum(['100g', '100ml', 'porsiyon', 'okunamadı']).describe('Tablodaki değerlerin neye göre verildiği'),
  servingGrams: z.number().min(1).max(2000).nullable(),
  kcal: z.number().min(0).max(1000).nullable(),
  protein: z.number().min(0).max(100).nullable(),
  carb: z.number().min(0).max(100).nullable(),
  sugar: z.number().min(0).max(100).nullable(),
  fat: z.number().min(0).max(100).nullable(),
  satFat: z.number().min(0).max(100).nullable(),
  fiber: z.number().min(0).max(100).nullable(),
  salt: z.number().min(0).max(100).nullable(),
})
export type LabelResult = z.infer<typeof LabelResult>

export const TASKS = {
  'meal-photo': {
    schema: MealResult,
    system: 'Sen bir beslenme kayıt yardımcısısın. Fotoğraftaki yiyecek ve içecekleri ayrı ayrı listele, her biri için Türkçe genel adını ve tabaktaki miktarı gram olarak tahmin et. Kalori veya besin değeri hesaplama; bunu uygulama veritabanından yapacak. Emin olmadığında confidence "düşük" ver ve note alanında kısaca belirt. Yemek olmayan bir fotoğrafta items boş olsun.',
  },
  'meal-text': {
    schema: MealResult,
    system: 'Sen bir beslenme kayıt yardımcısısın. Kullanıcının Türkçe yazdığı ya da söylediği öğünü kalemlere ayır: her kalem için Türkçe genel ad ve gram (porsiyon söylendiyse yaygın gramajı tahmin et, ör. 1 dilim ekmek ≈ 25 g, 1 kase çorba ≈ 250 g, 1 su bardağı ≈ 200 ml). Kalori hesaplama. İçecekler (su, çay, kahve, ayran…) için drink alanını doldur. Belirsizse confidence "düşük" ve kısa note.',
  },
  label: {
    schema: LabelResult,
    system: 'Fotoğraftaki besin değeri tablosunu oku. Yalnızca tabloda yazan sayıları aktar, tahmin etme ya da hesaplama yapma; okunamayan değer null olsun. Değerler 100 g / 100 ml için verilmişse basis buna göre; yalnızca porsiyon başına verilmişse basis "porsiyon" ve servingGrams porsiyon gramı. Ürün adı ve marka paketten okunabiliyorsa yaz.',
  },
} as const
export type Task = keyof typeof TASKS

type J = Record<string, unknown>
const MOVE = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'maxItems', 'minItems', 'pattern', 'format']
/**
 * Yapılandırılmış çıktı modlarının desteklediği alt kümeye indirger: type/properties/required/items/enum/anyOf/description korunur,
 * ek alan kapalı; aralık ve uzunluk kısıtları açıklamaya yazılır (asıl doğrulama dönüşte zod ile yapılır).
 */
export function strictSubset(node: J): J {
  const out: J = {}
  if (Array.isArray(node.anyOf)) out.anyOf = (node.anyOf as J[]).map(strictSubset)
  if (node.type !== undefined) out.type = node.type
  if (Array.isArray(node.enum)) out.enum = node.enum
  const notes = MOVE.filter((k) => node[k] !== undefined).map((k) => `${k}: ${JSON.stringify(node[k])}`)
  const desc = [node.description, notes.length ? `(${notes.join(', ')})` : ''].filter(Boolean).join(' ')
  if (desc) out.description = desc
  if (node.type === 'object') {
    const props = (node.properties ?? {}) as Record<string, J>
    out.properties = Object.fromEntries(Object.entries(props).map(([k, v]) => [k, strictSubset(v)]))
    out.required = Object.keys(props)
    out.additionalProperties = false
  }
  if (node.type === 'array' && node.items) out.items = strictSubset(node.items as J)
  return out
}

/** Sağlayıcılara gönderilecek JSON Schema (ek alan yok, tüm alanlar zorunlu). */
export function jsonSchemaFor(task: Task): J {
  return strictSubset(z.toJSONSchema(TASKS[task].schema, { target: 'draft-2020-12' }) as J)
}

/** Dönen metni JSON olarak ayrıştırır ve şemayla doğrular; geçersizse hata. */
export function parseResult<T extends Task>(task: T, text: string): z.infer<(typeof TASKS)[T]['schema']> {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('AI yanıtı JSON değil')
  return TASKS[task].schema.parse(JSON.parse(text.slice(start, end + 1))) as never
}

/** Etiket "porsiyon" bazındaysa 100 g'a çevirir (motor hesaplar, model değil). */
export function labelPer100(l: LabelResult): { kcal: number | null; protein: number | null; carb: number | null; fat: number | null; sugar: number | null; fiber: number | null; salt: number | null; satFat: number | null } | null {
  const k = l.basis === 'porsiyon' ? (l.servingGrams ? 100 / l.servingGrams : null) : l.basis === 'okunamadı' ? null : 1
  if (k === null) return null
  const f = (v: number | null) => (v === null ? null : Math.round(v * k * 10) / 10)
  return { kcal: f(l.kcal), protein: f(l.protein), carb: f(l.carb), fat: f(l.fat), sugar: f(l.sugar), fiber: f(l.fiber), salt: f(l.salt), satFat: f(l.satFat) }
}
