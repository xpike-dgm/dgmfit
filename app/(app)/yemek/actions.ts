'use server'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { publish } from '@/lib/events'
import { dayString } from '@/lib/time'
import { macrosFor } from '@/lib/food'
import { computeRecipe, normalizeSearch, NUTRIENT_KEYS, type Nutrients } from '@/lib/nutrition'
import { ensureWaterSetup } from '@/lib/water-data'

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const Meal = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

async function uid() {
  const u = await getUser()
  if (!u) throw new Error('Oturum yok')
  return u.id
}

function checkDay(day: string | undefined) {
  const today = dayString()
  const d = day ?? today
  if (d > today) throw new Error('Gelecekteki bir güne kayıt eklenemez')
  return d
}

/** Çorba, ayran gibi su oranı yüksek yemeklerden gelen suyu (ayar açıksa) Su modülüne ekler. */
async function maybeFoodWater(userId: string, itemId: number, per100: Nutrients, grams: number, category: string | null, day: string) {
  const water = ((per100.water ?? 0) * grams) / 100
  const liquid = (per100.water ?? 0) >= 80 && /Çorba|İçecek|Süt/i.test(category ?? '')
  if (!liquid || water < 50) return
  await ensureWaterSetup(userId)
  const [s] = await db.select({ on: schema.waterSettings.foodWater }).from(schema.waterSettings).where(eq(schema.waterSettings.userId, userId)).limit(1)
  if (!s?.on) return
  const ml = Math.round(water / 10) * 10
  const at = day === dayString() ? new Date() : new Date(`${day}T12:00:00+03:00`)
  await db.insert(schema.waterLogs).values({ userId, loggedAt: at, ml, drink: 'water', hydration: 1, effectiveMl: ml, source: 'meal', note: `meal_item:${itemId}`, history: [{ at: new Date().toISOString(), action: 'create' }] })
}

const AddInput = z.object({
  foodId: z.number().int().positive(),
  grams: z.number().min(1).max(5000),
  portionLabel: z.string().max(80).nullable().optional(),
  portionQty: z.number().min(0.05).max(100).nullable().optional(),
  meal: Meal,
  day: Day.optional(),
  source: z.enum(['search', 'recent', 'barcode', 'saved', 'recipe']).default('search'),
})

export async function addMealItem(input: z.input<typeof AddInput>): Promise<R<{ id: number; kcal: number }>> {
  const userId = await uid()
  const p = AddInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz miktar' }
  let day: string
  try { day = checkDay(p.data.day) } catch (e) { return { ok: false, error: (e as Error).message } }
  const [f] = await db.select().from(schema.foods).where(and(eq(schema.foods.id, p.data.foodId), isNull(schema.foods.deletedAt))).limit(1)
  if (!f || (f.userId && f.userId !== userId)) return { ok: false, error: 'Besin bulunamadı' }
  const m = macrosFor(f.per100, p.data.grams)
  const [row] = await db.insert(schema.mealItems).values({
    userId, day, meal: p.data.meal, foodId: f.id, name: f.nameTr ?? f.nameEn ?? 'Besin', grams: p.data.grams,
    portionLabel: p.data.portionLabel ?? null, portionQty: p.data.portionQty ?? null, per100: f.per100, ...m, source: p.data.source,
  }).returning({ id: schema.mealItems.id })
  await maybeFoodWater(userId, row.id, f.per100, p.data.grams, f.category, day)
  await publish(userId, 'meal.logged', { id: row.id, day, meal: p.data.meal, ...m })
  revalidatePath('/'); revalidatePath('/yemek')
  return { ok: true, id: row.id, kcal: m.kcal }
}

const EditInput = z.object({ id: z.number().int(), grams: z.number().min(1).max(5000), portionLabel: z.string().max(80).nullable(), portionQty: z.number().min(0.05).max(100).nullable(), meal: Meal })

export async function updateMealItem(input: z.input<typeof EditInput>): Promise<R> {
  const userId = await uid()
  const p = EditInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz değer' }
  const [it] = await db.select().from(schema.mealItems).where(and(eq(schema.mealItems.id, p.data.id), eq(schema.mealItems.userId, userId), isNull(schema.mealItems.deletedAt))).limit(1)
  if (!it) return { ok: false, error: 'Kayıt bulunamadı' }
  const m = it.per100 ? macrosFor(it.per100, p.data.grams) : { kcal: it.kcal, protein: it.protein, carb: it.carb, fat: it.fat }
  await db.update(schema.mealItems).set({ grams: p.data.grams, portionLabel: p.data.portionLabel, portionQty: p.data.portionQty, meal: p.data.meal, ...m }).where(eq(schema.mealItems.id, it.id))
  revalidatePath('/'); revalidatePath('/yemek')
  return { ok: true }
}

export async function deleteMealItem(id: number): Promise<R> {
  const userId = await uid()
  const res = await db.update(schema.mealItems).set({ deletedAt: new Date() }).where(and(eq(schema.mealItems.id, id), eq(schema.mealItems.userId, userId), isNull(schema.mealItems.deletedAt))).returning({ id: schema.mealItems.id })
  if (!res.length) return { ok: false, error: 'Kayıt bulunamadı' }
  // bu yemekten Su'ya aktarılmış kayıt varsa onu da kaldır
  await db.update(schema.waterLogs).set({ deletedAt: new Date() }).where(and(eq(schema.waterLogs.userId, userId), eq(schema.waterLogs.note, `meal_item:${id}`), isNull(schema.waterLogs.deletedAt)))
  revalidatePath('/'); revalidatePath('/yemek')
  return { ok: true }
}

const QuickInput = z.object({ name: z.string().trim().max(60).optional(), kcal: z.number().int().min(1).max(5000), protein: z.number().min(0).max(500).optional(), carb: z.number().min(0).max(1000).optional(), fat: z.number().min(0).max(500).optional(), meal: Meal, day: Day.optional() })

export async function addQuickCalories(input: z.input<typeof QuickInput>): Promise<R> {
  const userId = await uid()
  const p = QuickInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Kalori 1–5000 arasında olmalı' }
  let day: string
  try { day = checkDay(p.data.day) } catch (e) { return { ok: false, error: (e as Error).message } }
  const [row] = await db.insert(schema.mealItems).values({ userId, day, meal: p.data.meal, name: p.data.name || 'Hızlı kalori', grams: 0, kcal: p.data.kcal, protein: p.data.protein ?? 0, carb: p.data.carb ?? 0, fat: p.data.fat ?? 0, source: 'quick' }).returning({ id: schema.mealItems.id })
  await publish(userId, 'meal.logged', { id: row.id, day, meal: p.data.meal, kcal: p.data.kcal, quick: true })
  revalidatePath('/'); revalidatePath('/yemek')
  return { ok: true }
}

const CopyInput = z.object({ fromDay: Day, fromMeal: Meal, toDay: Day, toMeal: Meal })

/** Bir günün öğününü başka güne kopyalar (ör. "dünkü kahvaltı"). */
export async function copyMeal(input: z.input<typeof CopyInput>): Promise<R<{ count: number }>> {
  const userId = await uid()
  const p = CopyInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz kopyalama' }
  try { checkDay(p.data.toDay) } catch (e) { return { ok: false, error: (e as Error).message } }
  const items = await db.select().from(schema.mealItems).where(and(eq(schema.mealItems.userId, userId), eq(schema.mealItems.day, p.data.fromDay), eq(schema.mealItems.meal, p.data.fromMeal), isNull(schema.mealItems.deletedAt)))
  if (!items.length) return { ok: false, error: 'Kopyalanacak kayıt yok' }
  await db.insert(schema.mealItems).values(items.map((i) => ({ userId, day: p.data.toDay, meal: p.data.toMeal, foodId: i.foodId, name: i.name, grams: i.grams, portionLabel: i.portionLabel, portionQty: i.portionQty, per100: i.per100, kcal: i.kcal, protein: i.protein, carb: i.carb, fat: i.fat, source: 'copy' })))
  await publish(userId, 'meal.logged', { day: p.data.toDay, meal: p.data.toMeal, copied: items.length })
  revalidatePath('/'); revalidatePath('/yemek')
  return { ok: true, count: items.length }
}

export async function saveMealAsTemplate(day: string, meal: string, name: string): Promise<R> {
  const userId = await uid()
  const pd = Day.safeParse(day), pm = Meal.safeParse(meal), pn = z.string().trim().min(1).max(40).safeParse(name)
  if (!pd.success || !pm.success || !pn.success) return { ok: false, error: 'Öğün adı gerekli' }
  const items = await db.select().from(schema.mealItems).where(and(eq(schema.mealItems.userId, userId), eq(schema.mealItems.day, pd.data), eq(schema.mealItems.meal, pm.data), isNull(schema.mealItems.deletedAt)))
  const list = items.filter((i) => i.foodId).map((i) => ({ foodId: i.foodId!, grams: i.grams, portionLabel: i.portionLabel, portionQty: i.portionQty }))
  if (!list.length) return { ok: false, error: 'Bu öğünde kaydedilecek besin yok' }
  await db.insert(schema.savedMeals).values({ userId, name: pn.data, items: list })
  revalidatePath('/yemek/ekle')
  return { ok: true }
}

export async function addSavedMeal(savedId: string, meal: string, day?: string): Promise<R<{ count: number }>> {
  const userId = await uid()
  const pm = Meal.safeParse(meal)
  if (!pm.success) return { ok: false, error: 'Geçersiz öğün' }
  const [s] = await db.select().from(schema.savedMeals).where(and(eq(schema.savedMeals.id, savedId), eq(schema.savedMeals.userId, userId))).limit(1)
  if (!s) return { ok: false, error: 'Kayıtlı öğün bulunamadı' }
  let n = 0
  for (const it of s.items) { const r = await addMealItem({ foodId: it.foodId, grams: it.grams, portionLabel: it.portionLabel, portionQty: it.portionQty, meal: pm.data, day, source: 'saved' }); if (r.ok) n++ }
  return { ok: true, count: n }
}

const FoodInput = z.object({
  name: z.string().trim().min(2).max(80),
  brand: z.string().trim().max(60).optional(),
  barcode: z.string().regex(/^\d{8,14}$/).optional().or(z.literal('')),
  basis: z.enum(['100g', 'serving']),
  servingG: z.number().min(1).max(3000).optional(),
  servingLabel: z.string().trim().max(40).optional(),
  kcal: z.number().min(0).max(1000 * 30),
  protein: z.number().min(0).max(3000), carb: z.number().min(0).max(3000), fat: z.number().min(0).max(3000),
  fiber: z.number().min(0).max(3000).optional(), sugar: z.number().min(0).max(3000).optional(), satFat: z.number().min(0).max(3000).optional(), sodium: z.number().min(0).max(100000).optional(),
})

/** Kullanıcının kendi besini. Porsiyon bazında girilirse 100 g'a çevrilir. */
export async function createFood(input: z.input<typeof FoodInput>): Promise<R<{ id: number }>> {
  const userId = await uid()
  const p = FoodInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Ad, kalori ve makrolar gerekli' }
  const d = p.data
  if (d.basis === 'serving' && !d.servingG) return { ok: false, error: 'Porsiyon gramajı gerekli' }
  const f = d.basis === 'serving' ? 100 / d.servingG! : 1
  const per100: Nutrients = {}
  for (const k of ['kcal', 'protein', 'carb', 'fat', 'fiber', 'sugar', 'satFat', 'sodium'] as const) if (d[k] !== undefined) per100[k] = Math.round(d[k]! * f * 10) / 10
  if ((per100.protein ?? 0) + (per100.carb ?? 0) + (per100.fat ?? 0) > 100.5) return { ok: false, error: '100 g başına protein + karbonhidrat + yağ 100 g\'ı geçemez. Değerleri kontrol et.' }
  const portions = [...(d.servingG ? [{ label: d.servingLabel || `1 porsiyon (${d.servingG} g)`, g: d.servingG }] : []), { label: '100 g', g: 100 }]
  const [row] = await db.insert(schema.foods).values({
    source: 'user', sourceId: crypto.randomUUID(), userId, nameTr: d.name, brand: d.brand || null, barcode: d.barcode || null, category: 'Kendi besinim',
    per100, kcal: per100.kcal ?? 0, protein: per100.protein ?? 0, carb: per100.carb ?? 0, fat: per100.fat ?? 0, portions,
    search: normalizeSearch([d.name, d.brand].filter(Boolean).join(' ')),
  }).returning({ id: schema.foods.id })
  revalidatePath('/yemek/ekle')
  return { ok: true, id: row.id }
}

const RecipeInput = z.object({
  name: z.string().trim().min(2).max(80),
  servings: z.number().int().min(1).max(50),
  yieldG: z.number().min(10).max(20000).optional(),
  ingredients: z.array(z.object({ foodId: z.number().int().positive(), grams: z.number().min(0.5).max(10000) })).min(1).max(40),
})

/** Kendi tarifi: besin değerleri malzemelerden hesaplanır (lib/nutrition computeRecipe). */
export async function createRecipe(input: z.input<typeof RecipeInput>): Promise<R<{ id: number; per100: Nutrients }>> {
  const userId = await uid()
  const p = RecipeInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Tarif adı, porsiyon sayısı ve en az bir malzeme gerekli' }
  const d = p.data
  const ids = [...new Set(d.ingredients.map((i) => i.foodId))]
  const foods = await db.select().from(schema.foods).where(sql`${schema.foods.id} in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) and ${schema.foods.deletedAt} is null and (${schema.foods.userId} is null or ${schema.foods.userId} = ${userId})`)
  const byId = new Map(foods.map((f) => [f.id, f]))
  if (ids.some((i) => !byId.has(i))) return { ok: false, error: 'Malzemelerden biri bulunamadı' }
  const r = computeRecipe(d.ingredients.map((i) => ({ per100: byId.get(i.foodId)!.per100, grams: i.grams })), d.yieldG)
  const per100: Nutrients = {}
  for (const k of NUTRIENT_KEYS) if (r.per100[k] !== undefined) per100[k] = r.per100[k]
  const portion = Math.round((r.yieldGrams / d.servings) * 10) / 10
  const [row] = await db.insert(schema.foods).values({
    source: 'user-recipe', sourceId: crypto.randomUUID(), userId, nameTr: d.name, category: 'Kendi tarifim', per100,
    kcal: per100.kcal ?? 0, protein: per100.protein ?? 0, carb: per100.carb ?? 0, fat: per100.fat ?? 0,
    portions: [{ label: `1 porsiyon (${portion} g)`, g: portion }, { label: '100 g', g: 100 }],
    recipe: { yield: r.yieldGrams, raw: r.rawGrams, servings: d.servings, ingredients: d.ingredients.map((i) => ({ foodId: i.foodId, name: byId.get(i.foodId)!.nameTr ?? byId.get(i.foodId)!.nameEn, g: i.grams })) },
    search: normalizeSearch(d.name), approx: true,
  }).returning({ id: schema.foods.id })
  revalidatePath('/yemek/ekle')
  return { ok: true, id: row.id, per100 }
}

export async function deleteUserFood(id: number): Promise<R> {
  const userId = await uid()
  const res = await db.update(schema.foods).set({ deletedAt: new Date() }).where(and(eq(schema.foods.id, id), eq(schema.foods.userId, userId))).returning({ id: schema.foods.id })
  if (!res.length) return { ok: false, error: 'Besin bulunamadı' }
  revalidatePath('/yemek/ekle')
  return { ok: true }
}

export async function setFoodWater(on: boolean): Promise<R> {
  const userId = await uid()
  await ensureWaterSetup(userId)
  await db.update(schema.waterSettings).set({ foodWater: on, updatedAt: new Date() }).where(eq(schema.waterSettings.userId, userId))
  revalidatePath('/su/ayarlar')
  return { ok: true }
}
