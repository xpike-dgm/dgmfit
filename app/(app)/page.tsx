import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getToday } from '@/lib/today'
import { greeting, longDate, shortDate, addDays } from '@/lib/time'
import { fmtNum } from '@/lib/calc'
import { Bar, Ring } from '@/components/ui'
import QuickWaterButton from '@/components/QuickWaterButton'
import { Drop, Dumbbell, Flame, Pulse, Spark, User } from '@/components/icons'

export default async function Today() {
  const user = await requireUser()
  const t = await getToday(user.id)
  if (!t) redirect('/kurulum')

  const budget = t.target.kcal + t.burned
  const left = budget - t.eaten.kcal
  const usedFrac = budget > 0 ? t.eaten.kcal / budget : 0
  const w = t.weight
  const recomp = t.goal?.type === 'recomp'
  const diffPlan = (w.progress - w.planned) * Math.abs(w.target - w.start)
  const waterFrac = t.target.water ? t.waterMl / t.target.water : 0

  const macros = [
    { name: 'Protein', val: t.eaten.protein, goal: t.target.protein, color: 'var(--color-lime)' },
    { name: 'Karbonhidrat', val: t.eaten.carb, goal: t.target.carb, color: 'var(--color-orange)' },
    { name: 'Yağ', val: t.eaten.fat, goal: t.target.fat, color: 'var(--color-violet)' },
  ]

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-6 pb-2 flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <span className="num font-bold text-[15px] tracking-wide text-lime">DgFit</span>
          <span className="text-sm text-mute capitalize">{longDate(t.day)}</span>
          <h1 className="mt-0.5 text-[26px] leading-tight font-extrabold tracking-tight">{greeting()}, {user.username}</h1>
        </div>
        <div className="flex gap-2 items-center pt-1">
          <Link href="/su/istatistik" className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-surface-2 text-sm font-bold" aria-label={`Su serisi: ${t.streak} gün`}>
            <Flame size={16} className="text-orange" />{t.streak}
          </Link>
          <Link href="/profil" aria-label="Profil" className="w-11 h-11 rounded-full border border-line bg-surface flex items-center justify-center"><User size={20} /></Link>
        </div>
      </header>

      <nav aria-label="Bu hafta" className="px-5 pt-3 pb-1 grid grid-cols-7 gap-1.5">
        {t.week.map((d) => (
          <div key={d.day} className={`flex flex-col items-center gap-1.5 py-2 rounded-2xl ${d.today ? 'bg-surface-2' : ''}`} aria-current={d.today ? 'date' : undefined}>
            <span className={`text-xs font-semibold ${d.today ? 'text-lime' : 'text-mute'}`}>{d.label}</span>
            <Ring size={30} stroke={3} value={d.frac} color={d.frac >= 1 ? 'var(--color-lime)' : 'var(--color-ink-2)'} track="var(--color-line)">
              <span className={`num text-[11px] font-semibold ${d.future ? 'text-faint' : 'text-ink'}`}>{d.num}</span>
            </Ring>
          </div>
        ))}
      </nav>

      <main className="px-4 pt-3 flex flex-col gap-3">
        <section aria-label="Kalori" className="card p-5 flex flex-col gap-[18px]">
          <div className="flex justify-between items-center">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-mute">Kalan kalori</span>
              <span className="num text-[52px] font-bold tracking-[-0.03em] leading-none">{fmtNum(left)}</span>
              <span className="text-sm text-mute">kcal · %{Math.round(usedFrac * 100)} tüketildi</span>
            </div>
            <Ring size={124} stroke={12} value={usedFrac} label={`Kalorinin yüzde ${Math.round(usedFrac * 100)}'i tüketildi`}>
              <Flame size={24} />
            </Ring>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Mini label="Hedef" value={fmtNum(t.target.kcal)} />
            <Mini label="Yenen" value={t.eaten.kcal ? '−' + fmtNum(t.eaten.kcal) : '0'} />
            <Mini label="Egzersiz" value={'+' + fmtNum(t.burned)} accent />
          </div>
          <div className="flex flex-col gap-3">
            {macros.map((m) => (
              <div key={m.name} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold"><span className="w-2 h-2 rounded-full" style={{ background: m.color }} />{m.name}</span>
                  <span className="text-mute"><b className="num text-ink font-semibold">{fmtNum(m.val)}</b> / {fmtNum(m.goal)} g</span>
                </div>
                <Bar value={m.goal ? m.val / m.goal : 0} color={m.color} />
              </div>
            ))}
          </div>
          <div className="flex gap-2.5 items-start px-3.5 py-3 rounded-2xl bg-surface-2">
            <Pulse size={18} className="text-mute shrink-0 mt-0.5" />
            <span className="text-[13px] leading-relaxed text-ink-2">
              {t.target.adjustment
                ? <>Akıllı dengeleme bugünkü hedefini <b className="text-ink">{t.target.adjustment > 0 ? '+' : '−'}{fmtNum(Math.abs(t.target.adjustment))} kcal</b> ayarladı.</>
                : <>Bir gün hedefin üstünde ya da altında kalırsan fark, sonraki günlere dengeli şekilde dağıtılır.</>}
            </span>
          </div>
        </section>

        <section aria-label="Kilo hedefi" className="card p-5 flex flex-col gap-3.5">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-mute">Trend kilo</span>
              <span className="num text-[34px] font-bold tracking-[-0.02em]">{fmtNum(w.trend, 1)} <span className="text-lg text-mute">kg</span></span>
            </div>
            {t.goal && !recomp ? (
              <span className="text-right text-[13px] text-mute">Hedef tarih<br /><b className="text-ink">{shortDate(addDays(t.goal.startDate, t.totalDays - 1))}</b></span>
            ) : null}
          </div>
          {!recomp ? (
            <div className="flex flex-col gap-2">
              <div className="relative h-2.5 rounded-full bg-surface-3">
                <div className="absolute inset-y-0 left-0 rounded-full bg-lime transition-[width] duration-500" style={{ width: `${Math.max(2, w.progress * 100)}%` }} />
                <div className="absolute -top-1 w-0.5 h-[18px] rounded bg-ink" style={{ left: `calc(${w.planned * 100}% - 1px)` }} aria-hidden />
              </div>
              <div className="flex justify-between text-[13px] text-mute">
                <span className="num">{fmtNum(w.start, 1)} kg</span>
                <span className="text-ink-2">Gün {t.dayIndex} / {t.totalDays}{t.dayIndex > 1 ? ` · ${Math.abs(diffPlan) < 0.05 ? 'planla aynı' : `planın ${fmtNum(Math.abs(diffPlan), 1)} kg ${diffPlan > 0 ? 'önünde' : 'gerisinde'}`}` : ''}</span>
                <span className="num">{fmtNum(w.target, 1)} kg</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-2">Rekompozisyon: kilonu koruyup kas kazanıyorsun. Haftalık tartı ve ölçüleri takip et.</p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3">
          <section aria-label="Su" className="card p-[18px] flex flex-col gap-3 relative overflow-hidden min-h-[196px]">
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-water/20 to-water/[0.08] transition-[height] duration-700" style={{ height: `${Math.min(1, waterFrac) * 100}%` }} />
            <Link href="/su" className="relative flex flex-col gap-3">
              <span className="flex items-center gap-2"><Drop size={18} className="text-water" /><span className="text-sm font-bold">Su</span></span>
              <span className="flex flex-col">
                <span className="num text-[30px] font-bold tracking-[-0.02em]">{fmtNum(t.waterMl)}</span>
                <span className="text-[13px] text-ink-2">/ {fmtNum(t.target.water)} ml · %{Math.round(waterFrac * 100)}</span>
              </span>
            </Link>
            <QuickWaterButton />
          </section>
          <Link href="/fitness" aria-label="Antrenman" className="card p-[18px] flex flex-col gap-3 min-h-[196px]">
            <div className="flex items-center gap-2"><Dumbbell size={18} className="text-orange" /><span className="text-sm font-bold">Antrenman</span></div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xl font-extrabold">Bugün kayıt yok</span>
              <span className="text-[13px] text-mute">{t.profile.trainingDays ? `Haftalık hedef · ${t.profile.trainingDays} gün` : 'Program oluşturarak başla'}</span>
            </div>
            <span className="mt-auto h-11 rounded-full border border-line-2 text-ink font-bold text-[15px] flex items-center justify-center">Başlat</span>
          </Link>
        </div>

        <section aria-label="Koç" className="rounded-[28px] px-5 py-[18px] flex flex-col gap-3 bg-coach border border-coach-line">
          <div className="flex items-center gap-2"><Spark size={18} className="text-lime" /><span className="text-[13px] font-bold tracking-[0.08em] uppercase text-lime">Koç</span></div>
          <p className="text-[15px] leading-relaxed text-[#E4E8DC]">{coachLine(t)}</p>
        </section>
      </main>
    </div>
  )
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-surface-2 rounded-2xl px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-xs text-mute">{label}</span>
      <span className={`num text-lg font-semibold ${accent ? 'text-orange' : ''}`}>{value}</span>
    </div>
  )
}

function coachLine(t: NonNullable<Awaited<ReturnType<typeof getToday>>>): string {
  if (t.dayIndex <= 1) {
    return `Planın hazır: günde ${fmtNum(t.target.kcal)} kcal ve ${fmtNum(t.target.protein)} g protein. İlk hafta amacın sadece düzenli kayıt tutmak; tartını her sabah aynı saatte yap.`
  }
  if (t.weight.history.length < 3) return 'Kilo trendini hesaplayabilmem için haftada en az 3 gün tartı kaydı gir. + butonundan “Kilo gir”i kullanabilirsin.'
  return `Bugün ${fmtNum(t.target.protein)} g protein hedefin var. Proteini öğünlere bölmek tokluğu artırır ve kas korumayı kolaylaştırır.`
}
