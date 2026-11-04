'use server'
import { revalidatePath } from 'next/cache'
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { publish } from '@/lib/events'
import { dayString } from '@/lib/time'
import { ensureWaterSetup, minuteOfDay, type WaterLogView } from '@/lib/water-data'
import { DRINKS, calibrateSip, effectiveMl, isLikelyDuplicate, overHourlyLimit, type DrinkId } from '@/lib/water'

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function uid() {
  const u = await getUser()
  if (!u) throw new Error('Oturum yok')
  return u.id
}

const drinkIds = Object.keys(DRINKS) as [DrinkId, ...DrinkId[]]
const AddInput = z.object({
  ml: z.number().int().min(1).max(3000),
  drink: z.enum(drinkIds).default('water'),
  source: z.enum(['button', 'sip', 'container', 'fill', 'finish', 'custom', 'backdate']),
  containerId: z.string().uuid().nullable().optional(),
  fill: z.number().min(0).max(1).optional(),
  /** ISO zaman; yoksa şimdi */
  at: z.string().datetime({ offset: true }).optional(),
  /** Çift kayıt uyarısı onaylandıysa true */
  force: z.boolean().optional(),
})

function toView(r: typeof schema.waterLogs.$inferSelect, containerName: string | null): WaterLogView {
  return {
    id: r.id, atIso: r.loggedAt.toISOString(), at: minuteOfDay(r.loggedAt), ml: r.ml, effectiveMl: r.effectiveMl,
    drink: r.drink as DrinkId, containerId: r.containerId, containerName, source: r.source,
    edited: (r.history ?? []).some((h) => h.action === 'edit'),
  }
}

export async function addWater(input: z.input<typeof AddInput>): Promise<R<{ log: WaterLogView; warning?: string }> | { ok: false; duplicate: true; error: string }> {
  const userId = await uid()
  const p = AddInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz miktar' }
  const d = p.data
  const at = d.at ? new Date(d.at) : new Date()
  if (at.getTime() > Date.now() + 5 * 60000) return { ok: false, error: 'Gelecekteki bir zamana kayıt eklenemez' }
  await ensureWaterSetup(userId)

  const hydration = DRINKS[d.drink].hydration
  let containerName: string | null = null
  if (d.containerId) {
    const [c] = await db.select().from(schema.waterContainers).where(and(eq(schema.waterContainers.id, d.containerId), eq(schema.waterContainers.userId, userId))).limit(1)
    if (!c) return { ok: false, error: 'Kap bulunamadı' }
    containerName = c.name
    if (d.fill !== undefined) await db.update(schema.waterContainers).set({ lastFill: d.fill }).where(eq(schema.waterContainers.id, c.id))
  }

  // Kontrol + kayıt kullanıcı başına kilitli tek işlemde: hızlı çift dokunuşta yarış olmaz
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'water:' + userId}))`)
    const recent = await tx.select({ ml: schema.waterLogs.ml, loggedAt: schema.waterLogs.loggedAt }).from(schema.waterLogs)
      .where(and(eq(schema.waterLogs.userId, userId), isNull(schema.waterLogs.deletedAt), gte(schema.waterLogs.loggedAt, new Date(at.getTime() - 3600000))))
    const rec = recent.map((r) => ({ ml: r.ml, atMs: r.loggedAt.getTime() }))
    if (!d.force && isLikelyDuplicate(d.ml, at.getTime(), rec)) return { duplicate: true as const }
    const [row] = await tx.insert(schema.waterLogs).values({
      userId, loggedAt: at, ml: d.ml, drink: d.drink, hydration, effectiveMl: effectiveMl(d.ml, d.drink),
      containerId: d.containerId ?? null, source: d.at && Math.abs(at.getTime() - Date.now()) > 10 * 60000 ? 'backdate' : d.source,
      history: [{ at: new Date().toISOString(), action: 'create' }],
    }).returning()
    return { row, over: overHourlyLimit(d.ml, at.getTime(), rec) }
  })
  if ('duplicate' in result) return { ok: false, duplicate: true, error: `${d.ml} ml az önce de eklendi. Tekrar eklemek istiyor musun?` }
  const { row } = result
  await publish(userId, 'water.logged', { id: row.id, ml: row.ml, effectiveMl: row.effectiveMl, drink: row.drink, day: dayString(at) })
  revalidatePath('/')
  const warning = result.over
    ? 'Son bir saatte 1 litreden fazla içtin. Suyu gün içine yaymak daha sağlıklı.' : undefined
  return { ok: true, log: toView(row, containerName), warning }
}

export async function undoWater(id: number): Promise<R> {
  return deleteWater(id, 'undo')
}

export async function deleteWater(id: number, action: 'delete' | 'undo' = 'delete'): Promise<R> {
  const userId = await uid()
  const res = await db.update(schema.waterLogs).set({
    deletedAt: new Date(), updatedAt: new Date(),
    history: sql`${schema.waterLogs.history} || ${JSON.stringify([{ at: new Date().toISOString(), action }])}::jsonb`,
  }).where(and(eq(schema.waterLogs.id, id), eq(schema.waterLogs.userId, userId), isNull(schema.waterLogs.deletedAt))).returning({ id: schema.waterLogs.id })
  if (!res.length) return { ok: false, error: 'Kayıt bulunamadı' }
  revalidatePath('/')
  return { ok: true }
}

const EditInput = z.object({
  id: z.number().int(),
  ml: z.number().int().min(1).max(3000),
  drink: z.enum(drinkIds),
  at: z.string().datetime({ offset: true }),
})

export async function updateWater(input: z.input<typeof EditInput>): Promise<R<{ log: WaterLogView }>> {
  const userId = await uid()
  const p = EditInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Geçersiz değer' }
  const d = p.data
  const at = new Date(d.at)
  if (at.getTime() > Date.now() + 5 * 60000) return { ok: false, error: 'Gelecekteki bir zaman seçilemez' }
  const [old] = await db.select().from(schema.waterLogs).where(and(eq(schema.waterLogs.id, d.id), eq(schema.waterLogs.userId, userId), isNull(schema.waterLogs.deletedAt))).limit(1)
  if (!old) return { ok: false, error: 'Kayıt bulunamadı' }
  const hydration = DRINKS[d.drink].hydration
  const [row] = await db.update(schema.waterLogs).set({
    ml: d.ml, drink: d.drink, hydration, effectiveMl: effectiveMl(d.ml, d.drink), loggedAt: at, updatedAt: new Date(),
    history: [...(old.history ?? []), { at: new Date().toISOString(), action: 'edit', before: { ml: old.ml, drink: old.drink, at: old.loggedAt.toISOString() } }],
  }).where(eq(schema.waterLogs.id, d.id)).returning()
  let name: string | null = null
  if (row.containerId) {
    const [c] = await db.select({ name: schema.waterContainers.name }).from(schema.waterContainers).where(eq(schema.waterContainers.id, row.containerId))
    name = c?.name ?? null
  }
  revalidatePath('/')
  return { ok: true, log: toView(row, name) }
}

/** Seçilen kayıtları en erken zamanda tek kayıtta birleştirir. */
export async function mergeWater(ids: number[]): Promise<R<{ log: WaterLogView }>> {
  const userId = await uid()
  const uniq = [...new Set(ids)].filter((x) => Number.isInteger(x))
  if (uniq.length < 2) return { ok: false, error: 'Birleştirmek için en az 2 kayıt seç' }
  const rows = await db.select().from(schema.waterLogs)
    .where(and(eq(schema.waterLogs.userId, userId), inArray(schema.waterLogs.id, uniq), isNull(schema.waterLogs.deletedAt)))
  if (rows.length !== uniq.length) return { ok: false, error: 'Bazı kayıtlar bulunamadı' }
  const drinks = new Set(rows.map((r) => r.drink))
  if (drinks.size > 1) return { ok: false, error: 'Yalnızca aynı içecek türündeki kayıtlar birleştirilebilir' }
  rows.sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime())
  const keep = rows[0]
  const ml = rows.reduce((a, r) => a + r.ml, 0)
  const now = new Date().toISOString()
  const merged = await db.transaction(async (tx) => {
    const [row] = await tx.update(schema.waterLogs).set({
      ml, effectiveMl: effectiveMl(ml, keep.drink as DrinkId), updatedAt: new Date(),
      history: [...(keep.history ?? []), { at: now, action: 'merge', before: rows.map((r) => ({ id: r.id, ml: r.ml, at: r.loggedAt.toISOString() })) }],
    }).where(eq(schema.waterLogs.id, keep.id)).returning()
    for (const r of rows.slice(1)) {
      await tx.update(schema.waterLogs).set({ deletedAt: new Date(), history: [...(r.history ?? []), { at: now, action: 'merged', before: { into: keep.id } }] }).where(eq(schema.waterLogs.id, r.id))
    }
    return row
  })
  revalidatePath('/')
  return { ok: true, log: toView(merged, null) }
}

// ───────── Ayarlar ─────────

const ContainerInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(30),
  kind: z.enum(['glass', 'bottle', 'thermos', 'cup']),
  capacityMl: z.number().int().min(30).max(3000),
  isDefault: z.boolean().optional(),
})

export async function saveContainer(input: z.input<typeof ContainerInput>): Promise<R> {
  const userId = await uid()
  const p = ContainerInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Kap adı ve 30–3000 ml arası kapasite gerekli' }
  const d = p.data
  await ensureWaterSetup(userId)
  await db.transaction(async (tx) => {
    if (d.isDefault) await tx.update(schema.waterContainers).set({ isDefault: false }).where(eq(schema.waterContainers.userId, userId))
    if (d.id) {
      await tx.update(schema.waterContainers).set({ name: d.name, kind: d.kind, capacityMl: d.capacityMl, ...(d.isDefault !== undefined ? { isDefault: d.isDefault } : {}) })
        .where(and(eq(schema.waterContainers.id, d.id), eq(schema.waterContainers.userId, userId)))
    } else {
      await tx.insert(schema.waterContainers).values({ userId, name: d.name, kind: d.kind, capacityMl: d.capacityMl, isDefault: !!d.isDefault, sort: 99 })
    }
  })
  revalidatePath('/su')
  return { ok: true }
}

export async function archiveContainer(id: string): Promise<R> {
  const userId = await uid()
  await db.update(schema.waterContainers).set({ archivedAt: new Date(), isDefault: false })
    .where(and(eq(schema.waterContainers.id, id), eq(schema.waterContainers.userId, userId)))
  revalidatePath('/su')
  return { ok: true }
}

export async function saveSipCalibration(volumeMl: number, sips: number): Promise<R<{ sipMl: number }>> {
  const userId = await uid()
  let v: number
  try { v = calibrateSip(volumeMl, sips) } catch { return { ok: false, error: 'Hacim ve yudum sayısı 0’dan büyük olmalı' } }
  await ensureWaterSetup(userId)
  await db.update(schema.waterSettings).set({ sipMl: v, updatedAt: new Date() }).where(eq(schema.waterSettings.userId, userId))
  revalidatePath('/su')
  return { ok: true, sipMl: v }
}

const SettingsInput = z.object({
  buttons: z.array(z.number().int().min(10).max(2000)).min(1).max(8),
  progressStyle: z.enum(['bottle', 'ring', 'wave']),
  feedback: z.boolean(),
})

export async function saveWaterSettings(input: z.input<typeof SettingsInput>): Promise<R> {
  const userId = await uid()
  const p = SettingsInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Butonlar 10–2000 ml arasında olmalı (en fazla 8)' }
  await ensureWaterSetup(userId)
  const buttons = [...new Set(p.data.buttons)].sort((a, b) => a - b)
  await db.update(schema.waterSettings).set({ buttons, progressStyle: p.data.progressStyle, feedback: p.data.feedback, updatedAt: new Date() })
    .where(eq(schema.waterSettings.userId, userId))
  revalidatePath('/su')
  return { ok: true }
}

const GoalInput = z.object({
  baseMl: z.number().int().min(500).max(8000),
  weekday: z.array(z.number().int().min(500).max(8000).nullable()).length(7),
})

/** Yeni hedef bugünden itibaren geçerli olur; geçmiş günlerin hedefi değişmez. */
export async function saveWaterGoal(input: z.input<typeof GoalInput>): Promise<R> {
  const userId = await uid()
  const p = GoalInput.safeParse(input)
  if (!p.success) return { ok: false, error: 'Hedefler 500–8000 ml arasında olmalı' }
  await ensureWaterSetup(userId)
  const today = dayString()
  const weekday = p.data.weekday.some((x) => x) ? p.data.weekday : null
  await db.transaction(async (tx) => {
    await tx.delete(schema.waterGoalHistory).where(and(eq(schema.waterGoalHistory.userId, userId), eq(schema.waterGoalHistory.effectiveFrom, today)))
    await tx.insert(schema.waterGoalHistory).values({ userId, effectiveFrom: today, baseMl: p.data.baseMl, weekday })
  })
  revalidatePath('/')
  revalidatePath('/su')
  return { ok: true }
}
