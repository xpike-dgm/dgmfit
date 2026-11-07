'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { addDays, dayString } from '@/lib/time'
import { requireUser, rateLimit } from '@/lib/auth'
import { SCREENS, isScreen } from '@/lib/cards/registry'
import { applyWizard, hideCardToday, pinCard, resetScreen, saveModules, saveNav, savePrefs, saveRules, saveScreen, saveStyle } from '@/lib/cards/design-data'
import { readMedia } from '@/lib/media'
import { activateDesign, createDesign, deleteDesign, renameDesign, restoreVersion } from '@/lib/cards/designs-data'
import { adminTemplate, deleteTemplate, publishTemplate, reactTemplate, remixTemplate, reportTemplate, useTemplate } from '@/lib/cards/templates-data'
import { closeAnnouncement, createAnnouncement, dismissAnnouncement, enterContest, followDesigner, isScreenId, setContest, setGroupTheme, setLayoutDefault, voteContest } from '@/lib/cards/community-data'
import { activeDesign, screenLayout, transformDesign } from '@/lib/cards/design-data'
import { applySuggestion } from '@/lib/cards/usage'
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

// ───────── Ö3c: topluluk ve yönetim ─────────
export async function communityAction(input: unknown): Promise<R> {
  const u = await requireUser()
  const p = z.discriminatedUnion('op', [
    z.object({ op: z.literal('enter'), templateId: Id }),
    z.object({ op: z.literal('vote'), templateId: Id }),
    z.object({ op: z.literal('follow'), userId: Id, on: z.boolean() }),
    z.object({ op: z.literal('groupTheme'), groupId: Id, templateId: Id.nullable() }),
    z.object({ op: z.literal('dismiss'), id: Id }),
    z.object({ op: z.literal('contest'), theme: z.string().min(2).max(60), description: z.string().max(300) }),
    z.object({ op: z.literal('announce'), title: z.string().min(2).max(80), body: z.string().max(300), url: z.string().max(300).nullable(), days: z.number().int().min(1).max(60) }),
    z.object({ op: z.literal('closeAnnouncement'), id: Id }),
    z.object({ op: z.literal('defaultLayout'), screen: z.string().max(20), reset: z.boolean() }),
  ]).safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz istek' }
  if (!rateLimit('community:' + u.id, 120, 3600_000)) return { ok: false, error: 'Çok sık; biraz sonra dene' }
  const a = p.data
  const adminOnly = ['contest', 'announce', 'closeAnnouncement', 'defaultLayout'].includes(a.op)
  if (adminOnly && !u.admin) return { ok: false, error: 'Yetki yok' }
  let err: string | null = null
  switch (a.op) {
    case 'enter': err = await enterContest(u.id, a.templateId); break
    case 'vote': err = await voteContest(u.id, a.templateId); break
    case 'follow': try { await followDesigner(u.id, a.userId, a.on) } catch (e) { err = (e as Error).message } break
    case 'groupTheme': err = await setGroupTheme(u.id, a.groupId, a.templateId); break
    case 'dismiss': await dismissAnnouncement(u.id, a.id); break
    case 'contest': { const r = await setContest(u.id, a.theme, a.description); if (!r.ok) err = r.error; break }
    case 'announce': err = await createAnnouncement(u.id, a); break
    case 'closeAnnouncement': await closeAnnouncement(a.id); break
    case 'defaultLayout': {
      if (!isScreenId(a.screen)) { err = 'Geçersiz ekran'; break }
      const d = await activeDesign(u.id)
      const items = a.reset ? null : d?.screens[a.screen]?.items ?? null
      if (!a.reset && !items) { err = 'Önce bu ekranı kendin düzenle; senin düzenin varsayılan yapılır'; break }
      await setLayoutDefault(u.id, a.screen, items)
      break
    }
  }
  if (err) return { ok: false, error: err }
  everywhere()
  return { ok: true }
}

// ───────── Ö4: koç önerileri ─────────
export async function suggestionAction(input: unknown): Promise<R> {
  const u = await requireUser()
  const p = z.discriminatedUnion('op', [
    z.object({ op: z.literal('apply'), screen: z.string().max(20), card: z.string().max(60), kind: z.enum(['up', 'remove']) }),
    z.object({ op: z.literal('dismiss'), id: z.string().max(80) }),
  ]).safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz istek' }
  if (limited(u.id)) return { ok: false, error: 'Çok sık; biraz sonra dene' }
  const a = p.data
  if (a.op === 'dismiss') {
    await transformDesign(u.id, (d) => ({ ...d, insights: { dismissed: [...new Set([...(d.insights?.dismissed ?? []), a.id])].slice(-50) } }))
    revalidatePath('/profil/ozellestirme'); return { ok: true }
  }
  if (!isScreen(a.screen)) return { ok: false, error: 'Geçersiz ekran' }
  const l = await screenLayout(u.id, a.screen, { editing: true })
  await saveScreen(u.id, a.screen, applySuggestion(l.items.map((i) => ({ id: i.id, size: i.size, ...(i.stack ? { stack: i.stack } : {}) })), a))
  revalidatePath(SCREENS[a.screen].path); revalidatePath('/profil/ozellestirme')
  return { ok: true }
}

// ───────── Ö5a: kendi takip alanlarım ve kendi kartlarım ─────────
export async function trackerAction(input: unknown): Promise<R & { id?: string }> {
  const u = await requireUser()
  const p = z.discriminatedUnion('op', [
    z.object({ op: z.literal('create'), name: z.string().max(40), unit: z.string().max(12).optional(), kind: z.enum(['count', 'number', 'scale', 'yesno']),
      goal: z.number().positive().max(1e6).nullable().optional(), goalDir: z.enum(['min', 'max']).optional(), step: z.number().positive().max(1000).optional(), emoji: z.string().max(8).optional() }),
    z.object({ op: z.literal('archive'), id: Id }),
    z.object({ op: z.literal('log'), id: Id, value: z.number().min(-1).max(1e6) }),
  ]).safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz istek' }
  if (!rateLimit('tracker:' + u.id, 240, 3600_000)) return { ok: false, error: 'Çok sık; biraz sonra dene' }
  const { createTracker, archiveTracker, logTracker } = await import('@/lib/cards/custom-data')
  const x = p.data
  if (x.op === 'create') { const r = await createTracker(u.id, x); if (!r.ok) return r; revalidatePath('/profil/ozellestirme/takip'); return { ok: true, id: r.id } }
  if (x.op === 'archive') await archiveTracker(u.id, x.id)
  else { const err = await logTracker(u.id, x.id, x.value); if (err) return { ok: false, error: err } }
  everywhere()
  return { ok: true }
}

export async function userCardAction(input: unknown): Promise<R & { id?: string }> {
  const u = await requireUser()
  const p = z.discriminatedUnion('op', [
    z.object({ op: z.literal('save'), id: z.string().max(40).nullable(), card: z.record(z.string(), z.unknown()) }),
    z.object({ op: z.literal('delete'), id: z.string().max(40) }),
  ]).safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz istek' }
  if (limited(u.id)) return { ok: false, error: 'Çok sık; biraz sonra dene' }
  const { saveUserCard, deleteUserCard } = await import('@/lib/cards/custom-data')
  if (p.data.op === 'delete') { if (!(await deleteUserCard(u.id, p.data.id))) return { ok: false, error: 'Kart bulunamadı' }; everywhere(); return { ok: true } }
  const r = await saveUserCard(u.id, p.data.id, p.data.card)
  if (!r.ok) return r
  everywhere()
  return { ok: true, id: r.id }
}

// ───────── Ö5b: odak modu ve Ramazan modu ─────────
const Hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export async function modesAction(patch: unknown): Promise<R> {
  const u = await requireUser()
  const p = z.object({
    focus: z.enum(['training', 'diet', 'vacation', 'sick']).nullable(), focusFrom: Day.nullable(), focusUntil: Day.nullable(),
    ramadan: z.boolean(), sahur: Hm, iftar: Hm, ramadanUntil: Day.nullable(),
  }).partial().safeParse(patch)
  if (!p.success) return { ok: false, error: 'Geçersiz ayar' }
  if (p.data.sahur && p.data.iftar && p.data.sahur >= p.data.iftar) return { ok: false, error: 'Sahur saati iftardan önce olmalı' }
  // geçmişe en çok 14 gün (tatil dün başladıysa o günlerin dengelemesi de durur; kapanmış günler değişmez)
  if (p.data.focusFrom && p.data.focusFrom < addDays(dayString(), -14)) return { ok: false, error: 'Başlangıç en çok 14 gün önce olabilir' }
  if (limited(u.id)) return { ok: false, error: 'Çok sık; biraz sonra dene' }
  const { saveModes } = await import('@/lib/modes-data')
  await saveModes(u.id, p.data)
  everywhere()
  return { ok: true }
}
