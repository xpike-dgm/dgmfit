import 'server-only'
// Özelleştirme Ö3b: şablon kütüphanesi veri katmanı. Şablon verisi her zaman `shareable()` ile kişisel kısmı ayıklanmış
// tasarımdır. Ad/açıklama/etiketler kural moderasyonundan geçer (şüpheli → onay bekler, engelli → gizli).
import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import { db, schema } from '../db'
import { publish } from '../events'
import { moderateText } from '../moderation'
import { dayString } from '../time'
import { notify, createPost } from '../social-data'
import type { Design } from './layout'
import { applyTemplate, shareable, type ApplyMode } from './share'
import { normalizeMeta, popularity, searchTerm, weekKey, type Sort } from './templates'
import { transformDesign } from './design-data'
import { createDesignFromData, ownDesignData } from './designs-data'

const T = schema.designTemplates, RX = schema.templateReactions
export const TEMPLATES_PER_USER = 30
export const REPORTS_TO_REVIEW = 3

export type TemplateRow = {
  id: string; name: string; description: string; category: string; tags: string[]; data: Design; status: string
  likes: number; saves: number; uses: number; featured: boolean; createdAt: Date; ownerId: string; owner: string
  remixOf: { id: string; name: string; owner: string } | null; liked: boolean; saved: boolean; used: boolean
}

const base = () => db.select({
  id: T.id, name: T.name, description: T.description, category: T.category, tags: T.tags, data: T.data, status: T.status,
  likes: T.likes, saves: T.saves, uses: T.uses, featuredWeek: T.featuredWeek, createdAt: T.createdAt, ownerId: T.ownerId, owner: schema.users.username, remixOf: T.remixOf,
}).from(T).innerJoin(schema.users, eq(schema.users.id, T.ownerId))

async function decorate(viewerId: string, rows: Awaited<ReturnType<ReturnType<typeof base>['where']>>): Promise<TemplateRow[]> {
  const ids = rows.map((r) => r.id)
  const rx = ids.length ? await db.select({ t: RX.templateId, k: RX.kind }).from(RX).where(and(eq(RX.userId, viewerId), inArray(RX.templateId, ids))) : []
  const remixIds = [...new Set(rows.map((r) => r.remixOf).filter(Boolean) as string[])]
  const remix = remixIds.length ? await db.select({ id: T.id, name: T.name, owner: schema.users.username }).from(T).innerJoin(schema.users, eq(schema.users.id, T.ownerId)).where(inArray(T.id, remixIds)) : []
  const wk = weekKey(dayString())
  return rows.map((r) => ({
    id: r.id, name: r.name, description: r.description, category: r.category, tags: r.tags, data: r.data as unknown as Design, status: r.status,
    likes: r.likes, saves: r.saves, uses: r.uses, featured: r.featuredWeek === wk, createdAt: r.createdAt, ownerId: r.ownerId, owner: r.owner,
    remixOf: r.remixOf ? remix.find((x) => x.id === r.remixOf) ?? null : null,
    liked: rx.some((x) => x.t === r.id && x.k === 'like'), saved: rx.some((x) => x.t === r.id && x.k === 'save'), used: rx.some((x) => x.t === r.id && x.k === 'use'),
  }))
}

export async function listTemplates(viewerId: string, o: { sort: Sort; category?: string | null; q?: string | null; admin?: boolean; pending?: boolean; limit?: number }) {
  const conds: SQL[] = [isNull(T.deletedAt)]
  if (o.sort === 'mine') conds.push(eq(T.ownerId, viewerId))
  else if (o.pending && o.admin) conds.push(eq(T.status, 'pending'))
  else conds.push(eq(T.status, 'public'))
  if (o.category) conds.push(eq(T.category, o.category))
  const term = searchTerm(o.q)
  if (term) conds.push(or(ilike(T.name, term), ilike(T.description, term), sql`${T.tags}::text ilike ${term}`)!)
  if (o.sort === 'saved') conds.push(sql`exists (select 1 from template_reactions r where r.template_id = ${T.id} and r.user_id = ${viewerId} and r.kind = 'save')`)
  const rows = await base().where(and(...conds)).orderBy(desc(T.createdAt)).limit(o.sort === 'popular' || o.sort === 'featured' ? 200 : (o.limit ?? 60))
  let out = await decorate(viewerId, rows)
  const now = new Date()
  if (o.sort === 'popular' || o.sort === 'featured') out = out.sort((a, b) => Number(b.featured) - Number(a.featured) || popularity(b, now) - popularity(a, now)).slice(0, o.limit ?? 60)
  return out
}

/** Tek şablon: herkese açıksa herkes; onay bekleyen/gizli yalnız sahibi ve yönetici. */
export async function getTemplate(viewerId: string, id: string, admin = false): Promise<TemplateRow | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  const rows = await base().where(and(eq(T.id, id), isNull(T.deletedAt))).limit(1)
  const r = rows[0]
  if (!r || (r.status !== 'public' && r.ownerId !== viewerId && !admin)) return null
  return (await decorate(viewerId, rows))[0]
}

/** Tasarımımı şablon olarak yayınlar (kişisel kısım çıkarılır). İsteğe bağlı olarak sosyal akışta da paylaşır. */
export async function publishTemplate(userId: string, designId: string, meta: { name: string; description?: string; category?: string; tags?: string[] }, toFeed: boolean) {
  const d = await ownDesignData(userId, designId)
  if (!d) return { ok: false as const, error: 'Tasarım bulunamadı' }
  const m = normalizeMeta(meta)
  if (m.name.length < 2) return { ok: false as const, error: 'Şablona bir ad ver' }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(T).where(and(eq(T.ownerId, userId), isNull(T.deletedAt)))
  if (Number(n) >= TEMPLATES_PER_USER) return { ok: false as const, error: `En çok ${TEMPLATES_PER_USER} şablon paylaşılabilir` }
  const mod = moderateText([m.name, m.description, m.tags.join(' ')].join(' '))
  const status = mod.verdict === 'ok' ? 'public' : mod.verdict === 'block' ? 'hidden' : 'pending'
  let remixOf: string | null = null
  if (d.origin?.templateId) { const [src] = await db.select({ id: T.id }).from(T).where(eq(T.id, d.origin.templateId)).limit(1); remixOf = src?.id ?? null }
  const data = shareable(d)
  const [row] = await db.insert(T).values({ ownerId: userId, name: m.name, description: m.description, category: m.category, tags: m.tags, data: data as unknown as Record<string, unknown>, remixOf, status, moderationReason: mod.reasons.join(', ') || null }).returning({ id: T.id })
  if (toFeed && status === 'public') await createPost(userId, { kind: 'design', body: m.description, mediaIds: [], audience: 'friends', audienceIds: [], ref: row.id }).catch(() => null)
  if (status === 'public') { const { notifyDesignerFollowers } = await import('./community-data'); await notifyDesignerFollowers(userId, row.id) }
  await publish(userId, 'template.published', { status, category: m.category, remix: !!remixOf })
  return { ok: true as const, id: row.id, status }
}

async function recount(id: string) {
  await db.execute(sql`update design_templates set
    likes = (select count(*) from template_reactions where template_id = ${id} and kind = 'like'),
    saves = (select count(*) from template_reactions where template_id = ${id} and kind = 'save'),
    uses = (select count(*) from template_reactions where template_id = ${id} and kind = 'use') where id = ${id}`)
}

/** Beğen / kaydet (aç-kapa). Beğeni sahibine bildirilir. */
export async function reactTemplate(userId: string, id: string, kind: 'like' | 'save', on: boolean) {
  const t = await getTemplate(userId, id)
  if (!t || t.status !== 'public') return false
  if (on) {
    const ins = await db.insert(RX).values({ userId, templateId: id, kind }).onConflictDoNothing().returning({ k: RX.kind })
    if (ins.length && kind === 'like') await notify(t.ownerId, 'template_like', userId, null, { url: `/profil/ozellestirme/sablonlar/${id}` }).catch(() => null)
  } else await db.delete(RX).where(and(eq(RX.userId, userId), eq(RX.templateId, id), eq(RX.kind, kind)))
  await recount(id)
  return true
}

/** Şablonu etkin tasarıma uygular (tümü / yalnız renkler / yalnız düzen); kullanım bir kez sayılır ve sahibine bildirilir. */
export async function useTemplate(userId: string, id: string, mode: ApplyMode) {
  const t = await getTemplate(userId, id)
  if (!t || (t.status !== 'public' && t.ownerId !== userId)) return false
  await transformDesign(userId, (cur) => ({ ...applyTemplate(cur, t.data, mode), origin: { templateId: t.id, name: t.name } }), `Şablon: ${t.name}`)
  const ins = await db.insert(RX).values({ userId, templateId: id, kind: 'use' }).onConflictDoNothing().returning({ k: RX.kind })
  if (ins.length) { await recount(id); await notify(t.ownerId, 'template_use', userId, null, { url: `/profil/ozellestirme/sablonlar/${id}` }).catch(() => null) }
  await publish(userId, 'template.used', { mode })
  return true
}

/** Remix: şablonu tasarımlarıma kopya olarak ekler (etkin olmaz; düzenleyip kendi şablonum olarak paylaşabilirim). */
export async function remixTemplate(userId: string, id: string) {
  const t = await getTemplate(userId, id)
  if (!t) return { ok: false as const, error: 'Şablon bulunamadı' }
  return createDesignFromData(userId, `${t.name} (remix)`.slice(0, 40), { ...t.data, origin: { templateId: t.id, name: t.name } })
}

export async function deleteTemplate(userId: string, id: string, admin = false) {
  const r = await db.update(T).set({ deletedAt: new Date() }).where(and(eq(T.id, id), admin ? sql`true` : eq(T.ownerId, userId))).returning({ id: T.id })
  return r.length > 0
}

/** Yönetici: haftanın şablonu (o haftanın tek öne çıkanı), onayla / gizle. */
export async function adminTemplate(id: string, op: 'feature' | 'approve' | 'hide') {
  if (op === 'feature') {
    const wk = weekKey(dayString())
    await db.update(T).set({ featuredWeek: null }).where(eq(T.featuredWeek, wk))
    await db.update(T).set({ featuredWeek: wk, status: 'public' }).where(eq(T.id, id))
  } else await db.update(T).set({ status: op === 'approve' ? 'public' : 'hidden' }).where(eq(T.id, id))
  return true
}

/** Şikayet: 3 açık şikayette şablon onaya düşer. */
export async function reportTemplate(userId: string, id: string, reason: string) {
  const t = await getTemplate(userId, id)
  if (!t || t.ownerId === userId) return false
  const [dup] = await db.select({ id: schema.reports.id }).from(schema.reports).where(and(eq(schema.reports.reporterId, userId), eq(schema.reports.targetType, 'template'), eq(schema.reports.targetId, id))).limit(1)
  if (!dup) await db.insert(schema.reports).values({ reporterId: userId, targetType: 'template', targetId: id, reason: reason.slice(0, 60) })
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.reports).where(and(eq(schema.reports.targetType, 'template'), eq(schema.reports.targetId, id), eq(schema.reports.status, 'open')))
  if (Number(n) >= REPORTS_TO_REVIEW) await db.update(T).set({ status: 'pending', moderationReason: 'şikayet' }).where(and(eq(T.id, id), eq(T.status, 'public')))
  return true
}
