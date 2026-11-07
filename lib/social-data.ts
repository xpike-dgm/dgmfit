import 'server-only'
// Sosyal veri katmanı (Faz 5a). Görünürlük kararları lib/social.ts'deki saf fonksiyonlardan; her okuma izleyici ilişkisine göre süzülür.
import crypto from 'node:crypto'
import { z } from 'zod'
import { and, asc, desc, eq, gte, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { dayString } from './time'
import { normalizeSearch } from './nutrition'
import { sendToUser } from './push'
import { mediaMeta } from './media'
import { activeGoal, weightSeries } from './fit-data'
import { addDays } from './time'
import { getProgram, insertProgram, workoutSummary } from './fitness-data'
import { getToday } from './today'
import { getWaterInsights } from './water-data'
import { PR_LABEL, type PrType } from './training'
import { DEFAULT_ITEMS, GOAL_BADGE, ITEMS, feedScore, itemVisible, longestWeekStreak, milestoneText, postVisible, profileAccess, suggestionScore,
  type Audience, type Item, type ItemVis, type PostKind, type Reaction, type Relation, type Visibility } from './social'
import { cleanTextError, combine, moderateText, type ModResult } from './moderation'
import { aiAvailable, runTask } from './ai/engine'
import { MEAL_LABEL, type MealId } from './food'

export type SocialProfile = typeof schema.socialProfiles.$inferSelect
export async function socialProfile(userId: string): Promise<SocialProfile> {
  const [r] = await db.select().from(schema.socialProfiles).where(eq(schema.socialProfiles.userId, userId)).limit(1)
  if (r) return r
  await db.insert(schema.socialProfiles).values({ userId }).onConflictDoNothing()
  const [n] = await db.select().from(schema.socialProfiles).where(eq(schema.socialProfiles.userId, userId)).limit(1)
  return n
}
export const itemsOf = (p: SocialProfile) => ({ ...DEFAULT_ITEMS, ...(p.items as Record<Item, ItemVis>) })

// ───────── İlişki ─────────

export async function relationOf(viewerId: string, targetId: string): Promise<Relation> {
  if (viewerId === targetId) return 'self'
  const [b] = await db.select({ k: schema.userBlocks.kind }).from(schema.userBlocks).where(and(eq(schema.userBlocks.kind, 'block'), or(
    and(eq(schema.userBlocks.userId, viewerId), eq(schema.userBlocks.targetId, targetId)), and(eq(schema.userBlocks.userId, targetId), eq(schema.userBlocks.targetId, viewerId))))).limit(1)
  if (b) return 'blocked'
  const [f] = await db.select({ s: schema.friendLinks.status }).from(schema.friendLinks).where(and(eq(schema.friendLinks.userId, viewerId), eq(schema.friendLinks.friendId, targetId))).limit(1)
  if (f?.s === 'accepted') return 'friend'
  const [fo] = await db.select({ x: schema.follows.followerId }).from(schema.follows).where(and(eq(schema.follows.followerId, viewerId), eq(schema.follows.followeeId, targetId))).limit(1)
  return fo ? 'follower' : 'none'
}
export async function friendIds(userId: string): Promise<string[]> {
  return (await db.select({ id: schema.friendLinks.friendId }).from(schema.friendLinks).where(and(eq(schema.friendLinks.userId, userId), eq(schema.friendLinks.status, 'accepted')))).map((r) => r.id)
}
export async function hiddenIds(userId: string): Promise<{ blocked: Set<string>; muted: Set<string> }> {
  const rows = await db.select().from(schema.userBlocks).where(or(eq(schema.userBlocks.userId, userId), and(eq(schema.userBlocks.targetId, userId), eq(schema.userBlocks.kind, 'block'))))
  const blocked = new Set<string>(), muted = new Set<string>()
  for (const r of rows) {
    if (r.kind === 'block') blocked.add(r.userId === userId ? r.targetId : r.userId)
    else if (r.userId === userId) muted.add(r.targetId)
  }
  return { blocked, muted }
}

// ───────── Bildirim ─────────

export const NOTIFY_KINDS = { template_like: 'Şablon beğenileri', template_use: 'Şablonunu kullananlar', designer_follow: 'Tasarımcı takipçileri', designer_new: 'Takip ettiğin tasarımcıların yeni şablonları', friend_request: 'Arkadaşlık isteği', friend_accept: 'İstek kabulü', reaction: 'Tepkiler', comment: 'Yorumlar', follow: 'Yeni takipçi', message: 'Mesajlar', nudge: 'Dürtmeler', group_invite: 'Grup davetleri', challenge_invite: 'Meydan okuma davetleri', partner_workout: 'Partner antrenmanı', pr_witness: 'Rekor tanıklığı' } as const
export type NotifyKind = keyof typeof NOTIFY_KINDS
const TEXT: Record<NotifyKind, (n: string) => string> = {
  template_like: (n) => `${n} tasarım şablonunu beğendi`, template_use: (n) => `${n} tasarım şablonunu kullandı`,
  designer_follow: (n) => `${n} seni tasarımcı olarak takip etmeye başladı`, designer_new: (n) => `${n} yeni bir tasarım şablonu paylaştı`,
  friend_request: (n) => `${n} sana arkadaşlık isteği gönderdi`, friend_accept: (n) => `${n} arkadaşlık isteğini kabul etti`,
  reaction: (n) => `${n} gönderine tepki verdi`, comment: (n) => `${n} gönderine yorum yaptı`, follow: (n) => `${n} seni takip etmeye başladı`,
  message: (n) => `${n} sana mesaj gönderdi`, nudge: (n) => `${n} seni dürttü`, group_invite: (n) => `${n} seni bir gruba davet etti`,
  challenge_invite: (n) => `${n} seni bir meydan okumaya davet etti`, partner_workout: (n) => `Partnerin ${n} antrenmanını bitirdi 💪`, pr_witness: (n) => `${n} rekoruna tanıklık etti`,
}
export const notifyText = (kind: string, actor: string) => (TEXT[kind as NotifyKind] ?? (() => 'Yeni bildirim'))(actor)

/** Bildirim: uygulama içi kayıt + tercih açıksa push. `extra`: push metnine ek (ör. dürtme mesajı), `url`: dokununca açılacak sayfa. */
export async function notify(userId: string, kind: NotifyKind, actorId: string, postId: string | null = null, opt: { extra?: string; url?: string } = {}) {
  if (userId === actorId || (await relationOf(userId, actorId)) === 'blocked') return
  // aynı (alıcı, aktör, tür, hedef) bildirimi saatte en fazla 1 kez (spam/yığılma önlemi)
  const [dup] = await db.select({ id: schema.notifications.id }).from(schema.notifications).where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.actorId, actorId), eq(schema.notifications.kind, kind),
    postId ? eq(schema.notifications.postId, postId) : isNull(schema.notifications.postId), gte(schema.notifications.createdAt, new Date(Date.now() - 3600_000)))).limit(1)
  if (dup) return
  await db.insert(schema.notifications).values({ userId, kind, actorId, postId })
  const p = await socialProfile(userId)
  if ((p.notify as Record<string, boolean>)[kind] === false) return
  const [a] = await db.select({ username: schema.users.username }).from(schema.users).where(eq(schema.users.id, actorId)).limit(1)
  try { await sendToUser(userId, { title: 'DgFit Sosyal', body: notifyText(kind, a?.username ?? 'Biri') + (opt.extra ? ': ' + opt.extra : ''), tag: 'social-' + kind, url: opt.url ?? (postId ? `/sosyal/p/${postId}` : '/sosyal/bildirimler') }) } catch { /* push yoksa uygulama içi kalır */ }
}
export async function notificationsFor(userId: string) {
  const rows = await db.select({ n: schema.notifications, actor: schema.users.username }).from(schema.notifications)
    .leftJoin(schema.users, eq(schema.users.id, schema.notifications.actorId)).where(eq(schema.notifications.userId, userId)).orderBy(desc(schema.notifications.createdAt)).limit(50)
  return rows.map((r) => ({ id: r.n.id, kind: r.n.kind, actor: r.actor ?? '', postId: r.n.postId, read: !!r.n.readAt, createdAt: r.n.createdAt.toISOString(), text: notifyText(r.n.kind, r.actor ?? 'Biri') }))
}
export async function unreadCount(userId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.notifications).where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)))
  return Number(r?.n ?? 0)
}
export async function markAllRead(userId: string) {
  await db.update(schema.notifications).set({ readAt: new Date() }).where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)))
}

// ───────── Profil ─────────

async function userByName(username: string) {
  const [u] = await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users).where(eq(sql`lower(${schema.users.username})`, username.toLowerCase())).limit(1)
  return u ?? null
}
async function friendStatus(viewerId: string, targetId: string) {
  const [f] = await db.select().from(schema.friendLinks).where(and(eq(schema.friendLinks.userId, viewerId), eq(schema.friendLinks.friendId, targetId))).limit(1)
  return (f?.status ?? 'none') as 'none' | 'pending_out' | 'pending_in' | 'accepted'
}
async function goalBadge(userId: string) {
  const g = await activeGoal(userId)
  return g ? GOAL_BADGE[g.type] ?? null : null
}

/** PR vitrini: seçilen hareketlerde en iyi kg ve e1RM + kg rekor tarihçesi (mini grafik için). */
export async function showcase(userId: string, ids: number[]) {
  if (!ids.length) return []
  const rows = await db.select({ r: schema.exerciseRecords, name: schema.exercises.nameTr }).from(schema.exerciseRecords).innerJoin(schema.exercises, eq(schema.exercises.id, schema.exerciseRecords.exerciseId))
    .where(and(eq(schema.exerciseRecords.userId, userId), inArray(schema.exerciseRecords.exerciseId, ids)))
  const notSuspect = or(isNull(schema.personalRecords.suspect), eq(schema.personalRecords.verified, true))
  const hist = await db.select({ exerciseId: schema.personalRecords.exerciseId, value: schema.personalRecords.value, at: schema.personalRecords.createdAt }).from(schema.personalRecords)
    .where(and(eq(schema.personalRecords.userId, userId), inArray(schema.personalRecords.exerciseId, ids), eq(schema.personalRecords.type, 'kg'), notSuspect)).orderBy(asc(schema.personalRecords.createdAt))
  // şüpheli ve doğrulanmamış rekorlar vitrine girmez: en iyi değer rekordan önceki değere çekilir (strengthScore ile aynı kural)
  const sus = await db.select().from(schema.personalRecords).where(and(eq(schema.personalRecords.userId, userId), inArray(schema.personalRecords.exerciseId, ids), inArray(schema.personalRecords.type, ['kg', 'e1rm']), sql`${schema.personalRecords.suspect} is not null`, eq(schema.personalRecords.verified, false)))
  const clean = (exId: number, type: 'kg' | 'e1rm', best: number) => {
    for (const x of sus.filter((q) => q.exerciseId === exId && q.type === type).sort((a, b) => b.value - a.value)) if (x.value >= best - 1e-9) best = Math.min(best, x.previous ?? 0)
    return best
  }
  return ids.map((id) => rows.find((r) => r.r.exerciseId === id)).filter((r) => !!r).map((r) => ({
    exerciseId: r!.r.exerciseId, name: r!.name, kg: Math.round(clean(r!.r.exerciseId, 'kg', r!.r.records.kg ?? 0) * 10) / 10, e1rm: Math.round(clean(r!.r.exerciseId, 'e1rm', r!.r.records.e1rm ?? 0)),
    history: hist.filter((h) => h.exerciseId === r!.r.exerciseId).map((h) => ({ day: dayString(h.at), kg: h.value })),
  }))
}
/** İstatistik kartları: toplam antrenman, toplam kg, en uzun haftalık antrenman serisi, su serisi, kazanılan su rozetleri. */
export async function statCards(userId: string) {
  const [w] = await db.execute<{ n: number; vol: number }>(sql`select count(*)::int as n, coalesce(sum(volume_kg),0)::float as vol from workouts where user_id = ${userId} and deleted_at is null`)
  const days = (await db.execute<{ day: string }>(sql`select distinct day::text as day from workouts where user_id = ${userId} and deleted_at is null`)).map((r) => String(r.day))
  const t = await getToday(userId).catch(() => null)
  let badges = 0
  try { badges = (await getWaterInsights(userId)).badges.filter((b) => b.earnedDay).length } catch { /* su verisi yok */ }
  return { workouts: Number(w?.n ?? 0), volumeKg: Math.round(Number(w?.vol ?? 0)), weekStreak: longestWeekStreak(days), waterStreak: t?.streak ?? 0, badges }
}

export async function profileView(viewerId: string, username: string) {
  const u = await userByName(username)
  if (!u) return null
  const rel = await relationOf(viewerId, u.id)
  const sp = await socialProfile(u.id)
  const vis = sp.visibility as Visibility
  const access = profileAccess(rel, vis)
  if (!access.basic) {
    const [mine] = rel === 'blocked' ? await db.select({ k: schema.userBlocks.kind }).from(schema.userBlocks).where(and(eq(schema.userBlocks.userId, viewerId), eq(schema.userBlocks.targetId, u.id), eq(schema.userBlocks.kind, 'block'))).limit(1) : []
    return { username: u.username, id: u.id, rel, access, hidden: true as const, iBlocked: !!mine }
  }
  const items = itemsOf(sp)
  const [status, badge, nFriends] = await Promise.all([friendStatus(viewerId, u.id), sp.showGoal ? goalBadge(u.id) : null, friendIds(u.id).then((x) => x.length)])
  const can = (i: Item) => access.detail && itemVisible(rel, vis, items[i])
  return {
    hidden: false as const, id: u.id, username: u.username, rel, access, status, badge, friends: nFriends,
    bio: sp.bio, gym: sp.gym, avatar: sp.avatarId ? `/api/social/avatar/${u.id}?v=${sp.avatarId.slice(0, 8)}` : null, visibility: vis,
    showcase: can('prs') ? await showcase(u.id, sp.showcase) : null,
    stats: can('stats') ? await statCards(u.id) : null,
    posts: access.detail ? await postsOf(viewerId, u.id, rel, vis) : [],
  }
}

export async function updateSocialProfile(userId: string, v: { bio: string | null; gym: string | null; visibility: Visibility; items: Record<Item, ItemVis>; showGoal: boolean; showcase: number[]; notify: Record<string, boolean>; avatarId?: string | null }) {
  if (v.avatarId) {
    const [m] = await mediaMeta([v.avatarId])
    if (!m || m.userId !== userId || m.kind !== 'avatar') throw new Error('Geçersiz fotoğraf')
  }
  const bad = cleanTextError('Biyografi', v.bio) ?? cleanTextError('Salon adı', v.gym)
  if (bad) throw new Error(bad)
  await socialProfile(userId)
  const set = { bio: v.bio, gym: v.gym, visibility: v.visibility, items: v.items, showGoal: v.showGoal, showcase: v.showcase.slice(0, 6), notify: v.notify, updatedAt: new Date(), ...(v.avatarId !== undefined ? { avatarId: v.avatarId } : {}) }
  await db.update(schema.socialProfiles).set(set).where(eq(schema.socialProfiles.userId, userId))
  // gizliye geçince takipçiler düşer (takip yalnızca açık profilde)
  if (v.visibility !== 'public') await db.delete(schema.follows).where(eq(schema.follows.followeeId, userId))
}

// ───────── Arkadaşlık, takip, engel ─────────

export async function requestFriend(me: string, username: string): Promise<'sent' | 'accepted' | 'already'> {
  const u = await userByName(username)
  if (!u || u.id === me) throw new Error('Kullanıcı bulunamadı')
  const rel = await relationOf(me, u.id)
  const st = await friendStatus(me, u.id)
  if (st === 'accepted' || st === 'pending_out') return 'already'
  if (st === 'pending_in') { await acceptFriend(me, u.id); return 'accepted' }
  const sp = await socialProfile(u.id)
  if (!profileAccess(rel, sp.visibility as Visibility).canRequest) throw new Error('Kullanıcı bulunamadı')
  await db.insert(schema.friendLinks).values([{ userId: me, friendId: u.id, status: 'pending_out' }, { userId: u.id, friendId: me, status: 'pending_in' }]).onConflictDoNothing()
  await notify(u.id, 'friend_request', me)
  return 'sent'
}
export async function acceptFriend(me: string, otherId: string) {
  const r = await db.update(schema.friendLinks).set({ status: 'accepted', acceptedAt: new Date() }).where(and(eq(schema.friendLinks.userId, me), eq(schema.friendLinks.friendId, otherId), eq(schema.friendLinks.status, 'pending_in'))).returning()
  if (!r.length) throw new Error('İstek bulunamadı')
  await db.update(schema.friendLinks).set({ status: 'accepted', acceptedAt: new Date() }).where(and(eq(schema.friendLinks.userId, otherId), eq(schema.friendLinks.friendId, me)))
  await notify(otherId, 'friend_accept', me)
}
/** Reddet, isteği geri çek ya da arkadaşlıktan çıkar: iki satır da silinir. */
export async function removeFriend(me: string, otherId: string) {
  await db.delete(schema.friendLinks).where(or(and(eq(schema.friendLinks.userId, me), eq(schema.friendLinks.friendId, otherId)), and(eq(schema.friendLinks.userId, otherId), eq(schema.friendLinks.friendId, me))))
}
export async function setClose(me: string, otherId: string, close: boolean) {
  await db.update(schema.friendLinks).set({ close }).where(and(eq(schema.friendLinks.userId, me), eq(schema.friendLinks.friendId, otherId), eq(schema.friendLinks.status, 'accepted')))
}
export async function follow(me: string, otherId: string, on: boolean) {
  if (!on) { await db.delete(schema.follows).where(and(eq(schema.follows.followerId, me), eq(schema.follows.followeeId, otherId))); return }
  const rel = await relationOf(me, otherId)
  const sp = await socialProfile(otherId)
  if (!profileAccess(rel, sp.visibility as Visibility).canFollow) throw new Error('Bu profil takip edilemez')
  const r = await db.insert(schema.follows).values({ followerId: me, followeeId: otherId }).onConflictDoNothing().returning()
  if (r.length) await notify(otherId, 'follow', me)
}
export async function setBlock(me: string, otherId: string, kind: 'block' | 'mute', on: boolean) {
  if (me === otherId) return
  if (!on) { await db.delete(schema.userBlocks).where(and(eq(schema.userBlocks.userId, me), eq(schema.userBlocks.targetId, otherId), eq(schema.userBlocks.kind, kind))); return }
  await db.insert(schema.userBlocks).values({ userId: me, targetId: otherId, kind }).onConflictDoNothing()
  if (kind === 'block') {
    await removeFriend(me, otherId)
    await db.delete(schema.follows).where(or(and(eq(schema.follows.followerId, me), eq(schema.follows.followeeId, otherId)), and(eq(schema.follows.followerId, otherId), eq(schema.follows.followeeId, me))))
  }
}

export async function friendsOverview(me: string) {
  const links = await db.select({ l: schema.friendLinks, username: schema.users.username }).from(schema.friendLinks).innerJoin(schema.users, eq(schema.users.id, schema.friendLinks.friendId)).where(eq(schema.friendLinks.userId, me)).orderBy(asc(schema.users.username))
  const following = await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.follows).innerJoin(schema.users, eq(schema.users.id, schema.follows.followeeId)).where(eq(schema.follows.followerId, me))
  const followers = await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.follows).innerJoin(schema.users, eq(schema.users.id, schema.follows.followerId)).where(eq(schema.follows.followeeId, me))
  const blocks = await db.select({ id: schema.users.id, username: schema.users.username, kind: schema.userBlocks.kind }).from(schema.userBlocks).innerJoin(schema.users, eq(schema.users.id, schema.userBlocks.targetId)).where(eq(schema.userBlocks.userId, me))
  const pick = (s: string) => links.filter((x) => x.l.status === s).map((x) => ({ id: x.l.friendId, username: x.username, close: x.l.close }))
  return { friends: pick('accepted'), incoming: pick('pending_in'), outgoing: pick('pending_out'), following, followers, blocked: blocks.filter((b) => b.kind === 'block'), muted: blocks.filter((b) => b.kind === 'mute') }
}

/** Kullanıcı adıyla arama: gizli profiller (arkadaş değilse) ve engelliler görünmez. */
export async function searchUsers(me: string, q: string) {
  const n = q.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '')
  if (n.length < 2) return []
  const rows = await db.select({ id: schema.users.id, username: schema.users.username, vis: schema.socialProfiles.visibility }).from(schema.users)
    .leftJoin(schema.socialProfiles, eq(schema.socialProfiles.userId, schema.users.id)).where(and(sql`lower(${schema.users.username}) like ${'%' + n + '%'}`, ne(schema.users.id, me))).orderBy(sql`length(${schema.users.username})`).limit(20)
  const { blocked } = await hiddenIds(me)
  const out = []
  for (const r of rows) {
    if (blocked.has(r.id)) continue
    const rel = await relationOf(me, r.id)
    if (!profileAccess(rel, (r.vis ?? 'friends') as Visibility).basic) continue
    out.push({ id: r.id, username: r.username, status: await friendStatus(me, r.id), rel })
  }
  return out
}

/** Arkadaş önerileri: ortak arkadaş, aynı salon, benzer hedef (gizli/engelli/zaten bağlantılı olanlar hariç). */
export async function suggestions(me: string) {
  const mine = await friendIds(me)
  const sp = await socialProfile(me)
  const myGoal = (await activeGoal(me))?.type ?? null
  const fof = mine.length ? await db.select({ id: schema.friendLinks.friendId, n: sql<number>`count(*)::int` }).from(schema.friendLinks)
    .where(and(inArray(schema.friendLinks.userId, mine), eq(schema.friendLinks.status, 'accepted'))).groupBy(schema.friendLinks.friendId) : []
  const gymMates = sp.gym ? await db.select({ id: schema.socialProfiles.userId }).from(schema.socialProfiles).where(and(sql`lower(${schema.socialProfiles.gym}) = ${sp.gym.toLowerCase()}`, ne(schema.socialProfiles.userId, me))).limit(50) : []
  const cands = new Map<string, { mutual: number; sameGym: boolean }>()
  for (const r of fof) if (r.id !== me) cands.set(r.id, { mutual: Number(r.n), sameGym: false })
  for (const r of gymMates) cands.set(r.id, { ...(cands.get(r.id) ?? { mutual: 0 }), sameGym: true })
  const { blocked } = await hiddenIds(me)
  const linked = new Set((await db.select({ id: schema.friendLinks.friendId }).from(schema.friendLinks).where(eq(schema.friendLinks.userId, me))).map((r) => r.id))
  const ids = [...cands.keys()].filter((id) => !blocked.has(id) && !linked.has(id))
  if (!ids.length) return []
  const info = await db.select({ id: schema.users.id, username: schema.users.username, vis: schema.socialProfiles.visibility }).from(schema.users).leftJoin(schema.socialProfiles, eq(schema.socialProfiles.userId, schema.users.id)).where(inArray(schema.users.id, ids))
  const goals = await db.select({ userId: schema.goals.userId, type: schema.goals.type }).from(schema.goals).where(and(inArray(schema.goals.userId, ids), eq(schema.goals.active, true)))
  return info.filter((u) => (u.vis ?? 'friends') !== 'private').map((u) => {
    const c = cands.get(u.id)!
    const sameGoal = !!myGoal && goals.some((g) => g.userId === u.id && g.type === myGoal)
    return { id: u.id, username: u.username, mutual: c.mutual, sameGym: c.sameGym, score: suggestionScore({ ...c, sameGoal }) }
  }).sort((a, b) => b.score - a.score).slice(0, 10)
}

// ───────── Gönderiler ─────────

export interface NewPost { kind: PostKind; body: string; mediaIds: string[]; audience: Audience; audienceIds: string[]; ref?: string | null }

/** Gönderi verisi sunucuda kaynaktan üretilir (istemcinin gönderdiği sayıya güvenilmez). */
async function snapshot(userId: string, kind: PostKind, ref: string | null | undefined): Promise<Record<string, unknown>> {
  if (kind === 'workout') {
    const s = ref ? await workoutSummary(userId, ref) : null
    if (!s) throw new Error('Antrenman bulunamadı')
    const keys = new Map((await db.select({ id: schema.exercises.id, key: schema.exercises.key }).from(schema.exercises).where(inArray(schema.exercises.id, s.exercises.map((e) => e.exerciseId).concat([-1])))).map((r) => [r.id, r.key]))
    return {
      workoutId: s.workout.id, name: s.workout.name, day: s.workout.day, minutes: Math.round(s.workout.durationSec / 60), volumeKg: Math.round(s.workout.volumeKg), workSets: s.workout.workSets,
      exercises: s.exercises.map((e) => ({ key: keys.get(e.exerciseId) ?? null, name: e.name, kind: e.kind, sets: e.sets.filter((x) => x.type !== 'warmup').map((x) => ({ kg: x.kg, reps: x.reps, seconds: x.seconds ?? null })) })),
      prs: s.prs.map((p) => ({ name: p.name, type: p.type, value: p.value })),
    }
  }
  if (kind === 'program') {
    const p = ref && /^[0-9a-f-]{36}$/.test(ref) ? await getProgram(userId, ref) : null
    if (!p) throw new Error('Program bulunamadı')
    // yalnızca ortak kütüphane hareketleri paylaşılır (kişisel hareketler başkasının kütüphanesinde yok)
    const lib = new Map((await db.select({ id: schema.exercises.id, key: schema.exercises.key }).from(schema.exercises)
      .where(and(inArray(schema.exercises.id, p.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)).concat([-1])), isNull(schema.exercises.userId)))).map((r) => [r.id, r.key]))
    const days = p.days.map((d) => ({ name: d.name, focus: d.focus ?? '', exercises: d.exercises.filter((e) => lib.has(e.exerciseId)).map((e) => ({ key: lib.get(e.exerciseId)!, name: e.name, kind: e.kind, sets: e.sets, repMin: e.repMin, repMax: e.repMax, rir: e.rir, rest: e.rest, seconds: e.seconds })) })).filter((d) => d.exercises.length)
    if (!days.length) throw new Error('Programda paylaşılacak hareket yok')
    return { programId: p.id, name: p.name, days, skipped: p.days.reduce((a, d) => a + d.exercises.filter((e) => !lib.has(e.exerciseId)).length, 0) }
  }
  if (kind === 'pr') {
    const id = Number(ref)
    const [r] = Number.isInteger(id) ? await db.select({ pr: schema.personalRecords, name: schema.exercises.nameTr }).from(schema.personalRecords).innerJoin(schema.exercises, eq(schema.exercises.id, schema.personalRecords.exerciseId)).where(and(eq(schema.personalRecords.id, id), eq(schema.personalRecords.userId, userId))).limit(1) : []
    if (!r) throw new Error('Rekor bulunamadı')
    if (r.pr.suspect && !r.pr.verified) throw new Error('Doğrulanmamış rekor paylaşılamaz; önce tanıklık ya da kanıt gerekir')
    return { name: r.name, type: r.pr.type, label: PR_LABEL[r.pr.type as PrType] ?? r.pr.type, value: r.pr.value, previous: r.pr.previous, day: dayString(r.pr.createdAt) }
  }
  if (kind === 'recipe') {
    const id = Number(ref)
    const [f] = Number.isInteger(id) ? await db.select().from(schema.foods).where(and(eq(schema.foods.id, id), eq(schema.foods.userId, userId), eq(schema.foods.source, 'user-recipe'), isNull(schema.foods.deletedAt))).limit(1) : []
    if (!f) throw new Error('Tarif bulunamadı')
    return { name: f.nameTr, per100: f.per100, portions: f.portions, recipe: f.recipe }
  }
  if (kind === 'meal') {
    const [day, meal] = String(ref ?? '').split(':')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '') || !(meal in MEAL_LABEL)) throw new Error('Öğün bulunamadı')
    const items = await db.select({ name: schema.mealItems.name, grams: schema.mealItems.grams, kcal: schema.mealItems.kcal, protein: schema.mealItems.protein }).from(schema.mealItems)
      .where(and(eq(schema.mealItems.userId, userId), eq(schema.mealItems.day, day), eq(schema.mealItems.meal, meal), isNull(schema.mealItems.deletedAt)))
    if (!items.length) throw new Error('Öğünde kayıt yok')
    return { day, meal, label: MEAL_LABEL[meal as MealId], items: items.map((i) => ({ name: i.name, grams: Math.round(i.grams), kcal: Math.round(i.kcal) })), kcal: Math.round(items.reduce((a, i) => a + i.kcal, 0)), protein: Math.round(items.reduce((a, i) => a + i.protein, 0)) }
  }
  if (kind === 'streak') {
    const t = await getToday(userId)
    if (!t || t.streak < 2) throw new Error('Paylaşılacak bir seri yok (en az 2 gün)')
    return { streak: t.streak, label: 'günlük su serisi' }
  }
  if (kind === 'badge') {
    // P-7: kazanılmış rozet (yemek/antrenman/plan rozetleri ve su rozetleri); kazanılmamış rozet paylaşılamaz
    const { achievementsFor } = await import('./achievements-data')
    const { getWaterInsights } = await import('./water-data')
    const [a, w] = await Promise.all([achievementsFor(userId), getWaterInsights(userId)])
    const b = [...a.list, ...w.badges].find((x) => x.id === ref && x.earnedDay)
    if (!b) throw new Error('Bu rozet henüz kazanılmadı')
    return { id: b.id, title: b.title, desc: b.desc, day: b.earnedDay }
  }
  if (kind === 'design') {
    // Ö3b: şablon paylaşımı — yalnız kullanıcının kendi, herkese açık şablonu; veri şablonun paylaşılabilir tasarımı
    const [t] = ref && /^[0-9a-f-]{36}$/.test(ref) ? await db.select({ id: schema.designTemplates.id, name: schema.designTemplates.name, data: schema.designTemplates.data, status: schema.designTemplates.status })
      .from(schema.designTemplates).where(and(eq(schema.designTemplates.id, ref), eq(schema.designTemplates.ownerId, userId), isNull(schema.designTemplates.deletedAt))).limit(1) : []
    if (!t || t.status !== 'public') throw new Error('Şablon bulunamadı')
    return { templateId: t.id, name: t.name, design: t.data }
  }
  if (kind === 'milestone') {
    const g = await activeGoal(userId)
    if (!g) throw new Error('Aktif hedef yok')
    const s = await weightSeries(userId, addDays(dayString(), -28), dayString())
    const now = s.filter((x) => x.trend !== null).at(-1)?.trend
    const text = now ? milestoneText(g.startWeightKg, now, g.type) : null
    if (!text) throw new Error('Paylaşılacak bir değişim yok (en az 1 kg)')
    return { text } // yalnızca değişim; mutlak kilo yok
  }
  return {}
}

async function moderate(userId: string, body: string, media: string[]): Promise<ModResult> {
  const rule = moderateText(body)
  if (!(await aiAvailable())) return media.length ? { ...rule, verdict: rule.verdict === 'ok' ? 'review' : rule.verdict, reasons: [...rule.reasons, 'AI yok: fotoğraf onay bekliyor'] } : rule
  try {
    const { readMedia } = await import('./media')
    const img = media[0] ? await readMedia(userId, media[0]) : null
    const r = await runTask(userId, 'moderate', { text: `Gönderi metni: ${body.slice(0, 1500) || '(yok)'}${media.length > 1 ? ` (+${media.length - 1} fotoğraf daha)` : ''}`, image: img ?? undefined })
    return combine(rule, { verdict: r.result.verdict, reasons: r.result.categories })
  } catch {
    return media.length ? { ...rule, verdict: rule.verdict === 'ok' ? 'review' : rule.verdict, reasons: [...rule.reasons, 'moderasyon yapılamadı'] } : rule
  }
}

export async function createPost(userId: string, p: NewPost): Promise<{ id: string; moderation: string; support: 'ed' | 'crisis' | null }> {
  const body = p.body.trim().slice(0, 2000)
  const mediaIds = [...new Set(p.mediaIds)].slice(0, 4)
  const meta = await mediaMeta(mediaIds)
  const okKind = p.kind === 'progress' ? 'progress' : 'social'
  if (meta.length !== mediaIds.length || meta.some((m) => m.userId !== userId || m.kind !== okKind)) throw new Error('Geçersiz fotoğraf')
  if (p.kind === 'progress' && !mediaIds.length) throw new Error('İlerleme fotoğrafı seç')
  if (p.kind === 'text' && !body && !mediaIds.length) throw new Error('Boş gönderi paylaşılamaz')
  let audience: Audience = p.audience, audienceIds = [...new Set(p.audienceIds)]
  if (p.kind === 'progress') audience = 'selected' // ilerleme fotoğrafı yalnızca seçilen kişilere (spesifikasyon 8.3)
  if (audience === 'selected') {
    const fr = new Set(await friendIds(userId))
    audienceIds = audienceIds.filter((x) => fr.has(x))
    if (!audienceIds.length) throw new Error('En az bir arkadaş seç')
  } else audienceIds = []
  const data = await snapshot(userId, p.kind, p.ref)
  const mod = await moderate(userId, body, mediaIds)
  const moderation = mod.verdict === 'ok' ? 'ok' : mod.verdict === 'block' ? 'hidden' : 'pending'
  const [row] = await db.insert(schema.posts).values({ userId, kind: p.kind, body, data, mediaIds, audience, audienceIds, moderation, moderationReason: mod.reasons.join(', ') || null }).returning({ id: schema.posts.id })
  return { id: row.id, moderation, support: mod.support }
}
export async function deletePost(userId: string, id: string) {
  await db.update(schema.posts).set({ deletedAt: new Date() }).where(and(eq(schema.posts.id, id), eq(schema.posts.userId, userId)))
}

export interface PostView {
  id: string; kind: string; body: string; data: Record<string, unknown>; media: string[]; audience: string; moderation: string; createdAt: string
  author: { id: string; username: string; avatar: string | null }; mine: boolean
  reactions: Record<string, number>; myReaction: string | null; comments: number; saved: boolean; score: number
}

async function enrich(viewerId: string, rows: (typeof schema.posts.$inferSelect)[], close: Set<string>): Promise<PostView[]> {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id), authors = [...new Set(rows.map((r) => r.userId))]
  const [reacts, comments, saves, users, profs] = await Promise.all([
    db.select({ postId: schema.postReactions.postId, kind: schema.postReactions.kind, userId: schema.postReactions.userId }).from(schema.postReactions).where(inArray(schema.postReactions.postId, ids)),
    db.select({ postId: schema.postComments.postId, n: sql<number>`count(*)::int` }).from(schema.postComments).where(and(inArray(schema.postComments.postId, ids), isNull(schema.postComments.deletedAt), eq(schema.postComments.moderation, 'ok'))).groupBy(schema.postComments.postId),
    db.select({ postId: schema.postSaves.postId }).from(schema.postSaves).where(and(inArray(schema.postSaves.postId, ids), eq(schema.postSaves.userId, viewerId))),
    db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users).where(inArray(schema.users.id, authors)),
    db.select({ userId: schema.socialProfiles.userId, avatarId: schema.socialProfiles.avatarId }).from(schema.socialProfiles).where(inArray(schema.socialProfiles.userId, authors)),
  ])
  const now = Date.now()
  return rows.map((r) => {
    const rs = reacts.filter((x) => x.postId === r.id)
    const counts: Record<string, number> = {}
    for (const x of rs) counts[x.kind] = (counts[x.kind] ?? 0) + 1
    const nComments = Number(comments.find((c) => c.postId === r.id)?.n ?? 0)
    const av = profs.find((p) => p.userId === r.userId)?.avatarId
    return {
      id: r.id, kind: r.kind, body: r.body, data: r.data, media: r.mediaIds.map((_, i) => `/api/social/media/${r.id}/${i}`), audience: r.audience, moderation: r.moderation, createdAt: r.createdAt.toISOString(),
      author: { id: r.userId, username: users.find((u) => u.id === r.userId)?.username ?? '?', avatar: av ? `/api/social/avatar/${r.userId}?v=${av.slice(0, 8)}` : null }, mine: r.userId === viewerId,
      reactions: counts, myReaction: rs.find((x) => x.userId === viewerId)?.kind ?? null, comments: nComments, saved: saves.some((s) => s.postId === r.id),
      score: feedScore({ createdAt: r.createdAt.getTime(), kind: r.kind, close: close.has(r.userId), reactions: rs.length, comments: nComments, mine: r.userId === viewerId }, now),
    }
  })
}

async function postsOf(viewerId: string, authorId: string, rel: Relation, vis: Visibility): Promise<PostView[]> {
  const rows = await db.select().from(schema.posts).where(and(eq(schema.posts.userId, authorId), isNull(schema.posts.deletedAt))).orderBy(desc(schema.posts.createdAt)).limit(30)
  return enrich(viewerId, rows.filter((r) => postVisible(rel, { audience: r.audience as Audience, audienceIds: r.audienceIds, moderation: r.moderation }, viewerId, vis)), new Set())
}

/** Akış: kendi + arkadaş + takip edilen (son 30 gün), görünürlük süzgeci, engel/sessiz hariç; önerilen ya da kronolojik. */
export async function feed(viewerId: string, mode: 'onerilen' | 'kronolojik', savedOnly = false): Promise<PostView[]> {
  const friends = await friendIds(viewerId)
  const followed = (await db.select({ id: schema.follows.followeeId }).from(schema.follows).where(eq(schema.follows.followerId, viewerId))).map((r) => r.id)
  const { blocked, muted } = await hiddenIds(viewerId)
  const close = new Set((await db.select({ id: schema.friendLinks.friendId }).from(schema.friendLinks).where(and(eq(schema.friendLinks.userId, viewerId), eq(schema.friendLinks.close, true)))).map((r) => r.id))
  let rows: (typeof schema.posts.$inferSelect)[]
  if (savedOnly) {
    rows = (await db.select({ p: schema.posts }).from(schema.postSaves).innerJoin(schema.posts, eq(schema.posts.id, schema.postSaves.postId)).where(and(eq(schema.postSaves.userId, viewerId), isNull(schema.posts.deletedAt))).orderBy(desc(schema.postSaves.createdAt)).limit(60)).map((r) => r.p)
  } else {
    const authors = [...new Set([viewerId, ...friends, ...followed])].filter((a) => !blocked.has(a) && !muted.has(a))
    rows = await db.select().from(schema.posts).where(and(inArray(schema.posts.userId, authors), isNull(schema.posts.deletedAt), gte(schema.posts.createdAt, new Date(Date.now() - 30 * 86400000)))).orderBy(desc(schema.posts.createdAt)).limit(200)
  }
  const fr = new Set(friends), fo = new Set(followed)
  const vis = new Map((await db.select({ userId: schema.socialProfiles.userId, v: schema.socialProfiles.visibility }).from(schema.socialProfiles).where(inArray(schema.socialProfiles.userId, [...new Set(rows.map((r) => r.userId)), viewerId]))).map((r) => [r.userId, r.v as Visibility]))
  const visible = rows.filter((r) => {
    if (blocked.has(r.userId)) return false
    const rel: Relation = r.userId === viewerId ? 'self' : fr.has(r.userId) ? 'friend' : fo.has(r.userId) ? 'follower' : 'none'
    return postVisible(rel, { audience: r.audience as Audience, audienceIds: r.audienceIds, moderation: r.moderation }, viewerId, vis.get(r.userId) ?? 'friends')
  })
  const out = await enrich(viewerId, visible, close)
  if (mode === 'onerilen' && !savedOnly) out.sort((a, b) => b.score - a.score)
  return out.slice(0, 60)
}

/** Tek gönderi (izleyici görebiliyorsa) + yorumlar. Gönderiyi göremeyen için null (varlığı sızdırılmaz). */
export async function postDetail(viewerId: string, id: string) {
  const [r] = await db.select().from(schema.posts).where(and(eq(schema.posts.id, id), isNull(schema.posts.deletedAt))).limit(1)
  if (!r) return null
  const rel = await relationOf(viewerId, r.userId)
  const sp = await socialProfile(r.userId)
  if (!postVisible(rel, { audience: r.audience as Audience, audienceIds: r.audienceIds, moderation: r.moderation }, viewerId, sp.visibility as Visibility)) return null
  const [view] = await enrich(viewerId, [r], new Set())
  const { blocked } = await hiddenIds(viewerId)
  const cs = await db.select({ c: schema.postComments, username: schema.users.username }).from(schema.postComments).innerJoin(schema.users, eq(schema.users.id, schema.postComments.userId))
    .where(and(eq(schema.postComments.postId, id), isNull(schema.postComments.deletedAt))).orderBy(asc(schema.postComments.createdAt))
  const comments = cs.filter((c) => !blocked.has(c.c.userId) && (c.c.moderation === 'ok' || c.c.userId === viewerId))
    .map((c) => ({ id: c.c.id, body: c.c.body, username: c.username, mine: c.c.userId === viewerId, canDelete: c.c.userId === viewerId || r.userId === viewerId, pending: c.c.moderation !== 'ok', createdAt: c.c.createdAt.toISOString() }))
  return { post: view, comments, rel }
}
async function visiblePost(viewerId: string, id: string) {
  const d = await postDetail(viewerId, id)
  if (!d) throw new Error('Gönderi bulunamadı')
  return d
}

export async function react(viewerId: string, postId: string, kind: Reaction | null) {
  const d = await visiblePost(viewerId, postId)
  if (!kind) { await db.delete(schema.postReactions).where(and(eq(schema.postReactions.postId, postId), eq(schema.postReactions.userId, viewerId))); return }
  await db.insert(schema.postReactions).values({ postId, userId: viewerId, kind }).onConflictDoUpdate({ target: [schema.postReactions.postId, schema.postReactions.userId], set: { kind, createdAt: new Date() } })
  await notify(d.post.author.id, 'reaction', viewerId, postId)
}
export async function comment(viewerId: string, postId: string, body: string): Promise<{ pending: boolean }> {
  const d = await visiblePost(viewerId, postId)
  const text = body.trim().slice(0, 500)
  if (text.length < 1) throw new Error('Yorum boş')
  let mod = moderateText(text)
  if (mod.verdict === 'ok' && (await aiAvailable())) {
    try { const r = await runTask(viewerId, 'moderate', { text: `Yorum: ${text}` }); mod = combine(mod, { verdict: r.result.verdict, reasons: r.result.categories }) } catch { /* kural kararı */ }
  }
  const moderation = mod.verdict === 'ok' ? 'ok' : mod.verdict === 'block' ? 'hidden' : 'pending'
  await db.insert(schema.postComments).values({ postId, userId: viewerId, body: text, moderation })
  if (moderation === 'ok') await notify(d.post.author.id, 'comment', viewerId, postId)
  return { pending: moderation !== 'ok' }
}
export async function deleteComment(viewerId: string, commentId: string) {
  const [c] = await db.select({ c: schema.postComments, owner: schema.posts.userId }).from(schema.postComments).innerJoin(schema.posts, eq(schema.posts.id, schema.postComments.postId)).where(eq(schema.postComments.id, commentId)).limit(1)
  if (!c || (c.c.userId !== viewerId && c.owner !== viewerId)) throw new Error('Yorum bulunamadı')
  await db.update(schema.postComments).set({ deletedAt: new Date() }).where(eq(schema.postComments.id, commentId))
}
export async function toggleSave(viewerId: string, postId: string, on: boolean) {
  await visiblePost(viewerId, postId)
  if (on) await db.insert(schema.postSaves).values({ postId, userId: viewerId }).onConflictDoNothing()
  else await db.delete(schema.postSaves).where(and(eq(schema.postSaves.postId, postId), eq(schema.postSaves.userId, viewerId)))
}

/** "Bu antrenmanı kopyala": gönderideki hareketlerden izleyiciye tek günlük program (aktif yapılmaz). */
export async function copyWorkout(viewerId: string, postId: string): Promise<string> {
  const { post } = await visiblePost(viewerId, postId)
  if (post.kind !== 'workout') throw new Error('Antrenman gönderisi değil')
  const data = post.data as { name: string; exercises: { key: string | null; kind: string; sets: { kg: number; reps: number; seconds: number | null }[] }[] }
  const exs = data.exercises.filter((e) => e.key && e.sets.length).map((e, i) => {
    const reps = e.sets.map((s) => s.reps).filter((x) => x > 0)
    const time = e.kind === 'time'
    return { key: e.key!, role: (i === 0 ? 'ana' : 'yardımcı') as 'ana', sets: Math.min(6, e.sets.length), repMin: time ? 1 : Math.max(1, Math.min(...reps, 30)), repMax: time ? 1 : Math.max(1, Math.min(Math.max(...reps, 1), 30)), rir: 2, rest: 90, seconds: time ? (e.sets[0].seconds ?? 45) : undefined }
  })
  if (!exs.length) throw new Error('Kopyalanacak hareket yok')
  return insertProgram(viewerId, `${post.author.username}: ${data.name}`.slice(0, 60), 'shared', [{ name: data.name.slice(0, 40), focus: '', exercises: exs }], [`@${post.author.username} paylaşımından kopyalandı.`], false)
}

/** "Programlarıma kaydet": paylaşılan programın tüm günleri izleyiciye kopyalanır (aktif yapılmaz). */
export async function saveProgramCopy(viewerId: string, postId: string): Promise<string> {
  const { post } = await visiblePost(viewerId, postId)
  if (post.kind !== 'program') throw new Error('Program gönderisi değil')
  const d = post.data as { name: string; days: { name: string; focus: string; exercises: { key: string; sets: number; repMin: number; repMax: number; rir: number; rest: number; seconds: number | null }[] }[] }
  const days = d.days.map((x) => ({ name: x.name.slice(0, 40), focus: x.focus ?? '', exercises: x.exercises.map((e, i) => ({ key: e.key, role: (i === 0 ? 'ana' : 'yardımcı') as 'ana', sets: e.sets, repMin: e.repMin, repMax: e.repMax, rir: e.rir, rest: e.rest, seconds: e.seconds ?? undefined })) }))
  if (!days.length) throw new Error('Kaydedilecek gün yok')
  return insertProgram(viewerId, `${d.name}`.slice(0, 60), 'shared', days, [`@${post.author.username} paylaşımından kaydedildi.`], false)
}

/** "Tariflerime kaydet": tarifin besin değerleri ve malzeme listesiyle izleyiciye ait tarif kopyası. */
export async function saveRecipeCopy(viewerId: string, postId: string): Promise<number> {
  const { post } = await visiblePost(viewerId, postId)
  if (post.kind !== 'recipe') throw new Error('Tarif gönderisi değil')
  const d = post.data as { name: string; per100: Record<string, number>; portions: { label: string; g: number }[]; recipe: unknown }
  const [row] = await db.insert(schema.foods).values({
    source: 'user-recipe', sourceId: crypto.randomUUID(), userId: viewerId, nameTr: d.name, category: 'Kendi tarifim', per100: d.per100,
    kcal: d.per100.kcal ?? 0, protein: d.per100.protein ?? 0, carb: d.per100.carb ?? 0, fat: d.per100.fat ?? 0, portions: d.portions, recipe: d.recipe as object,
    search: normalizeSearch(d.name), approx: true, attribution: `@${post.author.username} tarifinden`,
  }).returning({ id: schema.foods.id })
  return row.id
}

export async function report(viewerId: string, targetType: 'post' | 'comment' | 'user', targetId: string, reason: string, note: string | null) {
  if (!z.string().uuid().safeParse(targetId).success) throw new Error('Geçersiz şikayet hedefi')
  // aynı kişinin aynı hedefe tekrar şikayeti sessizce yok sayılır
  const [dup] = await db.select({ id: schema.reports.id }).from(schema.reports).where(and(eq(schema.reports.reporterId, viewerId), eq(schema.reports.targetType, targetType), eq(schema.reports.targetId, targetId))).limit(1)
  if (dup) return
  await db.insert(schema.reports).values({ reporterId: viewerId, targetType, targetId, reason, note })
  // aynı gönderi 3 farklı kişiden şikayet alırsa onaya düşer
  if (targetType === 'post') {
    const [r] = await db.select({ n: sql<number>`count(distinct reporter_id)::int` }).from(schema.reports).where(and(eq(schema.reports.targetType, 'post'), eq(schema.reports.targetId, targetId), eq(schema.reports.status, 'open')))
    if (Number(r?.n ?? 0) >= 3) await db.update(schema.posts).set({ moderation: 'pending', moderationReason: 'çoklu şikayet' }).where(and(eq(schema.posts.id, targetId), eq(schema.posts.moderation, 'ok')))
  }
}

// ───────── Yönetici moderasyonu ─────────

export async function moderationQueue() {
  const pending = await db.select({ p: schema.posts, username: schema.users.username }).from(schema.posts).innerJoin(schema.users, eq(schema.users.id, schema.posts.userId))
    .where(and(inArray(schema.posts.moderation, ['pending', 'hidden']), isNull(schema.posts.deletedAt))).orderBy(desc(schema.posts.createdAt)).limit(50)
  const comments = await db.select({ c: schema.postComments, username: schema.users.username }).from(schema.postComments).innerJoin(schema.users, eq(schema.users.id, schema.postComments.userId))
    .where(and(inArray(schema.postComments.moderation, ['pending', 'hidden']), isNull(schema.postComments.deletedAt))).orderBy(desc(schema.postComments.createdAt)).limit(50)
  const reps = await db.select({ r: schema.reports, reporter: schema.users.username }).from(schema.reports).innerJoin(schema.users, eq(schema.users.id, schema.reports.reporterId))
    .where(eq(schema.reports.status, 'open')).orderBy(desc(schema.reports.createdAt)).limit(50)
  return {
    posts: pending.map((x) => ({ id: x.p.id, username: x.username, kind: x.p.kind, body: x.p.body, media: x.p.mediaIds.length, moderation: x.p.moderation, reason: x.p.moderationReason, createdAt: x.p.createdAt.toISOString() })),
    comments: comments.map((x) => ({ id: x.c.id, username: x.username, body: x.c.body, moderation: x.c.moderation })),
    reports: reps.map((x) => ({ id: x.r.id, reporter: x.reporter, targetType: x.r.targetType, targetId: x.r.targetId, reason: x.r.reason, note: x.r.note })),
  }
}
export async function resolvePost(id: string, approve: boolean) {
  await db.update(schema.posts).set({ moderation: approve ? 'ok' : 'hidden' }).where(eq(schema.posts.id, id))
  await db.update(schema.reports).set({ status: approve ? 'dismissed' : 'resolved', resolvedAt: new Date() }).where(and(eq(schema.reports.targetType, 'post'), eq(schema.reports.targetId, id), eq(schema.reports.status, 'open')))
}
export async function resolveComment(id: string, approve: boolean) {
  await db.update(schema.postComments).set(approve ? { moderation: 'ok' } : { moderation: 'hidden', deletedAt: new Date() }).where(eq(schema.postComments.id, id))
  await db.update(schema.reports).set({ status: approve ? 'dismissed' : 'resolved', resolvedAt: new Date() }).where(and(eq(schema.reports.targetType, 'comment'), eq(schema.reports.targetId, id), eq(schema.reports.status, 'open')))
}
export async function dismissReport(id: string) {
  await db.update(schema.reports).set({ status: 'dismissed', resolvedAt: new Date() }).where(eq(schema.reports.id, id))
}

/** Medya erişimi: gönderinin i. fotoğrafı (izleyici gönderiyi görebiliyorsa) ya da profil fotoğrafı (temel profil görünüyorsa). */
export async function postMedia(viewerId: string, postId: string, idx: number) {
  const d = await postDetail(viewerId, postId).catch(() => null)
  if (!d) return null
  const [r] = await db.select({ userId: schema.posts.userId, mediaIds: schema.posts.mediaIds }).from(schema.posts).where(eq(schema.posts.id, postId)).limit(1)
  const id = r?.mediaIds[idx]
  if (!id) return null
  const { readMedia } = await import('./media')
  return readMedia(r.userId, id)
}
export async function avatarMedia(viewerId: string, userId: string) {
  const rel = await relationOf(viewerId, userId)
  const sp = await socialProfile(userId)
  if (!profileAccess(rel, sp.visibility as Visibility).basic || !sp.avatarId) return null
  const { readMedia } = await import('./media')
  return readMedia(userId, sp.avatarId)
}

/** Paylaşım ekranı için kaynak listeleri (kullanıcının kendi verisi). */
export async function shareSources(userId: string) {
  const [workouts, prs, recipes, friends, programs] = await Promise.all([
    db.select({ id: schema.workouts.id, name: schema.workouts.name, day: schema.workouts.day }).from(schema.workouts).where(and(eq(schema.workouts.userId, userId), isNull(schema.workouts.deletedAt))).orderBy(desc(schema.workouts.startedAt)).limit(10),
    db.select({ id: schema.personalRecords.id, type: schema.personalRecords.type, value: schema.personalRecords.value, name: schema.exercises.nameTr }).from(schema.personalRecords).innerJoin(schema.exercises, eq(schema.exercises.id, schema.personalRecords.exerciseId)).where(eq(schema.personalRecords.userId, userId)).orderBy(desc(schema.personalRecords.createdAt)).limit(10),
    db.select({ id: schema.foods.id, name: schema.foods.nameTr }).from(schema.foods).where(and(eq(schema.foods.userId, userId), eq(schema.foods.source, 'user-recipe'), isNull(schema.foods.deletedAt))).orderBy(desc(schema.foods.createdAt)).limit(20),
    friendsOverview(userId).then((f) => f.friends),
    db.select({ id: schema.programs.id, name: schema.programs.name }).from(schema.programs).where(and(eq(schema.programs.userId, userId), isNull(schema.programs.deletedAt))).orderBy(desc(schema.programs.updatedAt)).limit(20),
  ])
  return { workouts, prs: prs.map((p) => ({ ...p, label: PR_LABEL[p.type as PrType] ?? p.type })), recipes, friends, programs }
}
export { ITEMS }
