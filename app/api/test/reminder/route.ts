import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { runForUser } from '@/lib/scheduler'

/** Yalnızca DGFIT_TEST_HOOKS=1 ile çalışan test kancası (canlıda 404). Zamanlayıcının karar + gönderim yolunu belirli bir saatte çalıştırır. */
export async function POST(req: Request) {
  if (process.env.DGFIT_TEST_HOOKS !== '1') return new NextResponse(null, { status: 404 })
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  const { at } = (await req.json().catch(() => ({}))) as { at?: string }
  return NextResponse.json(await runForUser(u.id, at ? new Date(at) : new Date()))
}
