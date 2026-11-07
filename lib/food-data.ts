import 'server-only'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { normalizeSearch, searchStems } from './nutrition'
import { mapOffProduct, sumMacros, type MealId, type Macros, MEALS } from './food'

export interface FoodHit {
  id: number
  name: string
  sub: string | null
  source: string
  kcal: number
  protein: number
  carb: number
  fat: number
  portions: { label: string; g: number }[]
  approx: boolean
  attribution: string | null
  per100: Record<string, number>
}

type FoodRow = typeof schema.foods.$inferSelect

export function toHit(f: FoodRow): FoodHit {
  const name = f.nameTr ?? f.nameEn ?? 'Besin'
  const sub = f.source === 'off' ? (f.brand ?? 'Paketli ürün')
    : f.source === 'user' ? 'Kendi besinin' : f.source === 'user-recipe' ? 'Kendi tarifin'
      : f.source === 'dgfit' ? `${f.category ?? 'Yemek'} · tarif (hesaplanmış)` : f.nameTr ? (f.category ?? null) : 'USDA (İngilizce ad)'
  return { id: f.id, name, sub, source: f.source, kcal: f.kcal, protein: f.protein, carb: f.carb, fat: f.fat, portions: f.portions, approx: f.approx, attribution: f.attribution, per100: f.per100 }
}

/**
 * Türkçe karakter ve ek duyarsız arama: sorgu köklere ayrılır ("tavuklu pilav" → tavuk + pilav). Tüm kökleri içeren
 * sonuçlar önce gelir; hiçbiri tam eşleşmezse kısmi eşleşenler `partial` işaretiyle döner (arayüz "yakın sonuçlar" der).
 * Küratörlü Türkçe adlar ve kullanıcının kendi besinleri önde.
 */
export async function searchFoods(userId: string, q: string, limit = 30): Promise<(FoodHit & { partial?: boolean })[]> {
  const nq = normalizeSearch(q)
  const stems = searchStems(q)
  if (nq.length < 2 || !stems.length) return []
  const likes = stems.map((t) => '%' + t.replace(/[%_]/g, '') + '%')
  const matched = sql.join(likes.map((l) => sql`(case when f.search like ${l} then 1 else 0 end)`), sql` + `)
  const anyLike = sql.join(likes.map((l) => sql`f.search like ${l}`), sql` or `)
  const rows = await db.execute<FoodRow & { score: number; matched: number }>(sql`
    select * from (
      select f.*, (${matched})::int as matched, (
        case when f.user_id = ${userId} then 3 else 0 end
        + case when f.name_tr is not null then 2 else 0 end
        + case when f.search like ${nq + '%'} then 1.5 when f.search like ${'%' + nq + '%'} then 1 else 0 end
        + word_similarity(${nq}, f.search) * 2
      ) as score
      from foods f
      where f.deleted_at is null and (f.user_id is null or f.user_id = ${userId} or (f.source = 'user' and f.barcode is not null)) and f.source <> 'user-supplement'
        and ((${anyLike}) or word_similarity(${nq}, f.search) > (case when f.name_tr is null then 0.7 else 0.45 end))
    ) x
    where x.name_tr is not null or x.matched = ${stems.length} or x.user_id = ${userId}
    order by x.matched desc, x.score desc, length(x.search) asc
    limit ${limit}`)
  const n = stems.length
  return rows.map((r) => {
    const row = camel(r)
    const h = toHit(row)
    if (row.userId && row.userId !== userId) h.sub = `${r.brand ? r.brand + ' · ' : ''}kullanıcı ekledi`
    return { ...h, partial: n > 1 && Number(r.matched) < n ? true : undefined }
  })
}

/** postgres-js ham satırını drizzle alan adlarına çevirir. */
function camel(r: Record<string, unknown>): FoodRow {
  return {
    id: Number(r.id), source: r.source as string, sourceId: r.source_id as string, userId: (r.user_id as string) ?? null, key: (r.key as string) ?? null,
    nameTr: (r.name_tr as string) ?? null, nameEn: (r.name_en as string) ?? null, brand: (r.brand as string) ?? null, barcode: (r.barcode as string) ?? null,
    category: (r.category as string) ?? null, per100: r.per100 as Record<string, number>, kcal: Number(r.kcal), protein: Number(r.protein), carb: Number(r.carb),
    fat: Number(r.fat), portions: r.portions as { label: string; g: number }[], approx: !!r.approx, aliases: (r.aliases as string[]) ?? [], recipe: r.recipe ?? null,
    search: r.search as string, attribution: (r.attribution as string) ?? null, imageUrl: (r.image_url as string) ?? null, supplement: (r.supplement as FoodRow['supplement']) ?? null,
    createdAt: r.created_at as Date, updatedAt: r.updated_at as Date, deletedAt: (r.deleted_at as Date) ?? null,
  }
}

/** Son kullanılan ve sık yenen besinler (son 30 gün). */
export async function recentFoods(userId: string, limit = 15): Promise<(FoodHit & { lastGrams: number; lastLabel: string | null; count: number })[]> {
  const rows = await db.execute<{ food_id: number; n: number; last: Date }>(sql`
    select food_id, count(*)::int as n, max(logged_at) as last from meal_items
    where user_id = ${userId} and deleted_at is null and food_id is not null and meal <> 'supplement' and logged_at > now() - interval '30 days'
    group by food_id order by max(logged_at) desc limit ${limit}`)
  if (!rows.length) return []
  const ids = rows.map((r) => Number(r.food_id))
  const foods = await db.select().from(schema.foods).where(sql`${schema.foods.id} in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) and ${schema.foods.deletedAt} is null`)
  const last = await db.execute<{ food_id: number; grams: number; portion_label: string | null }>(sql`
    select distinct on (food_id) food_id, grams, portion_label from meal_items
    where user_id = ${userId} and deleted_at is null and food_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})
    order by food_id, logged_at desc`)
  const lastBy = new Map(last.map((l) => [Number(l.food_id), l]))
  const byId = new Map(foods.map((f) => [f.id, f]))
  return rows.flatMap((r) => {
    const f = byId.get(Number(r.food_id))
    if (!f) return []
    const l = lastBy.get(f.id)
    return [{ ...toHit(f), lastGrams: Number(l?.grams ?? 100), lastLabel: l?.portion_label ?? null, count: Number(r.n) }]
  })
}

export async function getFood(userId: string, id: number): Promise<FoodHit & { recipe: unknown; imageUrl: string | null; nameEn: string | null } | null> {
  const [f] = await db.select().from(schema.foods).where(and(eq(schema.foods.id, id), isNull(schema.foods.deletedAt))).limit(1)
  if (!f || (f.userId && f.userId !== userId && !(f.source === 'user' && f.barcode))) return null
  return { ...toHit(f), recipe: f.recipe, imageUrl: f.imageUrl, nameEn: f.nameEn }
}

export interface DiaryItem extends Macros { id: number; meal: MealId; name: string; grams: number; portionLabel: string | null; portionQty: number | null; foodId: number | null; source: string; loggedAt: string }

export async function getDiary(userId: string, day: string) {
  const rows = await db.select().from(schema.mealItems)
    .where(and(eq(schema.mealItems.userId, userId), eq(schema.mealItems.day, day), isNull(schema.mealItems.deletedAt)))
    .orderBy(asc(schema.mealItems.loggedAt), asc(schema.mealItems.id))
  const items: DiaryItem[] = rows.map((r) => ({
    id: r.id, meal: r.meal as MealId, name: r.name, grams: r.grams, portionLabel: r.portionLabel, portionQty: r.portionQty, foodId: r.foodId,
    source: r.source, loggedAt: r.loggedAt.toISOString(), kcal: r.kcal, protein: r.protein, carb: r.carb, fat: r.fat,
  }))
  const meals = MEALS.map((m) => {
    const list = items.filter((i) => i.meal === m.id)
    return { ...m, items: list, totals: sumMacros(list) }
  })
  // gün içi mikro besin özeti (anlık kopyalardan)
  const micro: Record<string, number> = {}
  for (const r of rows) {
    if (!r.per100) continue
    for (const [k, v] of Object.entries(r.per100)) if (!['kcal', 'protein', 'carb', 'fat'].includes(k)) micro[k] = (micro[k] ?? 0) + (v * r.grams) / 100
  }
  return { day, items, meals, totals: sumMacros(items), micro }
}

export async function dayMacros(userId: string, day: string): Promise<Macros> {
  const [r] = await db.execute<{ kcal: number; protein: number; carb: number; fat: number }>(sql`
    select coalesce(sum(kcal),0)::float as kcal, coalesce(sum(protein),0)::float as protein, coalesce(sum(carb),0)::float as carb, coalesce(sum(fat),0)::float as fat
    from meal_items where user_id = ${userId} and day = ${day} and deleted_at is null`)
  return { kcal: Math.round(Number(r?.kcal ?? 0)), protein: Math.round(Number(r?.protein ?? 0)), carb: Math.round(Number(r?.carb ?? 0)), fat: Math.round(Number(r?.fat ?? 0)) }
}

export async function savedMealsFor(userId: string) {
  return db.select().from(schema.savedMeals).where(eq(schema.savedMeals.userId, userId)).orderBy(desc(schema.savedMeals.createdAt)).limit(20)
}

export async function userFoods(userId: string) {
  const rows = await db.select().from(schema.foods).where(and(eq(schema.foods.userId, userId), isNull(schema.foods.deletedAt), sql`${schema.foods.source} <> 'user-supplement'`)).orderBy(desc(schema.foods.createdAt)).limit(50)
  return rows.map(toHit)
}

const OFF_UA = 'DgFit/0.1 (https://dgfit.dgmcraft.online)'

/** EAN-13 ↔ UPC-A: okuyucu 12 haneli UPC verebilir; veritabanları çoğu zaman başına 0 eklenmiş 13 haneli hâli tutar. */
export function barcodeVariants(code: string): string[] {
  const v = [code]
  if (code.length === 12) v.push('0' + code)
  if (code.length === 13 && code.startsWith('0')) v.push(code.slice(1))
  return v
}

/**
 * Barkod: önce yerel veritabanı (genel + kendi ürünlerin), sonra başka kullanıcıların eklediği ürün (topluluk),
 * sonra Open Food Facts (önbelleğe alınır). Hiçbirinde yoksa barkod "bulunamayanlar" listesine sayılır.
 */
export async function lookupBarcode(userId: string, code: string): Promise<{ hit: FoodHit | null; from: 'local' | 'community' | 'off' | 'none'; error?: string }> {
  const codes = barcodeVariants(code)
  const inCodes = sql`${schema.foods.barcode} in (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})`
  const [local] = await db.select().from(schema.foods)
    .where(and(inCodes, isNull(schema.foods.deletedAt), sql`(${schema.foods.userId} is null or ${schema.foods.userId} = ${userId})`))
    .orderBy(sql`case when ${schema.foods.userId} = ${userId} then 0 else 1 end`).limit(1)
  if (local) return { hit: toHit(local), from: 'local' }
  // Önce Open Food Facts (resmî etiket verisi); topluluk kaydı yalnızca OFF'ta yoksa ve "doğrulanmadı" etiketiyle
  // (tek bir hatalı/kötü niyetli kayıt herkesin taramasını ezmesin)
  let offError: string | undefined
  for (const c of codes) {
    const r = await offLookup(c)
    if (r.hit) return r
    if (r.error) { offError = r.error; break }
  }
  const [shared] = await db.select().from(schema.foods)
    .where(and(inCodes, isNull(schema.foods.deletedAt), eq(schema.foods.source, 'user'), sql`${schema.foods.kcal} <= 900`))
    .orderBy(desc(schema.foods.createdAt)).limit(1)
  if (shared) return { hit: { ...toHit(shared), sub: `${shared.brand ? shared.brand + ' · ' : ''}kullanıcı ekledi · doğrulanmadı`, source: 'community' }, from: 'community' }
  if (offError) return { hit: null, from: 'none', error: offError }
  await db.insert(schema.barcodeMisses).values({ code }).onConflictDoUpdate({ target: schema.barcodeMisses.code, set: { count: sql`${schema.barcodeMisses.count} + 1`, lastAt: new Date(), resolvedAt: null } })
  return { hit: null, from: 'none' }
}

/** Kullanıcı bulunamayan bir barkodla ürün eklediğinde listeden düşer. */
export async function resolveBarcodeMiss(code: string) {
  await db.update(schema.barcodeMisses).set({ resolvedAt: new Date() }).where(sql`${schema.barcodeMisses.code} in (${sql.join(barcodeVariants(code).map((c) => sql`${c}`), sql`, `)})`)
}

async function offLookup(code: string): Promise<{ hit: FoodHit | null; from: 'off' | 'none'; error?: string }> {
  try {
    const ctl = AbortSignal.timeout(8000)
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_tr,generic_name,generic_name_tr,brands,quantity,serving_size,serving_quantity,nutriments,image_front_small_url`, { headers: { 'User-Agent': OFF_UA }, signal: ctl })
    if (r.status === 404) return { hit: null, from: 'none' }
    if (!r.ok) return { hit: null, from: 'none', error: `Open Food Facts yanıt vermedi (${r.status})` }
    const j = (await r.json()) as { status?: number; product?: Record<string, unknown> }
    const m = j.status === 1 ? mapOffProduct(code, j.product) : null
    if (!m) return { hit: null, from: 'none' }
    const [row] = await db.insert(schema.foods).values({
      source: 'off', sourceId: code, nameTr: m.nameTr, brand: m.brand, barcode: code, category: 'Paketli ürün', per100: m.per100,
      kcal: m.per100.kcal ?? 0, protein: m.per100.protein ?? 0, carb: m.per100.carb ?? 0, fat: m.per100.fat ?? 0, portions: m.portions,
      search: m.search, attribution: '© Open Food Facts katkıcıları (ODbL)', imageUrl: m.imageUrl,
    }).onConflictDoUpdate({ target: [schema.foods.source, schema.foods.sourceId], set: { updatedAt: new Date() } }).returning()
    return { hit: toHit(row), from: 'off' }
  } catch {
    return { hit: null, from: 'none', error: 'Open Food Facts\'e ulaşılamadı. Ürünü elle ekleyebilirsin.' }
  }
}
