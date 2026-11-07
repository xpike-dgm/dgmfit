'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser, rateLimit } from '@/lib/auth'
import { SCREENS, isScreen } from '@/lib/cards/registry'
import { applyWizard, hideCardToday, pinCard, resetScreen, saveModules, saveNav, savePrefs, saveRules, saveScreen } from '@/lib/cards/design-data'
import { cardDef } from '@/lib/cards/registry'
import { RULES_MAX } from '@/lib/cards/prefs'

type R = { ok: true } | { ok: false; error: string }
const Items = z.array(z.object({ id: z.string().min(1).max(60), size: z.enum(['half', 'full']).optional(), stack: z.array(z.string().min(1).max(60)).max(4).optional() })).max(60)

/** Özelleştirme: ekran düzenini kaydet (sunucu kart kaydına göre yeniden doğrular). */
const HexC = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const CardColorsZ = z.object({ bg: HexC.optional(), title: HexC.optional(), text: HexC.optional(), accent: HexC.optional() }).nullable()
const Settings = z.record(z.string().max(60), z.object({ quick: z.string().max(20).optional(), colors: CardColorsZ.optional() })).optional()

export async function saveLayoutAction(screen: string, items: unknown, settings?: unknown): Promise<R> {
  const u = await requireUser()
  const p = Items.safeParse(items)
  const st = Settings.safeParse(settings)
  if (!isScreen(screen) || !p.success || !st.success) return { ok: false, error: 'Geçersiz düzen' }
  if (!rateLimit('design:' + u.id, 60, 3600_000)) return { ok: false, error: 'Çok sık kaydedildi; biraz sonra dene' }
  await saveScreen(u.id, screen, p.data, st.data ?? {})
  revalidatePath(SCREENS[screen].path); revalidatePath('/profil/ozellestirme')
  return { ok: true }
}

export async function resetLayoutAction(screen: string): Promise<R> {
  const u = await requireUser()
  if (!isScreen(screen)) return { ok: false, error: 'Geçersiz ekran' }
  await resetScreen(u.id, screen)
  revalidatePath(SCREENS[screen].path); revalidatePath('/profil/ozellestirme')
  return { ok: true }
}

// ───────── Ö1b-2: alt bar, kurallar, kullanım tercihleri ─────────
const Tab = z.enum(['today', 'plan', 'water', 'food', 'fitness', 'social', 'mine'])
const Nav = z.object({ order: z.array(Tab).max(7), hidden: z.array(Tab).max(7) }).nullable()
const Min = z.number().int().min(0).max(1439)
const Cond = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('time'), from: Min, to: Min }),
  z.object({ kind: z.literal('weekday'), days: z.array(z.number().int().min(0).max(6)).min(1).max(7) }),
  z.object({ kind: z.literal('training') }),
  z.object({ kind: z.literal('rest') }),
  z.object({ kind: z.literal('goal'), goal: z.enum(['lose', 'gain', 'recomp']) }),
])
const Act = z.object({ kind: z.enum(['top', 'hide', 'show']), card: z.string().min(1).max(60) })
const Rules = z.array(z.object({ id: z.string().min(1).max(40), name: z.string().max(40), on: z.boolean(), when: z.array(Cond).min(1).max(5), then: z.array(Act).min(1).max(6) })).max(RULES_MAX)
const Prefs = z.object({ hand: z.enum(['left', 'right']).nullable(), holdToEdit: z.boolean() })

const limited = (id: string) => !rateLimit('design:' + id, 60, 3600_000)
const everywhere = () => { revalidatePath('/', 'layout') }

export async function saveNavAction(nav: unknown): Promise<R> {
  const u = await requireUser()
  const p = Nav.safeParse(nav)
  if (!p.success) return { ok: false, error: 'Geçersiz alt bar' }
  if (limited(u.id)) return { ok: false, error: 'Çok sık kaydedildi; biraz sonra dene' }
  await saveNav(u.id, p.data)
  everywhere()
  return { ok: true }
}

export async function saveRulesAction(rules: unknown): Promise<R & { count?: number }> {
  const u = await requireUser()
  const p = Rules.safeParse(rules)
  if (!p.success) return { ok: false, error: 'Geçersiz kural' }
  if (limited(u.id)) return { ok: false, error: 'Çok sık kaydedildi; biraz sonra dene' }
  const r = await saveRules(u.id, p.data)
  everywhere()
  return { ok: true, count: r.length }
}

export async function savePrefsAction(prefs: unknown): Promise<R> {
  const u = await requireUser()
  const p = Prefs.safeParse(prefs)
  if (!p.success) return { ok: false, error: 'Geçersiz ayar' }
  if (limited(u.id)) return { ok: false, error: 'Çok sık kaydedildi; biraz sonra dene' }
  await savePrefs(u.id, p.data)
  everywhere()
  return { ok: true }
}

// ───────── Ö1b-3: kaydırma hareketleri, sihirbaz ─────────
const gestureLimited = (id: string) => !rateLimit('gesture:' + id, 120, 3600_000)
const screenOf = (id: string) => { const d = cardDef(id); return d ? SCREENS[d.screen].path : null }

export async function pinCardAction(id: string, on: boolean): Promise<R> {
  const u = await requireUser()
  const path = typeof id === 'string' ? screenOf(id) : null
  if (!path || typeof on !== 'boolean') return { ok: false, error: 'Geçersiz kart' }
  if (gestureLimited(u.id)) return { ok: false, error: 'Çok sık; biraz sonra dene' }
  await pinCard(u.id, id, on)
  revalidatePath(path)
  return { ok: true }
}

export async function hideTodayAction(id: string, on: boolean): Promise<R> {
  const u = await requireUser()
  const path = typeof id === 'string' ? screenOf(id) : null
  if (!path || typeof on !== 'boolean') return { ok: false, error: 'Geçersiz kart' }
  if (gestureLimited(u.id)) return { ok: false, error: 'Çok sık; biraz sonra dene' }
  await hideCardToday(u.id, id, on)
  revalidatePath(path)
  return { ok: true }
}

const Wizard = z.object({
  focus: z.enum(['weight', 'strength', 'health']),
  logs: z.array(z.enum(['food', 'water', 'training'])).max(3),
  detail: z.enum(['simple', 'detailed']),
  hand: z.enum(['right', 'left', 'both']),
  time: z.enum(['morning', 'evening', 'all']),
})
export async function applyWizardAction(answers: unknown): Promise<R> {
  const u = await requireUser()
  const p = Wizard.safeParse(answers)
  if (!p.success) return { ok: false, error: 'Eksik cevap' }
  if (limited(u.id)) return { ok: false, error: 'Çok sık kaydedildi; biraz sonra dene' }
  await applyWizard(u.id, { ...p.data, logs: [...new Set(p.data.logs)] })
  everywhere()
  return { ok: true }
}

// ───────── Ö2a: modül renkleri ─────────
const Modules = z.partialRecord(z.enum(['today', 'plan', 'water', 'food', 'fitness', 'social', 'coach', 'profile']), HexC).nullable()
export async function saveModulesAction(mc: unknown): Promise<R> {
  const u = await requireUser()
  const p = Modules.safeParse(mc)
  if (!p.success) return { ok: false, error: 'Geçersiz renk' }
  if (limited(u.id)) return { ok: false, error: 'Çok sık kaydedildi; biraz sonra dene' }
  await saveModules(u.id, p.data)
  everywhere()
  return { ok: true }
}
