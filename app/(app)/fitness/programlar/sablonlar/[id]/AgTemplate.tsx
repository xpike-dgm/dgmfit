import { TopBar } from '@/components/ui'
import ExImg from '@/components/ExImg'
import { Dumbbell } from '@/components/icons'
import { AG_SOURCE } from '@/lib/licensed'
import { supersetBlocks } from '@/lib/supersets'
import type { agProgramPreview } from '@/lib/ag-program-data'
import { UseTemplate } from '../../ProgramsClient'

type P = NonNullable<Awaited<ReturnType<typeof agProgramPreview>>>
type E = P['days'][number]['exercises'][number]

const target = (e: E) => `${e.sets} × ${e.seconds ? `${e.seconds} sn` : e.type === 'amrap' ? 'maks.' : e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}`

function Row({ e }: { e: E }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-t border-line first:border-0" data-testid="ag-template-ex">
      <span className="w-14 h-14 rounded-xl overflow-hidden bg-surface-2 shrink-0" aria-hidden>
        {e.ex?.thumb ? <img src={e.ex.thumb} alt="" className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
          : e.ex?.image ? <ExImg src={`/media/exercises/${e.ex.image}`} size={56} className="w-full h-full" /> : <span className="w-full h-full flex items-center justify-center text-mute"><Dumbbell size={20} /></span>}
      </span>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-[14.5px] font-semibold leading-snug line-clamp-2">{e.ex?.name ?? e.key}</span>
        {e.note ? <span className="text-[12px] text-mute">{e.note}</span> : null}
      </span>
      <span className="num text-[13px] text-mute shrink-0 text-right">{target(e)}<br /><span className="text-[11.5px]">dinlenme {e.rest} sn</span></span>
    </div>
  )
}

export default function AgTemplate({ p }: { p: P }) {
  const i = p.info
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness/programlar/sablonlar" title={i.name} sub={`${i.level} · ${i.days === 1 ? 'tek antrenman' : `haftada ${i.days} gün`}`} />
      <section className="card p-4 flex flex-col gap-3">
        {i.description ? <p className="text-[14px] text-ink-2 leading-relaxed">{i.description}</p> : null}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
          {[['Yer', i.env.join(', ')], ['Hedef', i.goals.join(', ')], ['Bölge', i.targets.join(', ')], ['Ekipman', i.equipment.join(', ')]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-mute">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </section>
      {p.days.map((d, di) => (
        <section key={di} aria-label={d.name} className="card p-4 flex flex-col" data-testid="template-day">
          <div className="flex items-baseline justify-between gap-2 mb-1"><b className="text-[15px]">{d.name}</b><span className="text-[12px] text-mute">{d.focus}</span></div>
          {supersetBlocks(d.exercises).map((b) => b.group == null ? <Row key={b.idx[0]} e={d.exercises[b.idx[0]]} /> : (
            <div key={b.idx[0]} className="flex flex-col pl-3 border-l-[3px] border-[#E53935] my-1.5" data-testid="superset-block">
              <span className="text-[11.5px] font-extrabold text-[#E53935] uppercase tracking-wide pt-1">Süperset · art arda, dinlenme turun sonunda</span>
              {b.idx.map((x) => <Row key={x} e={d.exercises[x]} />)}
            </div>
          ))}
        </section>
      ))}
      <p className="text-[12px] text-mute px-1">Program oluştuktan sonra hareketleri, setleri ve süpersetleri istediğin gibi düzenleyebilirsin.</p>
      <UseTemplate id={i.id} />
      <a href={AG_SOURCE.url} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-faint self-start px-1" data-testid="ag-source">Kaynak: {AG_SOURCE.label}</a>
    </div>
  )
}
