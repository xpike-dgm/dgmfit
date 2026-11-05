import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { TEMPLATES } from '@/lib/programs'
import { TopBar } from '@/components/ui'
import { Next } from '@/components/icons'

export const metadata = { title: 'Hazır şablonlar · DgFit' }
const LEVEL = { new: 'Başlangıç', mid: 'Orta', adv: 'İleri' }

export default async function Page() {
  await requireUser()
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
    </div>
  )
}
