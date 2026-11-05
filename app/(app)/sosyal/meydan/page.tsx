import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { myChallenges } from '@/lib/social2-data'
import { friendsOverview } from '@/lib/social-data'
import { METRICS, TEMPLATES } from '@/lib/social-rank'
import { TopBar } from '@/components/ui'
import NewChallenge from './NewChallenge'

export const metadata: Metadata = { title: 'Meydan okumalar · DgFit' }
const SCOPE: Record<string, string> = { friends: 'Arkadaşlar', group: 'Grup', duel: 'Düello' }

export default async function Page() {
  const u = await requireUser()
  const [list, fr] = await Promise.all([myChallenges(u.id), friendsOverview(u.id)])
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/sosyal" title="Meydan okumalar" />
      <section className="card p-4 flex flex-col gap-2" data-testid="challenge-list">
        <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Benimkiler</span>
        {list.length ? list.map((c) => (
          <Link key={c.id} href={`/sosyal/meydan/${c.id}`} className="flex items-center justify-between min-h-12 border-b border-line last:border-0" data-testid="challenge-row">
            <span className="flex flex-col"><b>{c.title}</b><span className="text-[12px] text-mute">{SCOPE[c.scope]} · {c.ended ? 'bitti' : `${c.endDay} bitiyor`}</span></span>
            {c.status === 'invited' ? <span className="text-[12px] font-bold text-orange">Davet</span> : <span className="text-acc">›</span>}
          </Link>
        )) : <p className="text-[14px] text-mute">Henüz meydan okuma yok.</p>}
      </section>
      <NewChallenge templates={TEMPLATES.map((t) => ({ key: t.key, title: t.title, days: t.days }))} metrics={Object.entries(METRICS).map(([k, v]) => ({ key: k, label: v.label, unit: v.unit }))} friends={fr.friends.map((f) => ({ id: f.id, username: f.username }))} />
      <p className="text-[11px] text-faint text-center px-2">Katıldığında yalnızca bu meydan okumanın ölçütündeki ilerlemen (ör. su hedefi gün sayısı) diğer katılımcılara görünür. İlerleme kayıtlarından otomatik hesaplanır.</p>
    </div>
  )
}
