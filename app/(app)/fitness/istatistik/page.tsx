import { requireUser } from '@/lib/auth'
import { statsOverview } from '@/lib/fitness-stats'
import { MUSCLES } from '@/lib/exercise-labels'
import { SET_BAND } from '@/lib/progress'
import { addDays, shortDate } from '@/lib/time'
import { fmtNum } from '@/lib/calc'
import { Eyebrow, TopBar } from '@/components/ui'
import BodyMap from './BodyMap'

export const metadata = { title: 'Fitness istatistikleri · DgFit' }
const STATUS = { 'yeşil': { c: 'var(--color-good)', t: 'Hazır' }, 'sarı': { c: 'var(--color-orange)', t: 'Toparlanıyor' }, 'kırmızı': { c: 'var(--color-danger)', t: 'Dinlendir' } } as const

export default async function StatsPage() {
  const u = await requireUser()
  const s = await statsOverview(u.id)
  const maxV = Math.max(1, ...s.weeks.map((w) => w.volume))
  const W = 320, H = 140, L = 8, B = 20, bw = (W - L * 2) / s.weeks.length
  const trained = new Set(s.calendar)
  const worked = s.heat.filter((h) => h.week > 0 || h.sets7 > 0)
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness" title="İstatistik" />

      <section className="card p-5 flex flex-col gap-2" aria-label="Haftalık hacim">
        <Eyebrow>Haftalık hacim (kg × tekrar)</Eyebrow>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Son 12 haftanın hacmi; bu hafta ${fmtNum(s.weeks.at(-1)!.volume)} kg`} data-testid="volume-chart">
          <line x1={L} x2={W - L} y1={H - B} y2={H - B} stroke="var(--color-line)" />
          {s.weeks.map((w, i) => {
            const h = (w.volume / maxV) * (H - B - 18)
            const x = L + i * bw + 3
            return (
              <g key={w.week}>
                <rect x={x - 3} y={0} width={bw} height={H - B} fill="transparent"><title>{`${shortDate(w.week)} haftası: ${fmtNum(w.volume)} kg · ${w.workouts} antrenman · ${w.sets} set`}</title></rect>
                {w.volume ? <rect x={x} y={H - B - h} width={bw - 6} height={h} rx={4} fill={i === s.weeks.length - 1 ? 'var(--color-acc)' : 'var(--color-ink-2)'} opacity={i === s.weeks.length - 1 ? 1 : 0.55} pointerEvents="none" /> : null}
              </g>
            )
          })}
          {s.weeks.at(-1)!.volume ? <text x={W - L} y={12} textAnchor="end" fontSize={11} fill="var(--color-ink)" className="num">{fmtNum(s.weeks.at(-1)!.volume)} kg</text> : null}
          <text x={L} y={H - 5} fontSize={10} fill="var(--color-mute)">{shortDate(s.weeks[0].week)}</text>
          <text x={W - L} y={H - 5} fontSize={10} fill="var(--color-mute)" textAnchor="end">Bu hafta</text>
        </svg>
      </section>

      <section className="card p-5 flex flex-col gap-2" aria-label="Antrenman takvimi">
        <div className="flex justify-between items-center"><Eyebrow>Antrenman takvimi</Eyebrow><span className="text-[12px] text-mute num">{s.calendar.length} gün / 12 hafta</span></div>
        <div className="grid grid-flow-col gap-1" style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))' }} data-testid="calendar">
          {Array.from({ length: 84 }, (_, i) => {
            const d = addDays(s.from, i)
            const on = trained.has(d), future = d > s.today
            return <span key={d} title={`${shortDate(d)}${on ? ' · antrenman' : ''}`} className={`aspect-square rounded-[4px] ${on ? 'bg-orange' : future ? 'bg-transparent' : 'bg-surface-3'}`} />
          })}
        </div>
        <span className="text-[11px] text-mute">Sütunlar hafta (Pazartesi üstte), turuncu kare antrenman günü.</span>
      </section>

      <section className="card p-5 flex flex-col gap-3" aria-label="Kas ısı haritası">
        <Eyebrow>Son 7 gün · kas ısı haritası</Eyebrow>
        <BodyMap heat={s.heat.map((h) => ({ muscle: h.muscle, sets: h.sets7, status: h.status }))} />
        <div className="flex gap-3 text-[12px] text-ink-2">
          {Object.values(STATUS).map((v) => <span key={v.t} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: v.c }} />{v.t}</span>)}
        </div>
        <p className="text-[11px] text-mute">Renk yoğunluğu son 7 gündeki set sayısı, kenar rengi toparlanma (24 saatten yeni ya da 48 saatte 4+ set: dinlendir; 72 saatten yeni: toparlanıyor). Yaklaşık bir rehberdir.</p>
      </section>

      <section className="card p-5 flex flex-col gap-2.5" aria-label="Kas başına haftalık set" data-testid="weekly-sets">
        <Eyebrow>Bu hafta kas başına set</Eyebrow>
        <p className="text-[12px] text-mute -mt-1">Kas gelişimi için haftada {SET_BAND.min}–{SET_BAND.max} çalışma seti önerilir (ikincil kas yarım set sayılır).</p>
        {worked.length ? worked.sort((a, b) => b.week - a.week).map((h) => {
          const max = 24
          return (
            <div key={h.muscle} className="flex items-center gap-3">
              <span className="w-28 text-[13px] text-ink-2 truncate">{MUSCLES[h.muscle]}</span>
              <div className="relative flex-1 h-2.5 rounded-full bg-surface-3">
                <div className="absolute inset-y-0 rounded-full bg-[rgba(200,241,105,0.15)]" style={{ left: `${(SET_BAND.min / max) * 100}%`, width: `${((SET_BAND.max - SET_BAND.min) / max) * 100}%` }} aria-hidden />
                <div className="absolute inset-y-0 left-0 rounded-full bg-orange" style={{ width: `${Math.min(1, h.week / max) * 100}%` }} />
              </div>
              <span className="num text-[13px] w-16 text-right">{fmtNum(h.week, h.week % 1 ? 1 : 0)} <span className={`text-[11px] ${h.band === 'iyi' ? 'text-acc' : 'text-mute'}`}>{h.band}</span></span>
            </div>
          )
        }) : <p className="text-[13px] text-mute">Bu hafta henüz antrenman yok.</p>}
      </section>

      <section className="card p-5 flex flex-col gap-1" aria-label="Toparlanma tablosu">
        <Eyebrow>Toparlanma durumu</Eyebrow>
        {s.heat.filter((h) => h.hoursAgo !== null).map((h) => (
          <div key={h.muscle} className="flex justify-between text-[13px] min-h-[32px] items-center">
            <span className="text-ink-2">{MUSCLES[h.muscle]}</span>
            <span className="flex items-center gap-2"><span className="text-mute num">{h.hoursAgo! < 24 ? `${h.hoursAgo} sa önce` : `${Math.round(h.hoursAgo! / 24)} gün önce`}</span><span className="w-2 h-2 rounded-full" style={{ background: STATUS[h.status].c }} aria-hidden /><span>{STATUS[h.status].t}</span></span>
          </div>
        ))}
        {!s.heat.some((h) => h.hoursAgo !== null) ? <p className="text-[13px] text-mute">Son 7 günde antrenman yok: tüm kaslar hazır.</p> : null}
      </section>
    </div>
  )
}
