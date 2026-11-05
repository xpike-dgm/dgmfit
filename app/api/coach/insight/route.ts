import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { dailyInsight } from '@/lib/coach-data'

/** Bugünün içgörüsü (Bugün ekranı sonradan yükler: AI çağrısı sayfa açılışını bekletmesin). */
export async function GET() {
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'Oturum yok' }, { status: 401 })
  try {
    return NextResponse.json({ insight: await dailyInsight(u.id) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[dgfit] içgörü hatası', e)
    return NextResponse.json({ insight: null })
  }
}
