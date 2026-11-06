import 'server-only'
// Sosyal genişleme veri katmanı (Faz 5b): gruplar + sohbet, meydan okuma/düello, sıralama, mesaj, dürtme, partner, 24 saatlik kartlar, PR doğrulama.
// İlerleme ve puanlar lib/social-rank.ts saf fonksiyonlarıyla kayıtlardan hesaplanır; saklanmaz.
import { and, asc, desc, eq, gte, inArray, isNull, notInArray, or, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { addDays, dayString } from './time'
import { gatherDays } from './coach-data'
import { getProgram, insertProgram, listPrograms } from './fitness-data'
import { mediaMeta } from './media'
import { cleanTextError, moderateText } from './moderation'
import { LIFTS } from './progress'
import { consistency, dots, duelResult, METRICS, NUDGE, nudgeAllowed, progressOf, prSuspicious, rankBoard, STORY_HOURS, TEMPLATES, WITNESSES_NEEDED, type Metric, type NudgeKind } from './social-rank'
import { friendIds, hiddenIds, notify, relationOf, socialProfile } from './social-data'
import type { ProgramDay } from './programs'

const unameMap = async (ids: string[]) => new Map((ids.length ? await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users).where(inArray(schema.users.id, ids)) : []).map((u) => [u.id, u.username]))
async function mustBeFriend(me: string, other: string) {
  if ((await relationOf(me, other)) !== 'friend') throw new Error('Yalnızca arkadaşlarınla')
}

// ───────── Gruplar ─────────

export async function createGroup(me: string, name: string, description: string | null) {
  const bad = cleanTextError('Grup adı', name) ?? cleanTextError('Grup açıklaması', description)
  if (bad) throw new Error(bad)
  const [g] = await db.insert(schema.groups).values({ ownerId: me, name: name.slice(0, 60), description: description?.slice(0, 200) || null }).returning({ id: schema.groups.id })
  await db.insert(schema.groupMembers).values({ groupId: g.id, userId: me, status: 'joined', invitedBy: me })
  return g.id
}
async function membership(me: string, groupId: string) {
  const [m] = await db.select({ m: schema.groupMembers, g: schema.groups }).from(schema.groupMembers).innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId))
    .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, me), isNull(schema.groups.deletedAt))).limit(1)
  return m ?? null
}
export async function inviteToGroup(me: string, groupId: string, friendId: string) {
  const m = await membership(me, groupId)
  if (m?.m.status !== 'joined') throw new Error('Grup bulunamadı')
  await mustBeFriend(me, friendId)
  const r = await db.insert(schema.groupMembers).values({ groupId, userId: friendId, status: 'invited', invitedBy: me }).onConflictDoNothing().returning()
  if (r.length) await notify(friendId, 'group_invite', me, null, { url: `/sosyal/gruplar/${groupId}` })
}
export async function respondGroup(me: string, groupId: string, accept: boolean) {
  if (accept) await db.update(schema.groupMembers).set({ status: 'joined' }).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, me), eq(schema.groupMembers.status, 'invited')))
  else await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, me)))
}
/** Ayrıl; sahip ayrılırsa grup kapanır. Sahip başka üyeyi çıkarabilir. */
export async function leaveGroup(me: string, groupId: string, targetId: string = me) {
  const m = await membership(me, groupId)
  if (!m) throw new Error('Grup bulunamadı')
  if (targetId !== me && m.g.ownerId !== me) throw new Error('Yalnızca grup sahibi çıkarabilir')
  if (targetId === m.g.ownerId) { await db.update(schema.groups).set({ deletedAt: new Date() }).where(eq(schema.groups.id, groupId)); return }
  await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, targetId)))
}
export async function setRankOptIn(me: string, groupId: string, on: boolean) {
  await db.update(schema.groupMembers).set({ rankOptIn: on }).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, me)))
}
export async function myGroups(me: string) {
  const rows = await db.select({ g: schema.groups, status: schema.groupMembers.status }).from(schema.groupMembers).innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId))
    .where(and(eq(schema.groupMembers.userId, me), isNull(schema.groups.deletedAt))).orderBy(desc(schema.groups.createdAt))
  const counts = rows.length ? await db.select({ id: schema.groupMembers.groupId, n: sql<number>`count(*)::int` }).from(schema.groupMembers).where(and(inArray(schema.groupMembers.groupId, rows.map((r) => r.g.id)), eq(schema.groupMembers.status, 'joined'))).groupBy(schema.groupMembers.groupId) : []
  return rows.map((r) => ({ id: r.g.id, name: r.g.name, status: r.status, owner: r.g.ownerId === me, members: Number(counts.find((c) => c.id === r.g.id)?.n ?? 0) }))
}

/** Kuvvet puanı: squat + bench + deadlift tahmini 1RM toplamının DOTS puanı. Şüpheli ve doğrulanmamış rekorlar yerine önceki değer kullanılır. */
export async function strengthScore(userId: string): Promise<{ dots: number | null; total: number; lifts: Record<string, number>; excluded: number }> {
  const keys = ['squat', 'bench', 'deadlift'].flatMap((l) => LIFTS[l].keys)
  const ex = await db.select({ id: schema.exercises.id, key: schema.exercises.key }).from(schema.exercises).where(inArray(schema.exercises.key, keys))
  if (!ex.length) return { dots: null, total: 0, lifts: {}, excluded: 0 }
  const recs = await db.select().from(schema.exerciseRecords).where(and(eq(schema.exerciseRecords.userId, userId), inArray(schema.exerciseRecords.exerciseId, ex.map((e) => e.id))))
  const sus = await db.select().from(schema.personalRecords).where(and(eq(schema.personalRecords.userId, userId), inArray(schema.personalRecords.exerciseId, ex.map((e) => e.id)), eq(schema.personalRecords.type, 'e1rm'), sql`${schema.personalRecords.suspect} is not null`, eq(schema.personalRecords.verified, false)))
  const [p] = await db.select({ sex: schema.profiles.sex, kg: schema.profiles.weightKg }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  const [w] = await db.select({ kg: schema.weightLogs.kg }).from(schema.weightLogs).where(and(eq(schema.weightLogs.userId, userId), isNull(schema.weightLogs.deletedAt))).orderBy(desc(schema.weightLogs.loggedAt)).limit(1)
  const bw = w?.kg ?? p?.kg ?? 0
  const sex = (p?.sex as 'male' | 'female') ?? 'male'
  const lifts: Record<string, number> = {}
  let excluded = 0
  for (const lift of ['squat', 'bench', 'deadlift']) {
    const ids = ex.filter((e) => LIFTS[lift].keys.includes(e.key)).map((e) => e.id)
    let best = Math.max(0, ...recs.filter((r) => ids.includes(r.exerciseId)).map((r) => r.records.e1rm ?? 0))
    for (const s of sus.filter((x) => ids.includes(x.exerciseId)).sort((a, b) => b.value - a.value)) if (s.value >= best - 1e-9) { best = Math.min(best, s.previous ?? 0); excluded++ }
    // ilk kayıt (rekor satırı yok) olağandışıysa sıralamaya girmez
    const key = ex.find((e) => ids.includes(e.id))?.key ?? ''
    if (best > 0 && prSuspicious({ type: 'e1rm', value: best, best7dAgo: null, exerciseKey: key, bodyKg: bw, sex })) { best = 0; excluded++ }
    if (best > 0) lifts[lift] = Math.round(best)
  }
  const total = Object.values(lifts).reduce((a, x) => a + x, 0)
  return { dots: total && bw ? dots(total, bw, sex) : null, total, lifts, excluded }
}
/** Tutarlılık: son 4 haftada (Pazartesi başlangıçlı, bu hafta hariç) antrenman günü / haftalık hedef. */
export async function consistencyScore(userId: string): Promise<number> {
  const today = dayString(), dow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7
  const end = addDays(today, -dow - 1), start = addDays(end, -27)
  const days = await gatherDays(userId, start, end)
  const [p] = await db.select({ t: schema.profiles.trainingDays }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  const perWeek = [0, 1, 2, 3].map((w) => days.slice(w * 7, w * 7 + 7).filter((d) => d.workouts > 0 || d.cardioMin >= 20).length)
  return consistency(perWeek, p?.t ?? 3)
}

export async function groupView(me: string, groupId: string) {
  const m = await membership(me, groupId)
  if (!m) return null
  const g = m.g
  if (m.m.status === 'invited') return { id: g.id, name: g.name, description: g.description, invited: true as const }
  const members = await db.select({ userId: schema.groupMembers.userId, status: schema.groupMembers.status, rankOptIn: schema.groupMembers.rankOptIn, username: schema.users.username }).from(schema.groupMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.groupMembers.userId)).where(eq(schema.groupMembers.groupId, groupId)).orderBy(asc(schema.users.username))
  const { blocked } = await hiddenIds(me)
  const msgs = await db.select({ m: schema.groupMessages, username: schema.users.username }).from(schema.groupMessages).innerJoin(schema.users, eq(schema.users.id, schema.groupMessages.userId))
    .where(eq(schema.groupMessages.groupId, groupId)).orderBy(desc(schema.groupMessages.createdAt)).limit(50)
  const visibleMembers = members.filter((x) => !blocked.has(x.userId))
  const joined = visibleMembers.filter((x) => x.status === 'joined')
  const ranked = await Promise.all(joined.filter((x) => x.rankOptIn).map(async (x) => ({ userId: x.userId, name: x.username, str: await strengthScore(x.userId), cons: await consistencyScore(x.userId) })))
  const challenges = await db.select().from(schema.challenges).where(and(eq(schema.challenges.groupId, groupId), isNull(schema.challenges.deletedAt), gte(schema.challenges.endDay, addDays(dayString(), -7)))).orderBy(desc(schema.challenges.createdAt))
  return {
    id: g.id, name: g.name, description: g.description, invited: false as const, owner: g.ownerId === me, myOptIn: m.m.rankOptIn,
    members: visibleMembers.map((x) => ({ id: x.userId, username: x.username, status: x.status, owner: x.userId === g.ownerId })),
    messages: msgs.reverse().filter((x) => !blocked.has(x.m.userId)).map((x) => ({ id: x.m.id, username: x.username, body: x.m.body, flagged: x.m.flagged, mine: x.m.userId === me, createdAt: x.m.createdAt.toISOString() })),
    dotsBoard: rankBoard(ranked.filter((r) => r.str.dots !== null).map((r) => ({ userId: r.userId, name: r.name, value: r.str.dots!, total: r.str.total, excluded: r.str.excluded })), null),
    consBoard: rankBoard(ranked.map((r) => ({ userId: r.userId, name: r.name, value: r.cons })), 100),
    challenges: challenges.map((c) => ({ id: c.id, title: c.title, endDay: c.endDay })),
  }
}
export async function postGroupMessage(me: string, groupId: string, body: string) {
  const m = await membership(me, groupId)
  if (m?.m.status !== 'joined') throw new Error('Grup bulunamadı')
  const text = body.trim().slice(0, 1000)
  if (!text) throw new Error('Mesaj boş')
  const mod = moderateText(text)
  await db.insert(schema.groupMessages).values({ groupId, userId: me, body: text, flagged: mod.verdict === 'ok' ? null : mod.reasons.join(', ') })
  return { support: mod.support }
}

// ───────── Meydan okuma ve düello ─────────

export interface NewChallenge { template?: string | null; title?: string; metric?: Metric; param?: number | null; target?: number | null; days?: number; scope: 'friends' | 'group' | 'duel'; inviteIds: string[]; groupId?: string | null }
export async function createChallenge(me: string, c: NewChallenge): Promise<string> {
  const t = c.template ? TEMPLATES.find((x) => x.key === c.template) : null
  const metric = (t?.metric ?? c.metric) as Metric
  if (!metric || !(metric in METRICS)) throw new Error('Ölçüt seç')
  const days = Math.max(1, Math.min(90, Math.round(t?.days ?? (c.scope === 'duel' ? 7 : c.days ?? 7))))
  const start = dayString(), end = addDays(start, days - 1)
  const bad = c.template ? null : cleanTextError('Meydan okuma başlığı', c.title)
  if (bad) throw new Error(bad)
  const { blocked } = await hiddenIds(me)
  let invite = [...new Set(c.inviteIds)].filter((x) => x !== me && !blocked.has(x))
  if (c.scope === 'group') {
    const m = c.groupId ? await membership(me, c.groupId) : null
    if (m?.m.status !== 'joined') throw new Error('Grup bulunamadı')
    invite = (await db.select({ id: schema.groupMembers.userId }).from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, c.groupId!), eq(schema.groupMembers.status, 'joined')))).map((r) => r.id).filter((x) => x !== me && !blocked.has(x))
  } else {
    const fr = new Set(await friendIds(me))
    invite = invite.filter((x) => fr.has(x))
    if (c.scope === 'duel' && invite.length !== 1) throw new Error('Düello için bir arkadaş seç')
    if (!invite.length) throw new Error('En az bir arkadaş davet et')
  }
  const title = (t?.title ?? c.title ?? METRICS[metric].label).slice(0, 80)
  const [row] = await db.insert(schema.challenges).values({ creatorId: me, title, metric, param: t ? t.param : c.param ?? null, target: t ? t.target : c.target ?? null, startDay: start, endDay: end, scope: c.scope, groupId: c.scope === 'group' ? c.groupId! : null, template: t?.key ?? null }).returning({ id: schema.challenges.id })
  await db.insert(schema.challengeMembers).values([{ challengeId: row.id, userId: me, status: 'joined' }, ...invite.map((u) => ({ challengeId: row.id, userId: u, status: 'invited' }))])
  for (const u of invite) await notify(u, 'challenge_invite', me, null, { url: `/sosyal/meydan/${row.id}` })
  return row.id
}
export async function respondChallenge(me: string, id: string, status: 'joined' | 'declined' | 'left') {
  await db.update(schema.challengeMembers).set({ status }).where(and(eq(schema.challengeMembers.challengeId, id), eq(schema.challengeMembers.userId, me)))
}
async function board(c: typeof schema.challenges.$inferSelect, viewerId: string) {
  const { blocked } = await hiddenIds(viewerId)
  const ms = (await db.select({ userId: schema.challengeMembers.userId, status: schema.challengeMembers.status }).from(schema.challengeMembers).where(eq(schema.challengeMembers.challengeId, c.id))).filter((m) => m.userId === viewerId || !blocked.has(m.userId))
  const joined = ms.filter((m) => m.status === 'joined')
  const names = await unameMap(ms.map((m) => m.userId))
  const to = c.endDay < dayString() ? c.endDay : dayString()
  const rows = await Promise.all(joined.map(async (m) => ({ userId: m.userId, name: names.get(m.userId) ?? '?', value: progressOf(c.metric as Metric, c.param, await gatherDays(m.userId, c.startDay, to)) })))
  return { rows: rankBoard(rows, c.target), invited: ms.filter((m) => m.status === 'invited').map((m) => names.get(m.userId) ?? '?'), members: ms }
}
export async function challengeView(me: string, id: string) {
  const [c] = await db.select().from(schema.challenges).where(and(eq(schema.challenges.id, id), isNull(schema.challenges.deletedAt))).limit(1)
  if (!c) return null
  const [mine] = await db.select({ status: schema.challengeMembers.status }).from(schema.challengeMembers).where(and(eq(schema.challengeMembers.challengeId, id), eq(schema.challengeMembers.userId, me))).limit(1)
  if (!mine || mine.status === 'declined' || mine.status === 'left') return null
  const b = await board(c, me)
  const ended = c.endDay < dayString()
  const duel = c.scope === 'duel' && b.rows.length === 2 ? duelResult(b.rows[0], b.rows[1], ended) : null
  return { id: c.id, title: c.title, metric: c.metric, metricLabel: METRICS[c.metric as Metric].label, unit: METRICS[c.metric as Metric].unit, param: c.param, target: c.target, startDay: c.startDay, endDay: c.endDay, scope: c.scope, ended, myStatus: mine.status, board: b.rows, invited: b.invited, duel }
}
export async function myChallenges(me: string) {
  const rows = await db.select({ c: schema.challenges, status: schema.challengeMembers.status }).from(schema.challengeMembers).innerJoin(schema.challenges, eq(schema.challenges.id, schema.challengeMembers.challengeId))
    .where(and(eq(schema.challengeMembers.userId, me), inArray(schema.challengeMembers.status, ['invited', 'joined']), isNull(schema.challenges.deletedAt), gte(schema.challenges.endDay, addDays(dayString(), -14)))).orderBy(desc(schema.challenges.createdAt)).limit(30)
  return rows.map((r) => ({ id: r.c.id, title: r.c.title, scope: r.c.scope, endDay: r.c.endDay, status: r.status, ended: r.c.endDay < dayString() }))
}

// ───────── Birebir mesaj ─────────

export async function sendDM(me: string, toUsername: string, body: string, postId: string | null) {
  const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(sql`lower(${schema.users.username})`, toUsername.toLowerCase())).limit(1)
  if (!u) throw new Error('Kullanıcı bulunamadı')
  await mustBeFriend(me, u.id)
  const text = body.trim().slice(0, 2000)
  if (!text && !postId) throw new Error('Mesaj boş')
  if (postId) {
    const { postDetail } = await import('./social-data')
    if (!(await postDetail(me, postId))) throw new Error('Gönderi bulunamadı')
  }
  const mod = moderateText(text)
  await db.insert(schema.directMessages).values({ senderId: me, recipientId: u.id, body: text, postId, flagged: mod.verdict === 'ok' ? null : mod.reasons.join(', ') })
  await notify(u.id, 'message', me, null, { url: `/sosyal/mesaj/${encodeURIComponent((await unameMap([me])).get(me) ?? '')}` })
  return { support: mod.support }
}
export async function threads(me: string) {
  const rows = await db.execute<{ other: string; last: string; at: string; unread: number }>(sql`
    select other, (array_agg(body order by created_at desc))[1] as last, max(created_at)::text as at,
      count(*) filter (where recipient_id = ${me} and read_at is null)::int as unread
    from (select case when sender_id = ${me} then recipient_id else sender_id end as other, body, created_at, recipient_id, read_at
          from direct_messages where sender_id = ${me} or recipient_id = ${me}) x group by other order by max(created_at) desc limit 50`)
  const names = await unameMap(rows.map((r) => String(r.other)))
  const { blocked } = await hiddenIds(me)
  return rows.filter((r) => !blocked.has(String(r.other))).map((r) => ({ username: names.get(String(r.other)) ?? '?', last: String(r.last ?? ''), at: String(r.at), unread: Number(r.unread) }))
}
export async function thread(me: string, username: string) {
  const [u] = await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users).where(eq(sql`lower(${schema.users.username})`, username.toLowerCase())).limit(1)
  if (!u) return null
  const rel = await relationOf(me, u.id)
  if (rel === 'blocked') return null
  const msgs = await db.select().from(schema.directMessages).where(or(and(eq(schema.directMessages.senderId, me), eq(schema.directMessages.recipientId, u.id)), and(eq(schema.directMessages.senderId, u.id), eq(schema.directMessages.recipientId, me))))
    .orderBy(desc(schema.directMessages.createdAt)).limit(100)
  await db.update(schema.directMessages).set({ readAt: new Date() }).where(and(eq(schema.directMessages.senderId, u.id), eq(schema.directMessages.recipientId, me), isNull(schema.directMessages.readAt)))
  const { postDetail } = await import('./social-data')
  const shared = new Map<string, { id: string; author: string; kind: string; body: string } | null>()
  for (const m of msgs) if (m.postId && !shared.has(m.postId)) { const d = await postDetail(me, m.postId); shared.set(m.postId, d ? { id: d.post.id, author: d.post.author.username, kind: d.post.kind, body: d.post.body.slice(0, 120) } : null) }
  return {
    username: u.username, id: u.id, canSend: rel === 'friend',
    messages: msgs.reverse().map((m) => ({ id: m.id, mine: m.senderId === me, body: m.body, flagged: m.flagged, post: m.postId ? shared.get(m.postId) ?? null : null, createdAt: m.createdAt.toISOString() })),
  }
}
export async function unreadDMs(me: string) {
  const { blocked } = await hiddenIds(me)
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.directMessages).where(and(eq(schema.directMessages.recipientId, me), isNull(schema.directMessages.readAt), blocked.size ? notInArray(schema.directMessages.senderId, [...blocked]) : undefined))
  return Number(r?.n ?? 0)
}

// ───────── Dürtme ─────────

export async function nudge(me: string, otherId: string, kind: NudgeKind) {
  await mustBeFriend(me, otherId)
  const today = dayString()
  const sent = await db.select({ to: schema.nudges.recipientId, kind: schema.nudges.kind }).from(schema.nudges).where(and(eq(schema.nudges.senderId, me), eq(schema.nudges.day, today)))
  const err = nudgeAllowed(sent, otherId, kind)
  if (err) throw new Error(err)
  await db.insert(schema.nudges).values({ senderId: me, recipientId: otherId, kind, day: today })
  await notify(otherId, 'nudge', me, null, { extra: NUDGE[kind], url: kind === 'water' ? '/su' : '/fitness' })
}

// ───────── Antrenman partneri ─────────

export async function setPartner(me: string, otherId: string, on: boolean) {
  await mustBeFriend(me, otherId)
  await db.update(schema.friendLinks).set({ partner: on }).where(and(eq(schema.friendLinks.userId, me), eq(schema.friendLinks.friendId, otherId)))
}
export async function partnerStatus(me: string, otherId: string): Promise<{ mine: boolean; theirs: boolean; mutual: boolean }> {
  const rows = await db.select({ u: schema.friendLinks.userId, p: schema.friendLinks.partner }).from(schema.friendLinks).where(and(eq(schema.friendLinks.status, 'accepted'), or(and(eq(schema.friendLinks.userId, me), eq(schema.friendLinks.friendId, otherId)), and(eq(schema.friendLinks.userId, otherId), eq(schema.friendLinks.friendId, me)))))
  const mine = rows.some((r) => r.u === me && r.p), theirs = rows.some((r) => r.u === otherId && r.p)
  return { mine, theirs, mutual: mine && theirs }
}
/** workout.finished olayı: karşılıklı partnerlere bildirim. */
export async function notifyPartners(userId: string, minutes: number) {
  const mine = await db.select({ id: schema.friendLinks.friendId }).from(schema.friendLinks).where(and(eq(schema.friendLinks.userId, userId), eq(schema.friendLinks.partner, true), eq(schema.friendLinks.status, 'accepted')))
  for (const f of mine) {
    const st = await partnerStatus(userId, f.id)
    if (st.mutual) await notify(f.id, 'partner_workout', userId, null, { extra: `${minutes} dk`, url: '/sosyal' })
  }
}
/** Ortak program: karşılıklı partnerin aktif programını kopyalar (aktif yapılmaz). */
export async function copyPartnerProgram(me: string, otherId: string): Promise<string> {
  if (!(await partnerStatus(me, otherId)).mutual) throw new Error('Yalnızca karşılıklı antrenman partnerinin programı kopyalanabilir')
  const active = (await listPrograms(otherId)).find((p) => p.active)
  if (!active) throw new Error('Partnerinin aktif programı yok')
  const p = await getProgram(otherId, active.id)
  if (!p) throw new Error('Program bulunamadı')
  const ids = [...new Set(p.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))]
  const keys = new Map((ids.length ? await db.select({ id: schema.exercises.id, key: schema.exercises.key, userId: schema.exercises.userId }).from(schema.exercises).where(inArray(schema.exercises.id, ids)) : []).filter((x) => !x.userId).map((x) => [x.id, x.key]))
  const days: ProgramDay[] = p.days.map((d) => ({ name: d.name, focus: d.focus ?? '', exercises: d.exercises.filter((e) => keys.has(e.exerciseId)).map((e) => ({ key: keys.get(e.exerciseId)!, role: e.role as 'ana', sets: e.sets, repMin: e.repMin, repMax: e.repMax, rir: e.rir, rest: e.rest, seconds: e.seconds ?? undefined })) }))
  const owner = (await unameMap([otherId])).get(otherId) ?? 'partner'
  return insertProgram(me, `${p.name} (${owner})`.slice(0, 60), 'shared', days, [`Antrenman partnerin @${owner} programından kopyalandı.`], false)
}

// ───────── 24 saatlik kartlar ─────────

export async function createStory(me: string, body: string, mediaId: string | null) {
  const today = dayString()
  const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.stories).where(and(eq(schema.stories.userId, me), gte(schema.stories.createdAt, new Date(Date.now() - 86400000))))
  if (Number(n?.n ?? 0) >= 3) throw new Error('Günde en fazla 3 kart')
  if (mediaId) { const [m] = await mediaMeta([mediaId]); if (!m || m.userId !== me || m.kind !== 'social') throw new Error('Geçersiz fotoğraf') }
  const [w] = await db.select({ name: schema.workouts.name, sec: schema.workouts.durationSec, vol: schema.workouts.volumeKg }).from(schema.workouts).where(and(eq(schema.workouts.userId, me), eq(schema.workouts.day, today), isNull(schema.workouts.deletedAt))).orderBy(desc(schema.workouts.startedAt)).limit(1)
  const text = body.trim().slice(0, 200)
  if (!w && !mediaId && !text) throw new Error('Bugün antrenman kaydın yok; bir fotoğraf ya da not ekle')
  if (moderateText(text).verdict !== 'ok') throw new Error('Kart metni topluluk kurallarına uymuyor')
  await db.insert(schema.stories).values({ userId: me, body: text, mediaId, data: w ? { workout: w.name, minutes: Math.round(w.sec / 60), volumeKg: Math.round(w.vol) } : {} })
}
/** Arkadaşların ve kendi kartların (son 24 saat), engel/sessiz hariç. */
export async function storyStrip(me: string) {
  const fr = await friendIds(me)
  const { blocked, muted } = await hiddenIds(me)
  const authors = [me, ...fr].filter((a) => !blocked.has(a) && !muted.has(a))
  const rows = await db.select().from(schema.stories).where(and(inArray(schema.stories.userId, authors), isNull(schema.stories.deletedAt), gte(schema.stories.createdAt, new Date(Date.now() - STORY_HOURS * 3600_000)))).orderBy(asc(schema.stories.createdAt))
  const names = await unameMap([...new Set(rows.map((r) => r.userId))])
  return rows.map((r) => ({ id: r.id, username: names.get(r.userId) ?? '?', mine: r.userId === me, body: r.body, data: r.data as { workout?: string; minutes?: number; volumeKg?: number }, media: r.mediaId ? `/api/social/story/${r.id}` : null, createdAt: r.createdAt.toISOString() }))
}
export async function storyMedia(me: string, id: string) {
  const [s] = await db.select().from(schema.stories).where(and(eq(schema.stories.id, id), isNull(schema.stories.deletedAt), gte(schema.stories.createdAt, new Date(Date.now() - STORY_HOURS * 3600_000)))).limit(1)
  if (!s?.mediaId) return null
  const rel = await relationOf(me, s.userId)
  if (rel !== 'self' && rel !== 'friend') return null
  const { readMedia } = await import('./media')
  return readMedia(s.userId, s.mediaId)
}
export async function deleteStory(me: string, id: string) {
  await db.update(schema.stories).set({ deletedAt: new Date() }).where(and(eq(schema.stories.id, id), eq(schema.stories.userId, me)))
}

// ───────── PR doğrulama ─────────

/** Kullanıcının doğrulama bekleyen şüpheli rekorları (izleyici kendisiyse kanıt, arkadaşıysa tanıklık düğmesi). */
export async function pendingPRs(ownerId: string) {
  const rows = await db.select({ pr: schema.personalRecords, name: schema.exercises.nameTr }).from(schema.personalRecords).innerJoin(schema.exercises, eq(schema.exercises.id, schema.personalRecords.exerciseId))
    .where(and(eq(schema.personalRecords.userId, ownerId), sql`${schema.personalRecords.suspect} is not null`, eq(schema.personalRecords.verified, false), inArray(schema.personalRecords.type, ['kg', 'e1rm']))).orderBy(desc(schema.personalRecords.createdAt)).limit(10)
  return rows.map((r) => ({ id: r.pr.id, name: r.name, type: r.pr.type, value: r.pr.value, reason: r.pr.suspect!, witnesses: r.pr.witnesses.length, needed: WITNESSES_NEEDED, hasProof: !!r.pr.proofMediaId }))
}
export async function witnessPR(me: string, prId: number) {
  const [r] = await db.select().from(schema.personalRecords).where(eq(schema.personalRecords.id, prId)).limit(1)
  if (!r || !r.suspect || r.verified) throw new Error('Doğrulama bekleyen rekor yok')
  if (r.userId === me) throw new Error('Kendi rekoruna tanıklık edemezsin')
  await mustBeFriend(me, r.userId)
  if (r.witnesses.includes(me)) return { verified: r.verified, witnesses: r.witnesses.length }
  const w = [...new Set([...r.witnesses, me])]
  // aynı antrenmanın aynı hareketteki tüm şüpheli rekorları birlikte doğrulanır
  const verified = w.length >= WITNESSES_NEEDED
  await db.update(schema.personalRecords).set({ witnesses: w, verified }).where(and(eq(schema.personalRecords.userId, r.userId), eq(schema.personalRecords.exerciseId, r.exerciseId), r.workoutId ? eq(schema.personalRecords.workoutId, r.workoutId) : eq(schema.personalRecords.id, r.id)))
  await notify(r.userId, 'pr_witness', me)
  return { verified, witnesses: w.length }
}
export async function attachProof(me: string, prId: number, mediaId: string) {
  const [m] = await mediaMeta([mediaId])
  if (!m || m.userId !== me || m.kind !== 'social') throw new Error('Geçersiz fotoğraf')
  const r = await db.update(schema.personalRecords).set({ proofMediaId: mediaId }).where(and(eq(schema.personalRecords.id, prId), eq(schema.personalRecords.userId, me), sql`${schema.personalRecords.suspect} is not null`)).returning()
  if (!r.length) throw new Error('Rekor bulunamadı')
}
export async function proofQueue() {
  const rows = await db.select({ pr: schema.personalRecords, name: schema.exercises.nameTr, username: schema.users.username }).from(schema.personalRecords).innerJoin(schema.exercises, eq(schema.exercises.id, schema.personalRecords.exerciseId)).innerJoin(schema.users, eq(schema.users.id, schema.personalRecords.userId))
    .where(and(sql`${schema.personalRecords.proofMediaId} is not null`, eq(schema.personalRecords.verified, false))).orderBy(desc(schema.personalRecords.createdAt)).limit(30)
  return rows.map((r) => ({ id: r.pr.id, username: r.username, name: r.name, type: r.pr.type, value: r.pr.value, reason: r.pr.suspect, proof: `/api/social/proof/${r.pr.id}` }))
}
export async function resolveProof(prId: number, approve: boolean) {
  const [r] = await db.select().from(schema.personalRecords).where(eq(schema.personalRecords.id, prId)).limit(1)
  if (!r) return
  if (approve) await db.update(schema.personalRecords).set({ verified: true }).where(and(eq(schema.personalRecords.userId, r.userId), eq(schema.personalRecords.exerciseId, r.exerciseId), r.workoutId ? eq(schema.personalRecords.workoutId, r.workoutId) : eq(schema.personalRecords.id, r.id)))
  else await db.update(schema.personalRecords).set({ proofMediaId: null }).where(eq(schema.personalRecords.id, prId))
}
export async function proofMedia(prId: number) {
  const [r] = await db.select().from(schema.personalRecords).where(eq(schema.personalRecords.id, prId)).limit(1)
  if (!r?.proofMediaId) return null
  const { readMedia } = await import('./media')
  return readMedia(r.userId, r.proofMediaId)
}
export { socialProfile }

/** Faz 7-3: bugün antrenman yapan karşılıklı partnerler (Bugün kartı: "sıra sende"). */
export async function partnersTrainedToday(me: string, day: string): Promise<string[]> {
  const mine = await db.select({ id: schema.friendLinks.friendId }).from(schema.friendLinks).where(and(eq(schema.friendLinks.userId, me), eq(schema.friendLinks.partner, true), eq(schema.friendLinks.status, 'accepted')))
  if (!mine.length) return []
  const theirs = await db.select({ id: schema.friendLinks.userId }).from(schema.friendLinks).where(and(inArray(schema.friendLinks.userId, mine.map((m) => m.id)), eq(schema.friendLinks.friendId, me), eq(schema.friendLinks.partner, true), eq(schema.friendLinks.status, 'accepted')))
  if (!theirs.length) return []
  const rows = await db.selectDistinct({ name: schema.users.username }).from(schema.workouts).innerJoin(schema.users, eq(schema.users.id, schema.workouts.userId))
    .where(and(inArray(schema.workouts.userId, theirs.map((t) => t.id)), eq(schema.workouts.day, day), isNull(schema.workouts.deletedAt)))
  return rows.map((r) => r.name)
}
