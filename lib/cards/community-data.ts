import 'server-only'
// Özelleştirme Ö3c: yarışma, tasarımcı profili, grup teması, duyuru kartı, yönetimden varsayılan düzen.
import { cache } from 'react'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db, schema } from '../db'
import { publish } from '../events'
import { dayString } from '../time'
import { cleanTextError } from '../moderation'
import { notify } from '../social-data'
import type { Design, ScreenLayout } from './layout'
import { normalizeScreen } from './layout'
import { SCREENS, type ScreenId } from './registry'
import { weekKey } from './templates'
import { contestOpen, contestWinner, safeUrl, visibleAnnouncement, voteError } from './community'

const C = schema.designContests, E = schema.contestEntries, V = schema.contestVotes, T = schema.designTemplates

// ───────── yarışma ─────────
async function entriesWithVotes(contestId: string) {
  const rows = await db.select({ templateId: E.templateId, userId: E.userId, createdAt: E.createdAt, name: T.name, data: T.data, owner: schema.users.username,
    votes: sql<number>`(select count(*)::int from contest_votes v where v.contest_id = ${contestId} and v.template_id = ${E.templateId})` })
    .from(E).innerJoin(T, eq(T.id, E.templateId)).innerJoin(schema.users, eq(schema.users.id, E.userId))
    .where(and(eq(E.contestId, contestId), isNull(T.deletedAt), eq(T.status, 'public')))
  return rows.map((r) => ({ ...r, votes: Number(r.votes), data: r.data as unknown as Design }))
}

export async function contestPage(viewerId: string) {
  const today = dayString(), wk = weekKey(today)
  const contests = await db.select().from(C).orderBy(desc(C.week)).limit(8)
  const cur = contests.find((c) => c.week === wk) ?? null
  const entries = cur ? (await entriesWithVotes(cur.id)).sort((a, b) => b.votes - a.votes || a.createdAt.getTime() - b.createdAt.getTime()) : []
  const [myVote] = cur ? await db.select({ t: V.templateId }).from(V).where(and(eq(V.contestId, cur.id), eq(V.voterId, viewerId))).limit(1) : []
  const past = await Promise.all(contests.filter((c) => c.week < wk).map(async (c) => {
    const w = contestWinner(await entriesWithVotes(c.id))
    return { id: c.id, week: c.week, theme: c.theme, winner: w ? { templateId: w.templateId, owner: w.owner, name: w.name, votes: w.votes } : null }
  }))
  const mine = await db.select({ id: T.id, name: T.name }).from(T).where(and(eq(T.ownerId, viewerId), eq(T.status, 'public'), isNull(T.deletedAt))).orderBy(desc(T.createdAt)).limit(30)
  return { current: cur ? { id: cur.id, week: cur.week, theme: cur.theme, description: cur.description, open: contestOpen(cur.week, today) } : null, entries, myVote: myVote?.t ?? null, myEntry: entries.find((e) => e.userId === viewerId)?.templateId ?? null, past, mine }
}

export async function setContest(adminId: string, theme: string, description: string) {
  const err = cleanTextError('Tema', theme) ?? cleanTextError('Açıklama', description)
  if (err) return { ok: false as const, error: err }
  const week = weekKey(dayString())
  await db.insert(C).values({ week, theme: theme.trim().slice(0, 60), description: description.trim().slice(0, 300), createdBy: adminId })
    .onConflictDoUpdate({ target: C.week, set: { theme: theme.trim().slice(0, 60), description: description.trim().slice(0, 300) } })
  await publish(adminId, 'contest.set', { week })
  return { ok: true as const }
}

export async function enterContest(userId: string, templateId: string) {
  const p = await contestPage(userId)
  if (!p.current?.open) return 'Bu hafta açık yarışma yok'
  const [t] = await db.select({ id: T.id }).from(T).where(and(eq(T.id, templateId), eq(T.ownerId, userId), eq(T.status, 'public'), isNull(T.deletedAt))).limit(1)
  if (!t) return 'Yalnız kendi herkese açık şablonunla katılabilirsin'
  await db.insert(E).values({ contestId: p.current.id, userId, templateId }).onConflictDoUpdate({ target: [E.contestId, E.userId], set: { templateId, createdAt: new Date() } })
  await publish(userId, 'contest.entered', {})
  return null
}

export async function voteContest(userId: string, templateId: string) {
  const p = await contestPage(userId)
  if (!p.current) return 'Bu hafta yarışma yok'
  const e = p.entries.find((x) => x.templateId === templateId)
  if (!e) return 'Bu tasarım yarışmada değil'
  const err = voteError({ open: p.current.open, voterId: userId, entryOwnerId: e.userId })
  if (err) return err
  await db.insert(V).values({ contestId: p.current.id, voterId: userId, templateId }).onConflictDoUpdate({ target: [V.contestId, V.voterId], set: { templateId, createdAt: new Date() } })
  return null
}

/** Kazanılan yarışmalar (tasarımcı rozeti): geçmiş haftalarda en çok oy alan. */
export async function designerBadges(userId: string) {
  const wk = weekKey(dayString())
  const mine = await db.select({ c: E.contestId, week: C.week, theme: C.theme }).from(E).innerJoin(C, eq(C.id, E.contestId)).where(and(eq(E.userId, userId), sql`${C.week} < ${wk}`))
  const out: { week: string; theme: string }[] = []
  for (const m of mine) { const w = contestWinner(await entriesWithVotes(m.c)); if (w?.userId === userId) out.push({ week: m.week, theme: m.theme }) }
  return out
}

// ───────── tasarımcı profili ─────────
export async function designerProfile(viewerId: string, username: string) {
  const [u] = await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users).where(eq(schema.users.username, username)).limit(1)
  if (!u) return null
  const templates = await db.select({ id: T.id, name: T.name, data: T.data, likes: T.likes, uses: T.uses }).from(T).where(and(eq(T.ownerId, u.id), eq(T.status, 'public'), isNull(T.deletedAt))).orderBy(desc(T.createdAt)).limit(30)
  const DF = schema.designerFollows
  const [f] = await db.select({ n: sql<number>`count(*)::int` }).from(DF).where(and(eq(DF.followerId, viewerId), eq(DF.designerId, u.id)))
  const [fc] = await db.select({ n: sql<number>`count(*)::int` }).from(DF).where(eq(DF.designerId, u.id))
  return {
    id: u.id, username: u.username, me: u.id === viewerId, following: Number(f?.n ?? 0) > 0, followers: Number(fc?.n ?? 0),
    templates: templates.map((t) => ({ ...t, data: t.data as unknown as Design })),
    totals: { templates: templates.length, likes: templates.reduce((a, t) => a + t.likes, 0), uses: templates.reduce((a, t) => a + t.uses, 0) },
    badges: await designerBadges(u.id),
  }
}
/** Tasarımcı takibi: sosyal takipten ayrı (profil gizliliği etkilenmez); tasarımcıya bildirilir, yeni şablonları takipçilere bildirilir. */
export async function followDesigner(me: string, otherId: string, on: boolean) {
  if (me === otherId) throw new Error('Kendini takip edemezsin')
  const DF = schema.designerFollows
  if (!on) { await db.delete(DF).where(and(eq(DF.followerId, me), eq(DF.designerId, otherId))); return }
  const r = await db.insert(DF).values({ followerId: me, designerId: otherId }).onConflictDoNothing().returning({ f: DF.followerId })
  if (r.length) await notify(otherId, 'designer_follow', me).catch(() => null)
}
/** Yeni herkese açık şablonu tasarımcının takipçilerine bildirir (en çok 200). */
export async function notifyDesignerFollowers(designerId: string, templateId: string) {
  const fs = await db.select({ id: schema.designerFollows.followerId }).from(schema.designerFollows).where(eq(schema.designerFollows.designerId, designerId)).limit(200)
  for (const f of fs) await notify(f.id, 'designer_new', designerId, null, { url: `/profil/ozellestirme/sablonlar/${templateId}` }).catch(() => null)
}

// ───────── grup teması ─────────
export async function ownedGroups(userId: string) {
  return db.select({ id: schema.groups.id, name: schema.groups.name, theme: schema.groups.themeTemplateId }).from(schema.groups).where(and(eq(schema.groups.ownerId, userId), isNull(schema.groups.deletedAt)))
}
export async function setGroupTheme(userId: string, groupId: string, templateId: string | null) {
  const [g] = await db.select({ id: schema.groups.id }).from(schema.groups).where(and(eq(schema.groups.id, groupId), eq(schema.groups.ownerId, userId), isNull(schema.groups.deletedAt))).limit(1)
  if (!g) return 'Yalnız kendi grubunun temasını seçebilirsin'
  if (templateId) { const [t] = await db.select({ id: T.id }).from(T).where(and(eq(T.id, templateId), eq(T.status, 'public'), isNull(T.deletedAt))).limit(1); if (!t) return 'Şablon bulunamadı' }
  await db.update(schema.groups).set({ themeTemplateId: templateId }).where(eq(schema.groups.id, groupId))
  return null
}
export async function groupTheme(groupId: string) {
  const [r] = await db.select({ id: T.id, name: T.name, data: T.data, owner: schema.users.username }).from(schema.groups)
    .innerJoin(T, eq(T.id, schema.groups.themeTemplateId)).innerJoin(schema.users, eq(schema.users.id, T.ownerId))
    .where(and(eq(schema.groups.id, groupId), eq(T.status, 'public'), isNull(T.deletedAt))).limit(1)
  return r ? { ...r, data: r.data as unknown as Design } : null
}

// ───────── girişsiz önizleme ─────────
export async function publicTemplate(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  const [r] = await db.select({ id: T.id, name: T.name, description: T.description, data: T.data, owner: schema.users.username, likes: T.likes, uses: T.uses })
    .from(T).innerJoin(schema.users, eq(schema.users.id, T.ownerId)).where(and(eq(T.id, id), eq(T.status, 'public'), isNull(T.deletedAt))).limit(1)
  return r ? { ...r, data: r.data as unknown as Design } : null
}

// ───────── duyuru kartı ─────────
const A = schema.announcements, AD = schema.announcementDismissals
export async function announcementFor(userId: string) {
  const list = await db.select().from(A).where(eq(A.active, true)).orderBy(desc(A.createdAt)).limit(10)
  if (!list.length) return null
  const dis = await db.select({ id: AD.announcementId }).from(AD).where(and(eq(AD.userId, userId), inArray(AD.announcementId, list.map((a) => a.id))))
  const a = visibleAnnouncement(list, new Set(dis.map((d) => d.id)), new Date())
  return a ? { id: a.id, title: a.title, body: a.body, url: safeUrl(a.url) } : null
}
export async function dismissAnnouncement(userId: string, id: string) {
  await db.insert(AD).values({ userId, announcementId: id }).onConflictDoNothing()
}
export async function createAnnouncement(adminId: string, a: { title: string; body: string; url?: string | null; days: number }) {
  const err = cleanTextError('Başlık', a.title) ?? cleanTextError('Metin', a.body)
  if (err) return err
  if (a.url && !safeUrl(a.url)) return 'Bağlantı uygulama içi (/…) ya da https olmalı'
  await db.insert(A).values({ title: a.title.trim().slice(0, 80), body: a.body.trim().slice(0, 300), url: safeUrl(a.url), createdBy: adminId, endsAt: new Date(Date.now() + Math.max(1, Math.min(60, a.days)) * 86_400_000) })
  await publish(adminId, 'announcement.created', {})
  return null
}
export async function listAnnouncements() { return db.select().from(A).orderBy(desc(A.createdAt)).limit(20) }
export async function closeAnnouncement(id: string) { await db.update(A).set({ active: false }).where(eq(A.id, id)) }

// ───────── yönetimden varsayılan düzen ─────────
/** Özelleştirmemiş herkesin varsayılanı (ekran → düzen). Yoksa kayıttaki varsayılan geçerli. İstek başına bir sorgu. */
export const layoutDefaults = cache(async (): Promise<Partial<Record<ScreenId, ScreenLayout>>> => {
  const [r] = await db.select({ data: schema.appDefaults.data }).from(schema.appDefaults).where(eq(schema.appDefaults.key, 'layout')).limit(1)
  return (r?.data ?? {}) as Partial<Record<ScreenId, ScreenLayout>>
})
export async function setLayoutDefault(adminId: string, screen: ScreenId, items: ScreenLayout['items'] | null) {
  const cur = { ...(await layoutDefaults()) }
  if (items) cur[screen] = normalizeScreen(screen, items); else delete cur[screen]
  await db.insert(schema.appDefaults).values({ key: 'layout', data: cur as Record<string, unknown> }).onConflictDoUpdate({ target: schema.appDefaults.key, set: { data: cur as Record<string, unknown>, updatedAt: new Date() } })
  await publish(adminId, 'layout.default', { screen, reset: !items })
}
export const isScreenId = (s: string): s is ScreenId => s in SCREENS
