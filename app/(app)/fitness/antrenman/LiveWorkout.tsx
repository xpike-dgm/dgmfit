'use client'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import { btn } from '@/components/ui'
import { Check, Clock, Dots, Info, Plus, Trash } from '@/components/icons'
import { platesFor, roundTo, SET_TYPES, setVolume, strengthKcal, suggestNext, warmupSets, type ExKind, type LoggedSet, type SetType, type Suggestion } from '@/lib/training'
import type { LiveExercise } from '@/lib/fitness-data'
import { alternativesAction, liveExerciseAction, saveWorkoutAction } from '../actions'
import { LIVE_KEY, queuePending, readJson, writeJson } from '../live-store'
import { EQUIPMENT } from '@/lib/exercise-labels'

type LSet = { kg: string; reps: string; rir: number | null; type: SetType; seconds: string; done: boolean; completedAt: string | null; feedback: string | null; ph: { kg: number; reps: number; seconds: number } }
type LEx = Omit<LiveExercise, 'sets'> & { targetSets: number; sets: LSet[]; suggestion: Suggestion | null }
type Draft = { v: 1; clientId: string; programDayId: string | null; name: string; startedAt: string; exercises: LEx[]; notes: string; pain: boolean; restEndsAt: number | null; restTotal: number; restFor: string; restPush?: boolean }
interface Props { name: string; programDayId: string | null; bodyKg: number; deficitKcal: number; gym: { barKg: number; plates: number[]; increment: number }; exercises: LiveExercise[]; week?: number | null; fuel?: string | null }

const TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'drop', 'failure', 'amrap', 'restpause', 'myorep', 'superset', 'giant']
const n = (s: string) => { const v = Number(String(s).replace(',', '.')); return Number.isFinite(v) ? v : NaN }
const fmt = (v: number) => (Math.round(v * 100) / 100).toLocaleString('tr-TR')
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec % 60)).padStart(2, '0')}`

function buildExercise(e: LiveExercise, inc: number, deficitKcal: number): LEx {
  if (e.scheme?.sets.length) {
    // GZCLP: ağırlık ve tekrar kademeden gelir, son set AMRAP
    const sets: LSet[] = e.scheme.sets.map((x) => ({ kg: '', reps: '', seconds: '', rir: null, type: x.amrap ? 'amrap' : 'normal', done: false, completedAt: null, feedback: null, ph: { kg: x.kg, reps: x.reps, seconds: 0 } }))
    const { sets: _t, ...rest } = e
    return { ...rest, targetSets: sets.length, sets, suggestion: null }
  }
  let suggestion = suggestNext({ history: e.history, target: { repMin: e.repMin, repMax: e.repMax, rir: e.rir }, kind: e.kind, increment: inc, deficitKcal, feedback: e.feedback })
  if (suggestion && e.period && e.period.loadPct < 1 && e.kind === 'weight_reps') suggestion = { ...suggestion, kg: roundTo(suggestion.kg * e.period.loadPct, inc, 'down'), reason: suggestion.reason + ' Deload haftası: ağırlık %90.' }
  const last = e.history.at(-1)?.sets.filter((s) => s.type !== 'warmup') ?? []
  const sets: LSet[] = Array.from({ length: e.sets }, (_, i) => {
    const l = last[i] ?? last.at(-1)
    return {
      kg: '', reps: '', seconds: '', rir: e.kind === 'time' || e.kind === 'distance_time' ? null : e.rir, type: e.setType, done: false, completedAt: null, feedback: null,
      ph: { kg: suggestion?.kg ?? l?.kg ?? 0, reps: suggestion?.reps ?? l?.reps ?? e.repMin, seconds: e.seconds ?? l?.seconds ?? 45 },
    }
  })
  const { sets: _t, ...rest } = e
  return { ...rest, targetSets: e.sets, sets, suggestion }
}

export default function LiveWorkout(p: Props) {
  const router = useRouter()
  const [d, setD] = useState<Draft | null>(null)
  const [resumed, setResumed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [sheet, setSheet] = useState<null | { kind: 'plates' | 'reject' | 'menu' | 'alts'; ex: number } | { kind: 'add' } | { kind: 'finish' } | { kind: 'discard' }>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const audio = useRef<AudioContext | null>(null)
  const restFired = useRef<number | null>(null)

  // taslak: aynı program günü için 8 saatten yeni taslak varsa kaldığı yerden devam
  useEffect(() => {
    const saved = readJson<Draft>(LIVE_KEY)
    if (saved?.v === 1 && saved.programDayId === p.programDayId && Date.now() - Date.parse(saved.startedAt) < 8 * 3600_000) { setD(saved); setResumed(true); return }
    setD({
      v: 1, clientId: crypto.randomUUID(), programDayId: p.programDayId, name: p.name, startedAt: new Date().toISOString(),
      exercises: p.exercises.map((e) => buildExercise(e, p.gym.increment, p.deficitKcal)), notes: '', pain: false, restEndsAt: null, restTotal: 0, restFor: '',
    })
  }, [p])
  useEffect(() => { if (d) writeJson(LIVE_KEY, d) }, [d])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  // ekran kilitlenmesin (Wake Lock); sekme geri gelince yeniden iste
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const req = async () => { try { lock = await (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null } catch { lock = null } }
    const vis = () => { if (document.visibilityState === 'visible') void req() }
    void req(); document.addEventListener('visibilitychange', vis)
    return () => { document.removeEventListener('visibilitychange', vis); void lock?.release().catch(() => {}) }
  }, [])

  const restLeft = d?.restEndsAt ? Math.max(0, Math.ceil((d.restEndsAt - now) / 1000)) : 0
  useEffect(() => {
    if (!d?.restEndsAt || restLeft > 0 || restFired.current === d.restEndsAt) return
    restFired.current = d.restEndsAt
    try { navigator.vibrate?.([250, 120, 250]) } catch { /* */ }
    try {
      const a = audio.current
      if (a) { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.35) }
    } catch { /* */ }
    if (!d.restPush && document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
      void navigator.serviceWorker?.getRegistration().then((r) => r?.showNotification('Dinlenme bitti', { body: d.restFor ? `Sıradaki: ${d.restFor}` : 'Sıradaki sete geç', tag: 'dgfit-rest' }))
    }
  }, [restLeft, d])

  const update = useCallback((fn: (x: Draft) => Draft) => setD((x) => (x ? fn(structuredClone(x)) : x)), [])
  // kilit ekranı: dinlenme bitişinde sunucudan push (bildirim izni ve abonelik varsa)
  const pushRest = (seconds: number, next: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    void fetch('/api/push/rest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seconds, next, url: location.pathname + location.search }) })
      .then((r) => r.json()).then((j) => { if (j.scheduled) update((x) => { x.restPush = true; return x }) }).catch(() => {})
  }
  const cancelPush = () => { if (d?.restPush) { void fetch('/api/push/rest', { method: 'DELETE' }).catch(() => {}); update((x) => { x.restPush = false; return x }) } }
  const [alts, setAlts] = useState<{ id: number; nameTr: string; equipment: string }[] | null>(null)
  const stats = useMemo(() => {
    if (!d) return { volume: 0, sets: 0, kcal: 0, min: 0 }
    let volume = 0, sets = 0
    for (const e of d.exercises) for (const s of e.sets) if (s.done) { const ls = toLogged(s, e.kind); volume += setVolume(ls, e.kind, p.bodyKg); if (s.type !== 'warmup') sets++ }
    const min = Math.max(0, (now - Date.parse(d.startedAt)) / 60000)
    return { volume: Math.round(volume), sets, kcal: strengthKcal(min, p.bodyKg, sets).net, min }
  }, [d, now, p.bodyKg])

  if (!d) return <p className="p-6 text-mute">Hazırlanıyor…</p>

  const complete = (ei: number, si: number) => {
    if (!audio.current) { try { audio.current = new AudioContext() } catch { /* */ } }
    const s0 = d.exercises[ei].sets[si], k0 = d.exercises[ei].kind
    if (!s0.done && k0 === 'weight_reps' && s0.kg === '' && !(s0.ph.kg > 0)) { setMsg(`${d.exercises[ei].name}: önce ağırlığı gir (geçmiş kayıt yok).`); return }
    setMsg(null)
    update((x) => {
      const e = x.exercises[ei], s = e.sets[si]
      if (s.done) { s.done = false; s.completedAt = null; return x }
      if (s.kg === '' && e.kind !== 'time' && e.kind !== 'distance_time') s.kg = String(s.ph.kg)
      if (s.reps === '' && e.kind !== 'time' && e.kind !== 'distance_time') s.reps = String(s.ph.reps)
      if (s.seconds === '' && (e.kind === 'time' || e.kind === 'distance_time')) s.seconds = String(s.ph.seconds)
      s.done = true; s.completedAt = new Date().toISOString()
      // sonraki setlerin gri değerleri az önce yapılanı izler
      for (const t of e.sets.slice(si + 1)) if (!t.done && t.type === s.type) { t.ph = { kg: n(s.kg) || t.ph.kg, reps: n(s.reps) || t.ph.reps, seconds: n(s.seconds) || t.ph.seconds } }
      const nextSet = e.sets.find((t) => !t.done)
      const nextEx = nextSet ? e : x.exercises.slice(ei + 1).find((y) => y.sets.some((t) => !t.done))
      const rest = s.type === 'warmup' ? Math.min(60, e.rest) : e.rest
      x.restEndsAt = Date.now() + rest * 1000; x.restTotal = rest; x.restFor = nextEx ? nextEx.name : ''; x.restPush = false
      return x
    })
    const e0 = d.exercises[ei]
    if (!s0.done) pushRest(s0.type === 'warmup' ? Math.min(60, e0.rest) : e0.rest, e0.sets.some((t, i) => i !== si && !t.done) ? e0.name : (d.exercises.slice(ei + 1).find((y) => y.sets.some((t) => !t.done))?.name ?? ''))
  }

  const finish = async () => {
    setSaving(true); setMsg(null)
    const payload = {
      clientId: d.clientId, programDayId: d.programDayId, name: d.name, startedAt: d.startedAt, endedAt: new Date().toISOString(), notes: d.notes.trim() || null, pain: d.pain,
      exercises: d.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets.filter((s) => s.done).map((s) => {
          const l = toLogged(s, e.kind)
          return { ...l, seconds: l.seconds ?? null, distanceM: null, completedAt: s.completedAt!, suggestedKg: e.suggestion?.kg ?? null, suggestedReps: e.suggestion?.reps ?? null, feedback: s.feedback as 'too_heavy' | 'too_light' | 'no_equipment' | null }
        }),
      })).filter((e) => e.sets.length),
    }
    if (!payload.exercises.length) { setSaving(false); setMsg('Bitirmek için en az bir set tamamla.'); return }
    try {
      const r = await saveWorkoutAction(payload)
      if (!r.ok) { setSaving(false); setMsg(r.error); return }
      writeJson(LIVE_KEY, null)
      router.push(`/fitness/antrenman/${r.id}?yeni=1`)
    } catch {
      queuePending(payload); writeJson(LIVE_KEY, null); setSaving(false)
      setMsg('Bağlantı yok: antrenman telefona kaydedildi, bağlantı gelince otomatik gönderilecek.')
      setTimeout(() => router.push('/fitness'), 2500)
    }
  }

  const cur = sheet && 'ex' in sheet ? d.exercises[sheet.ex] : null
  return (
    <div className="flex flex-col gap-3 px-4 pb-40">
      <header className="sticky top-0 z-20 -mx-4 px-4 safe-top pb-3 bg-surface/95 backdrop-blur flex flex-col gap-2 border-b border-line">
        <div className="flex items-center justify-between gap-2">
          <span className="flex flex-col min-w-0">
            <span className="text-[18px] font-extrabold truncate">{d.name}</span>
            {resumed ? <span className="text-[12px] text-acc">Kaldığın yerden devam ediyorsun</span> : p.week ? <span className="text-[12px] text-mute">Programın {p.week}. haftası</span> : null}
          </span>
          <button type="button" className={`${btn.primary} h-11 text-[15px] px-5`} onClick={() => setSheet({ kind: 'finish' })}>Bitir</button>
        </div>
        {msg ? <p role="status" className="text-[13px] text-orange">{msg}</p> : null}
        {p.fuel && !resumed ? <p className="text-[12px] text-ink-2 rounded-xl bg-surface-2 px-3 py-2" data-testid="fuel">{p.fuel}</p> : null}
        <div className="grid grid-cols-4 gap-2 text-center" data-testid="live-stats">
          <Stat label="Süre" value={mmss(Math.floor(stats.min * 60))} />
          <Stat label="Hacim" value={`${fmt(stats.volume)} kg`} />
          <Stat label="Set" value={String(stats.sets)} />
          <Stat label="Kalori" value={`${stats.kcal}`} />
        </div>
      </header>

      {d.exercises.map((e, ei) => (
        <section key={e.exerciseId + '-' + ei} className="card p-4 flex flex-col gap-3" aria-label={e.name} data-testid="live-exercise">
          <div className="flex items-start justify-between gap-2">
            <span className="flex flex-col min-w-0">
              <span className="font-extrabold text-[17px] leading-snug">{e.name}</span>
              <span className="text-[12px] text-mute">Hedef {e.targetSets} × {e.kind === 'time' ? `${e.seconds ?? 45} sn` : e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}{e.kind === 'time' || e.kind === 'distance_time' ? '' : ` @ RIR ${e.rir}`} · dinlenme {mmss(e.rest)}</span>
            </span>
            <button type="button" className={btn.icon} aria-label={`${e.name} seçenekleri`} onClick={() => setSheet({ kind: 'menu', ex: ei })}><Dots size={20} /></button>
          </div>
          {e.scheme || e.period ? <span className={`self-start text-[12px] font-bold px-2.5 h-7 rounded-full flex items-center ${e.period?.deload ? 'bg-water/20 text-water' : 'bg-surface-2 text-ink-2'}`} data-testid="target-chip">{e.scheme?.label ?? e.period?.label}</span> : null}
          {e.plateau ? <p className="text-[12px] text-orange" data-testid="plateau-note">{e.plateau.weeks} haftadır ilerleme yok. {e.plateau.tip}</p> : null}
          {e.history.length ? <p className="text-[13px] text-mute" data-testid="last-time">Geçen ({e.history.at(-1)!.day.slice(8)}.{e.history.at(-1)!.day.slice(5, 7)}): {lastLine(e)}</p> : <p className="text-[13px] text-mute">İlk kez yapıyorsun: rahat bir ağırlıkla başla, RIR'ı dürüst gir.</p>}
          {e.suggestion ? (
            <div className="rounded-2xl bg-coach border border-coach-line px-3.5 py-3 flex flex-col gap-2" data-testid="suggestion">
              <span className="text-[14px]"><b className="text-acc">Öneri: {e.kind === 'time' ? e.suggestion.reason : `${fmt(e.suggestion.kg)} kg × ${e.suggestion.reps}`}</b> <span className="text-[12px] text-mute">· güven {e.suggestion.confidence}</span></span>
              {e.kind !== 'time' ? <span className="text-[12px] text-ink-2 leading-relaxed">{e.suggestion.reason}</span> : null}
              <div className="flex gap-2">
                <button type="button" className="h-9 px-3 rounded-full bg-acc text-acc-ink text-[13px] font-bold" onClick={() => update((x) => { for (const s of x.exercises[ei].sets) if (!s.done && s.type !== 'warmup') { s.kg = String(e.suggestion!.kg); s.reps = String(e.suggestion!.reps) } return x })}>Öneriyi uygula</button>
                {e.history.length ? <button type="button" className="h-9 px-3 rounded-full border border-line-2 text-[13px] font-bold" onClick={() => update((x) => { const last = e.history.at(-1)!.sets.filter((s) => s.type !== 'warmup'); x.exercises[ei].sets.filter((s) => !s.done && s.type !== 'warmup').forEach((s, i) => { const l = last[i] ?? last.at(-1)!; s.kg = String(l.kg); s.reps = String(l.reps) }); return x })}>Geçen gibi</button> : null}
                <button type="button" className="h-9 px-3 rounded-full text-[13px] font-bold text-mute" onClick={() => setSheet({ kind: 'reject', ex: ei })}>Uygun değil</button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            {e.sets.map((s, si) => (
              <div key={si} className={`grid items-center gap-1.5 ${s.done ? 'opacity-70' : ''}`} style={{ gridTemplateColumns: '34px 1fr 1fr 52px 48px' }} data-testid="set-row">
                <button type="button" aria-label={`Set ${si + 1} türü: ${SET_TYPES[s.type].label}`} onClick={() => update((x) => { const t = x.exercises[ei].sets[si]; t.type = TYPE_CYCLE[(TYPE_CYCLE.indexOf(t.type) + 1) % TYPE_CYCLE.length]; return x })}
                  className={`h-11 rounded-xl text-[13px] font-bold ${s.type === 'normal' ? 'bg-surface-2 text-ink-2' : 'bg-orange/20 text-orange'}`}>{SET_TYPES[s.type].short || si + 1}</button>
                {e.kind === 'time' || e.kind === 'distance_time' ? (
                  <NumField label={`Set ${si + 1} süre (sn)`} unit="sn" value={s.seconds} ph={s.ph.seconds} step={5} onChange={(v) => update((x) => { x.exercises[ei].sets[si].seconds = v; return x })} />
                ) : (
                  <NumField label={`Set ${si + 1} ${e.kind === 'assisted' ? 'destek' : e.kind === 'bodyweight' ? 'ek yük' : 'ağırlık'} (kg)`} unit={e.kind === 'assisted' ? '−kg' : e.kind === 'bodyweight' ? '+kg' : 'kg'} value={s.kg} ph={s.ph.kg} step={p.gym.increment} decimal onChange={(v) => update((x) => { x.exercises[ei].sets[si].kg = v; return x })} />
                )}
                {e.kind === 'time' || e.kind === 'distance_time' ? <span /> : (
                  <NumField label={`Set ${si + 1} tekrar`} unit="tkr" value={s.reps} ph={s.ph.reps} step={1} onChange={(v) => update((x) => { x.exercises[ei].sets[si].reps = v; return x })} />
                )}
                {e.kind === 'time' || e.kind === 'distance_time' ? <span /> : (
                  <button type="button" aria-label={`Set ${si + 1} RIR: ${s.rir ?? 'yok'}`} onClick={() => update((x) => { const t = x.exercises[ei].sets[si]; t.rir = t.rir === null ? 0 : t.rir >= 4 ? null : t.rir + 1; return x })}
                    className="h-11 rounded-xl bg-surface-2 text-[12px] font-bold leading-tight"><span className="block text-[10px] text-mute">RIR</span>{s.rir ?? '–'}</button>
                )}
                <button type="button" aria-label={`Set ${si + 1} ${s.done ? 'geri al' : 'tamamla'}`} onClick={() => complete(ei, si)}
                  className={`h-11 rounded-xl flex items-center justify-center ${s.done ? 'bg-acc text-acc-ink' : 'border border-line-2 text-ink'}`}><Check size={20} /></button>
              </div>
            ))}
          </div>
          <button type="button" className="h-10 rounded-full border border-dashed border-line-2 text-[13px] font-bold text-ink-2 flex items-center justify-center gap-1.5"
            onClick={() => update((x) => { const ex = x.exercises[ei], last = ex.sets.at(-1); ex.sets.push({ kg: '', reps: '', seconds: '', rir: last?.rir ?? ex.rir, type: 'normal', done: false, completedAt: null, feedback: null, ph: last ? { kg: n(last.kg) || last.ph.kg, reps: n(last.reps) || last.ph.reps, seconds: n(last.seconds) || last.ph.seconds } : { kg: 0, reps: ex.repMin, seconds: 45 } }); return x })}>
            <Plus size={16} />Set ekle
          </button>
        </section>
      ))}

      <button type="button" className={btn.secondary} onClick={() => setSheet({ kind: 'add' })}><Plus size={18} />Hareket ekle</button>

      <section className="card p-4 flex flex-col gap-2">
        <label htmlFor="live-notes" className="text-sm font-semibold">Not</label>
        <textarea id="live-notes" rows={2} maxLength={500} value={d.notes} onChange={(ev) => update((x) => { x.notes = ev.target.value; return x })} placeholder="Ör. sol omuz hafif ağrıdı" className="rounded-xl bg-surface-2 border border-line px-3 py-2 text-ink" />
        <label className="flex items-center gap-3 min-h-[44px] text-sm">
          <input type="checkbox" checked={d.pain} onChange={(ev) => update((x) => { x.pain = ev.target.checked; return x })} className="w-5 h-5 accent-[var(--color-orange)]" />
          Ağrı ya da rahatsızlık oldu (sonraki öneriler temkinli olur)
        </label>
        <button type="button" className="text-[13px] text-danger self-start py-2" onClick={() => setSheet({ kind: 'discard' })}>Antrenmanı sil</button>
      </section>

      {d.restEndsAt && restLeft > 0 ? (
        <div role="timer" aria-label="Dinlenme" className="fixed inset-x-0 bottom-[84px] z-30 px-4">
          <div className="max-w-md mx-auto rounded-2xl bg-surface-3 border border-line-2 px-4 py-3 flex items-center gap-3 shadow-lg" data-testid="rest-timer">
            <Clock size={20} className="text-acc" />
            <span className="flex flex-col flex-1 min-w-0">
              <span className="num text-[22px] font-bold leading-none">{mmss(restLeft)}</span>
              <span className="text-[12px] text-mute truncate">{d.restFor ? `Sıradaki: ${d.restFor}` : 'Dinlenme'}</span>
            </span>
            <button type="button" className="h-10 px-3 rounded-full bg-surface-2 text-[13px] font-bold" onClick={() => { const left = Math.max(5, restLeft - 15); update((x) => { x.restEndsAt = Math.max(Date.now(), (x.restEndsAt ?? 0) - 15000); return x }); if (d.restPush) pushRest(left, d.restFor) }}>−15</button>
            <button type="button" className="h-10 px-3 rounded-full bg-surface-2 text-[13px] font-bold" onClick={() => { update((x) => { x.restEndsAt = (x.restEndsAt ?? Date.now()) + 15000; return x }); if (d.restPush) pushRest(restLeft + 15, d.restFor) }}>+15</button>
            <button type="button" className="h-10 px-3 rounded-full bg-acc text-acc-ink text-[13px] font-bold" onClick={() => { cancelPush(); update((x) => { x.restEndsAt = null; return x }) }}>Atla</button>
          </div>
        </div>
      ) : null}

      <Sheet open={sheet?.kind === 'menu'} onClose={() => setSheet(null)} title={cur?.name ?? ''}>
        {cur && sheet && 'ex' in sheet ? (
          <div className="flex flex-col gap-2 pb-4">
            <button type="button" className={btn.secondary} onClick={() => setSheet({ kind: 'plates', ex: sheet.ex })}>Plaka hesapla</button>
            {cur.kind === 'weight_reps' ? <button type="button" className={btn.secondary} onClick={() => { update((x) => { const ex = x.exercises[sheet.ex]; const work = n(ex.sets.find((s) => s.type !== 'warmup')?.kg ?? '') || ex.sets.find((s) => s.type !== 'warmup')?.ph.kg || 0; const ws = warmupSets(work, p.gym.barKg, p.gym.increment); ex.sets = [...ws.map((w) => ({ kg: String(w.kg), reps: String(w.reps), seconds: '', rir: null, type: 'warmup' as SetType, done: false, completedAt: null, feedback: null, ph: { kg: w.kg, reps: w.reps, seconds: 0 } })), ...ex.sets.filter((s) => s.type !== 'warmup' || s.done)]; return x }); setSheet(null) }}>Isınma setleri ekle (%40 / %60 / %80)</button> : null}
            <button type="button" className={btn.secondary} onClick={async () => { setAlts(null); const ex = sheet.ex; setSheet({ kind: 'alts', ex }); const r = await alternativesAction(cur.exerciseId); setAlts(r.ok ? r.list : []) }}>İstasyon dolu: alternatifle değiştir</button>
            <Link href={`/fitness/hareketler/${cur.exerciseId}`} className={btn.secondary}><Info size={18} />Teknik ve geçmiş</Link>
            <button type="button" className={`${btn.ghost} text-danger`} onClick={() => { update((x) => { x.exercises.splice(sheet.ex, 1); return x }); setSheet(null) }}><Trash size={18} />Hareketi çıkar</button>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={sheet?.kind === 'alts'} onClose={() => setSheet(null)} title="Alternatif hareketler">
        {cur && sheet && 'ex' in sheet ? (
          <div className="flex flex-col pb-4" data-testid="alt-list">
            {alts === null ? <p className="text-mute text-sm">Yükleniyor…</p> : alts.length ? alts.map((a) => (
              <button key={a.id} type="button" className="flex justify-between items-center min-h-[52px] text-left border-b border-line last:border-0" onClick={async () => {
                const r = await liveExerciseAction(a.id)
                if (!r.ok) { setMsg(r.error); return }
                const old = d.exercises[sheet.ex]
                // hedefler korunur, yeni hareketin geçmişi ve önerisi gelir; tamamlanmış setler eski harekette kalır
                const nx = buildExercise({ ...r.exercise, sets: old.targetSets, repMin: old.repMin, repMax: old.repMax, rir: old.rir, rest: old.rest }, p.gym.increment, p.deficitKcal)
                update((x) => { const o = x.exercises[sheet.ex]; if (o.sets.some((t) => t.done)) { o.sets = o.sets.filter((t) => t.done); x.exercises.splice(sheet.ex + 1, 0, nx) } else x.exercises[sheet.ex] = nx; return x })
                setSheet(null)
              }}><span className="font-semibold">{a.nameTr}</span><span className="text-[12px] text-mute">{EQUIPMENT[a.equipment] ?? a.equipment}</span></button>
            )) : <p className="text-mute text-sm">Uygun alternatif bulunamadı.</p>}
          </div>
        ) : null}
      </Sheet>

      <Sheet open={sheet?.kind === 'plates'} onClose={() => setSheet(null)} title="Plaka hesaplayıcı">
        {cur ? <PlateCalc initial={n(cur.sets.find((s) => !s.done)?.kg ?? '') || cur.sets.find((s) => !s.done)?.ph.kg || cur.suggestion?.kg || 60} gym={p.gym} /> : null}
      </Sheet>

      <Sheet open={sheet?.kind === 'reject'} onClose={() => setSheet(null)} title="Öneri neden uygun değil?">
        {cur && sheet && 'ex' in sheet ? (
          <div className="flex flex-col gap-2 pb-4">
            {([['too_heavy', 'Çok ağır', -1], ['too_light', 'Çok hafif', 1], ['no_equipment', 'Ekipman yok / dolu', 0]] as const).map(([k, label, dir]) => (
              <button key={k} type="button" className={btn.secondary} onClick={() => { update((x) => { const ex = x.exercises[sheet.ex]; for (const s of ex.sets) if (!s.done) { s.feedback = k; if (dir) s.ph.kg = Math.max(0, Math.round((s.ph.kg + dir * p.gym.increment) * 100) / 100) } return x }); setSheet(null) }}>{label}</button>
            ))}
            <p className="text-[12px] text-mute">Seçimin kaydedilir; tekrarlanırsa motor bu harekette bir kademe {`hafif/ağır`} önerir.</p>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={sheet?.kind === 'add'} onClose={() => setSheet(null)} title="Hareket ekle">
        <ExercisePicker onPick={async (id) => {
          const r = await liveExerciseAction(id)
          if (!r.ok) { setMsg(r.error); return }
          update((x) => { x.exercises.push(buildExercise(r.exercise, p.gym.increment, p.deficitKcal)); return x })
          setSheet(null)
        }} />
      </Sheet>

      <Sheet open={sheet?.kind === 'finish'} onClose={() => setSheet(null)} title="Antrenmanı bitir">
        <div className="flex flex-col gap-3 pb-4">
          <p className="text-[15px] text-ink-2">{Math.round(stats.min)} dk · {stats.sets} çalışma seti · {fmt(stats.volume)} kg hacim · ~{stats.kcal} kcal (net)</p>
          {d.exercises.some((e) => e.sets.some((s) => !s.done)) ? <p className="text-[13px] text-mute">Tamamlanmamış setler kaydedilmez.</p> : null}
          <button type="button" className={btn.primary} disabled={saving} onClick={finish}>{saving ? 'Kaydediliyor…' : 'Kaydet ve özete geç'}</button>
          <button type="button" className={btn.ghost} onClick={() => setSheet(null)}>Devam et</button>
        </div>
      </Sheet>

      <Sheet open={sheet?.kind === 'discard'} onClose={() => setSheet(null)} title="Antrenman silinsin mi?">
        <div className="flex flex-col gap-3 pb-4">
          <p className="text-[14px] text-ink-2">Bu antrenmanda girdiğin setler kaydedilmeden silinir.</p>
          <button type="button" className={`${btn.secondary} text-danger`} onClick={() => { writeJson(LIVE_KEY, null); router.push('/fitness') }}>Sil</button>
          <button type="button" className={btn.ghost} onClick={() => setSheet(null)}>Vazgeç</button>
        </div>
      </Sheet>
    </div>
  )
}

function toLogged(s: LSet, kind: ExKind): LoggedSet {
  const time = kind === 'time' || kind === 'distance_time'
  return { kg: time ? 0 : Math.max(0, n(s.kg) || 0), reps: time ? 1 : Math.max(0, Math.round(n(s.reps) || 0)), rir: s.rir, type: s.type, seconds: time ? Math.max(0, Math.round(n(s.seconds) || 0)) : null }
}

function lastLine(e: LEx) {
  const sets = e.history.at(-1)!.sets.filter((s) => s.type !== 'warmup')
  if (e.kind === 'time') return sets.map((s) => `${s.seconds ?? 0} sn`).join(', ')
  const same = sets.every((s) => s.kg === sets[0].kg && s.reps === sets[0].reps)
  const one = (s: LoggedSet) => `${fmt(s.kg)} kg × ${s.reps}${s.rir !== null && s.rir !== undefined ? ` @ RIR ${s.rir}` : ''}`
  return same ? `${sets.length} × ${one(sets[0])}` : sets.map(one).join(', ')
}

function Stat({ label, value }: { label: string; value: string }) {
  return <span className="flex flex-col rounded-xl bg-surface px-1 py-1.5"><span className="text-[10px] text-mute uppercase tracking-wide">{label}</span><span className="num text-[15px] font-bold">{value}</span></span>
}

function NumField({ label, unit, value, ph, step, decimal, onChange }: { label: string; unit: string; value: string; ph: number; step: number; decimal?: boolean; onChange: (v: string) => void }) {
  const base = n(value)
  const bump = (dir: number) => { const cur = Number.isFinite(base) && value !== '' ? base : ph; onChange(String(Math.max(0, Math.round((cur + dir * step) * 100) / 100))) }
  return (
    <div className="flex items-stretch h-11 rounded-xl bg-surface-2 overflow-hidden">
      <button type="button" aria-label={`${label} azalt`} className="w-8 text-mute text-lg" onClick={() => bump(-1)}>−</button>
      <label className="flex-1 flex flex-col items-center justify-center min-w-0">
        <span className="sr-only">{label}</span>
        <input aria-label={label} inputMode={decimal ? 'decimal' : 'numeric'} value={value} placeholder={fmt(ph)} onChange={(ev) => onChange(ev.target.value.replace(/[^\d.,]/g, '').slice(0, 6))}
          className="w-full bg-transparent text-center num text-[17px] font-bold placeholder:text-faint placeholder:font-semibold outline-none" />
        <span className="text-[9px] text-mute -mt-1">{unit}</span>
      </label>
      <button type="button" aria-label={`${label} artır`} className="w-8 text-mute text-lg" onClick={() => bump(1)}>+</button>
    </div>
  )
}

function PlateCalc({ initial, gym }: { initial: number; gym: { barKg: number; plates: number[]; increment: number } }) {
  const [kg, setKg] = useState(String(initial))
  const r = platesFor(n(kg) || 0, gym.barKg, gym.plates)
  return (
    <div className="flex flex-col gap-3 pb-4" data-testid="plate-calc">
      <label className="flex items-center gap-3 text-sm font-semibold" htmlFor="pc-kg">Toplam
        <input id="pc-kg" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} className="w-28 h-12 rounded-xl bg-surface-2 border border-line px-3 num text-lg text-right" /> kg
      </label>
      <p className="text-[15px]">{r.perSide.length ? <>Her tarafa <b className="num">{r.perSide.map(fmt).join(' + ')}</b> kg</> : 'Yalnızca bar'} <span className="text-mute">(bar {fmt(gym.barKg)} kg)</span></p>
      {r.remainder ? <p className="text-[13px] text-orange">Plakalarınla tam {fmt(n(kg))} kg olmuyor; en yakın {fmt(r.achieved)} kg.</p> : null}
      <div className="flex items-center gap-1 h-20 justify-center" aria-hidden>
        <span className="w-16 h-2 rounded bg-ink-2" />
        {r.perSide.map((pl, i) => <span key={i} className="rounded-sm bg-orange" style={{ width: 8 + Math.min(pl, 25) / 5, height: 20 + pl * 2.2 }} />)}
      </div>
    </div>
  )
}

export function ExercisePicker({ onPick }: { onPick: (id: number) => void | Promise<void> }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<{ id: number; nameTr: string; equipment: string; image: string | null }[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const t = setTimeout(async () => {
      try { const r = await fetch('/api/exercises/search?q=' + encodeURIComponent(q)); if (r.ok) setRes((await r.json()).results) } catch { /* çevrimdışı */ }
    }, 200)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="flex flex-col gap-2 pb-4">
      <label htmlFor="ex-q" className="sr-only">Hareket ara</label>
      <input id="ex-q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hareket ara (ör. bench, squat, barfiks)" className="h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink" />
      <ul className="flex flex-col">
        {res.map((r) => (
          <li key={r.id}>
            <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onPick(r.id) } finally { setBusy(false) } }} className="w-full flex items-center gap-3 min-h-[56px] text-left">
              {r.image ? <img src={r.image} alt="" width={44} height={44} loading="lazy" className="w-11 h-11 rounded-lg object-cover bg-surface-2" /> : <span className="w-11 h-11 rounded-lg bg-surface-2" />}
              <span className="flex flex-col"><span className="font-semibold">{r.nameTr}</span><span className="text-[12px] text-mute">{EQUIPMENT[r.equipment] ?? r.equipment}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
