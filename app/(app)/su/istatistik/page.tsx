import Link from 'next/link'
import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { getWaterStats, getWaterSummary } from '@/lib/water-data'
import { fmtNum } from '@/lib/calc'
import { fmtHm } from '@/lib/water'
import { dayString } from '@/lib/time'
import { TopBar } from '@/components/ui'
import { Flame, Spark } from '@/components/icons'

export const metadata: Metadata = { title: 'Su istatistikleri' }
const RANGES = [7, 30, 90, 365] as const

export default async function Page(props: { searchParams: Promise<{ aralik?: string }> }) {
  const u = await requireUser()
  const { aralik } = await props.searchParams
  const range = RANGES.includes(Number(aralik) as (typeof RANGES)[number]) ? Number(aralik) : 7
  const s = await getWaterStats(u.id, range)
  const today = dayString()
  const monthStart = today.slice(0, 8) + '01'
  const cal = await getWaterSummary(u.id, monthStart, today)
  const lead = (new Date(monthStart + 'T12:00:00Z').getUTCDay() + 6) % 7 // Pazartesi başlangıç
  const monthLabel = new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(monthStart + 'T12:00:00Z'))
  const change = s.prevAvg ? Math.round(((s.avg - s.prevAvg) / s.prevAvg) * 100) : null

  // Grafik: 7/30 günde günlük çubuk, 90/365 günde haftalık ortalama
  const bars = range <= 30 ? s.days.map((d) => ({ key: d.day, v: d.total, goal: d.goal, label: d.day.slice(8, 10), today: d.day === today }))
    : chunk(s.days, 7).map((w) => ({ key: w[0].day, v: Math.round(w.reduce((a, d) => a + d.total, 0) / w.length), goal: Math.round(w.reduce((a, d) => a + d.goal, 0) / w.length), label: w[0].day.slice(5).replace('-', '/'), today: false }))
  const max = Math.max(1, ...bars.map((b) => Math.max(b.v, b.goal)))
  const goalY = bars.length ? bars.reduce((a, b) => a + b.goal, 0) / bars.length / max : 0
  const hMax = Math.max(50, ...s.hourlyAvg)

  return (
    <div className="px-4 pt-4 flex flex-col gap-3">
      <TopBar back="/su" title="Su istatistikleri" />

      <nav aria-label="Zaman aralığı" className="grid grid-cols-4 gap-1.5 p-1 rounded-full bg-surface mt-2">
        {RANGES.map((r) => (
          <Link key={r} href={`/su/istatistik?aralik=${r}`} aria-current={r === range ? 'page' : undefined}
            className={`h-10 rounded-full flex items-center justify-center text-sm font-bold ${r === range ? 'bg-water text-water-ink' : 'text-mute'}`}>
            {r === 365 ? '1 yıl' : `${r} gün`}
          </Link>
        ))}
      </nav>

      {s.activeDays === 0 ? (
        <section className="card p-5 text-sm text-ink-2">Bu aralıkta henüz su kaydı yok. Kayıt ekledikçe grafikler ve analizler burada oluşacak.</section>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Günlük ortalama" value={`${fmtNum(s.avg)} ml`} sub={change !== null ? `${change >= 0 ? '+' : '−'}%${Math.abs(change)} önceki ${range === 365 ? 'yıla' : `${range} güne`} göre` : 'Karşılaştırma için veri az'} />
        <Stat label="Hedef tamamlama" value={`%${Math.round(s.metRate * 100)}`} sub={`${s.days.filter((d) => d.total >= d.goal && d.day !== today).length} gün`} />
        <Stat label="Toplam" value={`${fmtNum(s.totalMl / 1000, 1)} litre`} sub={`${s.activeDays} aktif gün`} />
        <Stat label="Kayıt sıklığı" value={`${fmtNum(s.avgCount, 1)} / gün`} sub="kayıt sayısı" />
      </div>

      <section aria-label="Günlük miktarlar" className="card p-4 flex flex-col gap-3">
        <div className="flex justify-between items-baseline">
          <h2 className="font-extrabold text-[15px]">{range <= 30 ? 'Günlük miktar' : 'Haftalık ortalama'}</h2>
          <span className="text-xs text-mute flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-ink-2" aria-hidden /> hedef</span>
        </div>
        <div className="relative h-[150px]">
          <div className="absolute inset-x-0 border-t-2 border-dashed border-ink-2/60" style={{ bottom: `${goalY * 100}%` }} aria-hidden />
          <div className="absolute inset-0 grid items-end gap-[3px]" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
            {bars.map((b) => (
              <div key={b.key} title={`${b.key}: ${b.v} ml`} className="rounded-t-[5px] rounded-b-[2px]"
                style={{ height: `${Math.max(2, (b.v / max) * 100)}%`, background: b.v >= b.goal ? 'var(--color-water)' : b.today ? 'rgba(108,199,255,0.45)' : '#2F5A78' }} />
            ))}
          </div>
        </div>
        {bars.length <= 31 ? (
          <div className="grid gap-[3px] num text-[10px] text-mute text-center" style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
            {bars.map((b, i) => <span key={b.key}>{bars.length <= 7 || i % 5 === 0 ? b.label : ''}</span>)}
          </div>
        ) : null}
        <div className="flex gap-4 text-[13px] text-ink-2 flex-wrap">
          {s.best ? <span>En çok: <b className="num text-ink">{fmtNum(s.best.total)} ml</b> ({shortDay(s.best.day)})</span> : null}
          {s.worst ? <span>En az: <b className="num text-ink">{fmtNum(s.worst.total)} ml</b> ({shortDay(s.worst.day)})</span> : null}
        </div>
      </section>

      {s.weakest && s.weakest.avg < s.avg * 0.15 ? (
        <section aria-label="İçgörü" className="rounded-[24px] p-4 flex gap-3 bg-coach border border-coach-line">
          <Spark size={18} className="text-lime shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed text-[#E4E8DC]">
            Son {range} günde en az su içtiğin zaman dilimi <b>{fmtHm(s.weakest.from)}–{fmtHm(s.weakest.to)}</b> (ortalama {fmtNum(s.weakest.avg)} ml). Bu saatlerde masana bir şişe koymak ya da hatırlatma almak hedefini tamamlamanı kolaylaştırabilir.
          </p>
        </section>
      ) : null}

      <section aria-label="Saatlik ortalama" className="card p-4 flex flex-col gap-2.5">
        <h2 className="font-extrabold text-[15px]">Saatlik ortalama</h2>
        <div className="grid grid-cols-24 items-end gap-[2px] h-[70px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
          {s.hourlyAvg.map((v, h) => <div key={h} title={`${h}:00 · ${v} ml`} className="rounded-[3px]" style={{ height: Math.max(3, (v / hMax) * 68), background: v ? 'var(--color-water)' : 'var(--color-surface-3)' }} />)}
        </div>
        <div className="flex justify-between num text-[11px] text-mute"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      </section>

      <section aria-label="Haftanın günleri" className="card p-4 flex flex-col gap-3">
        <h2 className="font-extrabold text-[15px]">Haftanın günlerine göre hedef tamamlama</h2>
        <div className="grid grid-cols-7 gap-2">
          {s.weekdayRate.map((w) => (
            <div key={w.label} className="flex flex-col items-center gap-1.5">
              <div className="w-full h-20 rounded-xl bg-surface-3 relative overflow-hidden">
                <div className="absolute inset-x-0 bottom-0 bg-water" style={{ height: `${w.rate * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-mute">{w.label}</span>
              <span className="num text-[11px] text-ink-2">{w.n ? `%${Math.round(w.rate * 100)}` : '—'}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Takvim" className="card p-4 flex flex-col gap-3">
        <h2 className="font-extrabold text-[15px] capitalize">{monthLabel}</h2>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map((d) => <span key={d} className="text-[11px] font-bold text-mute">{d}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={'e' + i} />)}
          {[...cal.days.entries()].map(([d, v]) => {
            const f = v.goal ? Math.min(1, v.total / v.goal) : 0
            return (
              <Link key={d} href={d === today ? '/su' : `/su?gun=${d}`} aria-label={`${d}: ${v.total} ml`}
                className="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5"
                style={{ background: v.total ? `rgba(108,199,255,${0.12 + f * 0.6})` : 'var(--color-surface-2)', outline: d === today ? '2px solid var(--color-lime)' : undefined }}>
                <span className={`num text-[13px] font-bold ${f >= 0.6 ? 'text-water-ink' : 'text-ink'}`}>{Number(d.slice(8))}</span>
                {v.total ? <span className={`num text-[9px] ${f >= 0.6 ? 'text-water-ink' : 'text-ink-2'}`}>{fmtNum(v.total / 1000, 1)}</span> : null}
              </Link>
            )
          })}
        </div>
        <p className="text-xs text-mute">Renk koyulaştıkça hedefe yaklaşılmış demektir; rakamlar litre. Bir güne dokunup kayıtlarını görebilir ve ekleyebilirsin.</p>
      </section>
      <section aria-label="Seri" className="card p-4 grid grid-cols-3 gap-2">
        <Mini icon={<Flame size={16} className="text-orange" />} label="Şu anki seri" value={`${s.streak.current} gün`} />
        <Mini label="En uzun seri" value={`${s.streak.best} gün`} />
        <Mini label="Dondurma hakkı" value={`${s.streak.freezesLeft} / 2`} />
        <p className="col-span-3 text-xs text-mute leading-relaxed">Esnek seri: ayda 2 gün hedefi kaçırsan da serin bozulmaz. Bugün henüz bitmediği için seriyi etkilemez.</p>
      </section>
    </div>
  )
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n))
  return out
}
function shortDay(d: string) {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(d + 'T12:00:00Z'))
}
function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-4 flex flex-col gap-0.5 !rounded-[22px]">
      <span className="text-xs text-mute">{label}</span>
      <span className="num text-xl font-bold">{value}</span>
      <span className="text-xs text-mute">{sub}</span>
    </div>
  )
}
function Mini({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-surface-2 rounded-2xl p-3 flex flex-col gap-0.5">
      <span className="text-xs text-mute flex items-center gap-1">{icon}{label}</span>
      <span className="num font-bold">{value}</span>
    </div>
  )
}
