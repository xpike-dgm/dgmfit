'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser, rateLimit } from '@/lib/auth'
import { SCREENS, isScreen } from '@/lib/cards/registry'
import { applyWizard, hideCardToday, pinCard, resetScreen, saveModules, saveNav, savePrefs, saveRules, saveScreen, saveStyle } from '@/lib/cards/design-data'
import { readMedia } from '@/lib/media'
import { activateDesign, createDesign, deleteDesign, renameDesign, restoreVersion } from '@/lib/cards/designs-data'
import { adminTemplate, deleteTemplate, publishTemplate, reactTemplate, remixTemplate, reportTemplate, useTemplate } from '@/lib/cards/templates-data'
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

// ───────── Ö2b: stil ─────────
const StyleZ = z.object({
  radius: z.enum(['sharp', 'normal', 'round']), density: z.enum(['compact', 'normal', 'airy']), font: z.enum(['default', 'rounded', 'serif', 'system']),
  icons: z.enum(['thin', 'normal', 'bold']), band: z.enum(['gradient', 'flat', 'photo']), bandMedia: z.string().regex(/^[0-9a-f-]{36}$/).nullable(),
  motion: z.enum(['normal', 'reduce']), contrast: z.enum(['normal', 'high']), haptics: z.enum(['off', 'light', 'normal', 'strong']), sound: z.boolean(), warm: z.boolean(),
  units: z.object({ weight: z.enum(['kg', 'lb']), volume: z.enum(['ml', 'oz']), energy: z.enum(['kcal', 'kJ']), length: z.enum(['cm', 'in']) }).partial(),
}).partial()
export async function saveStyleAction(patch: unknown): Promise<R> {
  const u = await requireUser()
  const p = StyleZ.safeParse(patch)
  if (!p.success) return { ok: false, error: 'Geçersiz ayar' }
  if (limited(u.id)) return { ok: false, error: 'Çok sık kaydedildi; biraz sonra dene' }
  // bant fotoğrafı yalnız kullanıcının kendi 'band' fotoğrafı olabilir
  if (p.data.bandMedia) { const m = await readMedia(u.id, p.data.bandMedia).catch(() => null); if (!m) return { ok: false, error: 'Fotoğraf bulunamadı' } }
  await saveStyle(u.id, p.data as never)
  everywhere()
  return { ok: true }
}

// ───────── Ö3a: tasarımlarım ve sürümler ─────────
const Id = z.string().regex(/^[0-9a-f-]{36}$/)
export async function designAction(input: unknown): Promise<R & { id?: string }> {
  const u = await requireUser()
  const p = z.discriminatedUnion('op', [
    z.object({ op: z.literal('create'), name: z.string().max(40), from: z.union([z.literal('default'), Id]) }),
    z.object({ op: z.literal('activate'), id: Id }),
    z.object({ op: z.literal('rename'), id: Id, name: z.string().min(1).max(40) }),
    z.object({ op: z.literal('delete'), id: Id }),
    z.object({ op: z.literal('restore'), id: Id }),
  ]).safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz istek' }
  if (limited(u.id)) return { ok: false, error: 'Çok sık; biraz sonra dene' }
  const a = p.data
  if (a.op === 'create') { const r = await createDesign(u.id, a.name, a.from); if (!r.ok) return r; everywhere(); return { ok: true, id: r.id } }
  const ok = a.op === 'activate' ? await activateDesign(u.id, a.id) : a.op === 'rename' ? await renameDesign(u.id, a.id, a.name)
    : a.op === 'delete' ? await deleteDesign(u.id, a.id) : await restoreVersion(u.id, a.id)
  if (!ok) return { ok: false, error: a.op === 'delete' ? 'Etkin tasarım silinemez' : 'Bulunamadı' }
  everywhere()
  return { ok: true }
}

// ───────── Ö3b: şablon kütüphanesi ─────────
export async function templateAction(input: unknown): Promise<R & { id?: string; status?: string }> {
  const u = await requireUser()
  const p = z.discriminatedUnion('op', [
    z.object({ op: z.literal('publish'), designId: Id, name: z.string().min(1).max(60), description: z.string().max(400).optional(), category: z.string().max(20), tags: z.array(z.string().max(30)).max(8), toFeed: z.boolean() }),
    z.object({ op: z.enum(['like', 'save']), id: Id, on: z.boolean() }),
    z.object({ op: z.literal('use'), id: Id, mode: z.enum(['all', 'colors', 'layout']) }),
    z.object({ op: z.literal('remix'), id: Id }),
    z.object({ op: z.literal('delete'), id: Id }),
    z.object({ op: z.literal('report'), id: Id, reason: z.string().min(1).max(60) }),
    z.object({ op: z.literal('admin'), id: Id, action: z.enum(['feature', 'approve', 'hide']) }),
  ]).safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz istek' }
  if (!rateLimit('template:' + u.id, 120, 3600_000)) return { ok: false, error: 'Çok sık; biraz sonra dene' }
  const a = p.data
  switch (a.op) {
    case 'publish': {
      const r = await publishTemplate(u.id, a.designId, a, a.toFeed)
      if (!r.ok) return r
      revalidatePath('/profil/ozellestirme/sablonlar'); return { ok: true, id: r.id, status: r.status }
    }
    case 'like': case 'save': return (await reactTemplate(u.id, a.id, a.op, a.on)) ? { ok: true } : { ok: false, error: 'Şablon bulunamadı' }
    case 'use': { if (!(await useTemplate(u.id, a.id, a.mode))) return { ok: false, error: 'Şablon bulunamadı' }; everywhere(); return { ok: true } }
    case 'remix': { const r = await remixTemplate(u.id, a.id); if (!r.ok) return r; return { ok: true, id: r.id } }
    case 'delete': return (await deleteTemplate(u.id, a.id, u.admin)) ? { ok: true } : { ok: false, error: 'Silinemedi' }
    case 'report': return (await reportTemplate(u.id, a.id, a.reason)) ? { ok: true } : { ok: false, error: 'Şikayet gönderilemedi' }
    case 'admin': { if (!u.admin) return { ok: false, error: 'Yetki yok' }; await adminTemplate(a.id, a.action); revalidatePath('/profil/ozellestirme/sablonlar'); return { ok: true } }
  }
}
