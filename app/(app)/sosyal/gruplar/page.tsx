import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { myGroups } from '@/lib/social2-data'
import { TopBar } from '@/components/ui'
import { NewGroup } from './GroupClient'

export const metadata: Metadata = { title: 'Gruplar · DgFit' }

export default async function Page() {
  const u = await requireUser()
  const gs = await myGroups(u.id)
  return (
    <div className="px-4 pt-5 flex flex-col gap-3">
      <TopBar back="/sosyal" title="Gruplar" />
      <section className="card p-4 flex flex-col" data-testid="group-list">
        {gs.length ? gs.map((g) => (
          <Link key={g.id} href={`/sosyal/gruplar/${g.id}`} className="flex items-center justify-between min-h-12 border-b border-line last:border-0" data-testid="group-row">
            <span className="flex flex-col"><b>{g.name}</b><span className="text-[12px] text-mute">{g.members} üye{g.owner ? ' · sahibi sensin' : ''}</span></span>
            {g.status === 'invited' ? <span className="text-[12px] font-bold text-orange">Davet</span> : <span className="text-lime">›</span>}
          </Link>
        )) : <p className="text-[14px] text-mute">Salon arkadaşların, ailen ya da ofisinle bir grup kur.</p>}
      </section>
      <NewGroup />
    </div>
  )
}
