import { NextResponse } from 'next/server'
import { getUser, rateLimit } from '@/lib/auth'
import { lookupBarcode } from '@/lib/food-data'
import { isValidBarcode } from '@/lib/food'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  const code = (new URL(req.url).searchParams.get('code') ?? '').replace(/\D/g, '')
  if (!isValidBarcode(code)) return NextResponse.json({ error: 'Geçersiz barkod' }, { status: 400 })
  if (!rateLimit('barcode:' + u.id, 60, 60_000)) return NextResponse.json({ error: 'Çok sık deneme' }, { status: 429 })
  return NextResponse.json(await lookupBarcode(u.id, code))
}
