// GZCLP durum makinesi — saf. Testler: tests/progress.test.ts
// Kaynak (2026-11-05 doğrulandı): saynotobroscience.com/gzclp-infographic (Cody LeFever'in GZCLP'sinin özeti):
//  T1 5×3 → başarısızlıkta aynı ağırlıkla 6×2 → 10×1; T2 3×10 → 3×8 → 3×6, sonra 3×10'a "biraz daha ağır" (en çok 20 lb) dönüş;
//  T3 3×15, son sette 25 tekrar yapılınca en küçük artış; artış üst vücut 2,5 kg, alt vücut 5 kg; son set AMRAP.
// Kaynakta YAZMAYAN ve DgFit'in seçtiği: T1'in 10×1 sonrası sıfırlaması (son ağırlığın %85'i ile 5×3'e dönüş),
//  T2 dönüşünde "biraz daha ağır" = son başarılı 3×10 ağırlığı + bir artış.

export type Tier = 't1' | 't2' | 't3'
export interface GzState { tier: Tier; stage: number; kg: number; lastBaseKg: number | null }
export const GZ_STAGES: Record<Tier, { sets: number; reps: number }[]> = {
  t1: [{ sets: 5, reps: 3 }, { sets: 6, reps: 2 }, { sets: 10, reps: 1 }],
  t2: [{ sets: 3, reps: 10 }, { sets: 3, reps: 8 }, { sets: 3, reps: 6 }],
  t3: [{ sets: 3, reps: 15 }],
}
export const T3_AMRAP_TARGET = 25
const r25 = (kg: number) => Math.round(kg / 2.5) * 2.5

/** Bu seansın hedef setleri. T1 ve T3'te son set AMRAP. */
export function gzSets(s: GzState): { kg: number; reps: number; amrap: boolean }[] {
  const st = GZ_STAGES[s.tier][Math.min(s.stage, GZ_STAGES[s.tier].length - 1)]
  return Array.from({ length: st.sets }, (_, i) => ({ kg: s.kg, reps: st.reps, amrap: i === st.sets - 1 && s.tier !== 't2' }))
}

/**
 * Seans sonrası yeni durum. Başarı = tüm hedef setlerde hedef tekrar (T3'te artış yalnızca son set ≥ 25 ile).
 * `lower`: alt vücut hareketi (5 kg artış), değilse 2,5 kg. `smallest`: T3 için en küçük artış.
 */
export function gzAdvance(s: GzState, logged: { kg: number; reps: number }[], lower: boolean, smallest = 2.5): { next: GzState; result: 'artış' | 'aynı' | 'kademe' | 'sıfırlama'; reason: string } {
  const inc = lower ? 5 : 2.5
  const want = gzSets(s)
  const ok = logged.length >= want.length && want.every((w, i) => logged[i].reps >= w.reps && logged[i].kg >= w.kg - 1e-9)
  if (s.tier === 't3') {
    // AMRAP, kademenin son seti (fazladan geri çekilme/drop setleri sayılmaz)
    const last = logged[want.length - 1]?.reps ?? 0
    if (ok && last >= T3_AMRAP_TARGET) return { next: { ...s, kg: s.kg + smallest }, result: 'artış', reason: `Son sette ${last} tekrar (≥ ${T3_AMRAP_TARGET}): +${smallest} kg.` }
    return { next: s, result: 'aynı', reason: `Son sette ${T3_AMRAP_TARGET} tekrara ulaşınca ağırlık artar.` }
  }
  if (ok) {
    const base = s.stage === 0 ? s.kg : s.lastBaseKg
    return { next: { ...s, kg: s.kg + inc, lastBaseKg: s.stage === 0 ? s.kg : base }, result: 'artış', reason: `Tüm setler tamam: +${inc} kg.` }
  }
  const stages = GZ_STAGES[s.tier].length
  if (s.stage + 1 < stages) {
    const n = GZ_STAGES[s.tier][s.stage + 1]
    return { next: { ...s, stage: s.stage + 1 }, result: 'kademe', reason: `Hedef tutmadı: aynı ağırlıkla ${n.sets}×${n.reps}.` }
  }
  if (s.tier === 't1') {
    const kg = r25(s.kg * 0.85)
    return { next: { tier: 't1', stage: 0, kg, lastBaseKg: null }, result: 'sıfırlama', reason: `10×1 de tutmadı: döngü tamam. %85 ile (${kg} kg) 5×3'e dönülür (DgFit seçimi).` }
  }
  const kg = (s.lastBaseKg ?? s.kg) + inc
  return { next: { tier: 't2', stage: 0, kg, lastBaseKg: null }, result: 'sıfırlama', reason: `3×6 da tutmadı: son başarılı 3×10 ağırlığının bir kademe üstüyle (${kg} kg) 3×10'a dönülür.` }
}
