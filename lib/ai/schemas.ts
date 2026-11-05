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

export const CoachAction = z.strictObject({
  type: z.enum(['goal_date', 'add_exercise', 'log_water']),
  weeks: z.number().int().min(-12).max(12).nullable().describe('goal_date: hedef tarihini bu kadar hafta uzat (+) ya da kısalt (−); diğerlerinde null'),
  programDay: z.string().max(60).nullable().describe('add_exercise: bağlamdaki aktif program günlerinden birinin adı; diğerlerinde null'),
  exercise: z.string().max(80).nullable().describe('add_exercise: hareketin Türkçe adı (ör. "Romanya ölü kaldırışı"); diğerlerinde null'),
  sets: z.number().int().min(1).max(10).nullable(),
  repMin: z.number().int().min(1).max(50).nullable(),
  repMax: z.number().int().min(1).max(50).nullable(),
  ml: z.number().int().min(50).max(3000).nullable().describe('log_water: ml; diğerlerinde null'),
  drink: z.enum(drinkIds).nullable().describe('log_water: içecek türü; diğerlerinde null'),
})
export type CoachAction = z.infer<typeof CoachAction>
export const CoachResult = z.strictObject({
  reply: z.string().min(1).max(2400).describe('Kullanıcıya Türkçe cevap (kısa paragraflar, en fazla 8 cümle)'),
  actions: z.array(CoachAction).max(3).describe('Kullanıcının onayına sunulacak eylemler; gerekmiyorsa boş'),
  whatIf: z.array(z.strictObject({ name: z.string().min(1).max(80), grams: z.number().min(1).max(3000) })).max(5)
    .describe('Kullanıcı "şunu yersem ne olur" diye sorduysa yiyecekler ve tahmini gram; yoksa boş'),
  safety: z.enum(['yok', 'yeme-bozuklugu', 'kriz', 'tibbi']).describe('Mesajda yeme bozukluğu, kendine zarar ya da tıbbi durum işareti'),
})
export type CoachResult = z.infer<typeof CoachResult>
export const InsightResult = z.strictObject({
  title: z.string().min(1).max(70).describe('Kısa başlık'),
  body: z.string().min(1).max(320).describe('1–2 cümle; yalnızca verilen sayılar'),
})
export const WeeklyResult = z.strictObject({
  summary: z.string().min(1).max(900).describe('Haftanın 3–5 cümlelik özeti; yalnızca verilen sayılar'),
  suggestions: z.array(z.string().min(1).max(220)).min(1).max(3).describe('Somut, uygulanabilir öneriler'),
})

const COACH_RULES = [
  'Sen DgFit uygulamasının Türkçe konuşan koçusun. Kullanıcının verisi BAĞLAM bölümünde; oradaki sayılar uygulamanın test edilmiş motorlarıyla hesaplandı.',
  'Kurallar:',
  '1) Sayı uydurma. Yalnızca BAĞLAM\'daki sayıları kullan; bir veri yoksa "bu veri henüz yok" de. Kalori ya da makro hesaplama yapma.',
  '2) Tıbbi teşhis, tedavi, ilaç ya da takviye dozu önerme. Hastalık, hamilelik, ağrı ya da sakatlıkta hekime yönlendir ve safety="tibbi".',
  '3) Yeme bozukluğu işaretlerinde (kusma, aç kalma, laksatif, aşırı kısıtlama, yemekten sonra suçluluk) nazikçe bir uzmana yönlendir, kalori açığını artıracak hiçbir öneri yapma, safety="yeme-bozuklugu". Kendine zarar verme ifadesinde kısa ve şefkatli cevap ver, 112\'yi hatırlat, safety="kriz".',
  '4) Güvenli kalori tabanının altını ya da haftada vücut ağırlığının %1\'inden hızlı kilo kaybını asla önerme. BAĞLAM\'da güvenlik bayrağı varsa hedefi hızlandıran öneri yapma.',
  '5) Eylemleri kendin yapamazsın; yalnızca actions\'a öner, kullanıcı onaylar. Yalnızca kullanıcı istediğinde ya da açıkça faydalıysa öner. goal_date: hedef tarihini weeks hafta uzat (+) ya da kısalt (−). add_exercise: aktif programdaki bir güne hareket ekle. log_water: su ya da içecek kaydı. Kullanılmayan alanlar null.',
  '6) Kullanıcı bir yiyeceği yerse ne olacağını sorarsa whatIf\'e yiyecekleri ve tahmini gramı yaz; reply\'da o yiyeceğin kalorisini yazma, uygulama kartta veritabanından hesaplar.',
  '7) Kısa yaz (en fazla 8 cümle). Madde işareti kullanabilirsin; başlık ve tablo kullanma. Kullanıcıya "sen" diye hitap et.',
].join('\n')

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
  coach: { schema: CoachResult, system: COACH_RULES },
  insight: {
    schema: InsightResult,
    system: 'DgFit koçu olarak sana verilen TEK gerçeği kullanıcıya kişiliğine uygun, kısa bir içgörü kartına dönüştür. Yalnızca gerçekte geçen sayıları aynen kullan, yeni sayı ekleme. Tıbbi yorum yapma. Türkçe, "sen" diliyle.',
  },
  weekly: {
    schema: WeeklyResult,
    system: 'DgFit koçu olarak haftalık raporu yorumla. İstatistikler uygulamanın motorlarıyla hesaplandı; yalnızca verilen sayıları aynen kullan, yeni sayı ya da yüzde üretme. Güçlü yanları ve en önemli 1–2 sorunu söyle, en fazla 3 somut öneri ver. Tıbbi tavsiye verme; güvenlik bayrağı varsa daha az yemeyi ya da daha çok antrenmanı önerme. Türkçe, "sen" diliyle.',
  },
} as const
export type Task = keyof typeof TASKS
/** Kullanıcının günlük AI hakkına sayılan görevler (spesifikasyon 11.5: fotoğraf/ses ve koç sohbeti). */
export const USER_QUOTA_TASKS: Task[] = ['meal-photo', 'meal-text', 'label', 'coach']

export const PERSONAS = {
  supportive: { label: 'Destekleyici', hint: 'Sıcak, cesaretlendirici, yargısız', prompt: 'Kişilik: destekleyici. Sıcak, cesaretlendirici ve yargısız ol; küçük kazanımları fark et ve kutla.' },
  strict: { label: 'Disiplinli', hint: 'Net, doğrudan, hedef odaklı', prompt: 'Kişilik: disiplinli. Net, doğrudan ve hedef odaklı ol; bahaneyi nazikçe ama açıkça geri çevir, her cevabı somut bir sonraki adımla bitir. Asla aşağılama ya da utandırma.' },
  science: { label: 'Bilimsel', hint: 'Nedenleri kanıtla açıklar', prompt: 'Kişilik: bilimsel. Nedenleri enerji dengesi, TDEE, su tutulumu, ilerleyen aşırı yüklenme gibi kavramlarla sakin ve analitik biçimde açıkla; kesin olmayanı belirt.' },
} as const
export type Persona = keyof typeof PERSONAS

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
