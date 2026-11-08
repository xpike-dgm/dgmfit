import 'server-only'
// Y1: gün sınırının kaynağı.
// 1) İstek içinde: React `cache` her istekte tek bir kutu verir; giriş yapan kullanıcı okunduğunda (lib/auth.ts
//    getSessionUser) sınır kutuya yazılır ve aynı istekteki tüm `dayString()` çağrıları kullanıcının gününü verir.
// 2) İstek dışında (zamanlayıcı, test kancaları): `runWithDayStart` / `asUserDay` AsyncLocalStorage ile sınırı verir.
// İkisi de yoksa sınır 0 (takvim günü).
import { AsyncLocalStorage } from 'node:async_hooks'
import { cache } from 'react'
// Next'in istek başına iş deposu (sayfa, sunucu aksiyonu ve API rotasında aynı nesne): WeakMap anahtarı olarak kullanılır.
// React `cache` API rotalarında istekler arası paylaşılmıyordu (yerel e2e: rota takvim gününü verdi).
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external'
import { eq } from 'drizzle-orm'
import { db, schema } from './db'
import { DAY_START_DEFAULT, clampDayStart, setDayOffsetProvider } from './time'

const box = cache((): { min: number | null } => ({ min: null }))
const als = new AsyncLocalStorage<{ min: number }>()
const byRequest = new WeakMap<object, number>()
const reqKey = (): object | null => { try { return (workAsyncStorage.getStore() as object | undefined) ?? null } catch { return null } }

setDayOffsetProvider(() => {
  const s = als.getStore()
  if (s) return s.min
  const k = reqKey()
  if (k && byRequest.has(k)) return byRequest.get(k)!
  try { return box().min ?? 0 } catch { return 0 }
})

export function setRequestDayStart(min: number) {
  const m = clampDayStart(min)
  const k = reqKey()
  if (k) byRequest.set(k, m)
  try { box().min = m } catch { /* istek dışı */ }
}

/** Kullanıcının kayıtlı gün sınırı (profil yoksa varsayılan). */
export async function dayStartOf(userId: string): Promise<number> {
  const [p] = await db.select({ m: schema.profiles.dayStartMin }).from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1)
  return clampDayStart(p?.m ?? DAY_START_DEFAULT)
}

export function runWithDayStart<T>(min: number, fn: () => T): T { return als.run({ min: clampDayStart(min) }, fn) }

/** İstek dışı işler için: kullanıcının gün sınırıyla çalıştırır (zamanlayıcı). */
export async function asUserDay<T>(userId: string, fn: () => Promise<T>): Promise<T> { return runWithDayStart(await dayStartOf(userId), fn) }
