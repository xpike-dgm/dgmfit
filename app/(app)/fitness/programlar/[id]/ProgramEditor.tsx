'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import { btn, Eyebrow } from '@/components/ui'
import { Dumbbell, Plus, Trash } from '@/components/icons'
import { SET_TYPES, type SetType } from '@/lib/training'
import { addDayAction, addExerciseToDayAction, removeProgramExerciseAction, setActiveProgramAction, updateProgramExerciseAction } from '../../actions'
import { ExercisePicker } from '../../antrenman/LiveWorkout'

type Ex = { id: string; exerciseId: number; name: string; kind: string; sets: number; repMin: number; repMax: number; rir: number; rest: number; seconds: number | null; setType: string }
type Day = { id: string; name: string; focus: string; exercises: Ex[] }

export default function ProgramEditor({ program }: { program: { id: string; name: string; active: boolean; notes: string[]; nextDayIdx: number; days: Day[] } }) {
  const [edit, setEdit] = useState<Ex | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [dayName, setDayName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const go = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => { setErr(null); const r = await fn(); if (!r.ok) { setErr(r.error ?? 'Hata'); return } after?.(); router.refresh() })
  const next = program.days.length ? program.nextDayIdx % program.days.length : 0
  return (
    <>
      <section className="card p-5 flex flex-col gap-2">
        <h1 className="text-[22px] font-extrabold leading-tight">{program.name}</h1>
        {program.active ? <span className="text-[13px] text-lime">Aktif program · sıradaki gün: {program.days[next]?.name}</span>
          : <button type="button" className={btn.secondary} disabled={pending} onClick={() => go(() => setActiveProgramAction(program.id))}>Aktif program yap</button>}
        {program.notes.map((n) => <p key={n} className="text-[12px] text-mute">{n}</p>)}
      </section>
      {program.days.map((d, di) => (
        <section key={d.id} aria-label={d.name} className="card p-5 flex flex-col gap-2" data-testid="program-day">
          <div className="flex justify-between items-center gap-2">
            <span className="flex flex-col"><span className="font-extrabold">{d.name}</span>{d.focus ? <span className="text-[12px] text-mute">{d.focus}</span> : null}</span>
            {d.exercises.length ? <Link href={`/fitness/antrenman?gun=${d.id}`} className="h-9 px-3 rounded-full bg-lime text-lime-ink text-[13px] font-bold flex items-center gap-1.5"><Dumbbell size={15} />{di === next && program.active ? 'Başla' : 'Bu günü yap'}</Link> : null}
          </div>
          {d.exercises.map((e) => (
            <button key={e.id} type="button" onClick={() => setEdit(e)} className="flex justify-between items-center min-h-[48px] text-left border-b border-line last:border-0">
              <span className="font-semibold text-[15px]">{e.name}</span>
              <span className="num text-[13px] text-mute whitespace-nowrap">{e.sets} × {e.seconds ? `${e.seconds} sn` : e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}{e.seconds ? '' : ` @${e.rir}`}</span>
            </button>
          ))}
          <button type="button" className="h-10 rounded-full border border-dashed border-line-2 text-[13px] font-bold text-ink-2 flex items-center justify-center gap-1.5" onClick={() => setPick(d.id)}><Plus size={16} />Hareket ekle</button>
        </section>
      ))}
      <section className="card p-5 flex gap-2">
        <label htmlFor="day-name" className="sr-only">Yeni gün adı</label>
        <input id="day-name" value={dayName} onChange={(e) => setDayName(e.target.value.slice(0, 40))} placeholder={`Gün ${program.days.length + 1}`} className="flex-1 h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink" />
        <button type="button" className={btn.secondary + ' h-12'} disabled={pending} onClick={() => go(() => addDayAction(program.id, dayName.trim() || `Gün ${program.days.length + 1}`), () => setDayName(''))}>Gün ekle</button>
      </section>
      {err ? <p role="alert" className="text-[13px] text-danger px-1">{err}</p> : null}

      <Sheet open={!!pick} onClose={() => setPick(null)} title="Hareket ekle">
        <ExercisePicker onPick={async (id) => { const r = await addExerciseToDayAction(pick!, id); if (!r.ok) { setErr(r.error); return } setPick(null); router.refresh() }} />
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ''}>
        {edit ? <EditTarget ex={edit} pending={pending} onSave={(v) => go(() => updateProgramExerciseAction(edit.id, v), () => setEdit(null))} onRemove={() => go(() => removeProgramExerciseAction(edit.id), () => setEdit(null))} /> : null}
      </Sheet>
    </>
  )
}

function EditTarget({ ex, pending, onSave, onRemove }: { ex: Ex; pending: boolean; onSave: (v: { sets: number; repMin: number; repMax: number; rir: number; rest: number; seconds: number | null; setType: string }) => void; onRemove: () => void }) {
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
      <button type="button" className={btn.primary + ' mt-3'} disabled={pending || (!time && v.repMax < v.repMin)} onClick={() => onSave({ ...v, setType: v.setType as SetType, seconds: time ? v.seconds ?? 45 : null })}>Kaydet</button>
      <button type="button" className={`${btn.ghost} text-danger mt-1`} disabled={pending} onClick={onRemove}><Trash size={18} />Programdan çıkar</button>
    </div>
  )
}
