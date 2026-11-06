import 'server-only'
// Planlama veri katmanı (Faz 4c): AI menü + alışveriş listesi, elimdekiler, restoran modu, AI program, karb döngüsü.
// Dil modeli ad + gram önerir; besin/hareket eşleşmesi, kalori, ölçekleme ve denetim motorlarda (lib/menu.ts, lib/ai-program.ts).
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { addDays, dayString } from './time'
import { normalizeSearch, type Nutrients } from './nutrition'
import { macrosFor } from './food'
import { searchFoods } from './food-data'
import { activeGoal, dayTargets } from './fit-data'
import { ensureGym, insertProgram, listPrograms, searchExercises } from './fitness-data'
import { itemsMacros, rankDishes, scaleToKcal, shoppingList, type PlanItem, type RankedDish } from './menu'
import { checkProgram, type Experience, type ResolvedEx } from './ai-program'
import { runTask } from './ai/engine'
import type { ProgramDay } from './programs'

// ───────── Besin kataloğu ve eşleşme ─────────

type FoodRow = typeof schema.foods.$inferSelect
const g = globalThis as unknown as { __dgfitCatalog?: { at: number; rows: FoodRow[] } }
/** Türkçe adlı küratörlü besinler (USDA + DgFit yemekleri); modele katalog olarak verilir. 10 dk bellek önbelleği. */
async function catalogRows(): Promise<FoodRow[]> {
  if (g.__dgfitCatalog && Date.now() - g.__dgfitCatalog.at < 600_000) return g.__dgfitCatalog.rows
  const rows = await db.select().from(schema.foods).where(and(inArray(schema.foods.source, ['usda', 'dgfit']), isNotNull(schema.foods.nameTr), isNull(schema.foods.deletedAt))).orderBy(asc(schema.foods.nameTr))
  g.__dgfitCatalog = { at: Date.now(), rows }
  return rows
}
export async function catalogText(): Promise<string> {
  const rows = await catalogRows()
  return 'KATALOG: ' + rows.map((r) => r.nameTr).join(' | ')
}
const bare = (s: string) => normalizeSearch(s.replace(/\(.*?\)/g, ' '))

/** Ad → besin: katalogda birebir (parantez dahil ya da hariç) → kullanıcı aramasının ilk sonucu. */
export async function resolveFood(userId: string, name: string): Promise<FoodRow | null> {
  const rows = await catalogRows()
  const n = normalizeSearch(name), b = bare(name)
  const hit = rows.find((r) => normalizeSearch(r.nameTr!) === n) ?? rows.find((r) => bare(r.nameTr!) === b) ?? rows.find((r) => (r.aliases ?? []).some((a) => normalizeSearch(a) === n))
  if (hit) return hit
  const [h] = (await searchFoods(userId, name, 3)).filter((x) => !x.partial) // yalnızca tam eşleşme (kısmi kök eşleşmesi yanlış yemeğe bağlar)
  if (!h) return null
  const [f] = await db.select().from(schema.foods).where(eq(schema.foods.id, h.id)).limit(1)
  return f ?? null
}
async function prefsText(userId: string) {
  const [p] = await db.select({ dietPref: schema.profiles.dietPref, allergies: schema.profiles.allergies }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  return `Beslenme tercihi: ${p?.dietPref ?? 'yok'}. Alerjiler/kaçınılanlar: ${p?.allergies?.length ? p.allergies.join(', ') : 'yok'}.`
}

// ───────── Menü ─────────

export const BUDGETS = { ekonomik: 'Ekonomik', orta: 'Orta', serbest: 'Serbest' } as const
export type Budget = keyof typeof BUDGETS
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack']

/** AI menüsü oluşturur: hedefler Fit'ten, gramlar günün hedef kalorisine ölçeklenir, alışveriş listesi üretilir. */
export async function createMenu(userId: string, i: { startDay: string; days: number; budget: Budget; prep: boolean; note: string }): Promise<string> {
  const goal = await activeGoal(userId)
  const end = addDays(i.startDay, i.days - 1)
  const targets = await dayTargets(userId, i.startDay, end, goal)
  const req = [
    `Gün sayısı: ${i.days} (${i.startDay} – ${end}).`,
    'Günlük hedefler: ' + targets.map((t, k) => `${k + 1}. gün ${t.kcal} kcal, protein ${t.protein} g`).join('; ') + '.',
    await prefsText(userId), `Bütçe düzeyi: ${BUDGETS[i.budget]}.`, `Toplu hazırlık (meal prep): ${i.prep ? 'istendi' : 'istenmedi'}.`,
    i.note ? `Kullanıcı notu: ${i.note.slice(0, 200)}` : '', await catalogText(),
  ].filter(Boolean).join('\n')
  const r = await runTask(userId, 'menu', { text: req, system: 'Öğünler: breakfast=kahvaltı, lunch=öğle, dinner=akşam, snack=ara öğün.' })
  const out = r.result
  const resolved = new Map<string, FoodRow | null>()
  const food = async (name: string) => { const k = normalizeSearch(name); if (!resolved.has(k)) resolved.set(k, await resolveFood(userId, name)); return resolved.get(k)! }
  const rows: (typeof schema.mealPlanItems.$inferInsert)[] = []
  const shopSrc: Parameters<typeof shoppingList>[0] = []
  for (let d = 0; d < Math.min(i.days, out.days.length); d++) {
    const day = addDays(i.startDay, d)
    const flat: (PlanItem & { meal: string; row: FoodRow | null })[] = []
    for (const m of out.days[d].meals) for (const it of m.items) { const f = await food(it.name); flat.push({ meal: m.meal, name: f?.nameTr ?? f?.nameEn ?? it.name, foodId: f?.id ?? null, grams: Math.round(it.grams), per100: (f?.per100 as Nutrients) ?? null, row: f }) }
    const scaled = scaleToKcal(flat, targets[d].kcal).items as typeof flat
    for (const it of scaled) {
      const mm = it.per100 ? macrosFor(it.per100, it.grams) : null
      rows.push({ planId: '', userId, day, meal: it.meal, foodId: it.foodId, name: it.name, grams: it.grams, kcal: mm?.kcal ?? null, protein: mm?.protein ?? null, carb: mm?.carb ?? null, fat: mm?.fat ?? null })
      shopSrc.push({ name: it.name, grams: it.grams, category: it.row?.category ?? null, recipe: (it.row?.recipe as never) ?? null })
    }
  }
  const keys = [...new Set(shopSrc.flatMap((s) => s.recipe?.ingredients.map((x) => x.key) ?? []))]
  const keyCat = new Map((keys.length ? await db.select({ key: schema.foods.key, category: schema.foods.category }).from(schema.foods).where(inArray(schema.foods.key, keys)) : []).map((x) => [x.key!, x.category]))
  const shop = shoppingList(shopSrc, (k) => keyCat.get(k) ?? null)
  return db.transaction(async (tx) => {
    // aynı günleri kapsayan önceki menüler arşivlenir
    await tx.update(schema.mealPlans).set({ deletedAt: new Date() }).where(and(eq(schema.mealPlans.userId, userId), isNull(schema.mealPlans.deletedAt),
      sql`${schema.mealPlans.startDay} <= ${end} and ${schema.mealPlans.startDay} + ${schema.mealPlans.days} - 1 >= ${i.startDay}`))
    const [p] = await tx.insert(schema.mealPlans).values({ userId, startDay: i.startDay, days: i.days, prefs: { budget: i.budget, prep: i.prep, note: i.note }, prepSteps: i.prep ? out.prepSteps : [], provider: r.provider }).returning({ id: schema.mealPlans.id })
    if (rows.length) await tx.insert(schema.mealPlanItems).values(rows.map((x) => ({ ...x, planId: p.id })))
    if (shop.length) await tx.insert(schema.shoppingItems).values(shop.map((x) => ({ planId: p.id, userId, name: x.name, grams: x.grams, aisle: x.aisle })))
    return p.id
  })
}

export async function currentPlan(userId: string, planId?: string) {
  const today = dayString()
  const conds = [eq(schema.mealPlans.userId, userId), isNull(schema.mealPlans.deletedAt)]
  if (planId) conds.push(eq(schema.mealPlans.id, planId))
  else conds.push(sql`${schema.mealPlans.startDay} + ${schema.mealPlans.days} - 1 >= ${today}`)
  const [p] = await db.select().from(schema.mealPlans).where(and(...conds)).orderBy(desc(schema.mealPlans.createdAt)).limit(1)
  if (!p) return null
  const items = await db.select().from(schema.mealPlanItems).where(eq(schema.mealPlanItems.planId, p.id)).orderBy(asc(schema.mealPlanItems.day), asc(schema.mealPlanItems.id))
  const targets = await dayTargets(userId, p.startDay, addDays(p.startDay, p.days - 1))
  const days = targets.map((t) => {
    const its = items.filter((x) => x.day === t.day)
    const meals = MEAL_ORDER.map((m) => ({ meal: m, items: its.filter((x) => x.meal === m) })).filter((m) => m.items.length)
    const sum = (k: 'kcal' | 'protein') => Math.round(its.reduce((a, x) => a + (x[k] ?? 0), 0))
    return { day: t.day, target: t.kcal, proteinTarget: t.protein, kcal: sum('kcal'), protein: sum('protein'), meals }
  })
  return { ...p, days }
}
export async function shoppingFor(userId: string, planId: string) {
  return db.select().from(schema.shoppingItems).where(and(eq(schema.shoppingItems.planId, planId), eq(schema.shoppingItems.userId, userId))).orderBy(asc(schema.shoppingItems.id))
}
export async function toggleShopping(userId: string, id: number, checked: boolean) {
  await db.update(schema.shoppingItems).set({ checked }).where(and(eq(schema.shoppingItems.id, id), eq(schema.shoppingItems.userId, userId)))
}
/** Planın bir öğünündeki eşleşmiş kalemler (günlüğe eklenecek). Ekleme sunucu aksiyonunda addMealItem ile yapılır. */
export async function planMealItems(userId: string, planId: string, day: string, meal: string) {
  return db.select().from(schema.mealPlanItems).where(and(eq(schema.mealPlanItems.planId, planId), eq(schema.mealPlanItems.userId, userId), eq(schema.mealPlanItems.day, day), eq(schema.mealPlanItems.meal, meal), isNull(schema.mealPlanItems.loggedAt), isNotNull(schema.mealPlanItems.foodId)))
}
export async function markPlanLogged(userId: string, ids: number[]) {
  if (ids.length) await db.update(schema.mealPlanItems).set({ loggedAt: new Date() }).where(and(inArray(schema.mealPlanItems.id, ids), eq(schema.mealPlanItems.userId, userId)))
}

// ───────── Elimdekiler ve restoran ─────────

async function remainingToday(userId: string) {
  const today = dayString()
  const [t] = await dayTargets(userId, today, today)
  const [r] = await db.execute<{ kcal: number }>(sql`select coalesce(sum(kcal),0)::float as kcal from meal_items where user_id = ${userId} and day = ${today} and deleted_at is null`)
  const [b] = await db.execute<{ kcal: number }>(sql`select (coalesce((select sum(kcal_net) from workouts where user_id = ${userId} and day = ${today} and deleted_at is null),0) + coalesce((select sum(kcal_net) from cardio_sessions where user_id = ${userId} and day = ${today} and deleted_at is null),0))::int as kcal`)
  return Math.round(t.kcal + Number(b?.kcal ?? 0) - Number(r?.kcal ?? 0))
}

export interface PantryRecipe { title: string; minutes: number; servings: number; steps: string[]; ingredients: { name: string; foodId: number | null; grams: number; kcal: number | null }[]; perServing: number; portion: { factor: number; kcal: number; grams: { foodId: number; name: string; grams: number }[] } }

/** Elimdekilerle tarif: malzemeler veritabanından; önerilen porsiyon kalan bütçeye ölçeklenir (tek porsiyonun 0,5–1,5 katı). */
export async function pantryRecipes(userId: string, text: string): Promise<{ remaining: number; recipes: PantryRecipe[]; note: string | null; provider: string }> {
  const remaining = await remainingToday(userId)
  const r = await runTask(userId, 'pantry', { text: `Elimdeki malzemeler: ${text.slice(0, 500)}\nBugün kalan kalori bütçesi: ${remaining} kcal.\n${await prefsText(userId)}\n${await catalogText()}`, system: 'Tarifleri 1 kişilik değil, servings kadar kişilik yaz.' })
  const recipes: PantryRecipe[] = []
  for (const rec of r.result.recipes) {
    const ings = await Promise.all(rec.ingredients.map(async (x) => { const f = await resolveFood(userId, x.name); return { name: f?.nameTr ?? f?.nameEn ?? x.name, foodId: f?.id ?? null, grams: Math.round(x.grams), per100: (f?.per100 as Nutrients) ?? null } }))
    const total = itemsMacros(ings).kcal
    const perServing = Math.round(total / rec.servings)
    const want = remaining > 150 ? Math.min(perServing * 1.5, Math.max(perServing * 0.5, remaining * 0.9)) : perServing * 0.5
    const portion = scaleToKcal(ings.map((x) => ({ ...x, grams: x.grams / rec.servings })), Math.round(want))
    recipes.push({
      title: rec.title, minutes: rec.minutes, servings: rec.servings, steps: rec.steps, perServing,
      ingredients: ings.map((x) => ({ name: x.name, foodId: x.foodId, grams: x.grams, kcal: x.per100 ? macrosFor(x.per100, x.grams).kcal : null })),
      portion: { factor: perServing ? Math.round((portion.macros.kcal / perServing) * 100) / 100 : 1, kcal: portion.macros.kcal, grams: portion.items.filter((x) => x.foodId && x.per100).map((x) => ({ foodId: x.foodId!, name: x.name, grams: x.grams })) },
    })
  }
  return { remaining, recipes, note: r.result.note, provider: r.provider }
}

export async function restaurantOptions(userId: string, image: { mime: string; data: Buffer }): Promise<{ remaining: number; top: (RankedDish & { foodId: number | null })[]; all: (RankedDish & { foodId: number | null })[]; note: string | null; provider: string }> {
  const remaining = await remainingToday(userId)
  const r = await runTask(userId, 'restaurant', { text: `Bugün kalan kalori bütçem ${remaining} kcal. ${await catalogText()}`, image })
  const opts = await Promise.all(r.result.dishes.map(async (d) => {
    const f = await resolveFood(userId, d.food)
    const m = f ? macrosFor(f.per100 as Nutrients, d.grams) : null
    return { name: d.menuName, food: f?.nameTr ?? f?.nameEn ?? null, foodId: f?.id ?? null, grams: Math.round(d.grams), kcal: m?.kcal ?? null, protein: m?.protein ?? null }
  }))
  const ranked = rankDishes(opts, remaining, opts.length) as (RankedDish & { foodId: number | null })[]
  return { remaining, top: ranked.slice(0, 3), all: ranked, note: r.result.note, provider: r.provider }
}

// ───────── AI program ─────────

export async function createAiProgram(userId: string, i: { days: number; minutes: number; equipment: string[]; weak: string[]; note: string }): Promise<{ id: string; warnings: string[]; dropped: string[] }> {
  const [prof] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  const gym = await ensureGym(userId)
  const equipment = new Set(i.equipment.length ? i.equipment : gym.equipment)
  equipment.add('body only')
  const exp = ((prof?.experience as Experience) ?? 'new')
  const pool = await db.select({ id: schema.exercises.id, key: schema.exercises.key, nameTr: schema.exercises.nameTr, kind: schema.exercises.kind, equipment: schema.exercises.equipment, primary: schema.exercises.primary, secondary: schema.exercises.secondary })
    .from(schema.exercises).where(and(eq(schema.exercises.curated, true), isNull(schema.exercises.userId), inArray(schema.exercises.equipment, [...equipment])))
  const list = pool.map((e) => `${e.nameTr} [${e.primary.join(',')}]`).join(' | ')
  const goal = (await activeGoal(userId))?.type ?? prof?.goal ?? 'recomp'
  const r = await runTask(userId, 'program', {
    text: `Deneyim: ${exp}. Haftada ${i.days} gün, seans ${i.minutes} dk. Ekipman: ${[...equipment].join(', ')}. Hedef: ${goal}. Zayıf kas grupları: ${i.weak.join(', ') || 'yok'}.${i.note ? ' Not: ' + i.note.slice(0, 200) : ''}\nHAREKETLER: ${list}`,
    system: 'Gün sayısı tam olarak istenen kadar olsun.',
  })
  const byName = new Map(pool.map((e) => [normalizeSearch(e.nameTr), e]))
  const days = await Promise.all(r.result.days.map(async (d) => ({
    name: d.name, focus: d.focus,
    exercises: await Promise.all(d.exercises.map(async (x): Promise<ResolvedEx | { unresolved: string }> => {
      let e = byName.get(normalizeSearch(x.name))
      if (!e) {
        const [h] = await searchExercises(userId, { q: x.name, limit: 1 })
        if (h) e = { id: h.id, key: h.key, nameTr: h.nameTr, kind: h.kind, equipment: h.equipment, primary: h.primary, secondary: [] }
      }
      return e ? { ...x, exerciseId: e.id, key: e.key, nameTr: e.nameTr, kind: e.kind, equipment: e.equipment, primary: e.primary, secondary: e.secondary } : { unresolved: x.name }
    })),
  })))
  const c = checkProgram({ days, wantDays: i.days, minutes: i.minutes, exp, equipment, weak: i.weak })
  const pdays: ProgramDay[] = c.days.map((d) => ({ name: d.name, focus: d.focus, exercises: d.exercises.map((e, k) => ({ key: e.key, role: k === 0 ? 'ana' : 'yardımcı', sets: e.sets, repMin: e.repMin, repMax: e.repMax, rir: e.rir, rest: e.rest, seconds: e.kind === 'time' ? 45 : undefined })) }))
  const has = (await listPrograms(userId)).some((p) => p.active)
  const notes = [...r.result.notes.slice(0, 4), ...c.warnings, ...(c.dropped.length ? ['Çıkarılan: ' + c.dropped.join(', ')] : [])].map((n) => n.slice(0, 240))
  const id = await insertProgram(userId, r.result.name.slice(0, 60) || 'AI programı', 'ai', pdays, notes, !has)
  return { id, warnings: c.warnings, dropped: c.dropped }
}

// ───────── Karb döngüsü ayarı ─────────

export async function carbCycleFor(userId: string) {
  const [r] = await db.select().from(schema.carbCycle).where(eq(schema.carbCycle.userId, userId)).limit(1)
  return r ?? { userId, enabled: false, weekdays: [] as number[], shiftG: 40, updatedAt: new Date() }
}
export async function saveCarbCycle(userId: string, v: { enabled: boolean; weekdays: number[]; shiftG: number }) {
  await db.insert(schema.carbCycle).values({ userId, ...v }).onConflictDoUpdate({ target: schema.carbCycle.userId, set: { ...v, updatedAt: new Date() } })
}
