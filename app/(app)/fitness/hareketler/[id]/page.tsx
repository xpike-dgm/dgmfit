import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getExercise, imageUrl } from '@/lib/fitness-data'
import { CATEGORY, EQUIPMENT, KIND, LEVEL, MUSCLES } from '@/lib/exercise-labels'
import { e1rm, PR_LABEL, type PrType } from '@/lib/training'
import { shortDate } from '@/lib/time'
import { fmtNum } from '@/lib/calc'
import { btn, Eyebrow, TopBar } from '@/components/ui'
import { Dumbbell } from '@/components/icons'

export default async function ExercisePage(props: { params: Promise<{ id: string }> }) {
  const u = await requireUser()
  const { id } = await props.params
  if (!/^\d+$/.test(id)) notFound()
  const x = await getExercise(u.id, Number(id))
  if (!x) notFound()
  const recs = x.records ? (Object.entries(x.records) as [PrType, number][]).filter(([, v]) => v > 0) : []
  return (
    <div className="flex flex-col gap-3 px-4 pt-5">
      <TopBar back="/fitness/hareketler" title="Hareket" />
      <section className="card p-5 flex flex-col gap-3">
        <h1 className="text-[22px] font-extrabold leading-tight">{x.nameTr}</h1>
        {x.nameEn && x.nameEn !== x.nameTr ? <span className="text-[13px] text-mute -mt-2">{x.nameEn}</span> : null}
        {x.images.length ? (
          <div className="grid grid-cols-2 gap-2">
            {x.images.slice(0, 2).map((im, i) => <img key={im} src={imageUrl(im)} alt={`${x.nameTr} ${i === 0 ? 'başlangıç' : 'bitiş'} pozisyonu`} width={300} height={300} className="w-full aspect-square object-cover rounded-2xl bg-surface-2" />)}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5 text-[12px]">
          {[CATEGORY[x.category], EQUIPMENT[x.equipment], x.level ? LEVEL[x.level] : null, KIND[x.kind]].filter(Boolean).map((t) => <span key={t} className="px-2.5 h-7 rounded-full bg-surface-2 flex items-center text-ink-2">{t}</span>)}
        </div>
        <p className="text-[14px]"><span className="text-mute">Birincil:</span> <b>{x.primary.map((m) => MUSCLES[m] ?? m).join(', ') || '—'}</b>{x.secondary.length ? <><br /><span className="text-mute">İkincil:</span> {x.secondary.map((m) => MUSCLES[m] ?? m).join(', ')}</> : null}</p>
        <Link href={`/fitness/antrenman?hareket=${x.id}`} className={btn.primary}><Dumbbell size={20} />Bu hareketle antrenman başlat</Link>
      </section>
      {x.steps.length ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="Teknik">
          <Eyebrow>Teknik</Eyebrow>
          <ol className="list-decimal pl-5 flex flex-col gap-1.5 text-[14px] text-ink-2 leading-relaxed">{x.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          {x.mistakes.length ? <>
            <Eyebrow className="mt-2">Sık yapılan hatalar</Eyebrow>
            <ul className="list-disc pl-5 flex flex-col gap-1 text-[14px] text-ink-2">{x.mistakes.map((s) => <li key={s}>{s}</li>)}</ul>
          </> : null}
        </section>
      ) : <p className="card p-5 text-[13px] text-mute">Bu hareketin Türkçe teknik açıklaması henüz yok (Faz 3b). Görseller başlangıç ve bitiş pozisyonunu gösteriyor.</p>}
      {recs.length ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="Rekorlar">
          <Eyebrow>Rekorların</Eyebrow>
          {recs.map(([k, v]) => <div key={k} className="flex justify-between text-[14px]"><span className="text-ink-2">{PR_LABEL[k] ?? k}</span><span className="num font-bold">{k === 'reps' ? `${v} tekrar` : `${fmtNum(v, v % 1 ? 1 : 0)} kg`}</span></div>)}
        </section>
      ) : null}
      {x.history.length ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="Geçmiş">
          <Eyebrow>Son seanslar</Eyebrow>
          {[...x.history].reverse().map((h) => {
            const w = h.sets.filter((s) => s.type !== 'warmup')
            const best = Math.max(0, ...w.map((s) => e1rm(s.kg, s.reps, s.rir)))
            return <div key={h.workoutId} className="flex justify-between text-[13px] gap-2"><span className="text-mute w-16 shrink-0">{shortDate(h.day)}</span><span className="num flex-1 text-ink-2">{w.map((s) => x.kind === 'time' ? `${s.seconds ?? 0} sn` : `${fmtNum(s.kg, s.kg % 1 ? 1 : 0)}×${s.reps}`).join(' · ')}</span>{best ? <span className="num text-mute">e1RM {fmtNum(best, 1)}</span> : null}</div>
          })}
        </section>
      ) : null}
    </div>
  )
}
