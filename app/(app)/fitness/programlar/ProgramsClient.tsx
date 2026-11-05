'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn, Eyebrow } from '@/components/ui'
import { EQUIPMENT, MUSCLES } from '@/lib/exercise-labels'
import { ALL_EQUIPMENT } from '@/lib/programs'
import { copyProgramAction, createAiProgramAction, createEmptyProgramAction, createFromTemplateAction, createGeneratedAction, deleteProgramAction, setActiveProgramAction } from '../actions'

type R = { ok: true; id?: string } | { ok: false; error: string }

export function ProgramActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  const go = (fn: () => Promise<R>) => start(async () => { const r = await fn(); if (r.ok) router.refresh() })
  return (
    <div className="flex gap-1">
      {!active ? <button type="button" disabled={pending} className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold" onClick={() => go(() => setActiveProgramAction(id))}>Aktif yap</button> : null}
      <button type="button" disabled={pending} className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold" onClick={() => go(() => copyProgramAction(id))}>Kopyala</button>
      <button type="button" disabled={pending} className="h-9 px-3 rounded-full text-[12px] font-bold text-danger" onClick={() => { if (confirm('Program silinsin mi? Geçmiş antrenmanların korunur.')) go(() => deleteProgramAction(id)) }}>Sil</button>
    </div>
  )
}

const WEAK = ['chest', 'shoulders', 'lats', 'middle back', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals']

export function CreateProgram({ templates, defaults, aiOn }: { templates: { id: string; name: string; description: string; days: number; level: string; dayNames: string[] }[]; defaults: { days: number; minutes: number; equipment: string[] }; aiOn: boolean }) {
  const [weak, setWeak] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [days, setDays] = useState(Math.min(6, Math.max(2, defaults.days)))
  const [minutes, setMinutes] = useState(defaults.minutes)
  const [eq, setEq] = useState<string[]>(defaults.equipment)
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const go = (fn: () => Promise<R>) => start(async () => { setErr(null); const r = await fn(); if (!r.ok) { setErr(r.error); return } if (r.id) router.push(`/fitness/programlar/${r.id}`) })
  return (
    <>
      <section aria-label="Otomatik program" className="card p-5 flex flex-col gap-3">
        <Eyebrow>Benim için oluştur</Eyebrow>
        <p className="text-[13px] text-ink-2 leading-relaxed">Deneyimine, haftalık gün sayına, seans süresine ve ekipmanına göre kurallı bir program yazılır. Hedefin (Fit) dikkate alınır.</p>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold mb-1">Haftada kaç gün?</legend>
          <div className="flex gap-1.5">{[2, 3, 4, 5, 6].map((n) => <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)} className={`flex-1 h-11 rounded-xl font-bold num ${days === n ? 'bg-lime text-lime-ink' : 'bg-surface-2'}`}>{n}</button>)}</div>
        </fieldset>
        <label className="flex flex-col gap-1.5 text-sm font-semibold" htmlFor="gen-min">
          <span className="flex justify-between">Seans süresi <b className="num">{minutes} dk</b></span>
          <input id="gen-min" type="range" min={20} max={120} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="accent-[var(--color-lime)] h-8" />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold mb-1">Ekipman</legend>
          <div className="flex flex-wrap gap-1.5">
            {ALL_EQUIPMENT.map((k) => (
              <button key={k} type="button" aria-pressed={eq.includes(k)} onClick={() => setEq(eq.includes(k) ? eq.filter((x) => x !== k) : [...eq, k])}
                className={`h-9 px-3 rounded-full text-[13px] font-semibold ${eq.includes(k) ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2'}`}>{EQUIPMENT[k] ?? k}</button>
            ))}
          </div>
          <div className="flex gap-2 text-[12px]">
            <button type="button" className="underline text-mute" onClick={() => setEq([...ALL_EQUIPMENT])}>Tam salon</button>
            <button type="button" className="underline text-mute" onClick={() => setEq(['dumbbell', 'body only', 'bands'])}>Evde dumbbell</button>
            <button type="button" className="underline text-mute" onClick={() => setEq(['body only'])}>Yalnızca vücut ağırlığı</button>
          </div>
        </fieldset>
        <button type="button" className={btn.primary} disabled={pending || !eq.length} onClick={() => go(() => createGeneratedAction({ days, minutes, equipment: eq as never }))}>{pending ? 'Oluşturuluyor…' : 'Programı oluştur'}</button>
        {aiOn ? (
          <div className="flex flex-col gap-2 pt-2 border-t border-line" data-testid="ai-program">
            <span className="text-sm font-semibold">AI ile kişisel program</span>
            <span className="text-[12px] text-mute">Zayıf bölgelerini seç; dil modeli kütüphaneden hareket seçer, kurallar set/tekrar ve haftalık hacmi denetler. Günlük AI hakkından 1 düşer.</span>
            <div className="flex flex-wrap gap-1.5">{WEAK.map((k) => (
              <button key={k} type="button" aria-pressed={weak.includes(k)} onClick={() => setWeak(weak.includes(k) ? weak.filter((x) => x !== k) : weak.length < 4 ? [...weak, k] : weak)}
                className={`h-9 px-3 rounded-full text-[13px] font-semibold ${weak.includes(k) ? 'bg-lime text-lime-ink' : 'bg-surface-2 text-ink-2'}`}>{MUSCLES[k]}</button>
            ))}</div>
            <label htmlFor="ai-prog-note" className="sr-only">Not</label>
            <input id="ai-prog-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not (ör: dizimde hassasiyet var, squat yerine leg press)" className="h-11 rounded-xl bg-surface-2 border border-line px-3 text-[14px]" />
            <button type="button" className={btn.secondary + ' h-12'} disabled={pending || aiBusy || !eq.length} onClick={() => start(async () => {
              setErr(null); setAiBusy(true)
              const r = await createAiProgramAction({ days, minutes, equipment: eq as never, weak, note })
              setAiBusy(false)
              if (!r.ok) { setErr(r.error); return }
              router.push(`/fitness/programlar/${r.id}`)
            })}>{aiBusy ? 'AI program yazıyor…' : 'AI ile oluştur'}</button>
          </div>
        ) : null}
        {err ? <p role="alert" className="text-[13px] text-danger">{err}</p> : null}
      </section>

      <section aria-label="Hazır şablonlar" className="card p-5 flex flex-col gap-2">
        <Eyebrow>Hazır şablonlar</Eyebrow>
        {templates.map((t) => (
          <div key={t.id} className="rounded-2xl bg-surface-2 px-4 py-3 flex flex-col gap-1.5">
            <div className="flex justify-between items-center gap-2">
              <span className="font-bold">{t.name}</span>
              <span className="text-[11px] text-mute">{t.level} · haftada {t.days}</span>
            </div>
            <p className="text-[13px] text-ink-2 leading-relaxed">{t.description}</p>
            <p className="text-[12px] text-mute">{t.dayNames.join(' · ')}</p>
            <button type="button" disabled={pending} className="self-start h-9 px-4 rounded-full border border-line-2 text-[13px] font-bold" onClick={() => go(() => createFromTemplateAction(t.id))}>Bu şablonu kullan</button>
          </div>
        ))}
      </section>

      <section aria-label="Boş program" className="card p-5 flex flex-col gap-2">
        <Eyebrow>Boş program</Eyebrow>
        <div className="flex gap-2">
          <label htmlFor="empty-name" className="sr-only">Program adı</label>
          <input id="empty-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="Program adı" className="flex-1 h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink" />
          <button type="button" className={btn.secondary + ' h-12'} disabled={pending || !name.trim()} onClick={() => go(() => createEmptyProgramAction(name))}>Oluştur</button>
        </div>
      </section>
    </>
  )
}
