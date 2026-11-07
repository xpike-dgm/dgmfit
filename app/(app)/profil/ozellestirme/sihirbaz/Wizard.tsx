'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WIZARD_QUESTIONS, wizardDesign, type WizardAnswers } from '@/lib/cards/wizard'
import { cardDef } from '@/lib/cards/registry'
import { Check } from '@/components/icons'
import { applyWizardAction } from '../actions'

type Partial = { [K in keyof WizardAnswers]?: WizardAnswers[K] }

export default function Wizard() {
  const [step, setStep] = useState(0)
  const [a, setA] = useState<Partial>({ logs: [] })
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const total = WIZARD_QUESTIONS.length
  const done = step >= total
  const q = WIZARD_QUESTIONS[Math.min(step, total - 1)]
  const multi = 'multi' in q && q.multi
  const val = a[q.key as keyof WizardAnswers]
  const answered = multi ? true : val !== undefined
  const pick = (v: string) => {
    if (multi) { const cur = (a.logs ?? []) as string[]; setA({ ...a, logs: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]) as WizardAnswers['logs'] }) }
    else { setA({ ...a, [q.key]: v }); setTimeout(() => setStep((s) => s + 1), 180) }
  }
  const result = done ? wizardDesign(a as WizardAnswers) : null
  const apply = () => start(async () => {
    const r = await applyWizardAction(a).catch(() => null)
    if (!r?.ok) { setMsg(r && !r.ok ? r.error : 'Uygulanamadı'); return }
    router.push('/'); router.refresh()
  })
  return (
    <div className="flex flex-col gap-3" data-testid="wizard">
      <div className="flex gap-1.5 px-1" aria-label={`Adım ${Math.min(step + 1, total)} / ${total}`}>
        {WIZARD_QUESTIONS.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step || done ? 'bg-acc' : i === step ? 'bg-acc/50' : 'bg-surface-3'}`} />)}
      </div>
      {!done ? (
        <section className="card p-4 flex flex-col gap-3" aria-label={q.q} data-wizard-step={step}>
          <span className="text-[12px] font-bold text-mute tracking-[0.06em] uppercase">Soru {step + 1} / {total}</span>
          <h2 className="text-[19px] font-extrabold leading-snug">{q.q}</h2>
          {multi ? <span className="text-[12.5px] text-mute -mt-2">Birden çok seçebilirsin; seçtiğin sıra önem sırası olur.</span> : null}
          <div role={multi ? 'group' : 'radiogroup'} aria-label={q.q} className="flex flex-col gap-2">
            {q.options.map(([v, label]) => {
              const on = multi ? ((a.logs ?? []) as string[]).includes(v) : val === v
              const rank = multi && on ? ((a.logs ?? []) as string[]).indexOf(v) + 1 : 0
              return (
                <button key={v} type="button" role={multi ? undefined : 'radio'} aria-checked={multi ? undefined : on} aria-pressed={multi ? on : undefined} onClick={() => pick(v)}
                  className={`min-h-[56px] px-4 rounded-[18px] border text-left font-bold text-[15px] flex items-center justify-between gap-3 ${on ? 'bg-acc text-acc-ink border-acc' : 'bg-surface-2 border-line'}`}>
                  {label}
                  {on ? <span className="w-7 h-7 rounded-full bg-acc-ink/15 flex items-center justify-center text-[13px]">{rank || <Check size={15} />}</span> : null}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2 pt-1">
            {step > 0 ? <button type="button" onClick={() => setStep(step - 1)} className="h-12 px-5 rounded-full border border-line-2 font-bold text-[14px]">Geri</button> : null}
            {multi ? <button type="button" disabled={!answered} onClick={() => setStep(step + 1)} className="flex-1 h-12 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40" data-testid="wizard-next">{(a.logs ?? []).length ? 'Devam' : 'Hiçbiri, devam'}</button> : null}
          </div>
        </section>
      ) : result ? (
        <section className="card p-4 flex flex-col gap-3" aria-label="Önizleme" data-testid="wizard-preview">
          <h2 className="text-[19px] font-extrabold">Senin için hazırladığımız düzen</h2>
          <ul className="flex flex-col gap-1.5 text-[13.5px] text-ink-2">
            {result.summary.map((s) => <li key={s} className="flex gap-2"><Check size={15} className="text-acc shrink-0 mt-0.5" />{s}</li>)}
          </ul>
          <div className="rounded-[18px] bg-surface-2 p-3 flex flex-col gap-1.5" aria-label="Bugün ekranı sırası">
            <span className="text-[12px] font-bold text-mute">BUGÜN EKRANI</span>
            <ol className="grid grid-cols-2 gap-1.5 text-[12.5px] font-bold">
              {result.today.map((i, n) => { const d = cardDef(i.id)!; return <li key={i.id} className={`rounded-lg px-2 py-1.5 bg-surface ${d.size === 'full' ? 'col-span-2' : ''}`}><span className="text-mute mr-1">{n + 1}.</span>{d.title}</li> })}
            </ol>
          </div>
          <p className="text-[12px] text-mute leading-snug">Diğer ekranların düzeni ve kendi kuralların korunur. Sonra istediğin gibi değiştirebilirsin.</p>
          {msg ? <p role="status" className="text-[13px] text-danger">{msg}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(total - 1)} className="h-12 px-5 rounded-full border border-line-2 font-bold text-[14px]">Geri</button>
            <button type="button" disabled={pending} onClick={apply} className="flex-1 h-12 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40" data-testid="wizard-apply">{pending ? 'Uygulanıyor…' : 'Uygula'}</button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
