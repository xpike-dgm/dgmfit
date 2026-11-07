'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser, rateLimit } from '@/lib/auth'
import { SCREENS, isScreen } from '@/lib/cards/registry'
import { resetScreen, saveNav, savePrefs, saveRules, saveScreen } from '@/lib/cards/design-data'
import { RULES_MAX } from '@/lib/cards/prefs'

type R = { ok: true } | { ok: false; error: string }
const Items = z.array(z.object({ id: z.string().min(1).max(60), size: z.enum(['half', 'full']).optional() })).max(60)

/** Özelleştirme: ekran düzenini kaydet (sunucu kart kaydına göre yeniden doğrular). */
export async function saveLayoutAction(screen: string, items: unknown): Promise<R> {
  const u = await requireUser()
  const p = Items.safeParse(items)
  if (!isScreen(screen) || !p.success) return { ok: false, error: 'Geçersiz düzen' }
  if (!rateLimit('design:' + u.id, 60, 3600_000)) return { ok: false, error: 'Çok sık kaydedildi; biraz sonra dene' }
  await saveScreen(u.id, screen, p.data)
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
const Tab = z.enum(['today', 'plan', 'water', 'food', 'fitness', 'social'])
const Nav = z.object({ order: z.array(Tab).max(6), hidden: z.array(Tab).max(6) }).nullable()
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
