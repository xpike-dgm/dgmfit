'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import { btn, Eyebrow } from '@/components/ui'
import ExImg from '@/components/ExImg'
import { Dumbbell, EditSquare, Gauge, Play, Plus, Repeat, SetsIcon, Trash } from '@/components/icons'
import { SET_TYPES, type SetType } from '@/lib/training'
import { PERIODIZATION, weekIndex, isDeloadWeek, type Periodization } from '@/lib/progress'
import { gzSets, type GzState } from '@/lib/schemes'
import { addDayAction, addExerciseToDayAction, removeDayAction, removeProgramExerciseAction, setActiveProgramAction, setSchemeKgAction, updateProgramExerciseAction, updateProgramSettingsAction, linkSupersetAction } from '../../actions'
import { supersetBlocks } from '@/lib/supersets'
import { ExercisePicker } from '../../antrenman/LiveWorkout'

type Ex = { id: string; exerciseId: number; name: string; kind: string; thumb?: string | null; images?: string[]; sets: number; repMin: number; repMax: number; rir: number; rest: number; seconds: number | null; setType: string; scheme: string | null; schemeState: GzState | null; superset?: number | null; note?: string | null }
type Day = { id: string; name: string; focus: string; exercises: Ex[] }

export default function ProgramEditor({ program }: { program: { id: string; name: string; active: boolean; notes: string[]; nextDayIdx: number; periodization: string; deloadEvery: number; startDay: string; days: Day[] } }) {
  const [edit, setEdit] = useState<Ex | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [dayName, setDayName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const go = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => { setErr(null); const r = await fn(); if (!r.ok) { setErr(r.error ?? 'Hata'); return } after?.(); router.refresh() })
  const next = program.days.length ? program.nextDayIdx % program.days.length : 0
  const exRow = (e: Ex) => (
            <div key={e.id} className="flex items-center gap-3 py-3 border-b border-line last:border-0" data-testid="program-ex">
              <button type="button" onClick={() => setEdit(e)} className="w-[68px] h-[68px] rounded-2xl overflow-hidden bg-surface-2 shrink-0" aria-hidden tabIndex={-1}>
                {e.thumb ? <img src={e.thumb} alt="" className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                  : e.images?.[0] ? <ExImg src={`/media/exercises/${e.images[0]}`} size={68} className="w-full h-full" /> : <span className="w-full h-full flex items-center justify-center text-mute"><Dumbbell size={22} /></span>}
              </button>
              <button type="button" onClick={() => setEdit(e)} className="flex-1 min-w-0 flex flex-col gap-1 text-left">
                <span className="font-semibold text-[16px] leading-snug line-clamp-2">{e.name}</span>
                {e.scheme ? <span className="num text-[12.5px] text-mute" data-testid="gz-row">{schemeLine(e)}</span>
                  : <span className="num text-[13.5px] text-ink-2 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><SetsIcon size={16} />{e.sets} set</span>
                    <span className="flex items-center gap-1"><Repeat size={16} />{e.seconds ? `${e.seconds} sn` : e.setType === 'amrap' ? 'maks. tekrar' : e.repMin === e.repMax ? `${e.repMin} tekrar` : `${e.repMin}–${e.repMax} tekrar`}</span>
                    {e.seconds ? null : <span className="flex items-center gap-1" title="Tekrar yedeği"><Gauge size={16} />{e.rir.toFixed(1).replace('.', ',')} RiR</span>}
                  </span>}
                {e.note ? <span className="text-[12px] text-mute" data-testid="ex-note">{e.note}</span> : null}
              </button>
              <button type="button" aria-label={`${e.name} düzenle`} onClick={() => setEdit(e)} className="w-11 h-11 rounded-full text-ink flex items-center justify-center shrink-0"><EditSquare size={26} /></button>
              <button type="button" aria-label={`${e.name} sil`} disabled={pending} onClick={() => { if (confirm(`${e.name} bu günden çıkarılsın mı?`)) go(() => removeProgramExerciseAction(e.id)) }} className="w-9 h-9 rounded-full text-danger flex items-center justify-center shrink-0"><Trash size={16} /></button>
            </div>
  )
  return (
    <>
      <section className="card p-5 flex flex-col gap-2">
        <h1 className="text-[22px] font-extrabold leading-tight">{program.name}</h1>
        {program.active ? <span className="text-[13px] text-acc">Aktif program · sıradaki gün: {program.days[next]?.name}</span>
          : <button type="button" className={btn.secondary} disabled={pending} onClick={() => go(() => setActiveProgramAction(program.id))}>Aktif program yap</button>}
        {program.notes.map((n) => <p key={n} className="text-[12px] text-mute">{n}</p>)}
      </section>
      {program.days.map((d, di) => (
        <section key={d.id} aria-label={d.name} className="card p-5 flex flex-col gap-2" data-testid="program-day">
          <div className="flex justify-between items-center gap-2">
            <span className="flex flex-col"><span className="font-extrabold">{d.name}</span>{d.focus ? <span className="text-[12px] text-mute">{d.focus}</span> : null}</span>
            {di === next && program.active ? <span className="text-[11.5px] font-bold px-2 py-1 rounded-full bg-acc/15 text-acc shrink-0">Sıradaki</span> : null}
          </div>
          {supersetBlocks(d.exercises).map((b) => b.group == null ? exRow(d.exercises[b.idx[0]]) : (
            <div key={'ss-' + d.exercises[b.idx[0]].id} className="flex flex-col pl-3 border-l-[3px] border-[#E53935] my-1" data-testid="superset-block" aria-label={`Süperset: ${b.idx.map((i) => d.exercises[i].name).join(', ')}`}>
              <span className="text-[11.5px] font-extrabold text-[#E53935] uppercase tracking-wide pt-1">Süperset · {b.idx.length} hareket · dinlenme turun sonunda</span>
              {b.idx.map((i) => exRow(d.exercises[i]))}
            </div>
          ))}
          {d.exercises.length ? <Link href={`/fitness/antrenman?gun=${d.id}`} className="h-14 mt-1 rounded-2xl bg-[#E53935] text-white font-extrabold text-[17px] flex items-center justify-center gap-2"><Play size={22} />Antrenmana Başla</Link> : null}
          <div className="flex gap-2">
            <button type="button" className="flex-1 h-10 rounded-full border border-dashed border-line-2 text-[13px] font-bold text-ink-2 flex items-center justify-center gap-1.5" onClick={() => setPick(d.id)}><Plus size={16} />Hareket ekle</button>
            <button type="button" aria-label={`${d.name} gününü sil`} disabled={pending} onClick={() => { if (confirm(`${d.name} günü programdan silinsin mi? Geçmiş antrenmanların korunur.`)) go(() => removeDayAction(d.id)) }} className="h-10 px-3 rounded-full text-[13px] font-bold text-danger border border-danger-line flex items-center gap-1.5"><Trash size={15} />Günü sil</button>
          </div>
        </section>
      ))}
      <section className="card p-4 flex gap-2">
        <label htmlFor="day-name" className="sr-only">Yeni gün adı</label>
        <input id="day-name" value={dayName} onChange={(e) => setDayName(e.target.value.slice(0, 40))} placeholder={`Gün ${program.days.length + 1}`} className="flex-1 h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink" />
        <button type="button" className={btn.secondary + ' h-12'} disabled={pending} onClick={() => go(() => addDayAction(program.id, dayName.trim() || `Gün ${program.days.length + 1}`), () => setDayName(''))}>Gün ekle</button>
      </section>
      {err ? <p role="alert" className="text-[13px] text-danger px-1">{err}</p> : null}
      {program.days.some((d) => d.exercises.some((e) => !e.scheme)) ? <PeriodSettings program={program} pending={pending} go={go} /> : null}

      <Sheet open={!!pick} onClose={() => setPick(null)} title="Hareket ekle">
        <ExercisePicker onPick={async (id) => { const r = await addExerciseToDayAction(pick!, id); if (!r.ok) { setErr(r.error); return } setPick(null); router.refresh() }} />
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ''}>
        {edit?.scheme ? <SchemeEdit ex={edit} pending={pending} onSave={(kg) => go(() => setSchemeKgAction(edit.id, kg), () => setEdit(null))} onRemove={() => go(() => removeProgramExerciseAction(edit.id), () => setEdit(null))} />
          : edit ? <EditTarget ex={edit} pending={pending} link={linkState(program.days, edit.id)} onLink={(on) => go(() => linkSupersetAction(edit.id, on), () => setEdit(null))} onSave={(v) => go(() => updateProgramExerciseAction(edit.id, v), () => setEdit(null))} onRemove={() => go(() => removeProgramExerciseAction(edit.id), () => setEdit(null))} /> : null}
      </Sheet>
    </>
  )
}

/** Düzenlenen hareket sonrakiyle süperset mi; sonrası var mı. */
function linkState(days: Day[], peId: string): { canLink: boolean; linked: boolean; next: string | null } {
  for (const d of days) {
    const i = d.exercises.findIndex((e) => e.id === peId)
    if (i < 0) continue
    const e = d.exercises[i], n = d.exercises[i + 1]
    return { canLink: !!n && !e.scheme && !n.scheme, linked: !!n && e.superset != null && e.superset === n.superset, next: n?.name ?? null }
  }
  return { canLink: false, linked: false, next: null }
}

function EditTarget({ ex, pending, link, onLink, onSave, onRemove }: { ex: Ex; pending: boolean; link: { canLink: boolean; linked: boolean; next: string | null }; onLink: (on: boolean) => void; onSave: (v: { sets: number; repMin: number; repMax: number; rir: number; rest: number; seconds: number | null; setType: string }) => void; onRemove: () => void }) {
  const [v, setV] = useState({ sets: ex.sets, repMin: ex.repMin, repMax: ex.repMax, rir: ex.rir, rest: ex.rest, seconds: ex.seconds, setType: ex.setType })
  const time = ex.kind === 'time'
  const Row = ({ label, k, min, max, step = 1 }: { label: string; k: 'sets' | 'repMin' | 'repMax' | 'rir' | 'rest' | 'seconds'; min: number; max: number; step?: number }) => (
    <div className="flex items-center justify-between min-h-[52px]">
      <span className="text-sm font-semibold">{label}</span>
      <span className="flex items-center gap-2">
        <button type="button" aria-label={`${label} azalt`} className={btn.icon} onClick={() => setV({ ...v, [k]: Math.max(min, (v[k] ?? min) - step) })}>−</button>
        <span className="num w-12 text-center text-lg font-bold" data-testid={`edit-${k}`}>{v[k] ?? '–'}</span>
        <button type="button" aria-label={`${label} artır`} className={btn.icon} onClick={() => setV({ ...v, [k]: Math.min(max, (v[k] ?? min) + step) })}>+</button>
      </span>
    </div>
  )
  return (
    <div className="flex flex-col pb-4">
      <Row label="Set" k="sets" min={1} max={10} />
      {time ? <Row label="Süre (sn)" k="seconds" min={5} max={600} step={5} /> : <>
        <Row label="Tekrar (alt)" k="repMin" min={1} max={50} />
        <Row label="Tekrar (üst)" k="repMax" min={1} max={50} />
        <Row label="Hedef RIR" k="rir" min={0} max={4} />
      </>}
      <Row label="Dinlenme (sn)" k="rest" min={15} max={600} step={15} />
      <label className="flex items-center justify-between min-h-[52px] text-sm font-semibold" htmlFor="set-type">Set tipi
        <select id="set-type" value={v.setType} onChange={(e) => setV({ ...v, setType: e.target.value })} className="h-11 rounded-xl bg-surface-2 border border-line px-3 text-ink font-normal">
          {Object.entries(SET_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
      </label>
      {link.canLink ? (
        <button type="button" aria-pressed={link.linked} disabled={pending} onClick={() => onLink(!link.linked)} data-testid="superset-toggle"
          className={`mt-2 min-h-[52px] rounded-2xl px-4 py-2 text-left text-[14px] font-semibold border-2 ${link.linked ? 'border-[#E53935] text-[#E53935]' : 'border-line text-ink-2'}`}>
          {link.linked ? `Süperseti boz (${link.next})` : `Sonraki hareketle süperset yap (${link.next})`}
        </button>
      ) : null}
      <button type="button" className={btn.primary + ' mt-3'} disabled={pending || (!time && v.repMax < v.repMin)} onClick={() => onSave({ ...v, setType: v.setType as SetType, seconds: time ? v.seconds ?? 45 : null })}>Kaydet</button>
      <button type="button" className={`${btn.ghost} text-danger mt-1`} disabled={pending} onClick={onRemove}><Trash size={18} />Programdan çıkar</button>
    </div>
  )
}

function schemeLine(e: Ex) {
  const tier = (e.scheme ?? '').slice(6).toUpperCase()
  if (!e.schemeState) return `${tier} · ilk seans`
  const s = gzSets(e.schemeState)
  return `${tier} · ${s.length}×${s[0].reps}${s.some((x) => x.amrap) ? '+' : ''} · ${String(e.schemeState.kg).replace('.', ',')} kg`
}

function SchemeEdit({ ex, pending, onSave, onRemove }: { ex: Ex; pending: boolean; onSave: (kg: number) => void; onRemove: () => void }) {
  const [kg, setKg] = useState(String(ex.schemeState?.kg ?? ''))
  const tier = (ex.scheme ?? '').slice(6)
  return (
    <div className="flex flex-col gap-3 pb-4">
      <p className="text-[14px] text-ink-2 leading-relaxed">{schemeLine(ex)}. {tier === 't1' ? 'T1: 5×3 tutmazsa aynı ağırlıkla 6×2, sonra 10×1; o da tutmazsa %85 ile yeniden 5×3.' : tier === 't2' ? 'T2: 3×10 → 3×8 → 3×6; sonra son başarılı 3×10 ağırlığının bir kademe üstüyle 3×10.' : 'T3: 3×15, son sette 25 tekrar yapınca en küçük artış.'} Kademeler antrenmandan sonra otomatik ilerler.</p>
      <label htmlFor="gz-kg" className="flex items-center justify-between text-sm font-semibold">Çalışma ağırlığı (kg)
        <input id="gz-kg" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} className="w-28 h-12 rounded-xl bg-surface-2 border border-line px-3 num text-lg text-right" />
      </label>
      <button type="button" className={btn.primary} disabled={pending || !(Number(kg.replace(',', '.')) >= 0) || !kg.trim()} onClick={() => onSave(Number(kg.replace(',', '.')))}>Kaydet</button>
      <button type="button" className={`${btn.ghost} text-danger`} disabled={pending} onClick={onRemove}><Trash size={18} />Programdan çıkar</button>
    </div>
  )
}

function PeriodSettings({ program, pending, go }: { program: { id: string; periodization: string; deloadEvery: number; startDay: string }; pending: boolean; go: (fn: () => Promise<{ ok: boolean; error?: string }>) => void }) {
  const [p, setP] = useState(program.periodization as Periodization)
  const [every, setEvery] = useState(program.deloadEvery)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const week = weekIndex(program.startDay, today)
  const changed = p !== program.periodization || every !== program.deloadEvery
  return (
    <section className="card p-5 flex flex-col gap-3" aria-label="Periyodizasyon" data-testid="period-settings">
      <div className="flex justify-between items-center"><Eyebrow>Periyodizasyon</Eyebrow><span className="text-[12px] text-mute">{week + 1}. hafta{isDeloadWeek(week, program.deloadEvery) ? ' · deload' : ''}</span></div>
      <div className="flex flex-col gap-1.5">
        {(Object.keys(PERIODIZATION) as Periodization[]).map((k) => (
          <button key={k} type="button" aria-pressed={p === k} onClick={() => setP(k)} className={`text-left rounded-2xl px-4 py-2.5 ${p === k ? 'bg-surface-3 border border-acc' : 'bg-surface-2 border border-transparent'}`}>
            <span className="font-bold text-[14px]">{PERIODIZATION[k].label}</span><br /><span className="text-[12px] text-mute">{PERIODIZATION[k].hint}</span>
          </button>
        ))}
      </div>
      <fieldset className="flex gap-1.5"><legend className="text-sm font-semibold mb-1.5">Deload haftası</legend>
        {[0, 4, 5, 6, 8].map((n) => <button key={n} type="button" aria-pressed={every === n} onClick={() => setEvery(n)} className={`flex-1 h-10 rounded-xl text-[13px] font-bold ${every === n ? 'bg-acc text-acc-ink' : 'bg-surface-2'}`}>{n ? `${n}. hafta` : 'Yok'}</button>)}
      </fieldset>
      <p className="text-[11px] text-mute">Deload haftasında set sayısı yarıya iner, RIR 2 artar, önerilen ağırlık %90 olur. GZCLP hareketleri kendi kademeleriyle ilerler.</p>
      {changed ? <button type="button" className={btn.primary} disabled={pending} onClick={() => go(() => updateProgramSettingsAction(program.id, { periodization: p, deloadEvery: every }))}>Kaydet</button> : null}
    </section>
  )
}
