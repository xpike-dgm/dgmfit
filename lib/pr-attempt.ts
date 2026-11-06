// Faz 5h-6: rekor denemesi (saf; tests/pr-attempt.test.ts). Kendi algoritmamız: ısınma basamakları + 3 deneme,
// ağır setlerden sonra "nasıl hissettirdi?" yanıtına göre sonraki denemenin ağırlığı.
import { roundTo } from './training.ts'

export type Felt = 'fail' | 'hard' | 'normal' | 'easy'
export const FELT: { key: Felt; label: string; hint: string }[] = [
  { key: 'fail', label: 'Kaldıramadım', hint: 'Tekrar tamamlanmadı' },
  { key: 'hard', label: 'Zorlandım', hint: 'Son güçle çıktı' },
  { key: 'normal', label: 'Normaldi', hint: 'Zor ama temiz' },
  { key: 'easy', label: 'Hafifti', hint: 'Daha fazlası vardı' },
]

export interface PrStep { kind: 'warmup' | 'attempt'; n: number; kg: number; reps: number; rest: number; pct: number; ask: boolean }

const WARMUP: [number, number][] = [[0.4, 5], [0.55, 3], [0.7, 2], [0.8, 1], [0.9, 1]]
const restFor = (pct: number) => (pct < 0.6 ? 60 : pct < 0.75 ? 90 : pct < 0.85 ? 120 : 180)
export const ATTEMPT_REST = 240

/** Plan: (gerekirse bar × 8) + en çok 5 ısınma + 3 deneme (%95, %100, %102 — son ikisi yanıtlara göre değişir). */
export function prPlan(target: number, bar = 20, inc = 2.5): PrStep[] {
  const t = Math.max(target, bar)
  const out: PrStep[] = []
  const add = (kind: PrStep['kind'], kg: number, reps: number, pct: number) => out.push({ kind, n: out.filter((s) => s.kind === kind).length + 1, kg, reps, rest: kind === 'attempt' ? ATTEMPT_REST : restFor(pct), pct, ask: kind === 'attempt' || pct >= 0.8 })
  if (roundTo(t * 0.4, inc, 'down') > bar) add('warmup', bar, 8, bar / t)
  for (const [pct, reps] of WARMUP) {
    const kg = Math.max(bar, roundTo(t * pct, inc, 'down'))
    if (kg < t * 0.95 && !out.some((s) => s.kg === kg)) add('warmup', kg, reps, pct)
  }
  for (const pct of [0.95, 1, 1.02]) add('attempt', Math.max(bar, roundTo(t * pct, inc)), 1, pct)
  return out
}

/** `i`. set bittikten sonra yanıta göre sonraki denemenin ağırlığı (plan kopyası döner). */
export function adjustAfter(steps: PrStep[], i: number, felt: Felt, done: { kg: number; ok: boolean }[], target: number, inc = 2.5): PrStep[] {
  const out = steps.map((s) => ({ ...s }))
  const cur = out[i], next = out[i + 1]
  if (!next || next.kind !== 'attempt') return out
  const T = target
  const set = (kg: number) => { next.kg = Math.max(roundTo(kg, inc), 0); next.pct = T ? next.kg / T : 1 }
  if (cur.kind === 'warmup') { set(T * (felt === 'hard' || felt === 'fail' ? 0.92 : felt === 'easy' ? 0.97 : 0.95)); return out }
  const w = cur.kg
  const best = Math.max(0, ...done.filter((d) => d.ok).map((d) => d.kg))
  const up = (pct: number, min: number) => w + Math.max(min, roundTo(w * pct, inc))
  if (felt === 'fail') set(best ? Math.min(w, Math.max(best + inc, w * 0.975)) : w * 0.975)
  else if (cur.n === 1) set(felt === 'hard' ? Math.min(T, up(0.02, inc)) : felt === 'normal' ? Math.max(T, w + inc) : Math.max(T, up(0.04, 2 * inc)))
  else set(felt === 'hard' ? w + inc : felt === 'normal' ? up(0.025, inc) : up(0.04, 2 * inc))
  return out
}

/** Sonuç: en iyi başarılı deneme, hedefe ulaşıldı mı; günlük için set listesi (ısınma `warmup`, deneme `normal`, RiR yanıttan). */
export function prResult(steps: PrStep[], log: ({ kg: number; felt: Felt | null } | null)[], target: number) {
  const attempts = steps.map((s, i) => ({ s, l: log[i] })).filter((x) => x.s.kind === 'attempt' && x.l)
  const okKg = attempts.filter((x) => x.l!.felt !== 'fail').map((x) => x.l!.kg)
  const best = okKg.length ? Math.max(...okKg) : null
  const rirOf: Record<Felt, number | null> = { fail: null, hard: 0, normal: 1, easy: 2 }
  const sets = steps.flatMap((s, i) => {
    const l = log[i]
    if (!l) return []
    return [{ kg: l.kg, reps: s.kind === 'attempt' && l.felt === 'fail' ? 0 : s.reps, type: s.kind === 'warmup' ? 'warmup' as const : 'normal' as const, rir: s.kind === 'attempt' && l.felt ? rirOf[l.felt] : null }]
  })
  const reached = best != null && best >= target
  return {
    best, reached, sets,
    text: reached
      ? `Hedefine ulaştın${best! > target ? `, üstüne ${String(Math.round((best! - target) * 100) / 100).replace('.', ',')} kg ekledin` : ''}. Günlüğe ekleyince rekor listende görünür. Birkaç hafta bu ağırlığın %80–85'iyle 3–5 tekrarlık setler çalışıp yeniden dene.`
      : best != null ? `Bu sefer hedefe ulaşamadın; en iyi denemen ${String(best).replace('.', ',')} kg. 4–6 hafta %75–85 ile çalışıp hedefi yeniden dene.`
        : 'Başarılı deneme yok. Hedefin bugün için yüksek olabilir; bir sonraki denemede %5 daha düşük bir hedefle başla.',
  }
}
