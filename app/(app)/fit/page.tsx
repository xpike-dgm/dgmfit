import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getFitScreen } from '@/lib/fit-data'
import { carbCycleFor } from '@/lib/planner-data'
import { addDays, diffDays, longDate, shortDate } from '@/lib/time'
import { fmtNum, GOALS, type GoalType } from '@/lib/calc'
import { Band, Eyebrow } from '@/components/ui'
import { Calendar, Pulse, Scale, Spark, Trend } from '@/components/icons'
import { DayClose, ExceptionButton, FitFlash, WeighIn } from './FitClient'
import InfoTip from '@/components/InfoTip'
import { isAdvanced } from '@/lib/ui-mode'
import { screenLayout, userStyle } from '@/lib/cards/design-data'
import { weightOut } from '@/lib/units'
import CardBoard from '@/components/cards/CardBoard'
import type { ReactNode } from 'react'

export const metadata = { title: 'Plan · DgFit' }

const KIND: Record<string, string> = {
  balanced: 'Hedefte', over: 'Fazla', under: 'Az', incomplete: 'Eksik kayıt', untracked: 'Kayıt yok', exception: 'İstisna',
}
const WD = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
const wd = (d: string) => WD[new Date(d + 'T12:00:00Z').getUTCDay()]

export default async function FitPage(props: { searchParams: Promise<{ duzenle?: string }> }) {
  const user = await requireUser()
  const s = await getFitScreen(user.id)
  if (!s) redirect('/kurulum')
  const { goal, today, checkin } = s
  const sp = await props.searchParams
  const editing = sp.duzenle === '1'
  const [cc, adv, layout, sty] = await Promise.all([carbCycleFor(user.id), isAdvanced(user.id), screenLayout(user.id, 'fit', { editing }), userStyle(user.id)])
  const wu = sty.units.weight
  const type = goal.type as GoalType
  const totalDays = diffDays(goal.startDate, goal.endDate) + 1
  const dayIndex = Math.min(totalDays, diffDays(goal.startDate, today) + 1)
  const trendNow = checkin?.trendNow ?? goal.startWeightKg
  const change = Math.round((trendNow - goal.startWeightKg) * 10) / 10
  const lastWeigh = [...s.series].reverse().find((p) => p.raw !== null)
  const last = s.closures[0]
  const span = Math.abs(goal.targetWeightKg - goal.startWeightKg)
  const progress = type === 'recomp' || span < 0.05 ? 0 : Math.max(0, Math.min(1, ((trendNow - goal.startWeightKg) * Math.sign(goal.targetWeightKg - goal.startWeightKg)) / span))
  const forecastText = type === 'recomp' ? 'Rekompozisyonda kilonun sabit kalması beklenir; trend çizgisi ±1 kg bandında kalmalı.'
            : checkin?.forecast.day ? <>Son haftaların hızıyla (<b className="text-ink">{fmtNum(Math.abs(checkin.forecast.kgPerWeek ?? 0), 2)} kg/hafta</b>) hedefe <b className="text-ink">{shortDate(checkin.forecast.day)}</b> civarında ulaşırsın{checkin.forecast.day > goal.endDate ? `, planlanandan ${diffDays(goal.endDate, checkin.forecast.day)} gün sonra` : checkin.forecast.day < goal.endDate ? `, planlanandan ${diffDays(checkin.forecast.day, goal.endDate)} gün önce` : ''}.</>
            : <>Tahmin için en az 5 günlük tartı gerekiyor. Her sabah aynı koşulda tartılmak trendi netleştirir.</>
  const exceptionable = s.closures.find((c) => c.kind === 'over' && c.remaining < 0 && type === 'lose')

  const nodes: Record<string, ReactNode> = {
    'fit.header': <div className="flex flex-col gap-3">
      <Band title="Plan" sub={`${GOALS[type]?.label ?? 'Hedef'} · Gün ${dayIndex} / ${totalDays}`}
        ring={{ value: progress, big: fmtNum(weightOut(trendNow, wu), 1), small: `trend ${wu}`, label: `Hedefin yüzde ${Math.round(progress * 100)}'i` }}
        pills={[['Hedef', type === 'recomp' ? 'Koru' : `${fmtNum(weightOut(goal.targetWeightKg, wu), 1)} ${wu}`], [checkin?.forecast.day ? 'Tahmini varış' : 'Hedef tarih', shortDate(checkin?.forecast.day ?? goal.endDate)], ['Bugün', `${fmtNum(s.targets[0].kcal)} kcal`]]} />
      <FitFlash />
    </div>,
    'fit.goal': (
      <section aria-label="Hedef" className="card p-5 flex flex-col gap-3">
        {adv ? <div className="flex justify-between items-start gap-3">
          <div className="flex flex-col gap-0.5">
            <Eyebrow>{GOALS[type]?.label ?? 'Hedef'}</Eyebrow>
            <span className="num text-[30px] font-bold tracking-[-0.02em]">
              {fmtNum(goal.startWeightKg, 1)} <span className="text-mute text-xl">→</span> {fmtNum(goal.targetWeightKg, 1)} <span className="text-lg text-mute">kg</span>
            </span>
            <span className="text-sm text-mute">Gün {dayIndex} / {totalDays} · hedef tarih <b className="text-ink">{shortDate(goal.endDate)}</b></span>
          </div>
          <span className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center text-acc"><Trend size={22} /></span>
        </div> : (
          <div className="flex items-center gap-2">
            <Eyebrow>Kilo</Eyebrow>
            <InfoTip label="Grafik açıklaması">
              <span className="flex flex-wrap gap-x-3 gap-y-1 mb-2"><span>— Trend</span><span>··· Plan</span><span>• Tartı</span><span>- - Tahmin</span></span>
              {forecastText}
            </InfoTip>
          </div>
        )}
        <Roadmap s={s} />
        {adv ? <>
        <div className="flex gap-4 text-[12px] text-ink-2 -mt-1" aria-hidden>
          <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] rounded bg-acc" />Trend</span>
          <span className="flex items-center gap-1.5"><span className="w-3 border-t-[1.5px] border-dotted border-ink-2" />Plan</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-mute" />Tartı</span>
          <span className="flex items-center gap-1.5"><span className="w-3 border-t-[1.5px] border-dashed border-acc opacity-70" />Tahmin</span>
        </div>
        <p className="text-[13px] text-ink-2 leading-relaxed" data-testid="forecast">
          {type === 'recomp' ? 'Rekompozisyonda kilonun sabit kalması beklenir; trend çizgisi ±1 kg bandında kalmalı.'
            : checkin?.forecast.day ? <>Son haftaların hızıyla (<b className="text-ink">{fmtNum(Math.abs(checkin.forecast.kgPerWeek ?? 0), 2)} kg/hafta</b>) hedefe <b className="text-ink">{shortDate(checkin.forecast.day)}</b> civarında ulaşırsın{checkin.forecast.day > goal.endDate ? `, planlanandan ${diffDays(goal.endDate, checkin.forecast.day)} gün sonra` : checkin.forecast.day < goal.endDate ? `, planlanandan ${diffDays(checkin.forecast.day, goal.endDate)} gün önce` : ''}.</>
            : <>Tahmin için en az 5 günlük tartı gerekiyor. Her sabah aynı koşulda tartılmak trendi netleştirir.</>}
        </p>
        </> : null}
      </section>
    ),
    'fit.quality': s.quality ? (
        <section aria-label="Kazanım kalitesi" className="card p-4 flex flex-col gap-2" data-testid="quality-card" data-verdict={s.quality.verdict}>
          <div className="flex items-center justify-between"><Eyebrow>{type === 'lose' ? 'Kayıp kalitesi' : 'Kazanım kalitesi'}</Eyebrow><Link href="/profil/vucut" className="hit text-[12px] text-acc font-bold">Yağ oranı</Link></div>
          <p className="text-[14px] leading-snug">{s.quality.text}</p>
          {s.quality.waistDeltaCm === null ? <Link href="/fitness/olcumler" className="text-[12.5px] text-mute">2 haftada bir bel ölçünü girersen yağ mı kas mı ayırt ederiz ›</Link> : null}
        </section>
      ) : null,
    'fit.trend': <Stat label="Trend kilo" value={`${fmtNum(trendNow, 1)} kg`} sub={lastWeigh ? `Son tartı ${fmtNum(lastWeigh.raw!, 1)} kg` : 'Tartı yok'} />,
    'fit.change': <Stat label="Değişim" value={`${change > 0 ? '+' : change < 0 ? '−' : ''}${fmtNum(Math.abs(change), 1)} kg`} sub={`Başlangıç ${fmtNum(goal.startWeightKg, 1)} kg`} />,
    'fit.tdee': <Stat label="Ölçülen harcama" value={checkin?.tdee.tdee ? `${fmtNum(checkin.tdee.tdee)}` : '—'} sub={checkin?.tdee.tdee ? `kcal · güven ${checkin.tdee.confidence}` : `Veri toplanıyor · ${checkin?.tdee.loggedDays ?? 0}/10 tam gün`} />,
    'fit.plan-kcal': <Stat label="Plan kalorisi" value={fmtNum(goal.dailyKcal)} sub={`kcal · tahmini harcama ${fmtNum(goal.tdee)}`} />,
    'fit.today': (
      <section aria-label="Bugün" className="card p-5 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2"><Eyebrow>Bugün</Eyebrow><InfoTip label="Gün kapatma">Günü kapatınca hedefle arasındaki fark sonraki günlere dağıtılır. Kapatmazsan gün gece 03.00'te kendiliğinden kapanır; kapandıktan sonra öğün değiştirirsen hesap yenilenir.</InfoTip></span>
          <span className="text-sm text-mute capitalize">{longDate(today)}</span>
        </div>
        <div className="flex items-end justify-between">
          <span className="flex flex-col">
            <span className="num text-[34px] font-bold leading-none" data-testid="today-target">{fmtNum(s.targets[0].kcal)}</span>
            <span className="text-sm text-mute">kcal hedef · {fmtNum(s.todayState.eaten)} yendi</span>
          </span>
          {s.targets[0].adjustment ? <span className="num text-sm font-bold px-3 h-8 rounded-full bg-surface-2 flex items-center">{signed(s.targets[0].adjustment)} kcal</span> : null}
        </div>
        <DayClose day={today} closed={s.todayState.closed} items={s.todayState.items}
          result={s.todayState.closure ? { kind: s.todayState.closure.closureKind ?? '', diff: s.todayState.closure.diffKcal ?? 0 } : null} />
      </section>
    ),
    'fit.balance': last ? (
        <section aria-label="Dengeleme" className="card p-5 flex flex-col gap-3" data-testid="balance-card">
          <div className="flex items-center gap-2"><Pulse size={18} className="text-acc" /><Eyebrow>Akıllı dengeleme</Eyebrow></div>
          <p className="text-[15px] leading-relaxed text-ink-2">{closureText(last)}</p>
          {exceptionable ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 px-4 py-3">
              <span className="text-[13px] text-ink-2 leading-relaxed">
                {shortDate(exceptionable.day)} günündeki fazlanın <b className="text-ink">{fmtNum(-exceptionable.remaining)} kcal</b>'si önümüzdeki günlerden düşülecek.
                Doğum günü, bayram gibi özel bir günse istisna say: sonraki günlerin hedefi düşmez, hedef tarihin en fazla 3 gün uzar.
              </span>
              <ExceptionButton day={exceptionable.day} />
            </div>
          ) : null}
          <ol className="flex gap-1.5" aria-label="Son günler">
            {s.closures.slice(0, 7).reverse().map((c) => (
              <li key={c.day} className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-surface-2" title={`${shortDate(c.day)}: ${KIND[c.kind]}`}>
                <span className="text-[11px] text-mute">{wd(c.day)}</span>
                <span className={`num text-[12px] font-bold ${c.kind === 'over' ? 'text-orange' : c.kind === 'under' ? 'text-water' : c.kind === 'balanced' ? 'text-acc' : 'text-faint'}`}>
                  {c.kind === 'over' || c.kind === 'under' ? signed(c.eaten - c.target) : c.kind === 'balanced' ? '✓' : '·'}
                </span>
              </li>
            ))}
          </ol>
        </section>
    ) : null,
    'fit.milestone': Math.abs(change) >= 1 ?  <Link href="/sosyal/yeni?tur=milestone" className="card px-5 py-4 flex items-center justify-between" data-testid="share-milestone"><span className="text-[14px]">Kilometre taşını paylaş <span className="text-mute">(yalnızca değişim, kilo görünmez)</span></span><span className="text-acc font-bold">Paylaş</span></Link>  : null,
    'fit.tools':  <nav aria-label="Plan araçları" className="grid grid-cols-2 gap-2">
        {([
          ['/fit/gunler', 'Önümüzdeki 7 gün', `Bugün ${fmtNum(s.targets[0].kcal)} kcal`, Calendar],
          ['/fit/banka', 'Kalori bankası', s.banks.length ? `${s.banks.length} aktif` : 'Özel gün için biriktir', Spark],
          ['/fit/checkin', 'Haftalık check-in', checkin?.proposal ? (checkin.due ? 'Hazır' : `Sonraki ${shortDate(addDays(checkin.lastCheckin, 7))}`) : 'Veri toplanıyor', Pulse],
          ...(type !== 'recomp' ? [['/fit/senaryo', 'Senaryo simülatörü', 'Ne olursa ne zaman?', Trend] as const] : []),
          ['/fit/karb', 'Karb döngüsü', cc.enabled ? 'Açık' : 'Kapalı', Scale],
        ] as const).map(([href, label, sub, I]) => (
          <Link key={href} href={href} className="card p-3.5 flex flex-col gap-2 min-h-[92px]">
            <span className="w-9 h-9 rounded-xl bg-acc/15 text-acc flex items-center justify-center"><I size={18} /></span>
            <span className="flex flex-col min-w-0"><b className="text-[14px] leading-tight">{label}</b><span className="text-[12px] text-mute truncate">{sub}</span></span>
          </Link>
        ))}
      </nav> ,
    'fit.weigh': (
      <section id="tarti" aria-label="Tartı" className="card p-5 flex flex-col gap-3 scroll-mt-4">
        <div className="flex items-center gap-2"><Scale size={18} className="text-mute" /><Eyebrow>Tartı</Eyebrow><InfoTip label="Tartı ipucu">Sabah, tuvaletten sonra ve kahvaltıdan önce tartılmak en tutarlı sonucu verir.</InfoTip></div>
        <WeighIn last={lastWeigh?.raw ?? goal.startWeightKg} unit={wu} />
        <Link href="/profil/hedef" className="text-[13px] text-mute underline underline-offset-4">Hedef ve plan</Link>
      </section>
    ),
  }

  return (
    <div className="flex flex-col gap-3 px-4">
      <CardBoard screen="fit" editing={editing} items={layout.items.map((i) => ({ id: i.id, size: i.size, stack: i.stack }))} nodes={nodes}
        drawer={layout.drawer.map((d) => ({ id: d.def.id, reason: d.reason }))} notices={layout.notices} applied={layout.applied} quick={layout.quick} pinned={layout.pinned} colors={layout.colors} />
    </div>
  )
}

type Screen = NonNullable<Awaited<ReturnType<typeof getFitScreen>>>

function signed(n: number) { return `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtNum(Math.abs(n))}` }


function closureText(c: Screen['closures'][number]): string {
  const d = shortDate(c.day)
  const raw = c.eaten - c.target
  switch (c.kind) {
    case 'over': return `${d}: hedefin ${fmtNum(raw)} kcal üstündeydin. ${c.leftover ? `${fmtNum(raw - c.leftover)} kcal'i sonraki günlere dağıtıldı; ${fmtNum(c.leftover)} kcal sınırlar yüzünden dağıtılamadı.` : 'Fark önümüzdeki günlere küçük paylarla dağıtıldı.'}`
    case 'under': return `${d}: hedefin ${fmtNum(-raw)} kcal altındaydın. ${-c.diff < -raw ? `Güvenlik için yalnızca ${fmtNum(-c.diff)} kcal` : 'Fark'} sonraki günlere eklendi; aşırı açık kas kaybı riskini artırır.`
    case 'balanced': return `${d}: hedefin ±50 kcal içindeydin. Harika, düzeltme gerekmedi.`
    case 'incomplete': return `${d}: kayıt hedefin %60'ının altında kaldı, büyük olasılıkla eksik. Bu yüzden dengeleme yapılmadı.`
    case 'exception': return `${d} istisna sayıldı; sonraki günlerin hedefi düşürülmedi.`
    default: return `${d}: kayıt yoktu, dengeleme yapılmadı. Kayıt tuttuğun günler planı daha isabetli yapar.`
  }
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-xs text-mute font-semibold">{label}</span>
      <span className="num text-[22px] font-bold leading-tight">{value}</span>
      <span className="text-[12px] text-mute leading-snug">{sub}</span>
    </div>
  )
}

/** Yol haritası: plan çizgisi, trend, tartılar ve tahmin (sunucuda çizilen SVG). */
function Roadmap({ s }: { s: Screen }) {
  const W = 320, H = 170, L = 34, R = 8, T = 10, B = 22
  const { goal, today } = s
  const fc = s.checkin?.forecast.day && s.checkin.forecast.day <= addDays(goal.endDate, 90) ? s.checkin.forecast.day : null
  const xEnd = fc && fc > goal.endDate ? fc : goal.endDate
  const span = Math.max(1, diffDays(goal.startDate, xEnd))
  const x = (d: string) => L + (diffDays(goal.startDate, d) / span) * (W - L - R)
  const kgs = [goal.startWeightKg, goal.targetWeightKg, ...s.series.flatMap((p) => [p.raw, p.trend]).filter((v): v is number => v !== null)]
  let lo = Math.min(...kgs) - 0.5, hi = Math.max(...kgs) + 0.5
  if (hi - lo < 3) { const m = (hi + lo) / 2; lo = m - 1.5; hi = m + 1.5 }
  const y = (kg: number) => T + ((hi - kg) / (hi - lo)) * (H - T - B)
  const trend = s.series.filter((p) => p.trend !== null).map((p) => `${x(p.day).toFixed(1)},${y(p.trend!).toFixed(1)}`).join(' ')
  const trendNow = s.checkin?.trendNow ?? goal.startWeightKg
  const ticks = [hi - 0.5, (hi + lo) / 2, lo + 0.5].map((v) => Math.round(v * 10) / 10)
  const label = `Plan ${fmtNum(goal.startWeightKg, 1)} kilodan ${fmtNum(goal.targetWeightKg, 1)} kiloya, ${shortDate(goal.endDate)} tarihine kadar. Trend kilo ${fmtNum(trendNow, 1)}.${fc ? ` Tahmini varış ${shortDate(fc)}.` : ''}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={label} data-testid="roadmap">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="var(--color-mute)" className="num">{fmtNum(v, 1)}</text>
        </g>
      ))}
      <line x1={x(goal.startDate)} y1={y(goal.startWeightKg)} x2={x(goal.endDate)} y2={y(goal.targetWeightKg)} stroke="var(--color-ink-2)" strokeWidth={1.5} strokeDasharray="2 4" />
      <circle cx={x(goal.endDate)} cy={y(goal.targetWeightKg)} r={4} fill="none" stroke="var(--color-ink-2)" strokeWidth={1.5} />
      {today <= xEnd ? <line x1={x(today)} x2={x(today)} y1={T} y2={H - B} stroke="var(--color-line-2)" strokeWidth={1} /> : null}
      {s.series.filter((p) => p.raw !== null).map((p) => <circle key={p.day} cx={x(p.day)} cy={y(p.raw!)} r={2.2} fill="var(--color-mute)" />)}
      {trend ? <polyline points={trend} fill="none" stroke="var(--color-acc)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" /> : null}
      {fc ? <line x1={x(today)} y1={y(trendNow)} x2={x(fc)} y2={y(goal.targetWeightKg)} stroke="var(--color-acc)" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.7} /> : null}
      <text x={L} y={H - 6} fontSize={10} fill="var(--color-mute)">{shortDate(goal.startDate)}</text>
      <text x={W - R} y={H - 6} fontSize={10} fill="var(--color-mute)" textAnchor="end">{shortDate(xEnd)}</text>
    </svg>
  )
}
