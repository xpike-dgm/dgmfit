import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getFitScreen, sexOf } from '@/lib/fit-data'
import { carbCycleFor } from '@/lib/planner-data'
import { Scenario, CarbCycle } from './Planner'
import { addDays, diffDays, longDate, shortDate } from '@/lib/time'
import { calorieFloor, fmtNum, GOALS, type GoalType } from '@/lib/calc'
import { dayCap } from '@/lib/fit'
import { Band, Eyebrow } from '@/components/ui'
import { Calendar, Pulse, Scale, Spark, Trend } from '@/components/icons'
import { BankForm, CancelBank, CheckinApply, DayClose, ExceptionButton, FitFlash, WeighIn } from './FitClient'

export const metadata = { title: 'Plan · DgFit' }

const REASON: Record<string, string> = { balance: 'Dengeleme', 'bank-save': 'Banka birikimi', 'bank-spend': 'Banka harcaması' }
const KIND: Record<string, string> = {
  balanced: 'Hedefte', over: 'Fazla', under: 'Az', incomplete: 'Eksik kayıt', untracked: 'Kayıt yok', exception: 'İstisna',
}
const WD = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
const wd = (d: string) => WD[new Date(d + 'T12:00:00Z').getUTCDay()]

export default async function FitPage() {
  const user = await requireUser()
  const s = await getFitScreen(user.id)
  if (!s) redirect('/kurulum')
  const { goal, today, checkin } = s
  const [sex, cc] = await Promise.all([sexOf(user.id), carbCycleFor(user.id)])
  const type = goal.type as GoalType
  const totalDays = diffDays(goal.startDate, goal.endDate) + 1
  const dayIndex = Math.min(totalDays, diffDays(goal.startDate, today) + 1)
  const trendNow = checkin?.trendNow ?? goal.startWeightKg
  const change = Math.round((trendNow - goal.startWeightKg) * 10) / 10
  const lastWeigh = [...s.series].reverse().find((p) => p.raw !== null)
  const last = s.closures[0]
  const span = Math.abs(goal.targetWeightKg - goal.startWeightKg)
  const progress = type === 'recomp' || span < 0.05 ? 0 : Math.max(0, Math.min(1, ((trendNow - goal.startWeightKg) * Math.sign(goal.targetWeightKg - goal.startWeightKg)) / span))
  const exceptionable = s.closures.find((c) => c.kind === 'over' && c.remaining < 0 && type === 'lose')

  return (
    <div className="flex flex-col gap-3 px-4">
      <Band title="Plan" sub={`${GOALS[type]?.label ?? 'Hedef'} · Gün ${dayIndex} / ${totalDays}`}
        ring={{ value: progress, big: fmtNum(trendNow, 1), small: 'trend kg', label: `Hedefin yüzde ${Math.round(progress * 100)}'i` }}
        pills={[['Hedef', type === 'recomp' ? 'Koru' : `${fmtNum(goal.targetWeightKg, 1)} kg`], [checkin?.forecast.day ? 'Tahmini varış' : 'Hedef tarih', shortDate(checkin?.forecast.day ?? goal.endDate)], ['Bugün', `${fmtNum(s.targets[0].kcal)} kcal`]]} />
      <FitFlash />

      <section aria-label="Hedef" className="card p-5 flex flex-col gap-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex flex-col gap-0.5">
            <Eyebrow>{GOALS[type]?.label ?? 'Hedef'}</Eyebrow>
            <span className="num text-[30px] font-bold tracking-[-0.02em]">
              {fmtNum(goal.startWeightKg, 1)} <span className="text-mute text-xl">→</span> {fmtNum(goal.targetWeightKg, 1)} <span className="text-lg text-mute">kg</span>
            </span>
            <span className="text-sm text-mute">Gün {dayIndex} / {totalDays} · hedef tarih <b className="text-ink">{shortDate(goal.endDate)}</b></span>
          </div>
          <span className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center text-acc"><Trend size={22} /></span>
        </div>
        <Roadmap s={s} />
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
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Trend kilo" value={`${fmtNum(trendNow, 1)} kg`} sub={lastWeigh ? `Son tartı ${fmtNum(lastWeigh.raw!, 1)} kg` : 'Tartı yok'} />
        <Stat label="Değişim" value={`${change > 0 ? '+' : change < 0 ? '−' : ''}${fmtNum(Math.abs(change), 1)} kg`} sub={`Başlangıç ${fmtNum(goal.startWeightKg, 1)} kg`} />
        <Stat label="Ölçülen harcama" value={checkin?.tdee.tdee ? `${fmtNum(checkin.tdee.tdee)}` : '—'} sub={checkin?.tdee.tdee ? `kcal · güven ${checkin.tdee.confidence}` : `Veri toplanıyor · ${checkin?.tdee.loggedDays ?? 0}/10 tam gün`} />
        <Stat label="Plan kalorisi" value={fmtNum(goal.dailyKcal)} sub={`kcal · tahmini harcama ${fmtNum(goal.tdee)}`} />
      </div>

      <section aria-label="Bugün" className="card p-5 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <Eyebrow>Bugün</Eyebrow>
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

      {last ? (
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
      ) : null}

      <section aria-label="Önümüzdeki 7 gün" className="card p-5 flex flex-col gap-2" data-testid="next-days">
        <div className="flex items-center gap-2 mb-1"><Calendar size={18} className="text-mute" /><Eyebrow>Önümüzdeki 7 gün</Eyebrow></div>
        {s.targets.map((t) => (
          <div key={t.day} className="flex items-center gap-3 min-h-[44px]">
            <span className="w-14 text-sm font-semibold">{t.day === today ? 'Bugün' : wd(t.day)} <span className="text-mute font-normal num">{Number(t.day.slice(8))}</span></span>
            <div className="flex-1 flex flex-wrap gap-1">
              {t.reasons.length ? groupReasons(t.reasons).map((r) => (
                <span key={r.reason + (r.sourceDay ?? '')} className="text-[11px] px-2 h-6 rounded-full bg-surface-2 flex items-center text-ink-2">
                  {REASON[r.reason] ?? r.reason}{r.sourceDay ? ` · ${shortDate(r.sourceDay)}` : ''} <b className="num ml-1 text-ink">{signed(r.kcal)}</b>
                </span>
              )) : <span className="text-[12px] text-faint">Plan</span>}
            </div>
            <span className="num text-[17px] font-bold w-16 text-right">{fmtNum(t.kcal)}</span>
          </div>
        ))}
        <p className="text-[12px] text-mute leading-relaxed mt-1">
          Bir günün hedefi dengeleme yüzünden en fazla {fmtNum(dayCap(goal.dailyKcal))} kcal değişir ve {fmtNum(s.floor)} kcal güvenli tabanın altına inmez. Protein sabit kalır; fark karbonhidrat ve yağa dağıtılır.
        </p>
      </section>

      <section aria-label="Kalori bankası" className="card p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2"><Spark size={18} className="text-orange" /><Eyebrow>Kalori bankası</Eyebrow></div>
        <p className="text-[13px] text-ink-2 leading-relaxed">Düğün, davet, tatil… Özel bir gün için önceki günlerden biraz biriktir, o gün rahat ye. Toplam plan değişmez.</p>
        {s.banks.map((b) => (
          <div key={b.bankId} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3" data-testid="bank-item">
            <span className="flex flex-col">
              <span className="font-bold">{shortDate(b.day)}{b.note ? ` · ${b.note}` : ''}</span>
              <span className="text-[13px] text-mute">+{fmtNum(b.extra)} kcal ekstra</span>
            </span>
            <CancelBank bankId={b.bankId} />
          </div>
        ))}
        <BankForm days={Array.from({ length: 13 }, (_, i) => addDays(today, i + 2)).filter((d) => d <= goal.endDate).map((d) => ({ day: d, label: `${wd(d)} ${shortDate(d)}` }))} />
      </section>

      <section aria-label="Haftalık check-in" className="card p-5 flex flex-col gap-3" data-testid="checkin">
        <div className="flex items-center gap-2"><Pulse size={18} className="text-violet" /><Eyebrow>Haftalık check-in</Eyebrow></div>
        {checkin?.proposal ? (
          <>
            <p className="text-[15px] text-ink-2 leading-relaxed">{checkin.proposal.reason}</p>
            {checkin.proposal.delta !== 0 ? (
              <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
                <span className="num text-lg font-bold">{fmtNum(goal.dailyKcal)} → {fmtNum(checkin.proposal.kcal)} kcal</span>
                {checkin.due ? <CheckinApply /> : <span className="text-[12px] text-mute">Sonraki: {shortDate(addDays(checkin.lastCheckin, 7))}</span>}
              </div>
            ) : null}
            <span className="text-[12px] text-mute">Ölçülen harcama {checkin.tdee.spanDays} günlük trend ve {checkin.tdee.loggedDays} tam kayıtlı günden hesaplandı (güven: {checkin.tdee.confidence}).</span>
          </>
        ) : (
          <p className="text-[13px] text-ink-2 leading-relaxed">
            Gerçek harcamanı ölçmek için en az 14 günlük tartı trendi ve 10 tam kayıtlı gün gerekiyor (şu an {checkin?.tdee.spanDays ?? 0} gün, {checkin?.tdee.loggedDays ?? 0} tam gün).
            Sonra her hafta planın kanıta göre en fazla 150 kcal ayarlanır.
          </p>
        )}
      </section>

      {Math.abs(change) >= 1 ? <Link href="/sosyal/yeni?tur=milestone" className="card px-5 py-4 flex items-center justify-between" data-testid="share-milestone"><span className="text-[14px]">Kilometre taşını paylaş <span className="text-mute">(yalnızca değişim, kilo görünmez)</span></span><span className="text-acc font-bold">Paylaş</span></Link> : null}
      {type !== 'recomp' ? <Scenario goal={type} currentKg={trendNow} targetKg={goal.targetWeightKg} tdee={checkin?.tdee.tdee ?? goal.tdee} tdeeMeasured={!!checkin?.tdee.tdee} dailyKcal={goal.dailyKcal} floor={calorieFloor(sex)} today={today} endDate={goal.endDate} /> : null}
      <CarbCycle enabled={cc.enabled} weekdays={cc.weekdays} shiftG={cc.shiftG} base={{ kcal: goal.dailyKcal, protein: goal.proteinG, carb: goal.carbG, fat: goal.fatG }} />

      <section aria-label="Tartı" className="card p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2"><Scale size={18} className="text-mute" /><Eyebrow>Tartı</Eyebrow></div>
        <WeighIn last={lastWeigh?.raw ?? goal.startWeightKg} />
        <Link href="/profil/hedef" className="text-[13px] text-mute underline underline-offset-4">Hedef ve plan</Link>
      </section>
    </div>
  )
}

type Screen = NonNullable<Awaited<ReturnType<typeof getFitScreen>>>

function signed(n: number) { return `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtNum(Math.abs(n))}` }

function groupReasons(list: { kcal: number; reason: string; sourceDay: string | null }[]) {
  const m = new Map<string, { kcal: number; reason: string; sourceDay: string | null }>()
  for (const r of list) {
    const k = r.reason + (r.sourceDay ?? '')
    const e = m.get(k)
    if (e) e.kcal += r.kcal; else m.set(k, { ...r })
  }
  return [...m.values()]
}

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
