import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { requireAdmin } from '@/lib/admin'
import { listInvites } from '@/lib/admin-data'
import { inviteUsable } from '@/lib/access'
import { TopBar } from '@/components/ui'
import Invites from './Invites'

export const metadata: Metadata = { title: 'Davet kodları · Yönetim' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireAdmin()
  const h = await headers()
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'dgfit.dgmcraft.online'}`
  const now = new Date()
  const list = (await listInvites()).map((i) => ({ code: i.code, label: i.label, maxUses: i.maxUses, uses: i.uses, expiresAt: i.expiresAt?.toISOString() ?? null, disabled: i.disabled, usable: inviteUsable(i, now), createdAt: i.createdAt.toISOString() }))
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="admin-invites">
      <TopBar back="/yonetim" title="Davet kodları" sub="Kodla kayıt olan hesap onay beklemeden açılır" />
      <Invites list={list} origin={origin} />
    </div>
  )
}
