import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db, schema } from './db'
import { LICENSED_DIR, hasLicensedFile, licensedText, licensedUrl } from './licensed'
import { smoothPath, type Gender, type Side } from './anatomy'

export interface AnatomyArea { key: string; d: string }
export interface AnatomyView { key: string; gender: Gender; side: Side; w: number; h: number; image: string; areas: AnatomyArea[] }

let viewsCache: Record<string, AnatomyView> | null | undefined
/** Lisanslı paketteki dört görünüm (erkek/kadın × ön/arka), yumuşatılmış bölge yollarıyla. Paket yoksa null. */
export function anatomyViews(): Record<string, AnatomyView> | null {
  if (viewsCache !== undefined) return viewsCache
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(LICENSED_DIR, 'anatomy', 'anatomi-koordinatlari.json'), 'utf8')) as { image: string; width: number; height: number; areas: { muscle_key: string; points: [number, number][] }[] }[]
    const out: Record<string, AnatomyView> = {}
    for (const v of raw) {
      const key = v.image.replace(/\.png$/, '')
      const [gender, side] = key.split('_') as [Gender, Side]
      out[key] = { key, gender, side, w: v.width, h: v.height, image: licensedUrl('anatomy', v.image)!, areas: v.areas.map((a) => ({ key: a.muscle_key, d: smoothPath(a.points) })).filter((a) => a.d) }
    }
    viewsCache = Object.keys(out).length ? out : null
  } catch { viewsCache = null }
  return viewsCache
}

type Texts = { features?: { exercise?: { pages?: { cns?: Record<string, string>; legend?: Record<string, string>; exercise?: Record<string, string> } } } }
/** Paketteki ekran metinleri: MSS başlığı/açıklamaları (1–4) ve etki kademesi etiketleri (1–6). */
export function anatomyTexts() {
  const p = licensedText<Texts>('tam-ekran-metinleri.tr')?.features?.exercise?.pages
  return {
    cnsTitle: p?.cns?.title ?? 'MSS yükü',
    cns: [1, 2, 3, 4].map((i) => p?.cns?.[`description_${i}`] ?? ''),
    legend: [1, 2, 3, 4, 5, 6].map((i) => p?.legend?.[`label_${i}`] ?? `Kademe ${i}`),
  }
}

export interface FeedItem { id: number; name: string; video: string | null; muscles: Record<string, number>; rating: { avg: number; count: number } | null; fav: boolean }

const L = schema.exercises.licensed
function toItem(r: { id: number; name: string; licensed: typeof schema.exercises.$inferSelect['licensed'] }, favs: Set<number>): FeedItem {
  const l = r.licensed!
  return { id: r.id, name: r.name, video: hasLicensedFile('videos', l.video.right) ? licensedUrl('videos', l.video.right) : null, muscles: l.muscles, rating: l.rating ?? null, fav: favs.has(r.id) }
}
async function favSet(userId: string, ids: number[]) {
  if (!ids.length) return new Set<number>()
  const rows = await db.select({ id: schema.exerciseFavorites.exerciseId }).from(schema.exerciseFavorites).where(and(eq(schema.exerciseFavorites.userId, userId), inArray(schema.exerciseFavorites.exerciseId, ids)))
  return new Set(rows.map((r) => r.id))
}

/** Bir kası çalıştıran hareketler: kas puanı ≥ 4, puana sonra kullanıcı oylarına göre. */
export async function muscleFeed(userId: string, muscle: string, limit = 80): Promise<FeedItem[]> {
  if (!/^[A-Za-z]{2,30}$/.test(muscle)) return []
  const score = sql`coalesce((${L}->'muscles'->>${muscle})::float, 0)`
  const rows = await db.select({ id: schema.exercises.id, name: schema.exercises.nameTr, licensed: L }).from(schema.exercises)
    .where(and(isNull(schema.exercises.deletedAt), isNull(schema.exercises.userId), sql`${L} is not null`, sql`${score} >= 4`))
    .orderBy(desc(score), desc(sql`coalesce((${L}->'rating'->>'avg')::float, 0)`), asc(schema.exercises.nameTr)).limit(limit)
  const favs = await favSet(userId, rows.map((r) => r.id))
  return rows.map((r) => toItem(r, favs))
}

/** Kas başına hareket sayısı (anatomi ekranında). */
export async function muscleCounts(): Promise<Record<string, number>> {
  const rows = await db.execute<{ k: string; n: number }>(sql`
    select k, count(*)::int as n from exercises, jsonb_each_text(licensed->'muscles') as m(k, v)
    where licensed is not null and deleted_at is null and user_id is null and v::float >= 4 group by k`)
  return Object.fromEntries(rows.map((r) => [r.k, Number(r.n)]))
}

export async function favoriteFeed(userId: string): Promise<FeedItem[]> {
  const rows = await db.select({ id: schema.exercises.id, name: schema.exercises.nameTr, licensed: L }).from(schema.exerciseFavorites)
    .innerJoin(schema.exercises, eq(schema.exercises.id, schema.exerciseFavorites.exerciseId))
    .where(and(eq(schema.exerciseFavorites.userId, userId), isNull(schema.exercises.deletedAt), sql`${L} is not null`)).orderBy(desc(schema.exerciseFavorites.createdAt))
  return rows.map((r) => toItem(r, new Set(rows.map((x) => x.id))))
}

export async function isFavorite(userId: string, exerciseId: number) {
  return (await favSet(userId, [exerciseId])).has(exerciseId)
}
export async function setFavorite(userId: string, exerciseId: number, on: boolean) {
  if (on) await db.insert(schema.exerciseFavorites).values({ userId, exerciseId }).onConflictDoNothing()
  else await db.delete(schema.exerciseFavorites).where(and(eq(schema.exerciseFavorites.userId, userId), eq(schema.exerciseFavorites.exerciseId, exerciseId)))
}

/** "Antrenman Seç" için kullanıcının programları ve günleri (aktif program önce). */
export async function programDays(userId: string) {
  const ps = await db.select({ id: schema.programs.id, name: schema.programs.name, active: schema.programs.active }).from(schema.programs)
    .where(and(eq(schema.programs.userId, userId), isNull(schema.programs.deletedAt))).orderBy(desc(schema.programs.active), desc(schema.programs.updatedAt)).limit(10)
  if (!ps.length) return []
  const days = await db.select({ id: schema.programDays.id, programId: schema.programDays.programId, name: schema.programDays.name }).from(schema.programDays)
    .where(inArray(schema.programDays.programId, ps.map((p) => p.id))).orderBy(asc(schema.programDays.idx))
  return ps.map((p) => ({ ...p, days: days.filter((d) => d.programId === p.id).map((d) => ({ id: d.id, name: d.name })) }))
}
