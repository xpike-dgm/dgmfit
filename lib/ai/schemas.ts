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
  type: z.enum(['goal_date', 'add_exercise', 'log_water', 'plan_menu']),
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
  lookups: z.array(z.strictObject({
    kind: z.enum(['gun', 'donem', 'hareket', 'besin']).describe('gun: bir günün tam dökümü ve öğünleri; donem: iki tarih arası ortalamalar; hareket: bir hareketin geçmişi; besin: veritabanında besin değeri'),
    date: z.string().max(10).nullable().describe('gun: YYYY-MM-DD'), from: z.string().max(10).nullable().describe('donem: başlangıç YYYY-MM-DD'), to: z.string().max(10).nullable().describe('donem: bitiş YYYY-MM-DD'),
    query: z.string().max(60).nullable().describe('hareket/besin: aranacak ad'),
  })).max(4).describe('BAĞLAM\'da olmayan veriye ihtiyacın varsa iste (ör. geçen salı, geçen ay, bench press geçmişi); uygulama sonuçlarla seni yeniden çağırır. Gerekmiyorsa boş.'),
  mealPlan: z.strictObject({
    protein: z.number().min(0).max(1000).nullable(), carb: z.number().min(0).max(2000).nullable(), fat: z.number().min(0).max(1000).nullable(), kcal: z.number().min(0).max(6000).nullable(),
  }).nullable().describe('Kullanıcı "ne yesem", "kalanıma göre öner" ya da makro sınırlı öğün isterse: kullanıcının koyduğu üst sınırlar (yoksa null). Uygulama veritabanından öneri kartı hesaplar; reply\'da gram/kalori yazma.'),
  remember: z.array(z.string().min(3).max(160)).max(3).describe('Kullanıcı hakkında kalıcı olarak hatırlanmaya değer yeni bilgi (tercih, alışkanlık, sağlık sınırı, program); yoksa boş. Zaten NOTLAR\'da olanı tekrar yazma.'),
  memo: z.string().max(600).nullable().describe('Bu sohbetin şimdiye kadarki kısa özeti (kararlar, kullanıcının sınırları, konuşulan gün); uzun sohbetlerde eski mesajlar unutulmasın diye. Kısa sohbette null.'),
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

const Named = z.strictObject({ name: z.string().min(1).max(80).describe('KATALOG\'daki adı aynen yaz; katalogda yoksa Türkçe genel ad'), grams: z.number().min(0.5).max(1500).describe('Gram (sıvıda ml ≈ g; tuz/baharat gibi az miktarlar da olabilir)') })
export const MenuResult = z.strictObject({
  days: z.array(z.strictObject({
    meals: z.array(z.strictObject({ meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']), items: z.array(Named).min(1).max(6) })).min(2).max(5),
  })).min(1).max(7),
  prepSteps: z.array(z.string().min(1).max(200)).max(8).describe('Toplu hazırlık istendiyse adımlar, değilse boş'),
})
export type MenuResult = z.infer<typeof MenuResult>
export const PantryResult = z.strictObject({
  recipes: z.array(z.strictObject({
    title: z.string().min(1).max(80), minutes: z.number().int().min(5).max(180), servings: z.number().int().min(1).max(6),
    ingredients: z.array(Named).min(1).max(12).describe('Tarifin tamamı için malzemeler'), steps: z.array(z.string().min(1).max(220)).min(1).max(8),
  })).max(3),
  note: z.string().max(200).nullable(),
})
export type PantryResult = z.infer<typeof PantryResult>
export const RestaurantResult = z.strictObject({
  dishes: z.array(z.strictObject({
    menuName: z.string().min(1).max(80).describe('Menüde yazdığı gibi'), food: z.string().min(1).max(80).describe('KATALOG\'daki en yakın ad ya da Türkçe genel ad'),
    grams: z.number().min(20).max(1500).describe('Restoranda tipik tek porsiyon gramı'),
  })).max(20),
  note: z.string().max(200).nullable(),
})
export type RestaurantResult = z.infer<typeof RestaurantResult>
export const ProgramResult = z.strictObject({
  name: z.string().min(1).max(60),
  days: z.array(z.strictObject({
    name: z.string().min(1).max(40), focus: z.string().max(80),
    exercises: z.array(z.strictObject({ name: z.string().min(1).max(80).describe('HAREKETLER listesindeki adı aynen yaz'), sets: z.number().int().min(1).max(8), repMin: z.number().int().min(1).max(50), repMax: z.number().int().min(1).max(50), rir: z.number().int().min(0).max(5), rest: z.number().int().min(20).max(400).describe('saniye') })).min(1).max(10),
  })).min(1).max(7),
  notes: z.array(z.string().max(200)).max(4),
})
export type ProgramResult = z.infer<typeof ProgramResult>

export const ModerateResult = z.strictObject({
  verdict: z.enum(['ok', 'review', 'block']).describe('ok: sorun yok; review: insan incelemesi gerekir; block: açıkça uygunsuz'),
  categories: z.array(z.enum(['cinsel', 'şiddet', 'taciz', 'nefret', 'zararlı-diyet', 'kendine-zarar', 'spam', 'kişisel-bilgi'])).max(5),
  reason: z.string().max(160).nullable(),
})

const COACH_RULES = [
  'Sen DgFit uygulamasının Türkçe konuşan koçusun. Kullanıcının verisi BAĞLAM bölümünde; oradaki sayılar uygulamanın test edilmiş motorlarıyla hesaplandı.',
  'Kurallar:',
  '1) Sayı uydurma. Yalnızca BAĞLAM\'daki sayıları kullan; bir veri yoksa "bu veri henüz yok" de. Kalori ya da makro hesaplama yapma.',
  '2) Tıbbi teşhis, tedavi, ilaç ya da takviye dozu önerme. Hastalık, hamilelik, ağrı ya da sakatlıkta hekime yönlendir ve safety="tibbi".',
  '3) Yeme bozukluğu işaretlerinde (kusma, aç kalma, laksatif, aşırı kısıtlama, yemekten sonra suçluluk) nazikçe bir uzmana yönlendir, kalori açığını artıracak hiçbir öneri yapma, safety="yeme-bozuklugu". Kendine zarar verme ifadesinde kısa ve şefkatli cevap ver, 112\'yi hatırlat, safety="kriz".',
  '4) Güvenli kalori tabanının altını ya da haftada vücut ağırlığının %1\'inden hızlı kilo kaybını asla önerme. BAĞLAM\'da güvenlik bayrağı varsa hedefi hızlandıran öneri yapma.',
  '5) Eylemleri kendin yapamazsın; yalnızca actions\'a öner, kullanıcı onaylar. Yalnızca kullanıcı istediğinde ya da açıkça faydalıysa öner. goal_date: hedef tarihini weeks hafta uzat (+) ya da kısalt (−). add_exercise: aktif programdaki bir güne hareket ekle. log_water: su ya da içecek kaydı. plan_menu: yarın için menü hazırla (tüm alanlar null). Kullanılmayan alanlar null.',
  '6) Kullanıcı bir yiyeceği yerse ne olacağını sorarsa whatIf\'e yiyecekleri ve tahmini gramı yaz; reply\'da o yiyeceğin kalorisini yazma, uygulama kartta veritabanından hesaplar.',
  '7) Kısa yaz (en fazla 8 cümle). Madde işareti kullanabilirsin; başlık ve tablo kullanma. Kullanıcıya "sen" diye hitap et.',
  '8) Sohbetin akışını izle. Kısa takip soruları ("kalan değerler nedir", "peki yağ?", "ya protein?") önceki mesajlardaki gün ve konuya aittir: kullanıcı bir gün belirttiyse (ör. "dün") aksini söyleyene kadar o günün değerlerini ver. "Kalan besin değerleri" sorulursa kalori, protein, karbonhidrat, yağ ve suyun hepsini BAĞLAM\'daki "kalan / fazla" sayılarıyla ver.',
  '9) Kullanıcının koyduğu sınırları (ör. "en çok 20 g protein, 230 g karbonhidrat, 30 g yağ") sohbet boyunca unutma; öneri yaparken bu sınırlara uy, gerekiyorsa whatIf ile uygulamaya hesaplat. Sınır kalan değerlerle çelişiyorsa bunu açıkça söyle.',
  '10) Veri isteme: BAĞLAM\'da olmayan bir gün, dönem, hareket ya da besin gerekiyorsa lookups doldur ve reply\'a kısa bir ara cümle yaz ("Bakıyorum…"); uygulama ARAÇ SONUÇLARI ile seni tekrar çağırır, o zaman lookups boş olsun ve tam cevabı ver. Öğün önerisi istenirse mealPlan doldur. Kalıcı bilgi için remember, uzun sohbette memo kullan.',
].join('\n')

export const TASKS = {
  'meal-photo': {
    schema: MealResult,
    system: 'Sen bir beslenme kayıt yardımcısısın. Fotoğraftaki yiyecek ve içecekleri ayrı ayrı listele, her biri için Türkçe genel adını ve tabaktaki miktarı gram olarak tahmin et. Miktar için ölçek kullan: standart yemek tabağı ≈ 26 cm, servis tabağı ≈ 20 cm, çorba kasesi ≈ 300 ml, çay bardağı ≈ 100 ml, su bardağı ≈ 200 ml, çatal ≈ 19 cm, avuç içi ≈ 90 g et; tabağın kaplanan alanını ve yemeğin yüksekliğini dikkate al. Pişmiş ağırlık ver (ör. pişmiş pilav 1 servis kaşığı ≈ 40 g). Kalori veya besin değeri hesaplama; bunu uygulama veritabanından yapacak. Emin olmadığında confidence "düşük" ver ve note alanında kısaca belirt. Yemek olmayan bir fotoğrafta items boş olsun.',
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
  moderate: {
    schema: ModerateResult,
    system: 'Bir fitness ve beslenme uygulamasının sosyal akışı için içerik moderatörüsün. Gönderi metnini ve varsa fotoğrafları değerlendir. Engelle (block): çıplaklık/cinsel içerik, şiddet, nefret söylemi, açık taciz. İncelemeye al (review): kişiyi aşağılama, aşırı düşük kalori/kusma/laksatif gibi zararlı diyet önerisi, kendine zarar ima eden ifade, spam, telefon/adres gibi kişisel bilgi. Spor salonu, antrenman, yemek, ilerleme fotoğrafı (spor kıyafeti, mayo) normaldir: ok. Emin değilsen review.',
  },
  menu: {
    schema: MenuResult,
    system: 'Sen DgFit\'in Türk mutfağını iyi bilen menü planlayıcısısın. Her gün için verilen kalori ve protein hedefine yakın, dengeli, uygulanabilir öğünler öner. Besinleri mümkünse KATALOG\'daki adlarla aynen yaz ve gram ver; kalori hesaplama (uygulama veritabanından hesaplar ve gramları hedefe ölçekler). Alerjilere ve beslenme tercihine kesinlikle uy. Bütçe düzeyine uy (ekonomik: bakliyat, yumurta, mevsim sebzesi; serbest: balık, kırmızı et de olabilir). Günler arasında çeşitlilik olsun ama alışveriş kolay kalsın. Toplu hazırlık istenmediyse prepSteps boş.',
  },
  pantry: {
    schema: PantryResult,
    system: 'Kullanıcının elindeki malzemelerle yapılabilecek en fazla 3 Türkçe tarif öner. Esas olarak verilen malzemeleri kullan; tuz, baharat, sıvı yağ gibi temel ürünler eklenebilir. Malzemeleri mümkünse KATALOG\'daki adlarla ve tarifin tamamı için gramla yaz; kalori hesaplama (uygulama hesaplar ve porsiyonu kalan bütçeye ölçekler). Adımlar kısa ve net olsun. Alerjilere uy.',
  },
  restaurant: {
    schema: RestaurantResult,
    system: 'Fotoğraftaki restoran menüsünü oku ve yemekleri listele. Her yemek için menüde yazan adı, KATALOG\'daki en yakın besin adını (yoksa Türkçe genel ad) ve Türkiye\'de restoranda tipik tek porsiyon gramını yaz. Kalori hesaplama; uygulama veritabanından hesaplar. İçecek ve tatlıları da dahil et. Menü okunamıyorsa dishes boş, note\'ta kısa açıklama.',
  },
  program: {
    schema: ProgramResult,
    system: 'Sen deneyimli bir kuvvet antrenörüsün. Verilen deneyim, haftalık gün, seans süresi, ekipman, hedef ve zayıf kas gruplarına göre bir antrenman programı yaz. Hareketleri yalnızca HAREKETLER listesinden, adlarını aynen yazarak seç. Her kas grubu için haftalık 10–20 çalışma seti hedefle, zayıf gruplara biraz daha fazla hacim ver. Bileşik hareketler önce gelsin. Yeni başlayana az hareket, RIR 2–3. Seans süresine sığacak sayıda hareket seç. Tıbbi tavsiye verme; notes\'ta en fazla 4 kısa not.',
  },
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
/** Kullanıcının günlük AI hakkına sayılan görevler (spesifikasyon 11.5: fotoğraf/ses ve koç sohbeti; menü/tarif/restoran/program da kullanıcı tetikli olduğu için sayılır — DECISIONS). */
export const USER_QUOTA_TASKS: Task[] = ['meal-photo', 'meal-text', 'label', 'coach', 'menu', 'pantry', 'restaurant', 'program']

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
/**
 * Model yanıtını şemayla doğrular. Yalnızca sayı sınırı aşımı varsa (ör. tuz 2 g, süre 200 dk) değer sınıra çekilip
 * bir kez daha denenir: tek bir küçük sapma yüzünden tüm yanıt atılmaz. Diğer hatalar (eksik alan, yanlış tür) reddedilir.
 */
export function parseResult<T extends Task>(task: T, text: string): z.infer<(typeof TASKS)[T]['schema']> {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('AI yanıtı JSON değil')
  const raw = JSON.parse(text.slice(start, end + 1))
  // Y2: koçun sonradan eklenen alanları eksik gelirse varsayılanla doldurulur (eski/yedek sağlayıcı yanıtı bozulmasın)
  if (task === 'coach' && raw && typeof raw === 'object') raw.lookups ??= [], raw.mealPlan ??= null, raw.remember ??= [], raw.memo ??= null
  const schema = TASKS[task].schema
  const first = schema.safeParse(raw)
  if (first.success) return first.data as never
  const issues = first.error.issues
  if (!issues.every((i) => (i.code === 'too_small' || i.code === 'too_big') && 'origin' in i && i.origin === 'number')) throw first.error
  for (const i of issues) {
    let o: Record<string | number, unknown> = raw
    for (const k of i.path.slice(0, -1)) o = o?.[k as string] as Record<string | number, unknown>
    const last = i.path.at(-1) as string
    if (!o || typeof o[last] !== 'number' || (o[last] as number) < 0) throw first.error // negatif değer anlamsız: düzeltilmez
    const lim = Number((i as { minimum?: number | bigint; maximum?: number | bigint }).minimum ?? (i as { maximum?: number | bigint }).maximum)
    o[last] = lim
  }
  return schema.parse(raw) as never
}

/** Etiket "porsiyon" bazındaysa 100 g'a çevirir (motor hesaplar, model değil). */
export function labelPer100(l: LabelResult): { kcal: number | null; protein: number | null; carb: number | null; fat: number | null; sugar: number | null; fiber: number | null; salt: number | null; satFat: number | null } | null {
  const k = l.basis === 'porsiyon' ? (l.servingGrams ? 100 / l.servingGrams : null) : l.basis === 'okunamadı' ? null : 1
  if (k === null) return null
  const f = (v: number | null) => (v === null ? null : Math.round(v * k * 10) / 10)
  return { kcal: f(l.kcal), protein: f(l.protein), carb: f(l.carb), fat: f(l.fat), sugar: f(l.sugar), fiber: f(l.fiber), salt: f(l.salt), satFat: f(l.satFat) }
}
