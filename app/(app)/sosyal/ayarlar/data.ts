import 'server-only'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import QRCode from 'qrcode'
import { db, schema } from '@/lib/db'
import { itemsOf, socialProfile, NOTIFY_KINDS } from '@/lib/social-data'
import { mediaEnabled } from '@/lib/media'

/** Sosyal ayar sayfalarının ortak verisi. */
export async function socialSettingsData(user: { id: string; username: string }) {
  const sp = await socialProfile(user.id)
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'dgfit.dgmcraft.online'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const invite = `${proto}://${host}/u/${encodeURIComponent(user.username)}?davet=1`
  const qr = await QRCode.toString(invite, { type: 'svg', margin: 1, width: 180, color: { dark: '#11130F', light: '#FFFFFF' } })
  const recs = await db.select({ id: schema.exercises.id, name: schema.exercises.nameTr }).from(schema.exerciseRecords).innerJoin(schema.exercises, eq(schema.exercises.id, schema.exerciseRecords.exerciseId)).where(eq(schema.exerciseRecords.userId, user.id))
  return {
    sp,
    props: {
      mediaOn: mediaEnabled(), invite, qr, exercises: recs, notifyKinds: Object.entries(NOTIFY_KINDS),
      initial: { bio: sp.bio ?? '', gym: sp.gym ?? '', visibility: sp.visibility, items: itemsOf(sp), showGoal: sp.showGoal, showcase: sp.showcase, notify: sp.notify as Record<string, boolean>, avatar: sp.avatarId ? `/api/media/${sp.avatarId}` : null },
    },
  }
}
