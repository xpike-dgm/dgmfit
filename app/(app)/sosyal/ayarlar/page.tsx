import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import QRCode from 'qrcode'
import { requireUser } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { itemsOf, socialProfile, NOTIFY_KINDS } from '@/lib/social-data'
import { mediaEnabled } from '@/lib/media'
import { TopBar } from '@/components/ui'
import SocialSettings from './SocialSettings'

export const metadata: Metadata = { title: 'Sosyal ayarlar · DgFit' }

export default async function Page() {
  const u = await requireUser()
  const sp = await socialProfile(u.id)
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'dgfit.dgmcraft.online'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const invite = `${proto}://${host}/u/${encodeURIComponent(u.username)}?davet=1`
  const qr = await QRCode.toString(invite, { type: 'svg', margin: 1, width: 180, color: { dark: '#11130F', light: '#FFFFFF' } })
  const recs = await db.select({ id: schema.exercises.id, name: schema.exercises.nameTr }).from(schema.exerciseRecords).innerJoin(schema.exercises, eq(schema.exercises.id, schema.exerciseRecords.exerciseId)).where(eq(schema.exerciseRecords.userId, u.id))
  return (
    <div className="px-4 pt-5 flex flex-col gap-3">
      <TopBar back={`/u/${u.username}`} title="Profil ve gizlilik" />
      <SocialSettings mediaOn={mediaEnabled()} invite={invite} qr={qr} exercises={recs} notifyKinds={Object.entries(NOTIFY_KINDS)}
        initial={{ bio: sp.bio ?? '', gym: sp.gym ?? '', visibility: sp.visibility, items: itemsOf(sp), showGoal: sp.showGoal, showcase: sp.showcase, notify: sp.notify as Record<string, boolean>, avatar: sp.avatarId ? `/api/media/${sp.avatarId}` : null }} />
    </div>
  )
}
