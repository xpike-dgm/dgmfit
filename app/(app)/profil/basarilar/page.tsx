import { requireUser } from '@/lib/auth'
import { achievementsFor } from '@/lib/achievements-data'
import { getWaterInsights, getWaterStats } from '@/lib/water-data'
import { shortDate } from '@/lib/time'
import Link from 'next/link'
import { TopBar } from '@/components/ui'

export const metadata = { title: 'Başarılar' }

type B = { id: string; title: string; desc: string; earnedDay: string | null }
const GROUPS: [string, string][] = [['food', 'Yemek'], ['fitness', 'Antrenman'], ['fit', 'Plan'], ['water', 'Su']]

/** P-7: tüm modüllerin rozetleri ve serileri tek yerde. */
export default async function Page() {
  const u = await requireUser()
  const [a, wi, ws] = await Promise.all([achievementsFor(u.id), getWaterInsights(u.id), getWaterStats(u.id, 7)])
  const all: (B & { module: string })[] = [...a.list, ...wi.badges.map((b) => ({ ...b, module: 'water' }))]
  const earned = all.filter((b) => b.earnedDay).length
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="achievements">
      <TopBar back="/profil" title="Başarılar" sub={`${earned} / ${all.length} rozet`} />
      <section aria-label="Seriler" className="card p-4 grid grid-cols-3 gap-2 text-center" data-testid="streaks">
        <div className="flex flex-col gap-0.5"><b className="num text-xl" data-testid="streak-food">{a.foodStreak}</b><span className="text-[12px] text-mute leading-tight">gün üst üste yemek kaydı</span></div>
        <div className="flex flex-col gap-0.5"><b className="num text-xl">{ws.streak.current}</b><span className="text-[12px] text-mute leading-tight">gün su hedefi</span></div>
        <div className="flex flex-col gap-0.5"><b className="num text-xl" data-testid="streak-train">{a.weekStreak}</b><span className="text-[12px] text-mute leading-tight">hafta ≥2 antrenman</span></div>
      </section>
      {GROUPS.map(([m, label]) => {
        const list = all.filter((b) => b.module === m)
        return (
          <section key={m} aria-label={label} className="card p-4 flex flex-col gap-3">
            <h2 className="font-extrabold text-[15px]">{label} <span className="text-mute font-semibold num">{list.filter((b) => b.earnedDay).length}/{list.length}</span></h2>
            <ul className="grid grid-cols-2 gap-2">
              {list.map((b) => (
                <li key={b.id} data-earned={b.earnedDay ? '1' : '0'} className={`rounded-2xl p-3 flex flex-col gap-0.5 border ${b.earnedDay ? 'bg-coach border-coach-line' : 'bg-surface-2 border-transparent opacity-60'}`}>
                  <span className={`text-sm font-extrabold ${b.earnedDay ? 'text-acc' : 'text-ink-2'}`}>{b.title}</span>
                  <span className="text-xs text-mute leading-snug">{b.desc}</span>
                  <span className="text-[11px] text-ink-2 mt-1">{b.earnedDay ? `Kazanıldı · ${shortDate(b.earnedDay)}` : 'Henüz kazanılmadı'}</span>
                  {b.earnedDay ? <Link href={`/sosyal/yeni?tur=badge&ref=${b.id}`} className="text-[12px] font-bold text-acc mt-1 min-h-8 inline-flex items-center" data-testid="badge-share">Paylaş ›</Link> : null}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
