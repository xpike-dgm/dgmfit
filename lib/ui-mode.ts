import 'server-only'
import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db, schema } from './db'

/** Gelişmiş mod açık mı (sadeleştirme 2026-11-06). Kapalıysa ileri araçlar ve uzun açıklamalar gizlenir. İstek başına bir sorgu. */
export const isAdvanced = cache(async (userId: string): Promise<boolean> => {
  const [r] = await db.select({ v: schema.profiles.uiAdvanced }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  return !!r?.v
})

export async function setAdvanced(userId: string, on: boolean) {
  await db.update(schema.profiles).set({ uiAdvanced: on, updatedAt: new Date() }).where(eq(schema.profiles.userId, userId))
}
