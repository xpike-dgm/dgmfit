'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import BarLoad from '@/components/BarLoad'
import BackButton from '@/components/BackButton'
import { btn } from '@/components/ui'
import { Back, Check, Clock, Flame } from '@/components/icons'
import { ATTEMPT_REST, FELT, adjustAfter, prPlan, prResult, type Felt, type PrStep } from '@/lib/pr-attempt'
import type { PlateImages } from '@/lib/licensed'
import { ExercisePicker } from '../antrenman/LiveWorkout'
import { saveWorkoutAction } from '../actions'

// Faz 5h-6: rekor denemesi — hedef + bar → ısınma basamakları ve 3 deneme; ağır setlerden sonra "nasıl hissettirdi?"
// yanıtı sonraki denemeyi ayarlar (lib/pr-attempt.ts). Durum yerelde saklanır (sayfa yenilense de sürer).
type Ex = { id: number; name: string; kind: string; thumb: string | null; best: number | null; e1rm: number | null }
type Gym = { barKg: number; plates: number[]; increment: number }
type Log = { kg: number; felt: Felt | null; at: string } | null
type Run = { v: 1; exId: number; name: string; target: number; bar: number; steps: PrStep[]; log: Log[]; i: number; restEndsAt: number | null; startedAt: string; clientId: string }
const KEY = 'dgfit:pr:v1'
const fmt = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',')
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`
const num = (s: string) => Number(s.replace(',', '.'))
const read = (): Run | null => { try { const r = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return r?.v === 1 ? r : null } catch { return null } }
const write = (r: Run | null) => { try { if (r) localStorage.setItem(KEY, JSON.stringify(r)); else localStorage.removeItem(KEY) } catch { /* */ } }
const stepLabel = (s: PrStep, steps: PrStep[]) => `${s.kind === 'warmup' ? 'Isınma' : 'Deneme'} ${s.n}/${steps.filter((x) => x.kind === s.kind).length}`

export default function PrAttempt({ ex, gym, images }: { ex: Ex | null; gym: Gym; images: PlateImages | null }) {
  const router = useRouter()
  const [run, setRun] = useState<Run | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [felt, setFelt] = useState(false)
  const [quit, setQuit] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { const r = read(); if (r && (!ex || r.exId === ex.id)) setRun(r); setLoaded(true) }, [ex])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [])
  const save = (r: Run | null) => { setRun(r); write(r) }

  if (!loaded) return <p className="p-6 text-mute">Hazırlanıyor…</p>
  if (!run && !ex) return <PickExercise />
  if (!run) return <Form ex={ex!} gym={gym} images={images} onStart={(target, bar) => save({ v: 1, exId: ex!.id, name: ex!.name, target, bar, steps: prPlan(target, bar, gym.increment), log: [], i: 0, restEndsAt: null, startedAt: new Date().toISOString(), clientId: crypto.randomUUID() })} />

  const s = run.steps[run.i]
  const finished = run.i >= run.steps.length
  const restLeft = run.restEndsAt ? Math.max(0, Math.ceil((run.restEndsAt - now) / 1000)) : 0

  const complete = (f: Felt | null, skip = false) => {
    const log = [...run.log]; log[run.i] = skip ? null : { kg: s.kg, felt: f, at: new Date().toISOString() }
    const done = run.steps.map((x, j) => ({ x, l: log[j] })).filter((y) => y.x.kind === 'attempt' && y.l).map((y) => ({ kg: y.l!.kg, ok: y.l!.felt !== 'fail' }))
    const steps = f && !skip ? adjustAfter(run.steps, run.i, f, done, run.target, gym.increment) : run.steps
    const next = run.i + 1
    save({ ...run, steps, log, i: next, restEndsAt: next < steps.length && !skip ? Date.now() + s.rest * 1000 : null })
    setFelt(false)
  }

  const res = finished ? prResult(run.steps, run.log, run.target) : null
  const addToLog = async () => {
    if (!res) return
    setSaving(true); setErr(null)
    const at = (i: number) => run.log[i]?.at ?? new Date().toISOString()
    let k = 0
    const sets = run.steps.flatMap((_, i) => (run.log[i] ? [{ ...res.sets[k++], completedAt: at(i), seconds: null, suggestedKg: null, suggestedReps: null, feedback: null }] : []))
    const r = await saveWorkoutAction({ clientId: run.clientId, programDayId: null, name: 'Rekor denemesi', startedAt: run.startedAt, endedAt: new Date().toISOString(), notes: `Hedef ${fmt(run.target)} kg`, pain: false, exercises: [{ exerciseId: run.exId, sets }] })
    setSaving(false)
    if (!r.ok) { setErr(r.error); return }
    write(null); router.push(`/fitness/antrenman/${r.id}?yeni=1`)
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-10 safe-top">
      <header className="flex items-center gap-3 pt-2">
        {finished ? <BackButton fallback="/fitness" className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-ink shrink-0" /> : <button type="button" aria-label="Geri" className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-ink shrink-0" onClick={() => setQuit(true)}><Back size={22} /></button>}
        <span className="flex-1 min-w-0 flex flex-col">
          <b className="text-[19px] leading-tight truncate">Rekor denemesi</b>
          <span className="text-[12.5px] text-mute truncate">{run.name} · hedef {fmt(run.target)} kg</span>
        </span>
      </header>
      <ol className="flex gap-1" aria-label="İlerleme">
        {run.steps.map((x, j) => <li key={j} className={`flex-1 h-1.5 rounded-full ${j < run.i ? (run.log[j]?.felt === 'fail' ? 'bg-danger' : 'bg-[#E53935]') : x.kind === 'attempt' ? 'bg-ink-2/30' : 'bg-surface-3'}`} title={stepLabel(x, run.steps)} />)}
      </ol>

      {finished && res ? (
        <section className="card p-5 flex flex-col gap-3" data-testid="pr-result">
          <span className="flex items-center gap-2 text-[#E53935]"><Flame size={22} /><b className="text-[13px] uppercase tracking-wide">{res.reached ? 'Hedefe ulaştın' : 'Deneme bitti'}</b></span>
          <b className="text-[40px] leading-none num" data-testid="pr-best">{res.best != null ? `${fmt(res.best)} kg` : '—'}</b>
          <p className="text-[14px] text-ink-2 leading-relaxed">{res.text}</p>
          <div className="flex flex-col">
            {run.steps.map((x, j) => (
              <div key={j} className="flex justify-between items-center min-h-9 border-t border-line first:border-0 text-[13.5px]">
                <span className="text-ink-2">{stepLabel(x, run.steps)}</span>
                <span className="num">{run.log[j] ? `${fmt(run.log[j]!.kg)} kg × ${x.reps}${run.log[j]!.felt ? ` · ${FELT.find((f) => f.key === run.log[j]!.felt)!.label}` : ''}` : 'atlandı'}</span>
              </div>
            ))}
          </div>
          {err ? <p role="alert" className="text-[13px] text-danger">{err}</p> : null}
          <button type="button" className="h-14 rounded-2xl bg-[#E53935] text-white font-extrabold text-[17px] disabled:opacity-60" disabled={saving || !res.sets.length} onClick={addToLog}>{saving ? 'Kaydediliyor…' : 'Günlüğe ekle'}</button>
          <button type="button" className={btn.ghost} onClick={() => { write(null); setRun(null) }}>Kaydetmeden kapat</button>
        </section>
      ) : restLeft > 0 ? (
        <section className="card p-6 flex flex-col items-center gap-3 text-center" data-testid="pr-rest">
          <span className="text-[12px] font-bold text-mute uppercase tracking-wide flex items-center gap-1.5"><Clock size={16} />Dinlenme</span>
          <b className="num text-[56px] leading-none">{mmss(restLeft)}</b>
          <span className="text-[14px] text-ink-2">Sonraki: <b>{stepLabel(s, run.steps)} · {fmt(s.kg)} kg × {s.reps}</b></span>
          <p className="text-[12.5px] text-mute">{s.kind === 'attempt' ? 'Denemeden önce tam dinlen; süreyi çok kısaltmak performansı düşürür.' : 'Isınmada kısa dinlenmek yeterli.'}</p>
          <button type="button" className={btn.secondary} onClick={() => save({ ...run, restEndsAt: null })}>Dinlenmeyi bitir</button>
        </section>
      ) : (
        <section className="card p-5 flex flex-col gap-4" data-testid="pr-step" data-kind={s.kind} data-kg={s.kg}>
          <div className="flex items-baseline justify-between gap-2">
            <b className={`text-[13px] uppercase tracking-wide ${s.kind === 'attempt' ? 'text-[#E53935]' : 'text-mute'}`}>{stepLabel(s, run.steps)}</b>
            <span className="text-[12px] text-mute num">hedefin %{Math.round((s.kg / run.target) * 100)}</span>
          </div>
          <div className="flex items-baseline gap-3"><b className="num text-[48px] leading-none" data-testid="pr-kg">{fmt(s.kg)} kg</b><span className="text-[20px] text-ink-2">× {s.reps}</span></div>
          <BarLoad total={s.kg} bar={run.bar} plates={gym.plates} images={images} />
          <button type="button" className="h-14 rounded-2xl bg-[#E53935] text-white font-extrabold text-[17px] flex items-center justify-center gap-2" onClick={() => (s.ask ? setFelt(true) : complete(null))}><Check size={22} />Seti bitir</button>
          {s.kind === 'warmup' ? <button type="button" className={btn.ghost} onClick={() => complete(null, true)}>Bu ısınmayı atla</button> : null}
        </section>
      )}

      <Sheet open={felt} onClose={() => setFelt(false)} title="Bu set nasıl geçti?">
        <div className="flex flex-col gap-2 pb-4" data-testid="pr-felt">
          {FELT.filter((f) => s?.kind === 'attempt' || f.key !== 'fail').map((f) => (
            <button key={f.key} type="button" onClick={() => complete(f.key)} className="min-h-14 rounded-2xl bg-surface-2 px-4 text-left flex flex-col justify-center">
              <b className="text-[15px]">{f.label}</b><span className="text-[12.5px] text-mute">{f.hint}</span>
            </button>
          ))}
          <p className="text-[12px] text-mute px-1">Yanıtına göre sonraki denemenin ağırlığı ayarlanır.</p>
        </div>
      </Sheet>
      <Sheet open={quit} onClose={() => setQuit(false)} title="Rekor denemesini bırak?">
        <div className="flex flex-col gap-2 pb-4">
          <p className="text-[14px] text-ink-2">Şimdi çıkarsan bu deneme silinir. Kaldığın yerden devam etmek için sadece sayfadan çıkman yeterli; ilerlemen saklanır.</p>
          <button type="button" className="h-12 rounded-2xl bg-danger text-white font-bold" onClick={() => { write(null); router.push('/fitness') }}>Denemeyi sil ve çık</button>
          <button type="button" className={btn.secondary} onClick={() => router.push('/fitness')}>Sonra devam et</button>
        </div>
      </Sheet>
      <p className="text-[11.5px] text-mute">Dinlenme denemelerde {ATTEMPT_REST / 60} dk. Ağrı ya da teknik bozulma olursa denemeyi bırak.</p>
    </div>
  )
}

function PickExercise() {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-3 px-4 safe-top">
      <header className="flex items-center gap-3 pt-2"><BackButton fallback="/fitness" className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-ink shrink-0" /><b className="text-[19px]">Rekor denemesi</b></header>
      <p className="text-[14px] text-ink-2">Hangi harekette maksimumunu deneyeceksin?</p>
      <ExercisePicker onPick={(id) => router.push(`/fitness/rekor?ex=${id}`)} />
    </div>
  )
}

function Form({ ex, gym, images, onStart }: { ex: Ex; gym: Gym; images: PlateImages | null; onStart: (target: number, bar: number) => void }) {
  const suggest = ex.e1rm ? Math.round((ex.e1rm * 1.02) / gym.increment) * gym.increment : ex.best ?? 60
  const [kg, setKg] = useState(fmt(suggest))
  const [bar, setBar] = useState(gym.barKg)
  const t = num(kg)
  const ok = Number.isFinite(t) && t > bar && t <= 600
  const bars = [...new Set([gym.barKg, 20, 15, 10])]
  return (
    <div className="flex flex-col gap-4 px-4 pb-10 safe-top">
      <header className="flex items-center gap-3 pt-2"><BackButton fallback="/fitness" className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-ink shrink-0" /><span className="flex flex-col"><b className="text-[19px] leading-tight">Rekor denemesi</b><span className="text-[12.5px] text-mute">{ex.name}</span></span></header>
      <section className="card p-5 flex flex-col gap-4" data-testid="pr-form">
        {ex.thumb ? <img src={ex.thumb} alt="" className="w-full aspect-video object-cover rounded-2xl" /> : null}
        <p className="text-[13px] text-mute">{ex.e1rm ? `Kayıtlarına göre tahmini maksimumun ${fmt(ex.e1rm)} kg${ex.best ? `, en ağır setin ${fmt(ex.best)} kg` : ''}.` : 'Bu hareket için kaydın yok; hedefini kendin gir.'}</p>
        <label htmlFor="pr-target" className="flex items-center justify-between gap-3 text-[15px] font-semibold">Hedef ağırlık
          <span className="flex items-center gap-2"><input id="pr-target" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))} className="w-28 h-12 rounded-xl bg-surface-2 border-2 border-line px-3 num text-xl text-right" /> kg</span>
        </label>
        <fieldset className="flex flex-col gap-2"><legend className="text-[15px] font-semibold mb-2">Bar</legend>
          <div className="grid grid-cols-3 gap-2">
            {bars.map((b) => <button key={b} type="button" aria-pressed={bar === b} onClick={() => setBar(b)} className={`h-12 rounded-xl text-[14px] font-bold ${bar === b ? 'bg-ink text-bg' : 'bg-surface-2'}`}>{fmt(b)} kg</button>)}
          </div>
        </fieldset>
        {ok ? <BarLoad total={t} bar={bar} plates={gym.plates} images={images} /> : <p className="text-[13px] text-danger">Hedef bardan ağır olmalı.</p>}
        <p className="text-[12.5px] text-mute">Plan: bar ve {prPlan(ok ? t : 100, bar, gym.increment).filter((s) => s.kind === 'warmup').length - 1}+ ısınma, ardından 3 deneme. Ağır setlerden sonra nasıl hissettiğini soracağız; ilk deneme hedefin %95'i, sonrakiler yanıtına göre.</p>
        <button type="button" disabled={!ok} className="h-14 rounded-2xl bg-[#E53935] text-white font-extrabold text-[17px] disabled:opacity-50" onClick={() => onStart(t, bar)}>Başla</button>
      </section>
    </div>
  )
}
