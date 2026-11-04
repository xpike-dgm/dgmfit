import 'server-only'
import { db, schema } from './db'

/**
 * Modüller arası olay sistemi. Her olay kalıcı olarak kaydedilir ve süreç içi
 * dinleyicilere iletilir. Modüller (Fit, Su, Fitness, Yemek, Sosyal) kendi
 * tepkilerini `on()` ile kaydeder.
 */
export type EventType =
  | 'profile.onboarded'
  | 'profile.updated'
  | 'weight.logged'
  | 'meal.logged'
  | 'workout.finished'
  | 'pr.achieved'
  | 'water.logged'
  | 'day.closed'

type Handler = (userId: string, payload: Record<string, unknown>) => Promise<void> | void

const g = globalThis as unknown as { __dgfitHandlers?: Map<EventType, Handler[]> }
const handlers = (g.__dgfitHandlers ??= new Map())

export function on(type: EventType, h: Handler) {
  const list = handlers.get(type) ?? []
  list.push(h)
  handlers.set(type, list)
}

export async function publish(userId: string, type: EventType, payload: Record<string, unknown> = {}) {
  await db.insert(schema.events).values({ userId, type, payload })
  for (const h of handlers.get(type) ?? []) {
    try { await h(userId, payload) } catch (e) { console.error('[event]', type, e) }
  }
}
