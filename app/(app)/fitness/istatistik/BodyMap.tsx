import { MUSCLES } from '@/lib/exercise-labels'

type Heat = { muscle: string; sets: number; status: 'yeşil' | 'sarı' | 'kırmızı' }
const RING = { 'yeşil': 'var(--color-lime)', 'sarı': 'var(--color-orange)', 'kırmızı': 'var(--color-danger)' }

// Basit gövde şeması (100 × 210 birim): ön ve arka. Her bölge bir kas grubudur.
type Shape = { m: string; d: string }
const ell = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`
const rr = (x: number, y: number, w: number, h: number, r = 4) => `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - 2 * r)} a${r},${r} 0 0 1 ${-r},${-r} v${-(h - 2 * r)} a${r},${r} 0 0 1 ${r},${-r}z`
const pair = (m: string, f: (x: number) => string, xl: number, xr: number) => [{ m, d: f(xl) }, { m, d: f(xr) }]

const FRONT: Shape[] = [
  { m: 'neck', d: rr(44, 24, 12, 8, 3) },
  ...pair('shoulders', (x) => ell(x, 40, 9, 7), 27, 73),
  ...pair('chest', (x) => rr(x, 36, 17, 17, 5), 33, 50),
  ...pair('biceps', (x) => rr(x, 49, 9, 22, 4), 17, 74),
  ...pair('forearms', (x) => rr(x, 74, 8, 24, 4), 13, 79),
  { m: 'abdominals', d: rr(39, 56, 22, 34, 6) },
  ...pair('abductors', (x) => rr(x, 90, 7, 14, 3), 27, 66),
  ...pair('quadriceps', (x) => rr(x, 104, 14, 40, 6), 32, 54),
  ...pair('adductors', (x) => rr(x, 104, 4, 24, 2), 46, 50),
  ...pair('calves', (x) => rr(x, 150, 10, 34, 5), 34, 56),
]
const BACK: Shape[] = [
  { m: 'traps', d: rr(38, 24, 24, 18, 6) },
  ...pair('shoulders', (x) => ell(x, 40, 9, 7), 27, 73),
  ...pair('lats', (x) => rr(x, 44, 12, 28, 5), 31, 57),
  { m: 'middle back', d: rr(43, 44, 14, 22, 4) },
  { m: 'lower back', d: rr(40, 70, 20, 16, 5) },
  ...pair('triceps', (x) => rr(x, 49, 9, 22, 4), 17, 74),
  ...pair('forearms', (x) => rr(x, 74, 8, 24, 4), 13, 79),
  ...pair('glutes', (x) => rr(x, 88, 17, 16, 7), 33, 50),
  ...pair('hamstrings', (x) => rr(x, 106, 14, 40, 6), 32, 54),
  ...pair('calves', (x) => rr(x, 150, 10, 34, 5), 34, 56),
]

function Figure({ shapes, heat, label }: { shapes: Shape[]; heat: Map<string, Heat>; label: string }) {
  return (
    <figure className="flex flex-col items-center gap-1 flex-1">
      <svg viewBox="0 0 100 200" className="w-full max-w-[150px] h-auto" role="img" aria-label={`${label}: ${shapes.filter((s, i, a) => a.findIndex((x) => x.m === s.m) === i && (heat.get(s.m)?.sets ?? 0) > 0).map((s) => `${MUSCLES[s.m]} ${heat.get(s.m)!.sets} set`).join(', ') || 'çalışan kas yok'}`}>
        <circle cx={50} cy={13} r={9} fill="var(--color-surface-3)" />
        {shapes.map((s, i) => {
          const h = heat.get(s.m)
          const k = h?.sets ? Math.min(1, 0.25 + h.sets / 16) : 0
          return (
            <path key={i} d={s.d} fill={k ? 'var(--color-orange)' : 'var(--color-surface-3)'} fillOpacity={k || 1} stroke={h?.sets ? RING[h.status] : 'var(--color-line)'} strokeWidth={h?.sets ? 1.6 : 0.8}>
              <title>{`${MUSCLES[s.m]}: ${h?.sets ?? 0} set (son 7 gün)`}</title>
            </path>
          )
        })}
      </svg>
      <figcaption className="text-[11px] text-mute">{label}</figcaption>
    </figure>
  )
}

export default function BodyMap({ heat }: { heat: Heat[] }) {
  const m = new Map(heat.map((h) => [h.muscle, h]))
  return (
    <div className="flex gap-2 justify-center" data-testid="body-map">
      <Figure shapes={FRONT} heat={m} label="Ön" />
      <Figure shapes={BACK} heat={m} label="Arka" />
    </div>
  )
}
