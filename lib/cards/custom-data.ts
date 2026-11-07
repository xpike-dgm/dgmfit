import 'server-only'
// Özelleştirme Ö5a: kendi takip alanlarım ve kendi kartlarımın verisi (kart oluşturucu, motivasyon kartları).
import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { db, schema } from '../db'
import { publish } from '../events'
import { addDays, dayString } from '../time'
import { weightSeries } from '../fit-data'
import { isAdvanced } from '../ui-mode'
import { readMedia } from '../media'
import { SCREENS, type ScreenId } from './registry'
import { PERIODS, USER_CARDS_MAX, daysUntil, isUserCard, newUserCardId, normalizeTracker, normalizeUserCard, summarize, type Metric, type TrackerDef, type UserCard } from './custom'
import { addItem, normalizeScreen, removeItem, resolveScreen } from './layout'
import { transformDesign, activeDesign } from './design-data'

const TR = schema.trackers, TL = schema.trackerLogs
export const TRACKERS_MAX = 12

export async function listTrackers(userId: string) {
  const rows = await db.select().from(TR).where(and(eq(TR.userId, userId), eq(TR.archived, false))).orderBy(asc(TR.createdAt))
  const today = dayString()
  const logs = rows.length ? await db.select({ t: TL.trackerId, day: TL.day, value: TL.value }).from(TL).where(and(eq(TL.userId, userId), gte(TL.day, addDays(today, -6)))).orderBy(asc(TL.id)) : []
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  return rows.map((r) => {
    const def = { name: r.name, unit: r.unit, kind: r.kind, goal: r.goal, goalDir: r.goalDir, step: r.step, emoji: r.emoji } as TrackerDef
    const mine = logs.filter((l) => l.t === r.id)
    return { id: r.id, ...def, today: summarize(def.kind, mine, [today]).value, week: summarize(def.kind, mine, days) }
  })
}

export async function createTracker(userId: string, input: Partial<TrackerDef>) {
  const def = normalizeTracker(input)
  if (!def) return { ok: false as const, error: 'Takip alanına en az 2 harfli bir ad ver' }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(TR).where(and(eq(TR.userId, userId), eq(TR.archived, false)))
  if (Number(n) >= TRACKERS_MAX) return { ok: false as const, error: `En çok ${TRACKERS_MAX} takip alanı` }
  const [r] = await db.insert(TR).values({ userId, ...def }).returning({ id: TR.id })
  await publish(userId, 'tracker.created', { kind: def.kind })
  return { ok: true as const, id: r.id }
}
export async function archiveTracker(userId: string, id: string) {
  await db.update(TR).set({ archived: true }).where(and(eq(TR.id, id), eq(TR.userId, userId)))
}
/** Kayıt: sayaçta adım kadar ekler (eksi geri alır), ölçümde değer, puanda 1–5, evet/hayırda 1. */
export async function logTracker(userId: string, id: string, value: number) {
  const [t] = await db.select().from(TR).where(and(eq(TR.id, id), eq(TR.userId, userId), eq(TR.archived, false))).limit(1)
  if (!t) return 'Takip alanı bulunamadı'
  const day = dayString()
  if (t.kind === 'count' && value < 0) {
    // geri al: bugünün son kaydını sil
    const [last] = await db.select({ id: TL.id }).from(TL).where(and(eq(TL.trackerId, id), eq(TL.day, day))).orderBy(desc(TL.id)).limit(1)
    if (last) await db.delete(TL).where(eq(TL.id, last.id))
    return null
  }
  const v = t.kind === 'scale' ? Math.max(1, Math.min(5, Math.round(value))) : t.kind === 'yesno' ? (value > 0 ? 1 : 0) : t.kind === 'number' ? Math.max(0, Math.min(1e6, value)) : t.step
  if (t.kind === 'yesno' || t.kind === 'number' || t.kind === 'scale') await db.delete(TL).where(and(eq(TL.trackerId, id), eq(TL.day, day))) // günün tek değeri
  await db.insert(TL).values({ trackerId: id, userId, day, value: v })
  await publish(userId, 'tracker.logged', { kind: t.kind })
  return null
}

// ───────── kendi kartlarımın verisi ─────────
export type TrackerQuick = { id: string; kind: string; step: number; emoji: string }
export type UserCardData =
  | { kind: 'metric' | 'tracker'; title: string; unit: string; value: number | null; series: (number | null)[]; goal: number | null; view: 'number' | 'bar' | 'spark'; periodLabel: string; tracker?: TrackerQuick }
  | { kind: 'quote'; title: string; text: string }
  | { kind: 'countdown'; title: string; date: string; days: number }
  | { kind: 'photo'; title: string; mediaId: string }
  | { kind: 'records'; title: string; records: { name: string; value: number; type: string }[] }
  | { kind: 'missing'; title: string }

async function metricDays(userId: string, metric: Metric, days: string[]): Promise<(number | null)[]> {
  const from = days[0], to = days[days.length - 1]
  if (metric === 'weight') { const s = await weightSeries(userId, from, to); return days.map((d) => s.find((x) => x.day === d)?.trend ?? null) }
  const q = metric === 'water'
    ? sql`select (logged_at at time zone 'Europe/Istanbul')::date::text as day, sum(effective_ml)::real as v from water_logs where user_id = ${userId} and deleted_at is null and (logged_at at time zone 'Europe/Istanbul')::date between ${from} and ${to} group by 1`
    : metric === 'workouts'
      ? sql`select day::text as day, count(*)::real as v from workouts where user_id = ${userId} and deleted_at is null and day between ${from} and ${to} group by 1`
      : sql`select day::text as day, sum(${sql.raw(metric === 'kcal' ? 'kcal' : 'protein')})::real as v from meal_items where user_id = ${userId} and deleted_at is null and day between ${from} and ${to} group by 1`
  const rows = (await db.execute(q)) as unknown as { day: string; v: number }[]
  const by = new Map(rows.map((r) => [r.day, Number(r.v)]))
  return days.map((d) => by.get(d) ?? (metric === 'workouts' || metric === 'water' || metric === 'kcal' || metric === 'protein' ? 0 : null))
}

const METRIC_UNIT: Record<Metric, string> = { water: 'ml', kcal: 'kcal', protein: 'g', weight: 'kg', workouts: 'antrenman' }

/** Bir ekrandaki kendi kartlarımın görüntü verisi (yalnız ekranda/yığında duran kartlar için hesaplanır). */
export async function userCardData(userId: string, cards: Record<string, UserCard> | undefined, ids: string[]): Promise<Record<string, UserCardData>> {
  const out: Record<string, UserCardData> = {}
  const today = dayString()
  for (const id of ids) {
    const c = cards?.[id]
    if (!c) { out[id] = { kind: 'missing', title: 'Kart silinmiş' }; continue }
    if (c.kind === 'quote') out[id] = { kind: 'quote', title: c.title, text: c.text }
    else if (c.kind === 'countdown') out[id] = { kind: 'countdown', title: c.title, date: c.date, days: daysUntil(c.date, today) }
    else if (c.kind === 'photo') out[id] = { kind: 'photo', title: c.title, mediaId: c.mediaId }
    else if (c.kind === 'records') {
      const rows = await db.select({ name: schema.exercises.nameTr, value: sql<number>`max(${schema.personalRecords.value})::real`, type: schema.personalRecords.type })
        .from(schema.personalRecords).innerJoin(schema.exercises, eq(schema.exercises.id, schema.personalRecords.exerciseId))
        .where(and(eq(schema.personalRecords.userId, userId), isNull(schema.personalRecords.suspect), eq(schema.personalRecords.type, 'weight')))
        .groupBy(schema.exercises.nameTr, schema.personalRecords.type).orderBy(desc(sql`max(${schema.personalRecords.value})`)).limit(3)
      out[id] = { kind: 'records', title: c.title, records: rows.map((r) => ({ name: r.name, value: Number(r.value), type: r.type })) }
    } else {
      const n = PERIODS.find((p) => p.id === c.period)!.days
      const days = Array.from({ length: Math.max(n, c.view !== 'number' ? 7 : 1) }, (_, i) => addDays(today, i - Math.max(n, c.view !== 'number' ? 7 : 1) + 1))
      const periodLabel = PERIODS.find((p) => p.id === c.period)!.label
      if (c.kind === 'metric') {
        const series = await metricDays(userId, c.metric, days)
        const inPeriod = series.slice(-n).filter((v): v is number => v !== null)
        const value = c.metric === 'weight' ? inPeriod.at(-1) ?? null : inPeriod.length ? Math.round(inPeriod.reduce((a, v) => a + v, 0) / (n === 1 ? 1 : n)) : null
        out[id] = { kind: 'metric', title: c.title, unit: METRIC_UNIT[c.metric], value, series, goal: c.goal ?? null, view: c.view, periodLabel }
      } else {
        const [t] = await db.select().from(TR).where(and(eq(TR.id, c.trackerId), eq(TR.userId, userId))).limit(1)
        if (!t || t.archived) { out[id] = { kind: 'missing', title: c.title }; continue }
        const logs = await db.select({ day: TL.day, value: TL.value }).from(TL).where(and(eq(TL.trackerId, t.id), gte(TL.day, days[0]))).orderBy(asc(TL.id))
        const all = summarize(t.kind as TrackerDef['kind'], logs, days)
        const per = summarize(t.kind as TrackerDef['kind'], logs, days.slice(-n))
        out[id] = { kind: 'tracker', title: c.title, unit: t.unit, value: per.value, series: all.series, goal: t.goal, view: c.view, periodLabel, tracker: { id: t.id, kind: t.kind, step: t.step, emoji: t.emoji } }
      }
    }
  }
  return out
}

// ───────── kart oluşturucu: kendi kartımı kaydet / sil ─────────
export async function listUserCards(userId: string) {
  const d = await activeDesign(userId)
  const uc = d?.userCards ?? {}
  return Object.entries(uc).map(([id, c]) => {
    const sl = d?.screens?.[c.screen]
    const placed = !!sl?.items.some((i) => i.id === id || i.stack?.includes(id))
    return { id, card: c, placed }
  })
}

/** Yeni kart (id yok) ya da var olanı günceller. Yeni kart seçilen ekranın başına (sabit başlığın altına) eklenir. */
export async function saveUserCard(userId: string, id: string | null, input: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const c = normalizeUserCard(input)
  if (!c) return { ok: false, error: 'Kartın adı ve içeriği eksik' }
  if (c.kind === 'tracker') {
    const [t] = await db.select({ id: TR.id }).from(TR).where(and(eq(TR.id, c.trackerId), eq(TR.userId, userId), eq(TR.archived, false))).limit(1)
    if (!t) return { ok: false, error: 'Takip alanı bulunamadı' }
  }
  if (c.kind === 'photo' && !(await readMedia(userId, c.mediaId).catch(() => null))) return { ok: false, error: 'Fotoğraf bulunamadı' }
  const cur = await activeDesign(userId)
  const all = cur?.userCards ?? {}
  if (id && (!isUserCard(id) || !all[id])) return { ok: false, error: 'Kart bulunamadı' }
  if (!id && Object.keys(all).length >= USER_CARDS_MAX) return { ok: false, error: `En çok ${USER_CARDS_MAX} kendi kartın olabilir` }
  // ekran değişirse kimlik de değişir (kimlik ekranı taşır): eski kart düzenden kalkar
  const keep = id && all[id].screen === c.screen ? id : null
  const nid = keep ?? newUserCardId(c.screen, crypto.randomUUID().replace(/-/g, ''))
  const advanced = await isAdvanced(userId)
  await transformDesign(userId, (d) => {
    const userCards = { ...(d.userCards ?? {}) }
    const screens = { ...d.screens }
    if (id && id !== nid) {
      delete userCards[id]
      const old = all[id].screen, sl = screens[old]
      if (sl) screens[old] = { ...sl, items: removeItem(sl.items, id) }
    }
    userCards[nid] = c
    if (!keep) {
      const items = resolveScreen({ ...d, userCards }, c.screen, { advanced }).items.map((i) => ({ id: i.id, size: i.size, ...(i.stack ? { stack: i.stack } : {}) }))
      screens[c.screen] = normalizeScreen(c.screen, addItem(items, nid, 0), { advanced }, userCards)
    }
    return { ...d, userCards, screens }
  }, keep ? 'Kendi kartım güncellendi' : 'Kendi kartım eklendi')
  if (!keep) await publish(userId, 'usercard.created', { kind: c.kind, screen: c.screen })
  return { ok: true, id: nid }
}

export async function deleteUserCard(userId: string, id: string) {
  const cur = await activeDesign(userId)
  const c = cur?.userCards?.[id]
  if (!c) return false
  await transformDesign(userId, (d) => {
    const userCards = { ...(d.userCards ?? {}) }; delete userCards[id]
    const screens = { ...d.screens }
    const sl = screens[c.screen]
    if (sl) screens[c.screen] = { ...sl, items: removeItem(sl.items, id) }
    return { ...d, userCards, screens }
  }, 'Kendi kartım silindi')
  return true
}

export const SCREEN_TITLES = Object.fromEntries(Object.entries(SCREENS).map(([k, v]) => [k, v.title])) as Record<ScreenId, string>
export type { ScreenId }
