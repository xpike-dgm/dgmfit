import { NextResponse } from 'next/server'
import { vapid } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { publicKey } = await vapid()
  return NextResponse.json({ publicKey })
}
