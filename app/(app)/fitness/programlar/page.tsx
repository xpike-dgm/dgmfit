import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { aiAvailable } from '@/lib/ai/engine'
import { ensureGym, listPrograms } from '@/lib/fitness-data'
import { TEMPLATES } from '@/lib/programs'
import { Eyebrow, TopBar } from '@/components/ui'
import { Next } from '@/components/icons'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { CreateProgram, ProgramActions } from './ProgramsClient'

export const metadata = { title: 'Programlar · DgFit' }
const LEVEL = { new: 'Başlangıç', mid: 'Orta', adv: 'İleri' }

export default async function ProgramsPage() {
  const u = await requireUser()
  const [programs, gym, [profile], aiOn] = await Promise.all([
    listPrograms(u.id), ensureGym(u.id),
    db.select({ trainingDays: schema.profiles.trainingDays, experience: schema.profiles.experience }).from(schema.profiles).where(eq(schema.profiles.userId, u.id)).limit(1),
    aiAvailable(),
  ])
  return (
    <div className="flex flex-col gap-3 px-4 pt-5">
      <TopBar back="/fitness" title="Programlar" />
      {programs.length ? (
        <section aria-label="Programlarım" className="card p-5 flex flex-col gap-1">
          <Eyebrow>Programlarım</Eyebrow>
          {programs.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 min-h-[60px] border-b border-line last:border-0" data-testid="program-item">
              <Link href={`/fitness/programlar/${p.id}`} className="flex-1 flex flex-col min-w-0">
                <span className="font-bold truncate">{p.name} {p.active ? <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-lime text-lime-ink align-middle">Aktif</span> : null}</span>
                <span className="text-[12px] text-mute">{p.dayCount} gün</span>
              </Link>
              <ProgramActions id={p.id} active={p.active} />
              <Link href={`/fitness/programlar/${p.id}`} aria-label={`${p.name} düzenle`} className="text-mute"><Next size={18} /></Link>
            </div>
          ))}
        </section>
      ) : null}
      <CreateProgram
        templates={TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, days: t.daysPerWeek, level: LEVEL[t.level], dayNames: t.days.map((d) => d.name) }))}
        defaults={{ days: profile?.trainingDays ?? 3, minutes: gym.sessionMinutes, equipment: gym.equipment }} aiOn={aiOn}
      />
    </div>
  )
}
