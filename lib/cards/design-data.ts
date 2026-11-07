import 'server-only'
// Özelleştirme (Ö1): kullanıcının etkin tasarımı. Tek etkin tasarım (ui_designs_one_active); çoklu tasarım ve sürümler Ö3'te
// aynı tabloyu kullanır.
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db'
import { publish } from '../events'
import { REGISTRY_VERSION, type ScreenId } from './registry'
import { emptyDesign, normalizeScreen, resolveScreen, type Design, type LayoutItem } from './layout'

export async function activeDesign(userId: string): Promise<Design | null> {
  const [row] = await db.select({ data: schema.uiDesigns.data }).from(schema.uiDesigns)
    .where(and(eq(schema.uiDesigns.userId, userId), eq(schema.uiDesigns.active, true))).limit(1)
  return row ? (row.data as unknown as Design) : null
}

/** Ekranın çözülmüş düzeni (göç + doğrulama). Tasarımı olmayan kullanıcı varsayılanı alır. */
export async function screenLayout(userId: string, screen: ScreenId) {
  return resolveScreen(await activeDesign(userId), screen)
}

async function writeDesign(userId: string, d: Design) {
  const data = { ...d, v: REGISTRY_VERSION } as unknown as Record<string, unknown>
  const upd = await db.update(schema.uiDesigns).set({ data, updatedAt: new Date() })
    .where(and(eq(schema.uiDesigns.userId, userId), eq(schema.uiDesigns.active, true))).returning({ id: schema.uiDesigns.id })
  if (!upd.length) await db.insert(schema.uiDesigns).values({ userId, data, active: true }).onConflictDoNothing()
}

/** Ekran düzenini kaydeder (sunucuda yeniden doğrulanır: bilinmeyen kart, tekrar, kilitli kart). */
export async function saveScreen(userId: string, screen: ScreenId, items: LayoutItem[]) {
  const cur = (await activeDesign(userId)) ?? emptyDesign()
  const next: Design = { ...cur, screens: { ...cur.screens, [screen]: normalizeScreen(screen, items) } }
  await writeDesign(userId, next)
  await publish(userId, 'design.saved', { screen, cards: next.screens[screen]!.items.length })
}

/** Ekranı varsayılana döndürür (o ekranın kaydı silinir; kart ayarları korunur). */
export async function resetScreen(userId: string, screen: ScreenId) {
  const cur = await activeDesign(userId)
  if (!cur?.screens[screen]) return
  const screens = { ...cur.screens }
  delete screens[screen]
  await writeDesign(userId, { ...cur, screens })
  await publish(userId, 'design.reset', { screen })
}
