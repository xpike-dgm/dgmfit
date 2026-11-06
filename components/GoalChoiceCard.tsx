'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { btn } from './ui'
import { fmtNum } from '@/lib/calc'
import { goalChoiceAction } from '@/app/(app)/actions'

/** Faz 8: hedefe ulaşınca ya da hedef tarih gelince Bugün'de seçim kartı. */
export default function GoalChoiceCard({ s }: { s: { kind: 'reached' | 'ended'; trend: number; target: number; type: 'lose' | 'gain'; remainingKg?: number } }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const go = (c: 'recomp' | 'extend' | 'later' | 'new') => start(async () => {
    const r = await goalChoiceAction(c)
    if (!r.ok) { setErr(r.error ?? 'Olmadı, tekrar dene'); return }
    if (r.redirect) router.push(r.redirect); else router.refresh()
  })
  const reached = s.kind === 'reached'
  return (
    <section className="card p-4 flex flex-col gap-3 border-l-4 border-acc" data-testid="goal-choice" data-kind={s.kind}>
      <div className="flex flex-col gap-1">
        <b className="text-[17px] leading-snug">{reached ? `🎉 ${fmtNum(s.target, 1)} kg hedefine ulaştın!` : 'Hedef tarihin geldi'}</b>
        <span className="text-[13.5px] text-ink-2 leading-snug">{reached
          ? 'Şimdi ne yapalım? Seçimine göre kalori ve besin hedeflerin yeniden hesaplanır.'
          : `Hedefe ${fmtNum(s.remainingKg ?? 0, 1)} kg kaldı (şu an ${fmtNum(s.trend, 1)} kg). Nasıl devam edelim?`}</span>
      </div>
      <div className="flex flex-col gap-2">
        {reached ? (
          <button type="button" disabled={pending} className={btn.primary + ' h-12 text-[15px]'} onClick={() => go('recomp')} data-testid="choice-recomp">Kilomu koruyup kas kazanayım</button>
        ) : (
          <button type="button" disabled={pending} className={btn.primary + ' h-12 text-[15px]'} onClick={() => go('extend')} data-testid="choice-extend">Süreyi uzat, aynı tempoyla devam</button>
        )}
        {!reached ? <button type="button" disabled={pending} className={btn.secondary} onClick={() => go('recomp')} data-testid="choice-recomp">Bu kiloda kalıp kas kazanayım</button> : null}
        <button type="button" disabled={pending} className={btn.secondary} onClick={() => go('new')} data-testid="choice-new">Yeni hedef belirle</button>
        <button type="button" disabled={pending} className={btn.ghost + ' text-mute'} onClick={() => go('later')} data-testid="choice-later">Şimdilik böyle devam</button>
      </div>
      {reached ? <p className="text-[12px] text-mute leading-snug">“Kilomu koru” seçersen hedef tarihin aynı kalır; kalori bakım düzeyinde olur, antrenman günleri biraz daha fazla. Protein yağsız kütlene göre yükselir.</p> : null}
      {err ? <p role="alert" className="text-[13px] text-danger">{err}</p> : null}
    </section>
  )
}
