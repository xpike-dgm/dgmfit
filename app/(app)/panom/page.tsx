import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getToday } from '@/lib/today'
import { todayTraining, recoveryFor } from '@/lib/fitness-data'
import { getDiary } from '@/lib/food-data'
import { achievementsFor } from '@/lib/achievements-data'
import { recoveryText } from '@/lib/recovery'
import { dayState } from '@/lib/day-state'
import { minuteOfDay } from '@/lib/water-data'
import { fmtNum } from '@/lib/calc'
import { longDate } from '@/lib/time'
import { Band, Bar, Ring, hdrIcon } from '@/components/ui'
import { Drop, Dumbbell, Flame, Fork, Gear, Pulse, Target } from '@/components/icons'
import QuickWaterButton from '@/components/QuickWaterButton'
import InsightCard from '@/components/InsightCard'
import CardBoard from '@/components/cards/CardBoard'
import { screenLayout } from '@/lib/cards/design-data'

export const metadata: Metadata = { title: 'Panom' }

/** Ö1b-4: Kendi panom — modüllerden seçilen kartların bir arada durduğu ekran (alt bara sekme olarak eklenebilir). */
export default async function Panom(props: { searchParams: Promise<{ duzenle?: string }> }) {
  const user = await requireUser()
  const t = await getToday(user.id)
  if (!t) redirect('/kurulum')
  const editing = (await props.searchParams).duzenle === '1'
  const layout = await screenLayout(user.id, 'mine', { editing })
  const want = (id: string) => editing || layout.items.some((i) => i.id === id || i.stack?.includes(id))
  const [tr, rec, diary, streaks] = await Promise.all([
    want('mine.training') ? todayTraining(user.id, t.day) : Promise.resolve(null),
    want('mine.recovery') ? recoveryFor(user.id).catch(() => null) : Promise.resolve(null),
    want('mine.meals') ? getDiary(user.id, t.day) : Promise.resolve(null),
    want('mine.streaks') ? achievementsFor(user.id).catch(() => null) : Promise.resolve(null),
  ])
  const ds = dayState({ target: t.target, eaten: t.eaten, burned: t.burned, waterMl: t.waterMl, waterBonus: t.waterBonus, workoutMin: t.workout.minutes,
    sinceWorkoutMin: t.workout.endedAt ? Math.round((Date.now() - Date.parse(t.workout.endedAt)) / 60000) : null, nowMin: minuteOfDay(new Date()) })
  const waterFrac = t.target.water ? t.waterMl / t.target.water : 0
  const tile = 'card p-3.5 flex flex-col gap-2 border-t-4 border-acc min-w-0'
  const w = t.weight
  const trained = !!(tr && (tr.workouts || tr.cardio))
  const q = layout.quick

  const nodes: Record<string, ReactNode> = {
    'mine.header': (
      <Band title="Panom" sub={<span className="capitalize">{longDate(t.day)}</span>}
        right={<Link href="/panom?duzenle=1" aria-label="Panoyu düzenle" className={hdrIcon}><Gear size={20} /></Link>}
        ring={{ value: Math.min(1, ds.pct.kcal), big: fmtNum(Math.abs(ds.left.kcal)), small: ds.left.kcal >= 0 ? 'kalan kcal' : 'kcal aşım', label: 'Kalan kalori' }} ringHref="/yemek"
        pills={[['Su', `${fmtNum(t.waterMl)} / ${fmtNum(t.target.water)} ml`, '/su'], ['Protein', `${fmtNum(t.eaten.protein)} / ${fmtNum(t.target.protein)} g`, '/yemek'], ['Kilo', `${fmtNum(w.trend, 1)} kg`, '/fit']]} />
    ),
    'mine.kcal': (
      <Link href="/yemek" data-mod="today" className={`${tile} items-center`} aria-label="Kalan kalori">
        <Ring size={96} stroke={9} value={Math.min(1, ds.pct.kcal)} label="Kalan kalori"><span className="flex flex-col items-center"><b className="num text-[19px] leading-none">{fmtNum(Math.abs(ds.left.kcal))}</b><span className="text-[10.5px] text-mute">{ds.left.kcal >= 0 ? 'kalan kcal' : 'kcal aşım'}</span></span></Ring>
        <span className="text-[12px] text-mute">Bütçe {fmtNum(ds.budget)} kcal</span>
      </Link>
    ),
    'mine.water': (
      <section aria-label="Su" data-mod="water" className={tile}>
        <Link href="/su" className="flex flex-col gap-2">
          <span className="flex items-center justify-between text-[13px] font-extrabold"><span className="flex items-center gap-1.5"><Drop size={16} className="text-acc" />Su</span><span className="text-acc text-[12px]">%{Math.round(waterFrac * 100)}</span></span>
          <span className="flex items-baseline gap-1 flex-wrap"><span className="num text-[22px] font-bold leading-none">{fmtNum(t.waterMl)}</span><span className="text-[12px] text-mute">/ {fmtNum(t.target.water)} ml</span></span>
          <Bar value={waterFrac} color="var(--color-acc)" height={6} />
        </Link>
        {q['mine.water'] !== 'none' ? <QuickWaterButton compact ml={Number(q['mine.water'] ?? 250)} /> : null}
      </section>
    ),
    'mine.macros': (
      <Link href="/yemek" data-mod="food" className="card p-3.5 grid grid-cols-3 gap-3" aria-label="Makrolar">
        {([['Protein', t.eaten.protein, t.target.protein, 'var(--color-protein)'], ['Karb.', t.eaten.carb, t.target.carb, 'var(--color-orange)'], ['Yağ', t.eaten.fat, t.target.fat, 'var(--color-violet)']] as const).map(([n, v, g, c]) => (
          <span key={n} className="flex flex-col gap-1 min-w-0">
            <span className="text-[12px] font-semibold text-ink-2">{n}</span>
            <span className="text-[13px] text-mute"><b className="num text-ink font-semibold">{fmtNum(v)}</b> / {fmtNum(g)} g</span>
            <Bar value={g ? v / g : 0} color={c} height={5} />
          </span>
        ))}
      </Link>
    ),
    'mine.training': tr ? (
      <Link href={trained || !tr.next ? '/fitness' : `/fitness/antrenman?gun=${tr.next.id}`} data-mod="fitness" className={tile} aria-label="Antrenman">
        <span className="flex items-center gap-1.5 text-[13px] font-extrabold"><Dumbbell size={16} className="text-acc" />Antrenman</span>
        <span className="text-[15px] font-extrabold leading-snug">{trained ? `${tr.minutes} dk tamamlandı` : tr.next ? `Sıradaki: ${tr.next.name}` : 'Bugün kayıt yok'}</span>
        <span className="self-start h-9 px-4 rounded-full bg-acc text-acc-ink font-bold text-[13.5px] inline-flex items-center">{trained ? 'Detay' : 'Başlat'}</span>
      </Link>
    ) : null,
    'mine.weight': (
      <Link href="/fit" data-mod="plan" className={tile} aria-label="Kilo trendi">
        <span className="flex items-center gap-1.5 text-[13px] font-extrabold"><Target size={16} className="text-acc" />Kilo</span>
        <span className="num text-[22px] font-bold leading-none">{fmtNum(w.trend, 1)} <span className="text-[13px] text-mute">kg</span></span>
        <span className="text-[12px] text-mute">Hedef {fmtNum(w.target, 1)} kg · kalan {fmtNum(Math.abs(w.target - w.trend), 1)} kg</span>
      </Link>
    ),
    'mine.recovery': rec ? (
      <Link href="/fitness" data-mod="fitness" className={tile} aria-label="Toparlanma" data-testid="mine-recovery">
        <span className="flex items-center gap-1.5 text-[13px] font-extrabold"><Pulse size={16} className="text-acc" />Toparlanma</span>
        <span className="text-[13px] leading-snug">{recoveryText(rec) ?? 'Toparlandın; planladığın antrenmanı yapabilirsin.'}</span>
      </Link>
    ) : null,
    'mine.meals': diary ? (
      <Link href="/yemek" data-mod="food" className="card p-4 flex flex-col gap-1.5" aria-label="Bugünkü öğünler">
        <span className="flex items-center gap-1.5 text-[13px] font-extrabold"><Fork size={16} className="text-acc" />Öğünler</span>
        {diary.meals.map((m) => <span key={m.id} className="flex justify-between text-[13.5px]"><span>{m.label}</span><b className="num">{fmtNum(m.totals.kcal)} kcal</b></span>)}
      </Link>
    ) : null,
    'mine.coach': <div data-mod="coach"><InsightCard fallback="Bugün küçük bir adım yeter: bir öğünü kaydet, bir bardak su iç." weeklyReady={false} compact /></div>,
    'mine.streaks': streaks ? (
      <Link href="/profil/basarilar" className="card p-4 flex flex-col gap-2">
        <b className="text-[15px] flex items-center gap-1.5"><Flame size={16} className="text-acc" />Seriler</b>
        <span className="grid grid-cols-3 gap-2 text-center">
          {[['Yemek kaydı', `${streaks.foodStreak} gün`], ['Su hedefi', `${t.streak} gün`], ['Antrenman', `${streaks.weekStreak} hafta`]].map(([l, v]) => (
            <span key={l} className="flex flex-col"><b className="num text-[17px]">{v}</b><span className="text-[11px] text-mute">{l}</span></span>
          ))}
        </span>
      </Link>
    ) : null,
  }
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="panom">
      <CardBoard screen="mine" editing={editing} items={layout.items.map((i) => ({ id: i.id, size: i.size, stack: i.stack }))} nodes={nodes}
        drawer={layout.drawer.map((d) => ({ id: d.def.id, reason: d.reason }))} notices={layout.notices} applied={layout.applied} quick={layout.quick} pinned={layout.pinned} colors={layout.colors} />
    </div>
  )
}
