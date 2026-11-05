import { notFound } from 'next/navigation'
import { inArray, isNull, and } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { db, schema } from '@/lib/db'
import { TEMPLATES } from '@/lib/programs'
import { TopBar } from '@/components/ui'
import { UseTemplate } from '../../ProgramsClient'

export const metadata = { title: 'Şablon · DgFit' }
const LEVEL = { new: 'Başlangıç', mid: 'Orta', adv: 'İleri' }
const ROLE: Record<string, string> = { ana: 'Ana', yardımcı: 'Yardımcı', izolasyon: 'İzolasyon', core: 'Core' }

export default async function Page(props: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await props.params
  const t = TEMPLATES.find((x) => x.id === id)
  if (!t) notFound()
  const keys = [...new Set(t.days.flatMap((d) => d.slots.flatMap((s) => s.alts)))]
  const rows = await db.select({ key: schema.exercises.key, name: schema.exercises.nameTr }).from(schema.exercises).where(and(inArray(schema.exercises.key, keys), isNull(schema.exercises.userId)))
  const name = new Map(rows.map((r) => [r.key, r.name]))
  const reps = (s: { repMin: number; repMax: number; seconds?: number }) => s.seconds ? `${s.seconds} sn` : s.repMin === s.repMax ? `${s.repMin}` : `${s.repMin}–${s.repMax}`
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness/programlar/sablonlar" title={t.name} sub={`${LEVEL[t.level]} · haftada ${t.daysPerWeek} gün`} />
      <p className="card p-4 text-[14px] text-ink-2 leading-relaxed">{t.description}</p>
      {t.days.map((d) => (
        <section key={d.name} aria-label={d.name} className="card p-4 flex flex-col gap-1" data-testid="template-day">
          <div className="flex items-baseline justify-between gap-2 mb-1"><b className="text-[15px]">{d.name}</b><span className="text-[12px] text-mute">{d.focus}</span></div>
          {d.slots.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 min-h-10 border-t border-line first:border-0 text-[14px]">
              <span className="min-w-0 flex flex-col"><span className="truncate">{name.get(s.alts[0]) ?? s.alts[0].replace(/_/g, ' ')}</span><span className="text-[11.5px] text-mute">{ROLE[s.role]}{s.alts.length > 1 ? ` · ${s.alts.length - 1} alternatif` : ''}</span></span>
              <span className="num text-mute shrink-0">{s.sets} × {reps(s)}</span>
            </div>
          ))}
        </section>
      ))}
      <p className="text-[12px] text-mute px-1">Ekipmanında olmayan hareketler sıradaki alternatifle değiştirilir; program oluştuktan sonra istediğin gibi düzenleyebilirsin.</p>
      <UseTemplate id={t.id} />
    </div>
  )
}
