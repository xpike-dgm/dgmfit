import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { usernameError } from '@/lib/validation'
import { rateLimit, clientIp } from '@/lib/auth'

export async function GET(req: Request) {
  const u = (new URL(req.url).searchParams.get('u') ?? '').trim()
  const err = usernameError(u)
  if (err) return NextResponse.json({ available: false, error: err, suggestions: [] })
  if (!rateLimit('uname:' + (await clientIp()), 120, 60_000)) return NextResponse.json({ available: true, suggestions: [] })

  const base = u.replace(/[._]+$/, '').slice(0, 16)
  const candidates = [u, `${base}_fit`, `${base}${new Date().getFullYear() % 100}`, `${base}.dg`, `${base}${Math.floor(Math.random() * 90 + 10)}`]
  const rows = await db.execute<{ username: string }>(sql`
    select lower(username) as username from users where lower(username) in (${sql.join(candidates.map((c) => sql`${c.toLowerCase()}`), sql`, `)})`)
  const taken = new Set(rows.map((r) => r.username))
  const available = !taken.has(u.toLowerCase())
  const suggestions = available ? [] : candidates.slice(1).filter((c) => !taken.has(c.toLowerCase()) && !usernameError(c)).slice(0, 3)
  return NextResponse.json({ available, suggestions })
}
