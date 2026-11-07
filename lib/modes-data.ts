import 'server-only'
// Ö5b: kullanıcının odak modu ve Ramazan modu (user_modes). Zamanlayıcı, gün kapanışı, düzen ve ekranlar buradan okur.
import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db, schema } from './db'
import { publish } from './events'
import { DEFAULT_MODES, focusOn, normalizeModes, type ModeState } from './modes'

async function read(userId: string): Promise<ModeState> {
  const [r] = await db.select().from(schema.userModes).where(eq(schema.userModes.userId, userId)).limit(1)
  return r ? normalizeModes({ focus: r.focus as ModeState['focus'], focusFrom: r.focusFrom, focusUntil: r.focusUntil, ramadan: r.ramadan, sahur: r.sahur, iftar: r.iftar, ramadanUntil: r.ramadanUntil }) : DEFAULT_MODES
}
/** İstek başına bir sorgu (sayfa bileşenleri). */
export const getModes = cache(read)
/** Zamanlayıcı ve gün kapanışı için önbelleksiz okuma. */
export const readModes = read

export async function saveModes(userId: string, patch: Partial<ModeState>) {
  const cur = await read(userId)
  const n = normalizeModes({ ...cur, ...patch })
  const row = { focus: n.focus, focusFrom: n.focusFrom, focusUntil: n.focusUntil, ramadan: n.ramadan, sahur: n.sahur, iftar: n.iftar, ramadanUntil: n.ramadanUntil, updatedAt: new Date() }
  await db.insert(schema.userModes).values({ userId, ...row }).onConflictDoUpdate({ target: schema.userModes.userId, set: row })
  if (patch.focus !== undefined && patch.focus !== cur.focus) await publish(userId, 'mode.focus', { mode: n.focus })
  if (patch.ramadan !== undefined && patch.ramadan !== cur.ramadan) await publish(userId, 'mode.ramadan', { on: n.ramadan })
  return n
}

/** O gün dengeleme duraklatıldı mı (tatil / hastalık). */
export async function balancePausedOn(userId: string, day: string) { return !!focusOn(await read(userId), day)?.pauseBalance }
