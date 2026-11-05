import { MUSCLES } from '@/lib/exercise-labels'

type Heat = { muscle: string; sets: number; status: 'yeşil' | 'sarı' | 'kırmızı' }
const RING = { 'yeşil': 'var(--color-good)', 'sarı': 'var(--color-orange)', 'kırmızı': 'var(--color-danger)' }
const STATUS_T = { 'yeşil': 'Hazır', 'sarı': 'Toparlanıyor', 'kırmızı': 'Dinlendir' }
const GROUPS: [string, string[]][] = [
  ['Üst vücut', ['chest', 'shoulders', 'lats', 'middle back', 'traps', 'biceps', 'triceps', 'forearms', 'neck']],
  ['Gövde', ['abdominals', 'lower back']],
  ['Alt vücut', ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors']],
]

/**
 * Son 7 günde kas grubu başına set ve toparlanma durumu.
 * Not (2026-11-05): eski basit vücut çizimi kullanıcı isteğiyle kaldırıldı; profesyonel ön/arka anatomi görseli gelince
 * aynı veriyle bölge boyaması yapılacak (varlık tanımı LOG.md'de).
 */
export default function BodyMap({ heat }: { heat: Heat[] }) {
  const m = new Map(heat.map((h) => [h.muscle, h]))
  const max = Math.max(8, ...heat.map((h) => h.sets))
  return (
    <div className="flex flex-col gap-3" data-testid="body-map">
      {GROUPS.map(([title, keys]) => (
        <div key={title} className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-mute">{title}</span>
          <ul className="grid grid-cols-2 gap-1.5">
            {keys.map((k) => {
              const h = m.get(k)
              const sets = h?.sets ?? 0
              return (
                <li key={k} className="rounded-xl bg-surface-2 px-3 py-2 flex flex-col gap-1.5" title={`${MUSCLES[k]}: ${sets} set (son 7 gün)`}>
                  <span className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex items-center gap-1.5 min-w-0"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: sets ? RING[h!.status] : 'var(--color-line-2)' }} aria-hidden /><span className="truncate font-semibold">{MUSCLES[k]}</span></span>
                    <b className="num text-[12px] shrink-0">{sets ? `${sets} set` : '—'}</b>
                  </span>
                  <span className="h-1.5 rounded-full bg-surface-3 overflow-hidden"><span className="block h-full rounded-full bg-acc" style={{ width: `${(sets / max) * 100}%` }} /></span>
                  {sets ? <span className="sr-only">{STATUS_T[h!.status]}</span> : null}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
