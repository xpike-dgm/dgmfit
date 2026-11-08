import 'server-only'
// Özelleştirme Ö4: kart kullanım verisi, kullanım haritası, koç önerileri ve kişisel deney raporu.
import { and, desc, eq, gte, notInArray, sql } from 'drizzle-orm'
import { db, schema } from '../db'
import { addDays, dayString } from '../time'
import { cardDef, type ScreenId } from './registry'
import { suggestLayout, experiment, type CardUsage, type Suggestion, type DayCount } from './usage'
import { sqlDay } from '../water-data'

const U = schema.cardUsage

export async function recordUsage(userId: string, events: { card: string; kind: 'view' | 'tap' }[]) {
  const day = dayString()
  const agg = new Map<string, { v: number; t: number }>()
  for (const e of events) {
    if (!cardDef(e.card)) continue
    const a = agg.get(e.card) ?? { v: 0, t: 0 }
    if (e.kind === 'view') a.v = Math.min(a.v + 1, 5); else a.t = Math.min(a.t + 1, 20)
    agg.set(e.card, a)
  }
  for (const [card, a] of agg) {
    await db.insert(U).values({ userId, day, card, views: a.v, taps: a.t })
      .onConflictDoUpdate({ target: [U.userId, U.day, U.card], set: { views: sql`${U.views} + ${a.v}`, taps: sql`${U.taps} + ${a.t}` } })
  }
}

/** Son `days` günün kart başına toplamı (ekran filtreli). */
export async function usageFor(userId: string, days = 14, screen?: ScreenId): Promise<CardUsage[]> {
  const rows = await db.select({ card: U.card, views: sql<number>`sum(${U.views})::int`, taps: sql<number>`sum(${U.taps})::int` }).from(U)
    .where(and(eq(U.userId, userId), gte(U.day, addDays(dayString(), -(days - 1))))).groupBy(U.card)
  return rows.map((r) => ({ card: r.card, views: Number(r.views), taps: Number(r.taps) })).filter((r) => !screen || cardDef(r.card)?.screen === screen)
}

/** Koç önerileri: ekran başına en çok iki, toplam en çok üç. */
export function suggestionsFor(layouts: { screen: ScreenId; items: { id: string }[] }[], usage: CardUsage[], dismissed: string[]): Suggestion[] {
  return layouts.flatMap((l) => suggestLayout(l.screen, l.items, usage.filter((u) => cardDef(u.card)?.screen === l.screen), dismissed)).slice(0, 3)
}

/** Kişisel deney raporu: etkin tasarımın son anlamlı düzen değişikliği ve öncesi/sonrası 7 gün günlük kayıt sayısı (öğün + su + antrenman). */
export async function experimentReport(userId: string) {
  const [d] = await db.select({ id: schema.uiDesigns.id }).from(schema.uiDesigns).where(and(eq(schema.uiDesigns.userId, userId), eq(schema.uiDesigns.active, true))).limit(1)
  if (!d) return null
  const [v] = await db.select({ note: schema.uiDesignVersions.note, at: schema.uiDesignVersions.createdAt }).from(schema.uiDesignVersions)
    .where(and(eq(schema.uiDesignVersions.designId, d.id), notInArray(schema.uiDesignVersions.note, ['Başlangıç', 'Etkinleştirildi', 'Geri yüklendi', 'Kullanım ayarları', 'Stil'])))
    .orderBy(desc(schema.uiDesignVersions.createdAt)).limit(1)
  if (!v) return null
  const changeDay = dayString(v.at)
  const from = addDays(changeDay, -7), to = addDays(changeDay, 7)
  // gün sütunu: öğün ve antrenmanda `day`; suda kayıt anı (İstanbul günü)
  const q = (table: 'meal_items' | 'workouts') => db.execute(sql`select day::text as day, count(*)::int as n from ${sql.raw(table)} where user_id = ${userId} and day between ${from} and ${to} and deleted_at is null group by day`)
  const qw = db.execute(sql`select ${sqlDay(sql`logged_at`)} as day, count(*)::int as n from water_logs where user_id = ${userId} and (logged_at at time zone 'Europe/Istanbul')::date between ${from} and ${to} and deleted_at is null group by 1`)
  const rs = await Promise.all([q('meal_items'), qw, q('workouts')])
  const by = new Map<string, number>()
  for (const r of rs) for (const row of r as unknown as { day: string; n: number }[]) by.set(row.day, (by.get(row.day) ?? 0) + Number(row.n))
  // kayıt olmayan ama geçmiş günler 0 sayılır (bugün ve sonrası sayılmaz)
  const today = dayString()
  const counts: DayCount[] = []
  for (let i = -7; i <= 7; i++) { const day = addDays(changeDay, i); if (day < today) counts.push({ day, count: by.get(day) ?? 0 }) }
  return { note: v.note, changeDay, ...experiment(changeDay, counts) }
}
