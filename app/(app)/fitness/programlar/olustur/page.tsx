import { eq } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { aiAvailable } from '@/lib/ai/engine'
import { ensureGym } from '@/lib/fitness-data'
import { db, schema } from '@/lib/db'
import { TopBar } from '@/components/ui'
import { GenerateForm } from '../ProgramsClient'

export const metadata = { title: 'Benim için oluştur · DgFit' }

export default async function Page() {
  const u = await requireUser()
  const [gym, [profile], aiOn] = await Promise.all([
    ensureGym(u.id),
    db.select({ trainingDays: schema.profiles.trainingDays }).from(schema.profiles).where(eq(schema.profiles.userId, u.id)).limit(1),
    aiAvailable(),
  ])
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness/programlar" title="Benim için oluştur" sub="Önce nerede çalışacağını seç" />
      <GenerateForm defaults={{ days: profile?.trainingDays ?? 3, minutes: gym.sessionMinutes }} aiOn={aiOn} />
    </div>
  )
}
