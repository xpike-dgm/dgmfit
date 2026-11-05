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
import { Drop, Dumbbell, Flame, Pulse, User } from '@/components/icons'

export default async function Today() {
  const user = await requireUser()
  await closePendingDays(user.id)
  const t = await getToday(user.id)
  if (!t) redirect('/kurulum')
  const tr = await todayTraining(user.id, t.day)
  // Haftalık rapor kısayolu: Pazar 18.00'den Pazartesi sonuna kadar
  const weeklyReady = latestReportWeek() === mondayOf(t.day) || latestReportWeek() === addDays(mondayOf(t.day), -7) && new Date(t.day + 'T12:00:00Z').getUTCDay() === 1

  const budget = t.target.kcal + t.burned
  const left = budget - t.eaten.kcal
  const usedFrac = budget > 0 ? t.eaten.kcal / budget : 0
  const w = t.weight
  const recomp = t.goal?.type === 'recomp'
  const diffPlan = (w.progress - w.planned) * Math.abs(w.target - w.start)
  const waterFrac = t.target.water ? t.waterMl / t.target.water : 0

  const macros = [
    { name: 'Protein', val: t.eaten.protein, goal: t.target.protein, color: 'var(--color-protein)' },
    { name: 'Karbonhidrat', val: t.eaten.carb, goal: t.target.carb, color: 'var(--color-orange)' },
    { name: 'Yağ', val: t.eaten.fat, goal: t.target.fat, color: 'var(--color-violet)' },
  ]

  const stripe = 'card p-4 flex flex-col gap-3 border-l-4 border-acc'
  const trained = tr.workouts || tr.cardio

  return (
    <div className="px-4 flex flex-col gap-3">
      <section aria-label="Kalori" className="flex flex-col gap-3">
        <Band
          title={<>{greeting()}, {user.username}</>}
          sub={<span className="capitalize">{longDate(t.day)}</span>}
          right={
            <div className="flex gap-2 items-center">
              <Link href="/su/istatistik" className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/20 text-sm font-bold" aria-label={`Su serisi: ${t.streak} gün`}>
                <Flame size={16} />{t.streak}
              </Link>
              <Link href="/profil" aria-label="Profil" className={hdrIcon}><User size={20} /></Link>
            </div>
          }
          ring={{ value: usedFrac, big: fmtNum(left), small: 'kalan kcal', label: `Kalorinin yüzde ${Math.round(usedFrac * 100)}'i tüketildi` }}
          pills={[['Hedef', `${fmtNum(t.target.kcal)} kcal`], ['Yenen', t.eaten.kcal ? fmtNum(t.eaten.kcal) : '0'], ['Egzersiz', '+' + fmtNum(t.burned)]]}
        />

        <nav aria-label="Bu hafta" className="card px-2 py-2 grid grid-cols-7 gap-1">
          {t.week.map((d) => (
            <div key={d.day} className={`flex flex-col items-center gap-1 py-1.5 rounded-2xl ${d.today ? 'bg-surface-2' : ''}`} aria-current={d.today ? 'date' : undefined}>
              <span className={`text-[11px] font-bold ${d.today ? 'text-acc' : 'text-mute'}`}>{d.label}</span>
              <Ring size={28} stroke={3} value={d.frac} color={d.frac >= 1 ? 'var(--color-acc)' : 'var(--color-ink-2)'} track="var(--color-line)">
                <span className={`num text-[10.5px] font-semibold ${d.future ? 'text-faint' : 'text-ink'}`}>{d.num}</span>
              </Ring>
            </div>
          ))}
        </nav>

        <div className="card p-4 flex flex-col gap-3">
          <h2 className="text-[15px] font-extrabold">Makrolar</h2>
          {macros.map((m) => (
            <div key={m.name} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold"><span className="w-2 h-2 rounded-full" style={{ background: m.color }} />{m.name}</span>
                <span className="text-mute"><b className="num text-ink font-semibold">{fmtNum(m.val)}</b> / {fmtNum(m.goal)} g</span>
              </div>
              <Bar value={m.goal ? m.val / m.goal : 0} color={m.color} />
            </div>
          ))}
          <div className="flex gap-2.5 items-start px-3.5 py-3 rounded-2xl bg-surface-2">
            <Pulse size={18} className="text-mute shrink-0 mt-0.5" />
            <span className="text-[13px] leading-relaxed text-ink-2">
              {t.target.adjustment
                ? <>{adjustText(t.target.reasons)} Plan {fmtNum(t.target.base)} kcal → bugün <b className="text-ink">{fmtNum(t.target.kcal)} kcal</b>.</>
                : <>Bir gün hedefin üstünde ya da altında kalırsan fark, sonraki günlere dengeli şekilde dağıtılır.</>}
              {' '}<Link href="/fit" className="text-acc font-semibold whitespace-nowrap">Plan ayrıntıları</Link>
            </span>
          </div>
        </div>
      </section>

      <Link href="/fit" data-mod="plan" aria-label="Kilo hedefi ve plan" className={stripe}>
        <div className="flex justify-between items-center">
          <span className="text-[15px] font-extrabold">Fit · plan</span>
          <span className="text-[13px] font-bold text-acc">Aç ›</span>
        </div>
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <span className="text-[13px] text-mute">Trend kilo</span>
            <span className="num text-[28px] font-bold tracking-[-0.02em] leading-tight">{fmtNum(w.trend, 1)} <span className="text-base text-mute">kg</span></span>
          </div>
          {t.goal && !recomp ? (
            <span className="text-right text-[13px] text-mute">Hedef tarih<br /><b className="text-ink">{shortDate(addDays(t.goal.startDate, t.totalDays - 1))}</b></span>
          ) : null}
        </div>
        {!recomp ? (
          <div className="flex flex-col gap-2">
            <div className="relative h-2.5 rounded-full bg-surface-3">
              <div className="absolute inset-y-0 left-0 rounded-full bg-acc transition-[width] duration-500" style={{ width: `${Math.max(2, w.progress * 100)}%` }} />
              <div className="absolute -top-1 w-0.5 h-[18px] rounded bg-ink" style={{ left: `calc(${w.planned * 100}% - 1px)` }} aria-hidden />
            </div>
            <div className="flex justify-between text-[12.5px] text-mute">
              <span className="num">{fmtNum(w.start, 1)} kg</span>
              <span className="text-ink-2">Gün {t.dayIndex} / {t.totalDays}{t.dayIndex > 1 ? ` · ${Math.abs(diffPlan) < 0.05 ? 'planla aynı' : `planın ${fmtNum(Math.abs(diffPlan), 1)} kg ${diffPlan > 0 ? 'önünde' : 'gerisinde'}`}` : ''}</span>
              <span className="num">{fmtNum(w.target, 1)} kg</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-2">Rekompozisyon: kilonu koruyup kas kazanıyorsun. Haftalık tartı ve ölçüleri takip et.</p>
        )}
      </Link>

      <section aria-label="Su" data-mod="water" className={stripe}>
        <Link href="/su" className="flex flex-col gap-2">
          <span className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[15px] font-extrabold"><Drop size={18} className="text-acc" />Su</span>
            <span className="text-[13px] font-bold text-acc">%{Math.round(waterFrac * 100)}</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="num text-[26px] font-bold tracking-[-0.02em]">{fmtNum(t.waterMl)}</span>
            <span className="text-[13px] text-ink-2">/ {fmtNum(t.target.water)} ml</span>
          </span>
          <Bar value={waterFrac} color="var(--color-acc)" />
        </Link>
        <QuickWaterButton />
      </section>

      <Link href={trained || !tr.next ? '/fitness' : `/fitness/antrenman?gun=${tr.next.id}`} aria-label="Antrenman" data-mod="fitness" className={stripe} data-testid="today-training">
        <div className="flex items-center gap-2"><Dumbbell size={18} className="text-acc" /><span className="text-[15px] font-extrabold">Antrenman</span></div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-lg font-extrabold leading-snug">{trained ? `${tr.minutes} dk tamamlandı` : tr.next ? `Sıradaki: ${tr.next.name}` : 'Bugün kayıt yok'}</span>
            <span className="text-[13px] text-mute">{trained ? `+${fmtNum(t.burned)} kcal bütçeye eklendi` : tr.next ? 'Sıradaki program günü' : t.profile.trainingDays ? `Haftalık hedef · ${t.profile.trainingDays} gün` : 'Program oluşturarak başla'}</span>
          </div>
          <span className="h-10 px-4 rounded-full bg-acc text-acc-ink font-bold text-[14px] inline-flex items-center shrink-0">{trained ? 'Detay' : 'Başlat'}</span>
        </div>
      </Link>

      <div data-mod="coach"><InsightCard fallback={coachLine(t)} weeklyReady={weeklyReady} /></div>
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
