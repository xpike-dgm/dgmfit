'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { EQUIPMENT, MUSCLES } from '@/lib/exercise-labels'
import { ALL_EQUIPMENT } from '@/lib/programs'
import { copyProgramAction, createAiProgramAction, createEmptyProgramAction, createFromAgProgramAction, createFromTemplateAction, createGeneratedAction, deleteProgramAction, setActiveProgramAction } from '../actions'

type R = { ok: true; id?: string } | { ok: false; error: string }

export function ProgramActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  const [err, setErr] = useState<string | null>(null)
  const go = (fn: () => Promise<R>) => start(async () => {
    setErr(null)
    try { const r = await fn(); if (r.ok) router.refresh(); else setErr(r.error) } catch { setErr('Bağlantı yok; tekrar dene.') }
  })
  return (
    <div className="flex gap-1 flex-wrap items-center">
      {err ? <p role="alert" className="basis-full text-[12px] text-danger order-last">{err}</p> : null}
      {!active ? <button type="button" disabled={pending} className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold" onClick={() => go(() => setActiveProgramAction(id))}>Aktif yap</button> : null}
      <button type="button" disabled={pending} className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold" onClick={() => go(() => copyProgramAction(id))}>Kopyala</button>
      <button type="button" disabled={pending} className="h-9 px-3 rounded-full text-[12px] font-bold text-danger" onClick={() => { if (confirm('Program silinsin mi? Geçmiş antrenmanların korunur.')) go(() => deleteProgramAction(id)) }}>Sil</button>
    </div>
  )
}

const WEAK = ['chest', 'shoulders', 'lats', 'middle back', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals']

/** Çalışma ortamı → o ortamda anlamlı ekipmanlar (ilk açılır menü seçilmeden ikinci pasif). */
const ENVS: Record<string, { label: string; eq: readonly string[] }> = {
  gym: { label: 'Tam salon', eq: ALL_EQUIPMENT },
  home: { label: 'Evde (dumbbell)', eq: ['dumbbell', 'kettlebells', 'bands', 'body only'] },
  body: { label: 'Yalnızca vücut ağırlığı', eq: ['body only', 'bands'] },
}

export function GenerateForm({ defaults, aiOn }: { defaults: { days: number; minutes: number }; aiOn: boolean }) {
  const [weak, setWeak] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [days, setDays] = useState(Math.min(6, Math.max(2, defaults.days)))
  const [minutes, setMinutes] = useState(defaults.minutes)
  const [env, setEnv] = useState<string>('')
  const [eq, setEq] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const go = (fn: () => Promise<R>) => start(async () => { setErr(null); const r = await fn(); if (!r.ok) { setErr(r.error); return } if (r.id) router.push(`/fitness/programlar/${r.id}`) })
  const options = env ? ENVS[env].eq : []
  return (
    <section aria-label="Otomatik program" className="card p-5 flex flex-col gap-4">
      <p className="text-[13px] text-ink-2 leading-relaxed">Deneyimine, haftalık gün sayına, seans süresine ve ekipmanına göre kurallı bir program yazılır. Hedefin (Fit) dikkate alınır.</p>
      <label htmlFor="gen-env" className="flex flex-col gap-1.5 text-sm font-semibold">Nerede çalışacaksın?
        <select id="gen-env" value={env} onChange={(e) => { const v = e.target.value; setEnv(v); setEq(v ? [...ENVS[v].eq] : []) }}
          className="h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink font-normal">
          <option value="">Seç…</option>
          {Object.entries(ENVS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </label>
      <details className={`rounded-xl border border-line ${env ? '' : 'opacity-50 pointer-events-none'}`} aria-disabled={!env} data-testid="gen-equipment">
        <summary className="list-none cursor-pointer flex items-center justify-between min-h-12 px-3 text-sm font-semibold">
          <span>Ekipman</span>
          <span className="text-mute font-normal">{env ? `${eq.length} / ${options.length} seçili` : 'Önce ortamı seç'} ▾</span>
        </summary>
        <div className="flex flex-col px-3 pb-2">
          {options.map((k) => (
            <label key={k} className="flex items-center justify-between min-h-11 border-t border-line text-[14px]">
              {EQUIPMENT[k] ?? k}
              <input type="checkbox" className="w-5 h-5" checked={eq.includes(k)} onChange={(e) => setEq(e.target.checked ? [...eq, k] : eq.filter((x) => x !== k))} />
            </label>
          ))}
        </div>
      </details>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold mb-1">Haftada kaç gün?</legend>
        <div className="flex gap-1.5">{[2, 3, 4, 5, 6].map((n) => <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)} className={`flex-1 h-11 rounded-xl font-bold num ${days === n ? 'bg-acc text-acc-ink' : 'bg-surface-2'}`}>{n}</button>)}</div>
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-semibold" htmlFor="gen-min">
        <span className="flex justify-between">Seans süresi <b className="num">{minutes} dk</b></span>
        <input id="gen-min" type="range" min={20} max={120} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="h-8" />
      </label>
      <fieldset className="flex flex-col gap-2" data-testid="gen-priority">
        <legend className="text-sm font-semibold mb-1">Öncelikli bölgeler <span className="text-mute font-normal">(isteğe bağlı, en fazla 4)</span></legend>
        <div className="flex flex-wrap gap-1.5">{WEAK.map((k) => (
          <button key={k} type="button" aria-pressed={weak.includes(k)} onClick={() => setWeak(weak.includes(k) ? weak.filter((x) => x !== k) : weak.length < 4 ? [...weak, k] : weak)}
            className={`h-9 px-3 rounded-full text-[13px] font-semibold ${weak.includes(k) ? 'bg-acc text-acc-ink' : 'bg-surface-2 text-ink-2'}`}>{MUSCLES[k]}</button>
        ))}</div>
        <span className="text-[12px] text-mute">Seçtiğin bölgelere ek set verilir ve gün içinde öne alınır; haftalık set sayısı program notunda yazar.</span>
      </fieldset>
      <button type="button" className={btn.primary} disabled={pending || !eq.length} onClick={() => go(() => createGeneratedAction({ days, minutes, equipment: eq as never, priority: weak as never }))}>{pending ? 'Oluşturuluyor…' : 'Programı oluştur'}</button>
      {aiOn ? (
        <div className="flex flex-col gap-2 pt-3 border-t border-line" data-testid="ai-program">
          <span className="text-sm font-semibold">AI ile kişisel program</span>
          <span className="text-[12px] text-mute">Dil modeli kütüphaneden hareket seçer (yukarıdaki öncelikli bölgeler dahil), kurallar set/tekrar ve haftalık hacmi denetler. Günlük AI hakkından 1 düşer.</span>
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
  )
}

export function UseTemplate({ id }: { id: string }) {
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <>
      <button type="button" disabled={pending} className={btn.primary} onClick={() => start(async () => { setErr(null); const r = id.startsWith('ag-') ? await createFromAgProgramAction(id) : await createFromTemplateAction(id); if (!r.ok) { setErr(r.error); return } router.push(`/fitness/programlar/${r.id}`) })}>{pending ? 'Oluşturuluyor…' : 'Bu şablonu kullan'}</button>
      {err ? <p role="alert" className="text-[13px] text-danger">{err}</p> : null}
    </>
  )
}

export function EmptyForm() {
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <form className="card p-5 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); start(async () => { setErr(null); const r = await createEmptyProgramAction(name); if (!r.ok) { setErr(r.error); return } router.push(`/fitness/programlar/${r.id}`) }) }}>
      <label htmlFor="empty-name" className="flex flex-col gap-1.5 text-sm font-semibold">Program adı
        <input id="empty-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="Ör. Benim itme-çekme programım" className="h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink font-normal" />
      </label>
      <p className="text-[13px] text-mute leading-relaxed">Oluşturduktan sonra günlerini ekleyip her güne hareket seçersin; set, tekrar ve dinlenmeyi kendin belirlersin.</p>
      <button type="submit" className={btn.primary} disabled={pending || !name.trim()}>Oluştur</button>
      {err ? <p role="alert" className="text-[13px] text-danger">{err}</p> : null}
    </form>
  )
}
