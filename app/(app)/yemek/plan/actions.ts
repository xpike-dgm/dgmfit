'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getUser, rateLimit } from '@/lib/auth'
import { AiError } from '@/lib/ai/engine'
import { addDays, dayString } from '@/lib/time'
import { BUDGETS, createMenu, markPlanLogged, pantryRecipes, planMealItems, toggleShopping, type Budget, type PantryRecipe } from '@/lib/planner-data'
import { addMealItem } from '../actions'

async function uid() { const u = await getUser(); if (!u) throw new Error('Oturum yok'); return u.id }
const aiErr = (e: unknown) => (e instanceof AiError ? e.message : (console.error('[dgfit] planlama', e), 'AI isteği işlenemedi. Biraz sonra tekrar dene.'))
const Meal = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])

export async function createMenuAction(input: { days: number; start: 'today' | 'tomorrow'; budget: string; prep: boolean; note: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const p = z.object({ days: z.union([z.literal(1), z.literal(7)]), start: z.enum(['today', 'tomorrow']), budget: z.enum(Object.keys(BUDGETS) as [Budget, ...Budget[]]), prep: z.boolean(), note: z.string().trim().max(200) }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz seçim' }
  const userId = await uid()
  if (!rateLimit('menu:' + userId, 6, 3600_000)) return { ok: false, error: 'Saatte en fazla 6 menü oluşturulabilir' }
  try {
    const id = await createMenu(userId, { startDay: p.data.start === 'today' ? dayString() : addDays(dayString(), 1), days: p.data.days, budget: p.data.budget, prep: p.data.prep, note: p.data.note })
    revalidatePath('/yemek/plan')
    return { ok: true, id }
  } catch (e) { return { ok: false, error: aiErr(e) } }
}

export async function logPlanMealAction(input: { planId: string; day: string; meal: string }): Promise<{ ok: true; n: number; kcal: number } | { ok: false; error: string }> {
  const p = z.object({ planId: z.string().uuid(), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), meal: Meal }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz istek' }
  if (p.data.day > dayString()) return { ok: false, error: 'Gelecek günün öğünü henüz eklenemez' }
  const userId = await uid()
  const items = await planMealItems(userId, p.data.planId, p.data.day, p.data.meal)
  let kcal = 0
  const done: number[] = []
  for (const it of items) {
    const r = await addMealItem({ foodId: it.foodId!, grams: Math.round(it.grams), meal: p.data.meal, day: p.data.day, source: 'plan' })
    if (!r.ok) return { ok: false, error: r.error }
    kcal += r.kcal; done.push(it.id)
  }
  await markPlanLogged(userId, done)
  revalidatePath('/yemek/plan')
  return { ok: true, n: done.length, kcal }
}

export async function toggleShoppingAction(id: number, checked: boolean): Promise<{ ok: boolean }> {
  if (!Number.isInteger(id)) return { ok: false }
  await toggleShopping(await uid(), id, checked)
  return { ok: true }
}

export async function pantryAction(text: string): Promise<{ ok: true; remaining: number; recipes: PantryRecipe[]; note: string | null; provider: string } | { ok: false; error: string }> {
  const t = z.string().trim().min(3).max(500).safeParse(text)
  if (!t.success) return { ok: false, error: 'Malzemeleri 3–500 karakterle yaz' }
  try { return { ok: true, ...(await pantryRecipes(await uid(), t.data)) } } catch (e) { return { ok: false, error: aiErr(e) } }
}

/** Elimdekiler / restoran: seçilen porsiyonu günlüğe ekler (kalori veritabanından, addMealItem). */
export async function addPortionAction(input: { meal: string; items: { foodId: number; grams: number }[] }): Promise<{ ok: true; kcal: number } | { ok: false; error: string }> {
  const p = z.object({ meal: Meal, items: z.array(z.object({ foodId: z.number().int().positive(), grams: z.number().min(1).max(3000) })).min(1).max(15) }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz porsiyon' }
  let kcal = 0
  for (const it of p.data.items) {
    const r = await addMealItem({ foodId: it.foodId, grams: Math.round(it.grams), meal: p.data.meal, source: 'ai' })
    if (!r.ok) return { ok: false, error: r.error }
    kcal += r.kcal
  }
  return { ok: true, kcal }
}
