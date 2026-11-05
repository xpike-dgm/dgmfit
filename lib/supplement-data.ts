import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { macrosFor } from './food'
import { perServing, suppToFood, sumExtras, limitWarnings, type Extra, type SuppInput } from './supplements'

export interface Supp {
  id: number; name: string; brand: string | null; unit: string; label: string; servingG: number | null; servingGrams: number
  serving: { kcal: number; protein: number; carb: number; fat: number }; extras: Extra[]; daily: number | null; count: number
}

const SUPP = 'user-supplement'

/** Kullanıcının takviyeleri ve verilen gündeki porsiyon sayısı (en çok kullanılan önce). */
export async function listSupplements(userId: string, day: string): Promise<{ items: Supp[]; extras: Extra[]; warnings: string[]; totals: { kcal: number; protein: number } }> {
  const rows = await db.select().from(schema.foods).where(and(eq(schema.foods.userId, userId), eq(schema.foods.source, SUPP), isNull(schema.foods.deletedAt))).orderBy(desc(schema.foods.updatedAt))
  if (!rows.length) return { items: [], extras: [], warnings: [], totals: { kcal: 0, protein: 0 } }
  const logs = await db.execute<{ food_id: number; n: number; grams: number; kcal: number; protein: number }>(sql`
    select food_id, count(*)::int as n, sum(grams)::float as grams, sum(kcal)::float as kcal, sum(protein)::float as protein from meal_items
    where user_id = ${userId} and day = ${day} and meal = 'supplement' and deleted_at is null group by food_id`)
  const used = await db.execute<{ food_id: number; n: number }>(sql`
    select food_id, count(*)::int as n from meal_items where user_id = ${userId} and meal = 'supplement' and deleted_at is null and day > (${day}::date - 30) group by food_id`)
  const today = new Map(logs.map((l) => [Number(l.food_id), l]))
  const freq = new Map(used.map((u) => [Number(u.food_id), Number(u.n)]))
  const items = rows.map((f) => {
    const s = f.supplement ?? { unit: 'porsiyon', servingG: null, extras: [], daily: null }
    const g = f.portions[0]?.g ?? 1
    const l = today.get(f.id)
    // porsiyon sayısı = gram toplamı / porsiyon gramı (yarım porsiyon da sayılır)
    const count = l ? Math.round((Number(l.grams) / g) * 10) / 10 : 0
    return { id: f.id, name: f.nameTr ?? 'Takviye', brand: f.brand, unit: s.unit, label: f.portions[0]?.label ?? `1 ${s.unit}`, servingG: s.servingG, servingGrams: g, serving: perServing(f.per100 as never, g), extras: s.extras, daily: s.daily, count, freq: freq.get(f.id) ?? 0 }
  }).sort((a, b) => b.freq - a.freq).map(({ freq: _f, ...x }) => x)
  const extras = sumExtras(items.map((i) => ({ extras: i.extras, count: i.count })))
  const totals = { kcal: Math.round(logs.reduce((a, l) => a + Number(l.kcal), 0)), protein: Math.round(logs.reduce((a, l) => a + Number(l.protein), 0)) }
  return { items, extras, warnings: limitWarnings(extras), totals }
}

export async function getSupplement(userId: string, id: number) {
  const [f] = await db.select().from(schema.foods).where(and(eq(schema.foods.id, id), eq(schema.foods.userId, userId), eq(schema.foods.source, SUPP), isNull(schema.foods.deletedAt))).limit(1)
  if (!f) return null
  const s = f.supplement ?? { unit: 'porsiyon', servingG: null, extras: [], daily: null }
  return { id: f.id, input: { name: f.nameTr ?? '', brand: f.brand, unit: s.unit, servingG: s.servingG, ...perServing(f.per100 as never, f.portions[0]?.g ?? 1), extras: s.extras, daily: s.daily } }
}

function values(i: SuppInput) {
  const f = suppToFood(i)
  const name = i.name.trim()
  return {
    nameTr: name, brand: i.brand?.trim() || null, category: 'Takviye', per100: f.per100, kcal: f.kcal, protein: f.protein, carb: f.carb, fat: f.fat, portions: f.portions,
    supplement: { unit: i.unit, servingG: i.servingG, extras: i.extras.map((e) => ({ name: e.name.trim(), amount: e.amount, unit: e.unit })), daily: i.daily },
    search: name.toLocaleLowerCase('tr-TR'), updatedAt: new Date(),
  }
}

export async function createSupplement(userId: string, i: SuppInput): Promise<number> {
  const [r] = await db.insert(schema.foods).values({ source: SUPP, sourceId: `${userId}:${crypto.randomUUID()}`, userId, ...values(i) }).returning({ id: schema.foods.id })
  return r.id
}
/** Düzenleme yalnızca bundan sonraki kayıtları etkiler; geçmiş günlük kayıtları anlık kopyadır. */
export async function updateSupplement(userId: string, id: number, i: SuppInput): Promise<boolean> {
  const r = await db.update(schema.foods).set(values(i)).where(and(eq(schema.foods.id, id), eq(schema.foods.userId, userId), eq(schema.foods.source, SUPP))).returning({ id: schema.foods.id })
  return r.length > 0
}
export async function deleteSupplement(userId: string, id: number): Promise<boolean> {
  const r = await db.update(schema.foods).set({ deletedAt: new Date() }).where(and(eq(schema.foods.id, id), eq(schema.foods.userId, userId), eq(schema.foods.source, SUPP))).returning({ id: schema.foods.id })
  return r.length > 0
}

/** +1 porsiyon: günlüğe takviye kaydı (öğün = supplement). */
export async function logServing(userId: string, id: number, day: string, qty = 1): Promise<boolean> {
  const [f] = await db.select().from(schema.foods).where(and(eq(schema.foods.id, id), eq(schema.foods.userId, userId), eq(schema.foods.source, SUPP), isNull(schema.foods.deletedAt))).limit(1)
  if (!f) return false
  const p = f.portions[0] ?? { label: '1 porsiyon', g: 1 }
  const grams = p.g * qty
  const m = macrosFor(f.per100 as never, grams)
  await db.insert(schema.mealItems).values({ userId, day, meal: 'supplement', foodId: f.id, name: f.brand ? `${f.nameTr} · ${f.brand}` : (f.nameTr ?? 'Takviye'), grams, portionLabel: p.label, portionQty: qty, per100: f.per100, ...m, source: 'supplement' })
  return true
}
/** −1 porsiyon: o günün son kaydını geri alır. */
export async function unlogServing(userId: string, id: number, day: string): Promise<boolean> {
  const [last] = await db.select({ id: schema.mealItems.id }).from(schema.mealItems)
    .where(and(eq(schema.mealItems.userId, userId), eq(schema.mealItems.foodId, id), eq(schema.mealItems.day, day), eq(schema.mealItems.meal, 'supplement'), isNull(schema.mealItems.deletedAt)))
    .orderBy(desc(schema.mealItems.loggedAt), desc(schema.mealItems.id)).limit(1)
  if (!last) return false
  await db.update(schema.mealItems).set({ deletedAt: new Date() }).where(eq(schema.mealItems.id, last.id))
  return true
}
