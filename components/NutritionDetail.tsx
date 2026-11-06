import { fmtNum } from '@/lib/calc'
import type { MicroTargets } from '@/lib/body-comp'

type Row = { label: string; eaten: number | null; goal: number; unit: string; kind: 'min' | 'max' }

/** Faz 8: günün detaylı besin hedefleri (lif, sınırlar, mikro besinler, öğün başına protein). Açılır bölüm. */
export default function NutritionDetail({ t, eaten, perMeal, lean, bf, bfEstimated }: {
  t: MicroTargets; eaten: Record<string, number>; perMeal: { meals: number; perMealG: number }; lean: number; bf: number; bfEstimated: boolean
}) {
  const e = (k: string) => (eaten[k] === undefined ? null : eaten[k])
  const rows: Row[] = [
    { label: 'Lif', eaten: e('fiber'), goal: t.fiberG, unit: 'g', kind: 'min' },
    { label: 'Doymuş yağ', eaten: e('satFat'), goal: t.satFatMaxG, unit: 'g', kind: 'max' },
    { label: 'Şeker', eaten: e('sugar'), goal: t.sugarMaxG, unit: 'g', kind: 'max' },
    { label: 'Sodyum', eaten: e('sodium'), goal: t.sodiumMaxMg, unit: 'mg', kind: 'max' },
    { label: 'Kalsiyum', eaten: e('ca'), goal: t.calciumMg, unit: 'mg', kind: 'min' },
    { label: 'Demir', eaten: e('fe'), goal: t.ironMg, unit: 'mg', kind: 'min' },
    { label: 'Magnezyum', eaten: e('mg'), goal: t.magnesiumMg, unit: 'mg', kind: 'min' },
    { label: 'Potasyum', eaten: e('k'), goal: t.potassiumMg, unit: 'mg', kind: 'min' },
    { label: 'Çinko', eaten: e('zn'), goal: t.zincMg, unit: 'mg', kind: 'min' },
    { label: 'D vitamini', eaten: e('vitD'), goal: t.vitDMcg, unit: 'µg', kind: 'min' },
    { label: 'B12 vitamini', eaten: e('b12'), goal: t.b12Mcg, unit: 'µg', kind: 'min' },
  ]
  return (
    <details className="card px-4 py-3 group" data-testid="nutrition-detail">
      <summary className="flex items-center justify-between cursor-pointer list-none text-[14px] font-bold">
        Detaylı besin hedefleri <span className="text-mute text-[12px] font-semibold group-open:hidden">göster</span><span className="text-mute text-[12px] font-semibold hidden group-open:inline">gizle</span>
      </summary>
      <div className="flex flex-col gap-2 pt-3">
        <p className="text-[13px] text-ink-2 leading-snug">Proteini <b>{perMeal.meals} öğüne</b> böl: öğün başına <b className="num">~{perMeal.perMealG} g</b>. Hesaplar yağsız kütlene göre: <b className="num">{fmtNum(lean, 1)} kg</b> (yağ oranı %{fmtNum(bf, 1)}{bfEstimated ? ', tahmin' : ''}).</p>
        <ul className="flex flex-col divide-y divide-line">
          {rows.map((r) => {
            const v = r.eaten
            const ok = v === null ? null : r.kind === 'min' ? v >= r.goal : v <= r.goal
            return (
              <li key={r.label} className="flex items-center justify-between gap-3 py-1.5 text-[13px]" data-testid="nd-row">
                <span className="text-ink-2">{r.label} <span className="text-mute text-[11.5px]">{r.kind === 'max' ? 'en çok' : 'en az'}</span></span>
                <span className="num whitespace-nowrap"><b className={ok === false ? (r.kind === 'max' ? 'text-danger' : 'text-orange') : ''}>{v === null ? '—' : fmtNum(Math.round(v * 10) / 10)}</b> / {fmtNum(r.goal)} {r.unit}</span>
              </li>
            )
          })}
        </ul>
        <p className="text-[11px] text-mute">Sınırlar: doymuş yağ ve şeker kalorinin en çok %10'u (DSÖ), lif 1000 kcal başına 14 g; mineraller yaşına ve cinsiyetine göre günlük öneriler. "—": eklediğin besinlerde bu değer yok.</p>
      </div>
    </details>
  )
}
