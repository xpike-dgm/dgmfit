import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { imageUrl, searchExercises } from '@/lib/fitness-data'
import { EQUIPMENT, LEVEL, MUSCLES, MUSCLE_ORDER, PATTERN } from '@/lib/exercise-labels'
import { TopBar } from '@/components/ui'
import { Next } from '@/components/icons'
import CustomExercise from './CustomExercise'

export const metadata = { title: 'Hareketler · DgFit' }
type SP = { q?: string; kas?: string; ekipman?: string; tip?: string; seviye?: string }

export default async function LibraryPage(props: { searchParams: Promise<SP> }) {
  const u = await requireUser()
  const sp = await props.searchParams
  const clean = (v: string | undefined, allowed: Record<string, string>) => (v && allowed[v] ? v : undefined)
  const f = { q: sp.q?.slice(0, 60), muscle: clean(sp.kas, MUSCLES), equipment: clean(sp.ekipman, EQUIPMENT), pattern: clean(sp.tip, PATTERN), level: clean(sp.seviye, LEVEL) }
  const rows = await searchExercises(u.id, { ...f, limit: 80 })
  const href = (patch: Partial<SP>) => {
    const p = new URLSearchParams()
    const m = { q: f.q, kas: f.muscle, ekipman: f.equipment, tip: f.pattern, seviye: f.level, ...patch }
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v)
    const s = p.toString()
    return '/fitness/hareketler' + (s ? '?' + s : '')
  }
  const Chips = ({ title, map, cur, k, order }: { title: string; map: Record<string, string>; cur?: string; k: keyof SP; order?: string[] }) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-mute font-semibold">{title}</span>
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
        {(order ?? Object.keys(map)).map((key) => (
          <Link key={key} href={href({ [k]: cur === key ? undefined : key })} aria-current={cur === key ? 'true' : undefined}
            className={`shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold flex items-center ${cur === key ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2'}`}>{map[key]}</Link>
        ))}
      </div>
    </div>
  )
  return (
    <div className="flex flex-col gap-3 px-4 pt-5">
      <TopBar back="/fitness" title="Hareket kütüphanesi" />
      <form action="/fitness/hareketler" className="flex gap-2">
        {f.muscle ? <input type="hidden" name="kas" value={f.muscle} /> : null}
        {f.equipment ? <input type="hidden" name="ekipman" value={f.equipment} /> : null}
        {f.pattern ? <input type="hidden" name="tip" value={f.pattern} /> : null}
        {f.level ? <input type="hidden" name="seviye" value={f.level} /> : null}
        <label htmlFor="lib-q" className="sr-only">Hareket ara</label>
        <input id="lib-q" name="q" defaultValue={f.q} placeholder="Ara: squat, göğüs, barfiks…" className="flex-1 h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink" />
        <button type="submit" className="h-12 px-4 rounded-xl bg-lime text-lime-ink font-bold">Ara</button>
      </form>
      <Chips title="Kas grubu" map={MUSCLES} cur={f.muscle} k="kas" order={MUSCLE_ORDER} />
      <Chips title="Ekipman" map={EQUIPMENT} cur={f.equipment} k="ekipman" />
      <Chips title="Hareket tipi" map={PATTERN} cur={f.pattern} k="tip" />
      <Chips title="Zorluk" map={LEVEL} cur={f.level} k="seviye" />
      <p className="text-[12px] text-mute px-1" data-testid="lib-count">{rows.length === 80 ? 'İlk 80 sonuç' : `${rows.length} hareket`}</p>
      <ul className="card px-4 py-1 flex flex-col">
        {rows.map((r) => (
          <li key={r.id} className="border-b border-line last:border-0">
            <Link href={`/fitness/hareketler/${r.id}`} className="flex items-center gap-3 min-h-[64px]">
              {r.images[0] ? <img src={imageUrl(r.images[0])} alt="" width={48} height={48} loading="lazy" className="w-12 h-12 rounded-xl object-cover bg-surface-2" /> : <span className="w-12 h-12 rounded-xl bg-surface-2" />}
              <span className="flex-1 flex flex-col min-w-0">
                <span className="font-semibold truncate">{r.nameTr}</span>
                <span className="text-[12px] text-mute truncate">{r.primary.map((m) => MUSCLES[m] ?? m).join(', ')} · {EQUIPMENT[r.equipment] ?? r.equipment}{r.source === 'user' ? ' · özel' : ''}</span>
              </span>
              <Next size={16} className="text-mute shrink-0" />
            </Link>
          </li>
        ))}
        {!rows.length ? <li className="py-6 text-center text-mute text-sm">Sonuç yok. Filtreleri azalt ya da kendi hareketini ekle.</li> : null}
      </ul>
      <CustomExercise />
      <p className="text-[11px] text-faint px-1 pb-2">Hareket verisi ve görseller: free-exercise-db (kamu malı). Türkçe adlar ve teknik açıklamalar DgFit.</p>
    </div>
  )
}
