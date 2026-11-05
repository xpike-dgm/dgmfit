import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { TEMPLATES } from '@/lib/programs'
import { agProgramList } from '@/lib/ag-program-data'
import { AG_SOURCE } from '@/lib/licensed'
import { TopBar } from '@/components/ui'
import { Next } from '@/components/icons'

export const metadata = { title: 'Hazır şablonlar · DgFit' }
const LEVEL = { new: 'Başlangıç', mid: 'Orta', adv: 'İleri' }
const FILTERS = [
  { key: '', label: 'Tümü' }, { key: 'ev', label: 'Ev' }, { key: 'salon', label: 'Salon' },
  { key: 'baslangic', label: 'Başlangıç' }, { key: 'orta', label: 'Orta' }, { key: 'tek', label: 'Tek antrenman' }, { key: 'haftalik', label: 'Haftalık' },
] as const

export default async function Page(props: { searchParams: Promise<{ f?: string }> }) {
  await requireUser()
  const f = (await props.searchParams).f ?? ''
  const all = agProgramList()
  const ag = all.filter((p) => {
    switch (f) {
      case 'ev': return p.home
      case 'salon': return p.env.includes('Salon')
      case 'baslangic': return p.levelKey === 'new'
      case 'orta': return p.levelKey === 'mid'
      case 'tek': return p.days === 1
      case 'haftalik': return p.days > 1
      default: return true
    }
  })
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness/programlar" title="Hazır şablonlar" sub="İncelemek için dokun" />
      <section aria-label="Hazır şablonlar" className="flex flex-col gap-2">
        {TEMPLATES.map((t) => (
          <Link key={t.id} href={`/fitness/programlar/sablonlar/${t.id}`} className="card p-4 flex items-center gap-3" data-testid="template-item">
            <span className="flex-1 flex flex-col gap-1 min-w-0">
              <span className="flex items-center justify-between gap-2"><b className="text-[15px]">{t.name}</b><span className="text-[11.5px] text-mute shrink-0">{LEVEL[t.level]} · haftada {t.daysPerWeek}</span></span>
              <span className="text-[13px] text-ink-2 leading-snug line-clamp-2">{t.description}</span>
              <span className="text-[12px] text-mute truncate">{t.days.map((d) => d.name).join(' · ')}</span>
            </span>
            <Next size={18} className="text-mute shrink-0" />
          </Link>
        ))}
      </section>
      {all.length ? (
        <section aria-label="Ağırsağlam programları" className="flex flex-col gap-2 mt-2">
          <h2 className="text-[13px] font-bold text-mute uppercase tracking-wide px-1">Ağırsağlam programları <span className="font-normal normal-case">· {all.length}</span></h2>
          <nav aria-label="Program süzgeci" className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {FILTERS.map((x) => (
              <Link key={x.key} href={x.key ? `?f=${x.key}` : '?'} scroll={false} aria-current={f === x.key ? 'true' : undefined}
                className={`shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold flex items-center whitespace-nowrap ${f === x.key ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2'}`}>{x.label}</Link>
            ))}
          </nav>
          {ag.map((p) => (
            <Link key={p.id} href={`/fitness/programlar/sablonlar/${p.id}`} className="card p-4 flex items-center gap-3" data-testid="ag-template-item" data-name={p.name} data-days={p.days} data-ss={p.supersets}>
              <span className="flex-1 flex flex-col gap-1 min-w-0">
                <span className="flex items-start justify-between gap-2"><b className="text-[15px] leading-snug">{p.name}</b><span className="text-[11.5px] text-mute shrink-0 pt-0.5">{p.level} · {p.days === 1 ? 'tek antrenman' : `haftada ${p.days}`}</span></span>
                <span className="text-[13px] text-ink-2 leading-snug line-clamp-2">{p.description}</span>
                <span className="text-[12px] text-mute truncate">{[p.env.join(', '), p.targets.join(', '), p.supersets ? 'süperset' : ''].filter(Boolean).join(' · ')}</span>
              </span>
              <Next size={18} className="text-mute shrink-0" />
            </Link>
          ))}
          {!ag.length ? <p className="text-[13px] text-mute px-1">Bu süzgeçte program yok.</p> : null}
          <a href={AG_SOURCE.url} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-faint self-start px-1" data-testid="ag-source">Kaynak: {AG_SOURCE.label}</a>
        </section>
      ) : null}
    </div>
  )
}
