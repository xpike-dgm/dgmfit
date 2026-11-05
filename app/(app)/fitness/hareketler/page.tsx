import ExImg from '@/components/ExImg'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { imageUrl, searchExercises } from '@/lib/fitness-data'
import { EQUIPMENT, LEVEL, MUSCLES, MUSCLE_ORDER, PATTERN } from '@/lib/exercise-labels'
import { TopBar } from '@/components/ui'
import { Next } from '@/components/icons'
import CustomExercise from './CustomExercise'
import FilterSheet from './FilterSheet'

export const metadata = { title: 'Hareketler · DgFit' }
type SP = { q?: string; kas?: string; ekipman?: string; tip?: string; seviye?: string }

export default async function LibraryPage(props: { searchParams: Promise<SP> }) {
  const u = await requireUser()
  const sp = await props.searchParams
  const clean = (v: string | undefined, allowed: Record<string, string>) => (v && allowed[v] ? v : undefined)
  const f = { q: sp.q?.slice(0, 60), muscle: clean(sp.kas, MUSCLES), equipment: clean(sp.ekipman, EQUIPMENT), pattern: clean(sp.tip, PATTERN), level: clean(sp.seviye, LEVEL) }
  const rows = await searchExercises(u.id, { ...f, limit: 80 })
  return (
    <div className="flex flex-col gap-3 px-4">
      <TopBar back="/fitness" title="Hareket kütüphanesi" sub="Ara, filtrele ya da kendi hareketini ekle" />
      <form action="/fitness/hareketler" className="flex gap-2">
        {f.muscle ? <input type="hidden" name="kas" value={f.muscle} /> : null}
        {f.equipment ? <input type="hidden" name="ekipman" value={f.equipment} /> : null}
        {f.pattern ? <input type="hidden" name="tip" value={f.pattern} /> : null}
        {f.level ? <input type="hidden" name="seviye" value={f.level} /> : null}
        <label htmlFor="lib-q" className="sr-only">Hareket ara</label>
        <input id="lib-q" name="q" defaultValue={f.q} placeholder="Ara: squat, göğüs, barfiks…" className="flex-1 h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink" />
        <button type="submit" className="h-12 px-4 rounded-xl bg-acc text-acc-ink font-bold">Ara</button>
      </form>
      <FilterSheet q={f.q} groups={[
        { key: 'kas', title: 'Kas grubu', value: f.muscle, options: MUSCLE_ORDER.filter((k) => MUSCLES[k]).map((k) => [k, MUSCLES[k]]) },
        { key: 'ekipman', title: 'Ekipman', value: f.equipment, options: Object.entries(EQUIPMENT) },
        { key: 'tip', title: 'Hareket tipi', value: f.pattern, options: Object.entries(PATTERN) },
        { key: 'seviye', title: 'Zorluk', value: f.level, options: Object.entries(LEVEL) },
      ]} />
      <p className="text-[12px] text-mute px-1" data-testid="lib-count">{rows.length === 80 ? 'İlk 80 sonuç' : `${rows.length} hareket`}</p>
      <ul className="card px-4 py-1 flex flex-col">
        {rows.map((r) => (
          <li key={r.id} className="border-b border-line last:border-0">
            <Link href={`/fitness/hareketler/${r.id}`} className="flex items-center gap-3 min-h-[64px]">
              <ExImg src={r.images[0] ? imageUrl(r.images[0]) : null} size={48} className="w-12 h-12 rounded-xl shrink-0" />
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
    </div>
  )
}
