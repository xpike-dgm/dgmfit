import 'server-only'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db, schema } from './db'

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
export const SESSION_COOKIE = 'dgfit_session'
const SESSION_DAYS = 60

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(pw, salt, 64, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, keyB64] = stored.split('$')
  if (alg !== 'scrypt') return false
  const key = Buffer.from(keyB64, 'base64')
  const got = await scrypt(pw, Buffer.from(saltB64, 'base64'), key.length, { N: +n, r: +r, p: +p, maxmem: SCRYPT.maxmem })
  return got.length === key.length && crypto.timingSafeEqual(got, key)
}

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000)
  const ua = (await headers()).get('user-agent')?.slice(0, 300) ?? null
  await db.insert(schema.sessions).values({ id: tokenHash(token), userId, expiresAt, userAgent: ua })
  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, tokenHash(token)))
  jar.delete(SESSION_COOKIE)
}

export interface CurrentUser {
  id: string
  username: string
  email: string
  onboarded: boolean
}

export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const rows = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      onboardedAt: schema.profiles.onboardedAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, tokenHash(token)), gt(schema.sessions.expiresAt, sql`now()`)))
    .limit(1)
  const r = rows[0]
  if (!r) return null
  return { id: r.id, username: r.username, email: r.email, onboarded: !!r.onboardedAt }
})

/** Giriş yapmış ve kurulumu tamamlamış kullanıcı ister. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getUser()
  if (!u) redirect('/giris')
  if (!u.onboarded) redirect('/kurulum')
  return u
}

// Basit bellek içi deneme sınırlayıcı (tek süreç).
const attempts = new Map<string, { n: number; until: number }>()
export function rateLimit(key: string, max = 8, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now()
  const a = attempts.get(key)
  if (!a || a.until < now) {
    attempts.set(key, { n: 1, until: now + windowMs })
    return true
  }
  a.n++
  return a.n <= max
}

export async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local'
}
