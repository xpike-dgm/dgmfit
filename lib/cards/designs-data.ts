import 'server-only'
// Özelleştirme Ö3a: Tasarımlarım (birden çok tasarım, biri etkin) ve sürümler (geri yükleme). Kişisel kısım (birimler,
// tek el, hareketler…) tasarımlar arasında kullanıcıyla taşınır (lib/cards/share.ts).
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { db, schema } from '../db'
import { publish } from '../events'
import { REGISTRY_VERSION } from './registry'
import { emptyDesign, type Design } from './layout'
import { personalPart, withPersonal } from './share'
import { snapshot } from './design-data'

export const DESIGNS_MAX = 12
const D = schema.uiDesigns, V = schema.uiDesignVersions
const asDesign = (x: unknown) => x as Design
const asData = (d: Design) => ({ ...d, v: REGISTRY_VERSION }) as unknown as Record<string, unknown>

export async function listDesigns(userId: string) {
  const rows = await db.select({ id: D.id, name: D.name, active: D.active, data: D.data, updatedAt: D.updatedAt }).from(D).where(eq(D.userId, userId)).orderBy(desc(D.active), desc(D.updatedAt))
  return rows.map((r) => {
    const d = asDesign(r.data)
    return { id: r.id, name: r.name, active: r.active, updatedAt: r.updatedAt, screens: Object.keys(d.screens ?? {}).length, modules: Object.keys(d.modules ?? {}).length, rules: (d.rules ?? []).length, design: d }
  })
}

async function ownDesign(userId: string, id: string) {
  const [r] = await db.select().from(D).where(and(eq(D.id, id), eq(D.userId, userId))).limit(1)
  return r ?? null
}
async function activeRow(userId: string) {
  const [r] = await db.select().from(D).where(and(eq(D.userId, userId), eq(D.active, true))).limit(1)
  return r ?? null
}

/** Yeni tasarım: varsayılandan ya da var olan bir tasarımın kopyası (etkin olmaz). Kişisel kısım etkin tasarımdan gelir. */
export async function createDesign(userId: string, name: string, from: 'default' | string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(D).where(eq(D.userId, userId))
  if (Number(n) >= DESIGNS_MAX) return { ok: false, error: `En çok ${DESIGNS_MAX} tasarım saklanabilir` }
  const act = await activeRow(userId)
  let base: Design = emptyDesign()
  if (from !== 'default') { const src = await ownDesign(userId, from); if (!src) return { ok: false, error: 'Tasarım bulunamadı' }; base = asDesign(src.data) }
  const data = withPersonal(base, personalPart(act ? asDesign(act.data) : null))
  // hiç tasarımı yoksa (hiç özelleştirmemiş) önce mevcut varsayılanı "Benim düzenim" olarak etkin kaydet
  if (!act) await db.insert(D).values({ userId, data: asData(emptyDesign()), active: true }).onConflictDoNothing()
  const [r] = await db.insert(D).values({ userId, name: name.slice(0, 40) || 'Yeni tasarım', data: asData(data), active: false }).returning({ id: D.id })
  await publish(userId, 'design.created', { from: from === 'default' ? 'default' : 'copy' })
  return { ok: true, id: r.id }
}

/** Tasarımı etkinleştirir; kişisel kısım (birimler, tek el, sabitler…) önceki etkin tasarımdan taşınır. */
export async function activateDesign(userId: string, id: string) {
  const target = await ownDesign(userId, id)
  if (!target) return false
  if (target.active) return true
  const act = await activeRow(userId)
  const merged = withPersonal(asDesign(target.data), personalPart(act ? asDesign(act.data) : null))
  await db.transaction(async (tx) => {
    await tx.update(D).set({ active: false }).where(and(eq(D.userId, userId), eq(D.active, true)))
    await tx.update(D).set({ active: true, data: asData(merged), updatedAt: new Date() }).where(eq(D.id, id))
  })
  await snapshot(userId, id, asData(merged), 'Etkinleştirildi')
  await publish(userId, 'design.activated', {})
  return true
}

export async function renameDesign(userId: string, id: string, name: string) {
  const n = name.trim().slice(0, 40)
  if (!n) return false
  const r = await db.update(D).set({ name: n }).where(and(eq(D.id, id), eq(D.userId, userId))).returning({ id: D.id })
  return r.length > 0
}

/** Etkin olmayan tasarımı siler (etkin tasarım silinemez; önce başka biri etkinleştirilir). */
export async function deleteDesign(userId: string, id: string) {
  const r = await db.delete(D).where(and(eq(D.id, id), eq(D.userId, userId), eq(D.active, false))).returning({ id: D.id })
  return r.length > 0
}

export async function listVersions(userId: string, designId: string) {
  return db.select({ id: V.id, note: V.note, createdAt: V.createdAt }).from(V)
    .where(and(eq(V.designId, designId), eq(V.userId, userId))).orderBy(desc(V.createdAt)).limit(30)
}

/** Sürümü geri yükler (tasarımın düzeni/renkleri o ana döner; kişisel kısım bugünkü hâliyle kalır). Geri yükleme de sürüm olur. */
export async function restoreVersion(userId: string, versionId: string) {
  const [v] = await db.select().from(V).where(and(eq(V.id, versionId), eq(V.userId, userId))).limit(1)
  if (!v) return false
  const des = await ownDesign(userId, v.designId)
  if (!des) return false
  const data = withPersonal(asDesign(v.data), personalPart(asDesign(des.data)))
  await db.update(D).set({ data: asData(data), updatedAt: new Date() }).where(eq(D.id, des.id))
  await snapshot(userId, des.id, asData(data), 'Geri yüklendi')
  await publish(userId, 'design.restored', {})
  return true
}

/** Diğer tasarımların sayısı (stüdyo özeti). */
export async function designCount(userId: string) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(D).where(and(eq(D.userId, userId), ne(D.active, false)))
  const [{ all }] = await db.select({ all: sql<number>`count(*)::int` }).from(D).where(eq(D.userId, userId))
  return { active: Number(n), all: Number(all) }
}

/** Ö3b: verilen tasarım verisinden yeni (etkin olmayan) tasarım — şablonu "Tasarımlarıma ekle" (remix). */
export async function createDesignFromData(userId: string, name: string, data: Design): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(D).where(eq(D.userId, userId))
  if (Number(n) >= DESIGNS_MAX) return { ok: false, error: `En çok ${DESIGNS_MAX} tasarım saklanabilir` }
  const act = await activeRow(userId)
  if (!act) await db.insert(D).values({ userId, data: asData(emptyDesign()), active: true }).onConflictDoNothing()
  const [r] = await db.insert(D).values({ userId, name: name.slice(0, 40), data: asData(withPersonal(data, personalPart(act ? asDesign(act.data) : null))), active: false }).returning({ id: D.id })
  await publish(userId, 'design.created', { from: 'template' })
  return { ok: true, id: r.id }
}

export async function ownDesignData(userId: string, id: string): Promise<Design | null> { const r = await ownDesign(userId, id); return r ? asDesign(r.data) : null }
