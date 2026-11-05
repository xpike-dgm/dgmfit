import { shortDate } from '@/lib/time'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { challengeView } from '@/lib/social2-data'
import { fmtNum } from '@/lib/calc'
import { TopBar } from '@/components/ui'
import { ChallengeButtons } from './ChallengeButtons'

export const metadata: Metadata = { title: 'Meydan okuma · DgFit' }

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const u = await requireUser()
  const { id } = await props.params
  const c = /^[0-9a-f-]{36}$/.test(id) ? await challengeView(u.id, id) : null
  if (!c) notFound()
  const lead = c.duel ? (c.duel.winner ?? c.duel.leader) : null
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/sosyal/meydan" title={c.scope === 'duel' ? 'Düello' : 'Meydan okuma'} />
      <section className="card p-5 flex flex-col gap-1" data-testid="challenge">
        <b className="text-[20px]">{c.title}</b>
        <span className="text-[13px] text-mute">{c.metricLabel}{c.param ? ` (≥ ${fmtNum(c.param)} ml)` : ''}{c.target ? ` · hedef ${fmtNum(c.target)} ${c.unit}` : ''} · {shortDate(c.startDay)} – {shortDate(c.endDay)}{c.ended ? ' · bitti' : ''}</span>
        {c.scope === 'duel' ? <span className="mt-1 font-bold text-acc" data-testid="duel-result">{!c.duel ? 'Rakip henüz katılmadı' : c.duel.winner ? `Kazanan: ${c.board.find((b) => b.userId === c.duel!.winner)?.name}` : lead ? `Önde: ${c.board.find((b) => b.userId === lead)?.name}` : 'Berabere'}</span> : null}
      </section>
      <ChallengeButtons id={c.id} status={c.myStatus} ended={c.ended} />
      <section className="card p-4 flex flex-col" aria-label="Sıralama" data-testid="board">
        {c.board.map((r) => (
          <div key={r.userId} className={`flex items-center gap-3 min-h-12 border-b border-line last:border-0 ${r.userId === u.id ? 'font-bold' : ''}`} data-testid="board-row">
            <span className="num w-6 text-mute">{r.rank}</span>
            <span className="flex-1 truncate">{r.name}</span>
            <span className="num">{fmtNum(r.value)} {c.unit}</span>
            {r.pct !== null ? <span className={`num text-[12px] w-12 text-right ${r.done ? 'text-acc' : 'text-mute'}`}>%{r.pct}</span> : null}
          </div>
        ))}
        {c.invited.length ? <p className="text-[12px] text-mute pt-2">Davet bekleyen: {c.invited.join(', ')}</p> : null}
      </section>
    </div>
  )
}
