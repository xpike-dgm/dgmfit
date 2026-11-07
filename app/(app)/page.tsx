import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getToday } from '@/lib/today'
import { closePendingDays } from '@/lib/fit-data'
import { todayTraining } from '@/lib/fitness-data'
import { greeting, longDate, shortDate, addDays } from '@/lib/time'
import { fmtNum } from '@/lib/calc'
import { Band, Bar, Ring, hdrIcon } from '@/components/ui'
import QuickWaterButton from '@/components/QuickWaterButton'
import InsightCard from '@/components/InsightCard'
import { latestReportWeek, mondayOf } from '@/lib/coach-data'
import { Drop, Dumbbell, Flame, Pulse, Target, User } from '@/components/icons'
import { dayState } from '@/lib/day-state'
import { goalStatus } from '@/lib/goal-phase'
import GoalChoiceCard from '@/components/GoalChoiceCard'
import { partnersTrainedToday } from '@/lib/social2-data'
import { lastWeekBrief } from '@/lib/coach-data'
import { achievementsFor } from '@/lib/achievements-data'
import { recentFoods } from '@/lib/food-data'
import { minuteOfDay } from '@/lib/water-data'
import { screenLayout } from '@/lib/cards/design-data'
import CardBoard from '@/components/cards/CardBoard'
import type { ReactNode } from 'react'

export default async function Today(props: { searchParams: Promise<{ duzenle?: string }> }) {
  const user = await requireUser()
  await closePendingDays(user.id)
  const t = await getToday(user.id)
  if (!t) redirect('/kurulum')
  // Özelleştirme: düzen (yalnızca görünen kartların verisi hesaplanır; düzenlemede hepsi, çekmece için)
  const sp = await props.searchParams
  const editing = sp.duzenle === '1'
  const layout = await screenLayout(user.id, 'today', { editing })
  const want = (id: string) => editing || layout.items.some((i) => i.id === id)
  const [tr, gs, partners, brief, streaks] = await Promise.all([
    todayTraining(user.id, t.day), goalStatus(user.id),
    want('today.partner') ? partnersTrainedToday(user.id, t.day).catch(() => [] as string[]) : Promise.resolve([] as string[]),
    want('today.week-brief') ? lastWeekBrief(user.id, t.day).catch(() => null) : Promise.resolve(null),
    want('today.streaks') ? achievementsFor(user.id).catch(() => null) : Promise.resolve(null),
  ])
  // Haftalık rapor kısayolu: Pazar 18.00'den Pazartesi sonuna kadar
  const weeklyReady = latestReportWeek() === mondayOf(t.day) || latestReportWeek() === addDays(mondayOf(t.day), -7) && new Date(t.day + 'T12:00:00Z').getUTCDay() === 1

  // Faz 7-1: kalan değerler tek kaynaktan (Yemek ve Fit ile aynı hesap)
  const nowMin = minuteOfDay(new Date())
  const ds = dayState({ target: t.target, eaten: t.eaten, burned: t.burned, waterMl: t.waterMl, waterBonus: t.waterBonus, workoutMin: t.workout.minutes,
    sinceWorkoutMin: t.workout.endedAt ? Math.round((Date.now() - Date.parse(t.workout.endedAt)) / 60000) : null, nowMin })
  const budget = ds.budget
  const left = ds.left.kcal
  const usedFrac = ds.pct.kcal
  // antrenman sonrası protein: son kullanılanlardan 100 kcal başına en çok protein verenler
  const proteinPicks = ds.postWorkoutProtein && want('today.post-protein') ? (await recentFoods(user.id, 30)).filter((f) => f.kcal > 0).sort((a, b) => b.protein / b.kcal - a.protein / a.kcal).slice(0, 3) : []
  const mealNow = nowMin < 10 * 60 ? 'breakfast' : nowMin < 15 * 60 ? 'lunch' : nowMin < 21 * 60 ? 'dinner' : 'snack'
  const w = t.weight
  const recomp = t.goal?.type === 'recomp'
  const diffPlan = (w.progress - w.planned) * Math.abs(w.target - w.start)
  const waterFrac = t.target.water ? t.waterMl / t.target.water : 0

  const macros = [
    { name: 'Protein', val: t.eaten.protein, goal: t.target.protein, color: 'var(--color-protein)' },
    { name: 'Karbonhidrat', val: t.eaten.carb, goal: t.target.carb, color: 'var(--color-orange)' },
    { name: 'Yağ', val: t.eaten.fat, goal: t.target.fat, color: 'var(--color-violet)' },
  ]

  const tile = 'card p-3.5 flex flex-col gap-2 border-t-4 border-acc min-w-0'
  const trained = tr.workouts || tr.cardio

  const nodes: Record<string, ReactNode> = {
    'today.header': (
      <section aria-label="Kalori" className="flex flex-col" data-testid="today-state" data-left={left} data-budget={budget} data-water-goal={t.target.water} data-protein-left={ds.left.protein}>
        <Band
          title={<>{greeting()}, {user.username}</>}
          sub={<span className="capitalize">{longDate(t.day)}</span>}
          right={
            <div className="flex gap-2 items-center">
              <Link href="/su/istatistik" className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-[var(--band-box)] text-sm font-bold" aria-label={`Su serisi: ${t.streak} gün`}>
                <Flame size={16} />{t.streak}
              </Link>
              <Link href="/profil" aria-label="Profil" className={hdrIcon}><User size={20} /></Link>
            </div>
          }
          ring={{ value: usedFrac, big: fmtNum(Math.abs(left)), small: left < 0 ? 'kcal fazla' : 'kalan kcal', label: `Kalorinin yüzde ${Math.round(usedFrac * 100)}'i tüketildi` }}
          pills={[['Hedef', `${fmtNum(t.target.kcal)} kcal`], ['Yenen', t.eaten.kcal ? fmtNum(t.eaten.kcal) : '0'], ['Egzersiz', '+' + fmtNum(t.burned)]]}
        >
          <nav aria-label="Bu hafta" className="grid grid-cols-7 gap-1 mt-3">
            {t.week.map((d) => (
              <div key={d.day} className={`flex flex-col items-center gap-0.5 py-1 rounded-xl ${d.today ? 'bg-[var(--band-box)]' : ''}`} aria-current={d.today ? 'date' : undefined}>
                <span className="text-[10.5px] font-bold opacity-90">{d.label}</span>
                <Ring size={24} stroke={2.5} value={d.frac} color="#fff" track="rgba(255,255,255,0.3)">
                  <span className={`num text-[10px] font-semibold ${d.future ? 'opacity-60' : ''}`}>{d.num}</span>
                </Ring>
              </div>
            ))}
          </nav>
        </Band>
      </section>
    ),
    'today.macros': (
      <div className="card p-3.5 flex flex-col gap-2.5" aria-label="Makrolar">
        <div className="grid grid-cols-3 gap-3">
          {macros.map((m) => (
            <Link href="/yemek" key={m.name} className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 min-w-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} /><span className="truncate">{m.name === 'Karbonhidrat' ? <><span className="max-[350px]:hidden">Karbonhidrat</span><span className="min-[351px]:hidden" aria-hidden>Karb.</span></> : m.name}</span></div>
              <span className="text-[13px] text-mute"><b className="num text-ink font-semibold">{fmtNum(m.val)}</b> / {fmtNum(m.goal)} g</span>
              <Bar value={m.goal ? m.val / m.goal : 0} color={m.color} height={5} />
            </Link>
          ))}
        </div>
        {t.target.adjustment ? (
          <Link href="/fit" className="flex gap-2 items-start text-[12.5px] leading-snug text-ink-2 border-t border-line pt-2.5">
            <Pulse size={15} className="text-mute shrink-0 mt-0.5" />
            <span>{adjustText(t.target.reasons)} Plan {fmtNum(t.target.base)} kcal → bugün <b className="text-ink">{fmtNum(t.target.kcal)} kcal</b>.</span>
          </Link>
        ) : null}
      </div>
    ),
    'today.goal-choice': gs ? <GoalChoiceCard s={gs} /> : null,
    'today.week-brief': brief ? (
      <Link href={`/rapor?hafta=${brief.weekStart}`} className="card p-4 flex flex-col gap-2" data-testid="week-brief">
        <span className="flex items-center justify-between"><b className="text-[15px]">Geçen hafta</b><span className="text-acc font-bold text-[13px]">Rapor ›</span></span>
        <span className="grid grid-cols-4 gap-2 text-center">
          {[['Kayıt', `${brief.loggedDays}/7`], ['Uyum', brief.adherencePct === null ? '–' : `%${brief.adherencePct}`], ['Kilo', brief.weightChange === null ? '–' : `${brief.weightChange > 0 ? '+' : brief.weightChange < 0 ? '−' : ''}${fmtNum(Math.abs(brief.weightChange), 1)}`], ['Antrenman', String(brief.workouts)]].map(([l, v]) => (
            <span key={l} className="flex flex-col"><b className="num text-[17px]">{v}</b><span className="text-[11px] text-mute">{l}</span></span>
          ))}
        </span>
        <span className="text-[13px] text-ink-2 leading-snug">{brief.tip}</span>
      </Link>
    ) : null,
    'today.partner': partners.length && !trained ? (
      <Link href={tr.next ? `/fitness/antrenman?gun=${tr.next.id}` : '/fitness'} className="card px-4 py-3 flex items-center justify-between gap-3 border-l-4 border-acc" data-testid="partner-card" data-done="0">
        <span className="text-[14px] leading-snug">Partnerin <b>@{partners[0]}</b>{partners.length > 1 ? ` ve ${partners.length - 1} kişi daha` : ''} bugün antrenmanını yaptı. Sıra sende!</span>
        <span className="text-acc font-bold text-[13px] shrink-0">Başla ›</span>
      </Link>
    ) : partners.length ? (
      <p className="card px-4 py-3 text-[14px] leading-snug border-l-4 border-acc" data-testid="partner-card" data-done="1">
        Sen ve partnerin <b>@{partners[0]}</b>{partners.length > 1 ? ` (+${partners.length - 1})` : ''} bugün antrenmanınızı yaptınız. Birlikte istikrar böyle kazanılır.
      </p>
    ) : null,
    'today.post-protein': ds.postWorkoutProtein ? (
      <section className="card p-4 flex flex-col gap-2.5 border-l-4 border-[var(--color-protein)]" data-testid="post-workout-protein">
        <p className="text-[14px] leading-snug"><b>{ds.postWorkoutProtein.text}</b></p>
        {proteinPicks.length ? (
          <div className="flex flex-wrap gap-1.5">
            {proteinPicks.map((f) => <Link key={f.id} href={`/yemek/ekle?ogun=${mealNow}`} className="h-9 px-3 rounded-full bg-surface-2 text-[12.5px] font-semibold inline-flex items-center">{f.name} · {Math.round(f.protein)} g/100 g</Link>)}
          </div>
        ) : <Link href={`/yemek/ekle?ogun=${mealNow}`} className="text-[13px] font-bold text-acc">Protein ekle</Link>}
      </section>
    ) : null,
    'today.fit': (
      <Link href="/fit" data-mod="plan" aria-label="Kilo hedefi ve plan" className={tile}>
        <span className="flex items-center justify-between text-[13px] font-extrabold"><span className="flex items-center gap-1.5"><Target size={16} className="text-acc" />Fit</span><span className="text-acc text-[12px]">›</span></span>
        <span className="num text-[22px] font-bold leading-none">{fmtNum(w.trend, 1)} <span className="text-[13px] text-mute">kg</span></span>
        {!recomp ? (
          <>
            <div className="relative h-2 rounded-full bg-surface-3">
              <div className="absolute inset-y-0 left-0 rounded-full bg-acc" style={{ width: `${Math.max(3, w.progress * 100)}%` }} />
              <div className="absolute -top-0.5 w-0.5 h-3 rounded bg-ink" style={{ left: `calc(${w.planned * 100}% - 1px)` }} aria-hidden />
            </div>
            <span className="text-[12px] text-mute leading-tight">{t.goal ? <>Hedef tarih <b className="text-ink">{shortDate(addDays(t.goal.startDate, t.totalDays - 1))}</b></> : null}</span>
            {t.dayIndex > 1 ? <span className="text-[11.5px] text-ink-2 leading-tight">{Math.abs(diffPlan) < 0.05 ? 'Planla aynı' : `Planın ${fmtNum(Math.abs(diffPlan), 1)} kg ${diffPlan > 0 ? 'önünde' : 'gerisinde'}`}</span> : <span className="text-[11.5px] text-ink-2">Gün {t.dayIndex} / {t.totalDays}</span>}
          </>
        ) : <span className="text-[12px] text-ink-2 leading-snug">Rekompozisyon: kilonu koru, kas kazan.</span>}
      </Link>
    ),
    'today.water': (
      <section aria-label="Su" data-mod="water" className={tile}>
        <Link href="/su" className="flex flex-col gap-2">
          <span className="flex items-center justify-between text-[13px] font-extrabold"><span className="flex items-center gap-1.5"><Drop size={16} className="text-acc" />Su</span><span className="text-acc text-[12px]">%{Math.round(waterFrac * 100)}</span></span>
          <span className="flex items-baseline gap-1 flex-wrap">
            <span className="num text-[22px] font-bold leading-none">{fmtNum(t.waterMl)}</span>
            <span className="text-[12px] text-mute">/ {fmtNum(t.target.water)} ml</span>
          </span>
          <Bar value={waterFrac} color="var(--color-acc)" height={6} />
        </Link>
        <QuickWaterButton compact />
      </section>
    ),
    'today.training': (
      <Link href={trained || !tr.next ? '/fitness' : `/fitness/antrenman?gun=${tr.next.id}`} aria-label="Antrenman" data-mod="fitness" className={tile} data-testid="today-training">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col min-w-[9rem] flex-1">
            <span className="flex items-center gap-1.5 text-[13px] font-extrabold"><Dumbbell size={16} className="text-acc" />Antrenman</span>
            <span className="text-[15px] font-extrabold leading-snug truncate mt-1">{trained ? `${tr.minutes} dk tamamlandı` : tr.next ? `Sıradaki: ${tr.next.name}` : 'Bugün kayıt yok'}</span>
            <span className="text-[12px] text-mute truncate">{trained ? `+${fmtNum(t.burned)} kcal bütçeye eklendi` : tr.next ? null : t.profile.trainingDays ? `Haftalık hedef · ${t.profile.trainingDays} gün` : 'Program oluşturarak başla'}</span>
          </div>
          <span className="h-10 px-4 rounded-full bg-acc text-acc-ink font-bold text-[14px] inline-flex items-center shrink-0">{trained ? 'Detay' : 'Başlat'}</span>
        </div>
      </Link>
    ),
    'today.coach': <div data-mod="coach"><InsightCard fallback={coachLine(t)} weeklyReady={weeklyReady} compact /></div>,
    'today.streaks': streaks ? (
      <Link href="/profil/basarilar" className="card p-4 flex flex-col gap-2" data-testid="streaks-card">
        <span className="flex items-center justify-between"><b className="text-[15px] flex items-center gap-1.5"><Flame size={16} className="text-acc" />Seriler</b><span className="text-acc font-bold text-[13px]">Başarılar ›</span></span>
        <span className="grid grid-cols-3 gap-2 text-center">
          {[['Yemek kaydı', `${streaks.foodStreak} gün`], ['Su hedefi', `${t.streak} gün`], ['Antrenman', `${streaks.weekStreak} hafta`]].map(([l, v]) => (
            <span key={l} className="flex flex-col"><b className="num text-[17px]">{v}</b><span className="text-[11px] text-mute">{l}</span></span>
          ))}
        </span>
      </Link>
    ) : null,
  }
  const coachHidden = !layout.items.some((i) => i.id === 'today.coach')

  return (
    <div className="px-4 flex flex-col gap-3">
      <CardBoard screen="today" editing={editing} items={layout.items.map((i) => ({ id: i.id, size: i.size }))} nodes={nodes}
        drawer={layout.drawer.map((d) => ({ id: d.def.id, reason: d.reason }))} notices={layout.notices} applied={layout.applied} />
      {/* koç kartı kaldırılsa da güvenlik destek kartı gösterilir */}
      {coachHidden && !editing ? <div data-mod="coach"><InsightCard fallback="" weeklyReady={false} compact supportOnly /></div> : null}
    </div>
  )
}

function adjustText(reasons: { kcal: number; reason: string }[]): string {
  const sum = (r: string) => reasons.filter((x) => x.reason === r).reduce((a, x) => a + x.kcal, 0)
  const parts: string[] = []
  const bal = sum('balance'), save = sum('bank-save'), spend = sum('bank-spend')
  const s = (n: number) => `${n > 0 ? '+' : '−'}${fmtNum(Math.abs(n))} kcal`
  if (bal) parts.push(`Akıllı dengeleme ${s(bal)}`)
  if (save) parts.push(`kalori bankası birikimi ${s(save)}`)
  if (spend) parts.push(`etkinlik günü ${s(spend)}`)
  const t = parts.join(', ')
  return t.charAt(0).toUpperCase() + t.slice(1) + '.'
}

function coachLine(t: NonNullable<Awaited<ReturnType<typeof getToday>>>): string {
  if (t.dayIndex <= 1) {
    return `Planın hazır: günde ${fmtNum(t.target.kcal)} kcal ve ${fmtNum(t.target.protein)} g protein. İlk hafta amacın sadece düzenli kayıt tutmak; tartını her sabah aynı saatte yap.`
  }
  if (t.weight.history.length < 3) return 'Kilo trendini hesaplayabilmem için haftada en az 3 gün tartı kaydı gir. + butonundan “Kilo gir”i kullanabilirsin.'
  return `Bugün ${fmtNum(t.target.protein)} g protein hedefin var. Proteini öğünlere bölmek tokluğu artırır ve kas korumayı kolaylaştırır.`
}
