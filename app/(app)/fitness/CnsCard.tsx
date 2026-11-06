import Link from 'next/link'
import { Eyebrow } from '@/components/ui'
import { fmtNum } from '@/lib/calc'
import { CNS_LEVELS, type sessionCns, type weeklyCns } from '@/lib/cns'

// Faz 5h-5: MSS (merkezi sinir sistemi) yükü kartı — 5 kademeli gösterge, kendi açıklamalarımız
export const CNS_COLOR = ['#43A047', '#9CCC65', '#FFB300', '#FB8C00', '#E53935'] as const

export function CnsMeter({ level, label }: { level: number; label?: string }) {
  return (
    <div className="flex gap-1" role="meter" aria-valuemin={1} aria-valuemax={5} aria-valuenow={level} aria-label={`MSS yükü: ${label ?? CNS_LEVELS[level - 1]?.label ?? ''}`} data-testid="cns-meter" data-level={level}>
      {CNS_COLOR.map((c, i) => <span key={i} className="flex-1 h-2.5 rounded-full" style={{ background: i < level ? c : 'var(--color-surface-3)' }} />)}
    </div>
  )
}

export function SessionCnsCard({ c }: { c: ReturnType<typeof sessionCns> }) {
  return (
    <section aria-label="MSS yükü" className="card p-5 flex flex-col gap-3" data-testid="cns-card">
      <div className="flex items-baseline justify-between gap-2">
        <Eyebrow>MSS yükü</Eyebrow>
        <span className="text-[12px] text-mute num">puan {fmtNum(c.load, 1)}</span>
      </div>
      <b className="text-[20px] leading-tight" style={{ color: CNS_COLOR[c.level - 1] }}>{c.label}</b>
      <CnsMeter level={c.level} label={c.label} />
      <p className="text-[14px] text-ink-2 leading-relaxed">{c.text}</p>
      {c.exercises.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-mute">En çok katkı</span>
          {c.exercises.slice(0, 3).map((e) => (
            <div key={e.exerciseId} className="flex items-center justify-between gap-3 text-[13.5px]">
              <span className="truncate">{e.name} <span className="text-mute">· {e.sets} set · MSS {e.score}{e.estimated ? '*' : ''}</span></span>
              <span className="num font-bold shrink-0">%{e.share}</span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="text-[11.5px] text-mute">Hareketin MSS puanı × çalışma seti × efor (RiR, set tipi). Isınma setleri sayılmaz.{c.estimated ? ' * Puanı olmayan hareket için hareket türünden tahmin.' : ''}</p>
    </section>
  )
}

export function WeekCnsCard({ d }: { d: { sessions: { id: string; day: string; name: string; load: number; level: number; label: string }[]; week: ReturnType<typeof weeklyCns> } }) {
  return (
    <section aria-label="Haftalık MSS yükü" className="card p-5 flex flex-col gap-3" data-testid="week-cns">
      <div className="flex items-baseline justify-between gap-2">
        <Eyebrow>MSS yükü · son 7 gün</Eyebrow>
        <span className="text-[12px] text-mute num">{d.sessions.length} seans · toplam {fmtNum(d.week.total, 1)}</span>
      </div>
      <p className="text-[14px] text-ink-2 leading-relaxed">{d.week.note}</p>
      {d.sessions.map((s) => (
        <Link key={s.id} href={`/fitness/antrenman/${s.id}`} className="flex items-center gap-3 min-h-11" data-testid="week-cns-row">
          <span className="w-12 text-[12px] text-mute num shrink-0">{s.day.slice(8)}.{s.day.slice(5, 7)}</span>
          <span className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="text-[13.5px] truncate">{s.name}</span>
            <CnsMeter level={s.level} label={s.label} />
          </span>
          <span className="text-[12px] font-bold shrink-0 w-20 text-right" style={{ color: CNS_COLOR[s.level - 1] }}>{s.label}</span>
        </Link>
      ))}
    </section>
  )
}
