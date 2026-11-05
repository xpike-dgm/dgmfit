import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { listPrograms } from '@/lib/fitness-data'
import { Eyebrow, TopBar } from '@/components/ui'
import { Dumbbell, Next, Plus, Spark } from '@/components/icons'
import { ProgramActions } from './ProgramsClient'

export const metadata = { title: 'Programlar · DgFit' }

export default async function ProgramsPage() {
  const u = await requireUser()
  const programs = await listPrograms(u.id)
  const opts = [
    { href: '/fitness/programlar/olustur', title: 'Benim için oluştur', sub: 'Ortamına, gün sayına ve süreye göre otomatik', Icon: Spark },
    { href: '/fitness/programlar/sablonlar', title: 'Hazır şablonlar', sub: 'Full Body, Upper/Lower, PPL, GZCLP… incele ve seç', Icon: Dumbbell },
    { href: '/fitness/programlar/bos', title: 'Boş program', sub: 'Günleri ve hareketleri kendin kur', Icon: Plus },
  ]
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness" title="Programlar" sub={programs.length ? `${programs.length} program` : 'Henüz program yok'} />
      {programs.length ? (
        <section aria-label="Programlarım" className="card p-5 flex flex-col gap-1">
          <Eyebrow>Programlarım</Eyebrow>
          {programs.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 min-h-[60px] border-b border-line last:border-0" data-testid="program-item">
              <Link href={`/fitness/programlar/${p.id}`} className="flex-1 flex flex-col min-w-0">
                <span className="font-bold truncate">{p.name} {p.active ? <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-acc text-acc-ink align-middle">Aktif</span> : null}</span>
                <span className="text-[12px] text-mute">{p.dayCount} gün</span>
              </Link>
              <ProgramActions id={p.id} active={p.active} />
              <Link href={`/fitness/programlar/${p.id}`} aria-label={`${p.name} düzenle`} className="text-mute"><Next size={18} /></Link>
            </div>
          ))}
        </section>
      ) : null}
      <section aria-label="Program oluştur" className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold tracking-[0.06em] uppercase text-mute px-1 pt-1">Program oluştur</h2>
        {opts.map((o) => (
          <Link key={o.href} href={o.href} className="card p-4 flex items-center gap-3 min-h-[72px]">
            <span className="w-11 h-11 rounded-2xl bg-acc text-acc-ink flex items-center justify-center shrink-0"><o.Icon size={20} /></span>
            <span className="flex-1 flex flex-col min-w-0"><b className="text-[15px]">{o.title}</b><span className="text-[12.5px] text-mute">{o.sub}</span></span>
            <Next size={18} className="text-mute shrink-0" />
          </Link>
        ))}
      </section>
    </div>
  )
}
