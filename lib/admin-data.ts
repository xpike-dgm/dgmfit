import 'server-only'
import crypto from 'node:crypto'
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import { db, schema } from './db'
import { adminList, isAdmin } from './admin-list'
import { INVITE_ALPHABET, isStatus, type FeedbackKind, type FeedbackStatus, type UserStatus } from './access'
import { sendToUser, type PushPayload } from './push'
import { dayBounds } from './water-data'
import { addDays, dayString } from './time'

// ——— Bildirim ———

/** Yöneticilerin (DGFIT_ADMINS, tam ad) push aboneliklerine gönderir; hata yutulur. */
export async function notifyAdmins(p: PushPayload) {
  const names = adminList().filter((a) => !a.endsWith('*'))
  if (!names.length) return
  try {
    const rows = await db.select({ id: schema.users.id }).from(schema.users).where(inArray(sql`lower(${schema.users.username})`, names.map((n) => n.toLowerCase())))
    await Promise.all(rows.map((r) => sendToUser(r.id, p).catch(() => 0)))
  } catch { /* bildirim olmasa da kayıt sürer */ }
}

// ——— Pano ———

export async function dashboard() {
  const today = dayString()
  const [start] = dayBounds(today)
  const since14 = dayBounds(addDays(today, -13))[0]
  const week = dayBounds(addDays(today, -6))[0]
  const [u] = await db.execute<{ total: number; approved: number; pending: number; blocked: number; active_today: number; active_week: number; new_week: number }>(sql`
    select count(*)::int as total,
      count(*) filter (where status = 'approved')::int as approved,
      count(*) filter (where status = 'pending')::int as pending,
      count(*) filter (where status in ('suspended','rejected'))::int as blocked,
      count(*) filter (where last_seen_at >= ${start.toISOString()})::int as active_today,
      count(*) filter (where last_seen_at >= ${week.toISOString()})::int as active_week,
      count(*) filter (where created_at >= ${week.toISOString()})::int as new_week
    from users`)
  const signups = await db.execute<{ d: string; n: number }>(sql`
    select to_char(created_at at time zone 'Europe/Istanbul', 'YYYY-MM-DD') as d, count(*)::int as n
    from users where created_at >= ${since14.toISOString()} group by 1`)
  const active = await db.execute<{ d: string; n: number }>(sql`
    select to_char(created_at at time zone 'Europe/Istanbul', 'YYYY-MM-DD') as d, count(distinct user_id)::int as n from (
      select user_id, created_at from water_logs where created_at >= ${since14.toISOString()}
      union all select user_id, created_at from meal_items where created_at >= ${since14.toISOString()}
      union all select user_id, started_at as created_at from workouts where started_at >= ${since14.toISOString()}
    ) x group by 1`)
  const sMap = new Map(signups.map((r) => [r.d, Number(r.n)]))
  const aMap = new Map(active.map((r) => [r.d, Number(r.n)]))
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((d) => ({ day: d, signups: sMap.get(d) ?? 0, active: aMap.get(d) ?? 0 }))
  const [fb] = await db.execute<{ fresh: number; open: number; total: number }>(sql`
    select count(*) filter (where status = 'new')::int as fresh, count(*) filter (where status <> 'done')::int as open, count(*)::int as total from feedback`)
  const [ai] = await db.execute<{ ok: number; err: number; cached: number }>(sql`
    select count(*) filter (where ok and not cached)::int as ok, count(*) filter (where not ok)::int as err, count(*) filter (where cached)::int as cached
    from ai_calls where created_at >= ${start.toISOString()}`)
  const [mod] = await db.execute<{ posts: number; comments: number; reports: number; proofs: number }>(sql`
    select (select count(*) from posts where moderation in ('pending','hidden') and deleted_at is null and moderation = 'pending')::int as posts,
      (select count(*) from post_comments where moderation = 'pending' and deleted_at is null)::int as comments,
      (select count(*) from reports where status = 'open')::int as reports,
      (select count(*) from personal_records where proof_media_id is not null and not verified)::int as proofs`)
  const [inv] = await db.execute<{ active: number }>(sql`
    select count(*)::int as active from invites where not disabled and (expires_at is null or expires_at > now()) and (max_uses is null or uses < max_uses)`)
  const pending = await db.select({ id: schema.users.id, username: schema.users.username, createdAt: schema.users.createdAt }).from(schema.users)
    .where(eq(schema.users.status, 'pending')).orderBy(desc(schema.users.createdAt)).limit(3)
  const lastFb = await db.select({ id: schema.feedback.id, kind: schema.feedback.kind, body: schema.feedback.body, username: schema.users.username, createdAt: schema.feedback.createdAt })
    .from(schema.feedback).innerJoin(schema.users, eq(schema.users.id, schema.feedback.userId)).where(sql`${schema.feedback.status} <> 'done'`).orderBy(desc(schema.feedback.createdAt)).limit(2)
  const recent = await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users)
    .where(eq(schema.users.status, 'approved')).orderBy(sql`${schema.users.lastSeenAt} desc nulls last`).limit(6)
  const n = (x: unknown) => Number(x ?? 0)
  return {
    users: { total: n(u?.total), approved: n(u?.approved), pending: n(u?.pending), blocked: n(u?.blocked), activeToday: n(u?.active_today), activeWeek: n(u?.active_week), newWeek: n(u?.new_week) },
    days,
    feedback: { fresh: n(fb?.fresh), open: n(fb?.open), total: n(fb?.total), last: lastFb },
    ai: { ok: n(ai?.ok), err: n(ai?.err), cached: n(ai?.cached) },
    moderation: { posts: n(mod?.posts), comments: n(mod?.comments), reports: n(mod?.reports), proofs: n(mod?.proofs) },
    invites: { active: n(inv?.active) },
    pending, recent,
  }
}

// ——— Kullanıcılar ———

export type UserSort = 'new' | 'seen' | 'name'
export async function listUsers(o: { status?: string; q?: string; sort?: UserSort; limit?: number }) {
  const where: SQL[] = []
  if (o.status === 'blocked') where.push(inArray(schema.users.status, ['suspended', 'rejected']))
  else if (o.status && isStatus(o.status)) where.push(eq(schema.users.status, o.status))
  const q = o.q?.trim().slice(0, 60)
  if (q) where.push(or(ilike(schema.users.username, `%${q}%`), ilike(schema.users.email, `%${q}%`))!)
  const order = o.sort === 'seen' ? sql`${schema.users.lastSeenAt} desc nulls last` : o.sort === 'name' ? sql`lower(${schema.users.username})` : desc(schema.users.createdAt)
  const rows = await db.select({
    id: schema.users.id, username: schema.users.username, email: schema.users.email, status: schema.users.status, createdAt: schema.users.createdAt,
    lastSeenAt: schema.users.lastSeenAt, aiDaily: schema.users.aiDaily, onboardedAt: schema.profiles.onboardedAt,
  }).from(schema.users).leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(where.length ? and(...where) : undefined).orderBy(order).limit(o.limit ?? 200)
  const counts = await db.execute<{ status: string; n: number }>(sql`select status, count(*)::int as n from users group by status`)
  const c = Object.fromEntries(counts.map((r) => [r.status, Number(r.n)])) as Record<string, number>
  return {
    rows: rows.map((r) => ({ ...r, admin: isAdmin(r.username), onboarded: !!r.onboardedAt })),
    counts: { all: Object.values(c).reduce((a, b) => a + b, 0), pending: c.pending ?? 0, approved: c.approved ?? 0, blocked: (c.suspended ?? 0) + (c.rejected ?? 0) },
  }
}

export async function userDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1)
  if (!u) return null
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, id)).limit(1)
  const [goal] = await db.select().from(schema.goals).where(and(eq(schema.goals.userId, id), eq(schema.goals.active, true))).orderBy(desc(schema.goals.createdAt)).limit(1)
  const since30 = dayBounds(addDays(dayString(), -29))[0].toISOString()
  const [start] = dayBounds(dayString())
  const [s] = await db.execute<Record<string, number>>(sql`select
    (select count(*) from workouts where user_id = ${id})::int as workouts,
    (select count(*) from workouts where user_id = ${id} and started_at >= ${since30})::int as workouts30,
    (select count(*) from meal_items where user_id = ${id})::int as meals,
    (select count(*) from meal_items where user_id = ${id} and created_at >= ${since30})::int as meals30,
    (select count(*) from water_logs where user_id = ${id})::int as water,
    (select count(*) from water_logs where user_id = ${id} and created_at >= ${since30})::int as water30,
    (select count(*) from weight_logs where user_id = ${id})::int as weights,
    (select count(*) from posts where user_id = ${id} and deleted_at is null)::int as posts,
    (select count(*) from friend_links where user_id = ${id} and status = 'accepted')::int as friends,
    (select count(*) from ai_calls where user_id = ${id} and ok and not cached and created_at >= ${start.toISOString()})::int as ai_today,
    (select count(*) from ai_calls where user_id = ${id} and ok and not cached and created_at >= ${since30})::int as ai30,
    (select count(*) from sessions where user_id = ${id} and expires_at > now())::int as sessions,
    (select count(*) from feedback where user_id = ${id})::int as feedback,
    (select count(*) from push_subscriptions where user_id = ${id})::int as push,
    (select count(*) from media_blobs where user_id = ${id} and deleted_at is null)::int as media`)
  const fb = await db.select({ id: schema.feedback.id, kind: schema.feedback.kind, body: schema.feedback.body, status: schema.feedback.status, createdAt: schema.feedback.createdAt })
    .from(schema.feedback).where(eq(schema.feedback.userId, id)).orderBy(desc(schema.feedback.createdAt)).limit(5)
  const stats = Object.fromEntries(Object.entries(s ?? {}).map(([k, v]) => [k, Number(v)])) as Record<string, number>
  return { user: u, admin: isAdmin(u.username), profile: profile ?? null, goal: goal ?? null, stats, feedback: fb }
}

export async function setUserStatus(id: string, status: UserStatus, by: string) {
  await db.update(schema.users).set({ status, statusAt: new Date(), statusBy: by }).where(eq(schema.users.id, id))
  if (status === 'suspended' || status === 'rejected') await db.delete(schema.sessions).where(eq(schema.sessions.userId, id))
}

export async function approveAllPending(by: string): Promise<number> {
  const r = await db.update(schema.users).set({ status: 'approved', statusAt: new Date(), statusBy: by }).where(eq(schema.users.status, 'pending')).returning({ id: schema.users.id })
  return r.length
}

export async function setAiDaily(id: string, n: number | null) {
  await db.update(schema.users).set({ aiDaily: n }).where(eq(schema.users.id, id))
}
export async function setAdminNote(id: string, note: string) {
  await db.update(schema.users).set({ adminNote: note.trim().slice(0, 1000) || null }).where(eq(schema.users.id, id))
}
export async function endSessions(id: string): Promise<number> {
  return (await db.delete(schema.sessions).where(eq(schema.sessions.userId, id)).returning({ id: schema.sessions.id })).length
}

/**
 * Takip verilerini siler; hesap, oturum, geri bildirim ve AI kullanım kaydı kalır. Profil silindiği için kullanıcı kurulumdan yeniden başlar.
 * Sıra yabancı anahtarlara göre (önce çocuk tablolar). `social` ise gönderi, arkadaşlık, grup ve mesajlar da silinir.
 */
export async function resetUserData(id: string, o: { social: boolean }) {
  return db.transaction(async (tx) => {
    const del = (t: string, col = 'user_id', extra = '') => tx.execute(sql.raw(`delete from ${t} where ${col} = '${id}'${extra}`))
    // id UUID biçiminde doğrulandı (çağıran), yine de sql.raw yalnızca sabit tablo adları ve bu id ile kurulur
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('geçersiz id')
    for (const t of ['workout_sets', 'exercise_records', 'personal_records']) await del(t)
    await del('workouts'); await del('programs')
    // Özel hareketler: başka kullanıcıların kaydında geçmiyorsa silinir
    await tx.execute(sql`delete from exercises e where e.user_id = ${id}
      and not exists (select 1 from workout_sets s where s.exercise_id = e.id) and not exists (select 1 from exercise_records r where r.exercise_id = e.id)
      and not exists (select 1 from personal_records p where p.exercise_id = e.id) and not exists (select 1 from program_exercises x where x.exercise_id = e.id)`)
    for (const t of ['cardio_sessions', 'gym_settings', 'body_measurements', 'meal_plans', 'meal_items', 'saved_meals', 'kcal_adjustments', 'carb_cycle', 'daily_targets',
      'water_logs', 'water_containers', 'water_settings', 'water_goal_history', 'water_reminders', 'coach_prefs', 'ai_conversations', 'ai_insights',
      'weight_logs', 'goals', 'profile_history', 'events']) await del(t)
    await del('foods')
    await del('media_blobs', 'user_id', ` and kind in ('progress','exercise')`)
    if (o.social) {
      for (const t of ['post_reactions', 'post_comments', 'post_saves', 'stories', 'group_messages', 'group_members', 'challenge_members']) await del(t)
      await del('posts'); await del('challenges', 'creator_id'); await del('groups', 'owner_id')
      for (const [t, c] of [['friend_links', 'user_id'], ['friend_links', 'friend_id'], ['follows', 'follower_id'], ['follows', 'followee_id'], ['user_blocks', 'user_id'], ['user_blocks', 'target_id'],
        ['notifications', 'user_id'], ['notifications', 'actor_id'], ['direct_messages', 'sender_id'], ['direct_messages', 'recipient_id'], ['nudges', 'sender_id'], ['nudges', 'recipient_id'], ['reports', 'reporter_id']] as const) await del(t, c)
      await del('social_profiles'); await del('media_blobs')
    }
    await del('profiles')
  })
}

/** Hesabı tamamen siler (bağlı tüm veriler cascade). Başka kullanıcının kaydında geçen özel hareketler kütüphaneye değil, silinmeden önce sahipsiz bırakılmaz: işlem reddedilir. */
export async function deleteUser(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await resetUserData(id, { social: true })
    await db.delete(schema.users).where(eq(schema.users.id, id))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'Silinemedi: ' + (e as Error).message.slice(0, 160) }
  }
}

// ——— Geri bildirim ———

export async function createFeedback(userId: string, f: { kind: FeedbackKind; area: string | null; body: string; mediaId: string | null; device: { ua?: string; screen?: string; theme?: string } }) {
  const [r] = await db.insert(schema.feedback).values({ userId, ...f }).returning({ id: schema.feedback.id })
  return r.id
}
export async function feedbackToday(userId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.feedback).where(and(eq(schema.feedback.userId, userId), sql`${schema.feedback.createdAt} > now() - interval '1 day'`))
  return Number(r?.n ?? 0)
}
export async function myFeedback(userId: string) {
  return db.select().from(schema.feedback).where(eq(schema.feedback.userId, userId)).orderBy(desc(schema.feedback.createdAt)).limit(30)
}
export async function unreadReplies(userId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.feedback)
    .where(and(eq(schema.feedback.userId, userId), sql`${schema.feedback.repliedAt} is not null`, sql`(${schema.feedback.replySeenAt} is null or ${schema.feedback.replySeenAt} < ${schema.feedback.repliedAt})`))
  return Number(r?.n ?? 0)
}
export async function markRepliesSeen(userId: string) {
  await db.update(schema.feedback).set({ replySeenAt: new Date() }).where(and(eq(schema.feedback.userId, userId), sql`${schema.feedback.repliedAt} is not null`))
}

export async function listFeedback(o: { status?: string; kind?: string }) {
  const where: SQL[] = []
  if (o.status === 'open') where.push(sql`${schema.feedback.status} <> 'done'`)
  else if (o.status && ['new', 'seen', 'done'].includes(o.status)) where.push(eq(schema.feedback.status, o.status))
  if (o.kind && ['oneri', 'hata', 'sikayet', 'diger'].includes(o.kind)) where.push(eq(schema.feedback.kind, o.kind))
  const rows = await db.select({ f: schema.feedback, username: schema.users.username }).from(schema.feedback).innerJoin(schema.users, eq(schema.users.id, schema.feedback.userId))
    .where(where.length ? and(...where) : undefined).orderBy(desc(schema.feedback.createdAt)).limit(200)
  const counts = await db.execute<{ status: string; n: number }>(sql`select status, count(*)::int as n from feedback group by status`)
  const c = Object.fromEntries(counts.map((r) => [r.status, Number(r.n)])) as Record<string, number>
  return { rows, counts: { new: c.new ?? 0, seen: c.seen ?? 0, done: c.done ?? 0, open: (c.new ?? 0) + (c.seen ?? 0), all: (c.new ?? 0) + (c.seen ?? 0) + (c.done ?? 0) } }
}
export async function feedbackDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [r] = await db.select({ f: schema.feedback, username: schema.users.username, email: schema.users.email }).from(schema.feedback).innerJoin(schema.users, eq(schema.users.id, schema.feedback.userId)).where(eq(schema.feedback.id, id)).limit(1)
  if (r && r.f.status === 'new') { await db.update(schema.feedback).set({ status: 'seen', updatedAt: new Date() }).where(eq(schema.feedback.id, id)); r.f.status = 'seen' }
  return r ?? null
}
export async function setFeedbackStatus(id: string, status: FeedbackStatus) {
  await db.update(schema.feedback).set({ status, updatedAt: new Date() }).where(eq(schema.feedback.id, id))
}
export async function replyFeedback(id: string, reply: string, done: boolean) {
  const [r] = await db.update(schema.feedback).set({ reply, repliedAt: new Date(), updatedAt: new Date(), ...(done ? { status: 'done' } : {}) }).where(eq(schema.feedback.id, id)).returning({ userId: schema.feedback.userId })
  if (r) await sendToUser(r.userId, { title: 'Geri bildirimine yanıt geldi', body: reply.slice(0, 120), url: '/profil/geri-bildirim', tag: 'feedback-reply' }).catch(() => 0)
}

// ——— Davet kodları ———

export function newInviteCode(): string {
  const b = crypto.randomBytes(8)
  const c = Array.from(b, (x) => INVITE_ALPHABET[x % INVITE_ALPHABET.length]).join('')
  return c.slice(0, 4) + '-' + c.slice(4)
}
export async function listInvites() {
  return db.select().from(schema.invites).orderBy(desc(schema.invites.createdAt)).limit(100)
}
export async function createInvite(by: string, o: { label: string; maxUses: number | null; days: number | null }) {
  const code = newInviteCode()
  await db.insert(schema.invites).values({ code, label: o.label.trim().slice(0, 60), maxUses: o.maxUses, expiresAt: o.days ? new Date(Date.now() + o.days * 86400_000) : null, createdBy: by })
  return code
}
export async function setInviteDisabled(code: string, disabled: boolean) {
  await db.update(schema.invites).set({ disabled }).where(eq(schema.invites.code, code))
}
export async function deleteInvite(code: string) {
  await db.delete(schema.invites).where(eq(schema.invites.code, code))
}
export async function inviteUsers(code: string) {
  return db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users).where(eq(schema.users.inviteCode, code)).orderBy(desc(schema.users.createdAt)).limit(20)
}

export type ActivityKind = 'login' | 'meal' | 'water' | 'workout' | 'cardio' | 'weight' | 'measure' | 'program' | 'post' | 'comment' | 'message' | 'ai' | 'feedback' | 'profile'
export interface Activity { kind: ActivityKind; at: Date; text: string; detail: string | null }

/**
 * Kullanıcının son işlemleri (yönetici için): kayıtlı tablolardan derlenir, ayrı bir iz tablosu tutulmaz.
 * Mesaj ve gönderi içerikleri gösterilmez, yalnızca işlem yapıldığı bilgisi.
 */
export async function userActivity(id: string, limit = 80): Promise<Activity[]> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return []
  const rows = await db.execute<{ kind: ActivityKind; at: Date | string; text: string; detail: string | null }>(sql`
    select * from (
      (select 'login' as kind, created_at as at, 'Giriş yaptı' as text, left(coalesce(user_agent, ''), 120) as detail from sessions where user_id = ${id} order by created_at desc limit 20)
      union all (select 'meal', created_at, 'Öğün: ' || name, round(kcal)::text || ' kcal · ' || round(grams)::text || ' g' from meal_items where user_id = ${id} and deleted_at is null order by created_at desc limit 40)
      union all (select 'water', created_at, 'Su: ' || ml::text || ' ml', drink from water_logs where user_id = ${id} and deleted_at is null order by created_at desc limit 30)
      union all (select 'workout', coalesce(ended_at, created_at), 'Antrenman: ' || name, work_sets::text || ' set · ' || round(volume_kg)::text || ' kg · ' || round(duration_sec / 60.0)::text || ' dk' from workouts where user_id = ${id} and deleted_at is null order by created_at desc limit 20)
      union all (select 'cardio', created_at, 'Kardiyo: ' || type, round(minutes)::text || ' dk' from cardio_sessions where user_id = ${id} and deleted_at is null order by created_at desc limit 20)
      union all (select 'weight', logged_at, 'Tartı: ' || kg::text || ' kg', null from weight_logs where user_id = ${id} and deleted_at is null order by logged_at desc limit 20)
      union all (select 'measure', created_at, 'Vücut ölçüsü girdi', null from body_measurements where user_id = ${id} and deleted_at is null order by created_at desc limit 10)
      union all (select 'program', updated_at, 'Program: ' || name, case when active then 'aktif' else null end from programs where user_id = ${id} and deleted_at is null order by updated_at desc limit 10)
      union all (select 'post', created_at, 'Gönderi paylaştı', kind from posts where user_id = ${id} and deleted_at is null order by created_at desc limit 15)
      union all (select 'comment', created_at, 'Yorum yaptı', null from post_comments where user_id = ${id} and deleted_at is null order by created_at desc limit 15)
      union all (select 'message', created_at, 'Mesaj gönderdi', null from direct_messages where sender_id = ${id} order by created_at desc limit 15)
      union all (select 'ai', created_at, 'AI: ' || task, case when ok then provider else 'hata' end from ai_calls where user_id = ${id} order by created_at desc limit 20)
      union all (select 'feedback', created_at, 'Geri bildirim gönderdi', kind from feedback where user_id = ${id} order by created_at desc limit 10)
      union all (select 'profile', created_at, case type when 'profile.updated' then 'Profilini güncelledi' when 'profile.onboarded' then 'Kurulumu tamamladı' when 'day.closed' then 'Gün kapandı' else type end, null
        from events where user_id = ${id} and type in ('profile.updated', 'profile.onboarded') order by created_at desc limit 10)
    ) a order by at desc limit ${limit}`)
  return rows.map((r) => ({ kind: r.kind, at: new Date(r.at), text: r.text, detail: r.detail || null }))
}

/** Bulunamayan barkodlar (en çok aranan önce). Ürün eklendiğinde `resolved_at` dolar ve listeden düşer. */
export async function barcodeMissList(limit = 100) {
  return db.select().from(schema.barcodeMisses).where(sql`${schema.barcodeMisses.resolvedAt} is null`)
    .orderBy(desc(schema.barcodeMisses.count), desc(schema.barcodeMisses.lastAt)).limit(limit)
}
