// Antrenman motoru — saf, istemci ve sunucuda aynı sonuç. Testler: tests/training.test.ts
// Spesifikasyon 4.3 (canlı mod), 4.4 (ağırlık öneri motoru), 4.5 (PR), 4.6 (kardiyo).

export type SetType = 'warmup' | 'normal' | 'drop' | 'superset' | 'giant' | 'restpause' | 'myorep' | 'failure' | 'amrap'
export type ExKind = 'weight_reps' | 'bodyweight' | 'assisted' | 'time' | 'distance_time'

export const SET_TYPES: Record<SetType, { label: string; short: string }> = {
  warmup: { label: 'Isınma', short: 'I' }, normal: { label: 'Normal', short: '' }, drop: { label: 'Drop set', short: 'D' },
  superset: { label: 'Süper set', short: 'S' }, giant: { label: 'Dev set', short: 'G' }, restpause: { label: 'Rest-pause', short: 'RP' },
  myorep: { label: 'Myo-rep', short: 'M' }, failure: { label: 'Başarısızlığa kadar', short: 'F' }, amrap: { label: 'AMRAP', short: 'A' },
}

export interface LoggedSet { kg: number; reps: number; rir: number | null; type: SetType; seconds?: number | null }
export interface Session { day: string; sets: LoggedSet[]; pain?: boolean }
export interface Target { repMin: number; repMax: number; rir: number }

const round2 = (n: number) => Math.round(n * 100) / 100

/** Tahmini 1 tekrar maksimumu: Epley, tekrar + RIR (yedekteki tekrar) ile. 1 tekrar, RIR 0 ise ağırlığın kendisi. */
export function e1rm(kg: number, reps: number, rir: number | null = 0): number {
  const r = reps + Math.max(0, rir ?? 0)
  if (kg <= 0 || reps <= 0) return 0
  if (r <= 1) return round2(kg)
  return round2(kg * (1 + r / 30))
}

/** e1RM'den hedef tekrar ve RIR için ağırlık (Epley'in tersi). */
export function weightFor(oneRm: number, reps: number, rir = 0): number {
  const r = reps + Math.max(0, rir)
  return r <= 1 ? oneRm : oneRm / (1 + r / 30)
}

export function roundTo(kg: number, inc = 2.5, mode: 'nearest' | 'down' | 'up' = 'nearest'): number {
  const f = mode === 'down' ? Math.floor : mode === 'up' ? Math.ceil : Math.round
  return round2(f(kg / inc + 1e-9) * inc)
}

const workSets = (s: Session) => s.sets.filter((x) => x.type !== 'warmup' && x.reps > 0)
/** Seansın en iyi çalışma seti (en yüksek e1RM). */
export function topSet(s: Session): LoggedSet | null {
  let best: LoggedSet | null = null
  for (const x of workSets(s)) if (!best || e1rm(x.kg, x.reps, x.rir) > e1rm(best.kg, best.reps, best.rir)) best = x
  return best
}
export const sessionE1rm = (s: Session) => { const t = topSet(s); return t ? e1rm(t.kg, t.reps, t.rir) : 0 }

export interface Suggestion {
  kg: number; reps: number; rir: number
  rule: 'progress' | 'double' | 'hold' | 'deload' | 'cautious' | 'reps' | 'time'
  confidence: 'düşük' | 'orta' | 'yüksek'
  reason: string
}

export interface SuggestInput {
  history: Session[] // eskiden yeniye
  target: Target
  kind: ExKind
  increment?: number // salondaki en küçük artış (iki taraf toplamı), varsayılan 2,5
  deficitKcal?: number // Fit'ten: plan açığı (tdee − hedef)
  feedback?: { tooHeavy: number; tooLight: number } // son reddetme nedenleri
}

/**
 * Sonraki set önerisi. Kurallar:
 * 1) Yorgunluk: son iki seansta e1RM art arda %3'ten fazla düştüyse %10 deload; bir kez düştüyse ağırlık sabit.
 * 2) Çift aşamalı ilerleme: son seansta tüm çalışma setleri tekrar aralığının üstüne ulaştıysa ağırlık + artış, tekrar alt sınıra.
 * 3) Aksi halde e1RM'den, bir sonraki tekrar hedefi ve hedef RIR için ağırlık (son ağırlığın ± bir artışı içinde).
 * 4) Büyük kalori açığı (> 500 kcal) ya da ağrı notu → artış yapılmaz.
 * 5) Kullanıcı öneriyi sık sık "çok ağır" bulduysa bir artış aşağı, "çok hafif" bulduysa bir artış yukarı.
 * Güven: ilk 2 kayıtta düşük, 3–5 orta, 6+ yüksek.
 */
export function suggestNext(i: SuggestInput): Suggestion | null {
  const inc = i.increment ?? 2.5
  const hist = i.history.filter((s) => workSets(s).length)
  if (!hist.length) return null
  const last = hist.at(-1)!
  const top = topSet(last)!
  const confidence = hist.length <= 2 ? 'düşük' : hist.length <= 5 ? 'orta' : 'yüksek'
  const rir = i.target.rir
  const fmt = (n: number) => String(n).replace('.', ',')

  if (i.kind === 'time') {
    const sec = Math.max(...workSets(last).map((x) => x.seconds ?? 0))
    return { kg: top.kg, reps: top.reps, rir, rule: 'time', confidence, reason: `Geçen sefer ${sec} sn; bu kez ${sec + 5} sn dene.` }
  }
  if (i.kind === 'distance_time') return null

  const allTop = workSets(last).every((x) => x.reps >= i.target.repMax)
  const e = hist.map(sessionE1rm)
  const drop = (a: number, b: number) => b < a * 0.97
  const caution = (i.deficitKcal ?? 0) > 500 || !!last.pain

  if (i.kind === 'bodyweight' || i.kind === 'assisted') {
    if (allTop) {
      const kg = i.kind === 'assisted' ? Math.max(0, round2(top.kg - inc)) : round2(top.kg + inc)
      if (caution) return { kg: top.kg, reps: Math.min(top.reps, i.target.repMax), rir, rule: 'cautious', confidence, reason: cautionText(i, last) }
      return { kg, reps: i.target.repMin, rir, rule: 'progress', confidence, reason: i.kind === 'assisted' ? `Tüm setlerde ${i.target.repMax} tekrara ulaştın: destek ${fmt(inc)} kg azalıyor.` : `Tüm setlerde ${i.target.repMax} tekrara ulaştın: ${fmt(inc)} kg ek yük ekle.` }
    }
    const reps = Math.min(i.target.repMax, Math.max(i.target.repMin, top.reps + 1))
    return { kg: top.kg, reps, rir, rule: 'reps', confidence, reason: `Aynı yükle ${reps} tekrar hedefle.` }
  }

  if (e.length >= 3 && drop(e.at(-3)!, e.at(-2)!) && drop(e.at(-2)!, e.at(-1)!)) {
    const kg = roundTo(top.kg * 0.9, inc, 'down')
    return { kg, reps: i.target.repMin, rir: Math.max(rir, 2), rule: 'deload', confidence, reason: `Tahmini maksimumun iki antrenmandır %3'ten fazla düşüyor (${e.slice(-3).map((x) => Math.round(x)).join(' → ')} kg). Bu seans %10 hafiflet, toparlan.` }
  }
  if (e.length >= 2 && drop(e.at(-2)!, e.at(-1)!)) {
    return { kg: top.kg, reps: top.reps, rir, rule: 'hold', confidence, reason: 'Geçen seans performansın düştü; ağırlığı sabit tut.' }
  }

  let s: Suggestion
  if (allTop) {
    s = { kg: round2(top.kg + inc), reps: i.target.repMin, rir, rule: 'progress', confidence, reason: `Tüm setlerde ${i.target.repMax} tekrara ulaştın: ağırlık +${fmt(inc)} kg, tekrar ${i.target.repMin}'e döner.` }
  } else {
    const est = e1rm(top.kg, top.reps, top.rir)
    const estTxt = fmt(Math.round(est * 10) / 10)
    if (top.reps < i.target.repMin) {
      // aralığın altında kaldı: alt sınır tekrarı için e1RM'den ağırlık (en fazla iki kademe düşüş)
      const kg = Math.max(top.kg - 2 * inc, roundTo(weightFor(est, i.target.repMin, rir), inc, 'down'))
      s = { kg: round2(kg), reps: i.target.repMin, rir, rule: 'double', confidence, reason: `Geçen sefer ${top.reps} tekrar, aralığın altında. Tahmini maksimum ${estTxt} kg; ${i.target.repMin} tekrar için ${fmt(round2(kg))} kg.` }
    } else {
      // aralık içinde: aynı ağırlıkla bir tekrar fazla; RIR hedefin üstünde kaldıysa e1RM ağırlık artışına izin verir (en fazla bir kademe)
      const reps = Math.min(i.target.repMax, top.reps + 1)
      const byE1rm = roundTo(weightFor(est, reps, rir), inc, 'down')
      const kg = byE1rm > top.kg ? Math.min(byE1rm, top.kg + inc) : top.kg
      s = { kg: round2(kg), reps, rir, rule: 'double', confidence, reason: kg > top.kg ? `Geçen sefer yedekte tekrarın kaldı (tahmini maksimum ${estTxt} kg): ${fmt(round2(kg))} kg × ${reps}.` : `Aynı ağırlıkla ${reps} tekrar hedefle (aralık ${i.target.repMin}–${i.target.repMax}).` }
    }
  }
  const fb = i.feedback
  if (fb && fb.tooHeavy >= fb.tooLight + 2) { s.kg = round2(Math.max(0, s.kg - inc)); s.reason += ' Önerileri sık sık ağır bulduğun için bir kademe hafifletildi.' }
  else if (fb && fb.tooLight >= fb.tooHeavy + 2) { s.kg = round2(s.kg + inc); s.reason += ' Önerileri sık sık hafif bulduğun için bir kademe artırıldı.' }
  if (caution && s.kg > top.kg) return { ...s, kg: top.kg, rule: 'cautious', reason: cautionText(i, last) }
  return s
}

function cautionText(i: SuggestInput, last: Session) {
  return last.pain ? 'Geçen seans ağrı notu var: ağırlığı artırma, tekniğe odaklan.' : `Kalori açığın büyük (${Math.round(i.deficitKcal ?? 0)} kcal): kuvveti korumak hedef, ağırlığı artırma.`
}

/** Plaka hesaplayıcı: barın her iki yanına takılacak plakalar (büyükten küçüğe). */
export function platesFor(total: number, bar = 20, plates = [25, 20, 15, 10, 5, 2.5, 1.25]): { perSide: number[]; achieved: number; remainder: number } {
  let side = round2((total - bar) / 2)
  const perSide: number[] = []
  if (side <= 0) return { perSide, achieved: Math.max(bar, 0), remainder: round2(Math.max(0, total - bar)) }
  for (const p of [...plates].sort((a, b) => b - a)) while (side + 1e-9 >= p) { perSide.push(p); side = round2(side - p) }
  const achieved = round2(bar + 2 * perSide.reduce((a, b) => a + b, 0))
  return { perSide, achieved, remainder: round2(total - achieved) }
}

/** Isınma setleri: çalışma ağırlığının %40 / %60 / %80'i (8 / 5 / 3 tekrar), bara ve artışa yuvarlanmış. */
export function warmupSets(work: number, bar = 20, inc = 2.5): { kg: number; reps: number; pct: number }[] {
  if (work <= bar) return []
  const out: { kg: number; reps: number; pct: number }[] = []
  for (const [pct, reps] of [[40, 8], [60, 5], [80, 3]] as const) {
    const kg = Math.max(bar, roundTo((work * pct) / 100, inc, 'down'))
    if (kg < work && !out.some((o) => o.kg === kg)) out.push({ kg, reps, pct })
  }
  return out
}

/** Hacim (kg × tekrar). Vücut ağırlığı hareketinde vücut ağırlığı + ek yük, destekli harekette vücut ağırlığı − destek. */
export function setVolume(s: LoggedSet, kind: ExKind, bodyKg = 0): number {
  if (s.type === 'warmup' || s.reps <= 0) return 0
  const load = kind === 'bodyweight' ? bodyKg + s.kg : kind === 'assisted' ? Math.max(0, bodyKg - s.kg) : kind === 'weight_reps' ? s.kg : 0
  return round2(load * s.reps)
}

export interface Records { kg: number; e1rm: number; rm3: number; rm5: number; rm10: number; reps: number; volume: number }
export type PrType = keyof Records
export const PR_LABEL: Record<PrType, string> = { kg: 'En ağır', e1rm: 'Tahmini maksimum (e1RM)', rm3: '3RM', rm5: '5RM', rm10: '10RM', reps: 'En çok tekrar', volume: 'Seans hacmi' }

/** Bir seansın rekor adayları (yalnızca çalışma setleri). */
export function sessionRecords(sets: LoggedSet[], kind: ExKind, bodyKg = 0): Records {
  const w = sets.filter((x) => x.type !== 'warmup' && x.reps > 0)
  const load = (x: LoggedSet) => (kind === 'bodyweight' ? x.kg : kind === 'assisted' ? -x.kg : x.kg)
  const xrm = (n: number) => Math.max(0, ...w.filter((x) => x.reps >= n).map((x) => x.kg))
  return {
    kg: w.length ? Math.max(...w.map(load)) : 0,
    e1rm: kind === 'weight_reps' ? Math.max(0, ...w.map((x) => e1rm(x.kg, x.reps, x.rir))) : 0,
    rm3: kind === 'weight_reps' ? xrm(3) : 0, rm5: kind === 'weight_reps' ? xrm(5) : 0, rm10: kind === 'weight_reps' ? xrm(10) : 0,
    reps: Math.max(0, ...w.map((x) => x.reps)),
    volume: round2(w.reduce((a, x) => a + setVolume(x, kind, bodyKg), 0)),
  }
}

/** Kırılan rekorlar. Hareketin ilk kaydı rekor sayılmaz (kıyaslanacak geçmiş yok). */
export function detectPRs(prev: Records | null, cur: Records, kind: ExKind): { type: PrType; value: number; previous: number }[] {
  if (!prev) return []
  const keys: PrType[] = kind === 'weight_reps' ? ['kg', 'e1rm', 'rm3', 'rm5', 'rm10', 'reps', 'volume'] : kind === 'time' || kind === 'distance_time' ? [] : ['kg', 'reps', 'volume']
  const out: { type: PrType; value: number; previous: number }[] = []
  for (const k of keys) if (cur[k] > 0 && cur[k] > prev[k] + 1e-9) out.push({ type: k, value: cur[k], previous: prev[k] })
  // e1RM rekoru yalnızca ağırlık ya da tekrar rekoruyla aynı değilse anlamlı; ikisi de varsa kg öncelikli gösterilir
  return out
}

export function mergeRecords(a: Records | null, b: Records): Records {
  if (!a) return b
  return { kg: Math.max(a.kg, b.kg), e1rm: Math.max(a.e1rm, b.e1rm), rm3: Math.max(a.rm3, b.rm3), rm5: Math.max(a.rm5, b.rm5), rm10: Math.max(a.rm10, b.rm10), reps: Math.max(a.reps, b.reps), volume: Math.max(a.volume, b.volume) }
}

// ───────────── Kalori ─────────────
// MET değerleri: Compendium of Physical Activities (Ainsworth vd., 2011) — yaklaşık değerler.
export const CARDIO: Record<string, { label: string; met: { hafif: number; orta: number; yoğun: number }; distance: boolean }> = {
  run: { label: 'Koşu', met: { hafif: 7.0, orta: 9.8, yoğun: 11.8 }, distance: true },
  walk: { label: 'Yürüyüş', met: { hafif: 2.8, orta: 3.5, yoğun: 5.0 }, distance: true },
  bike: { label: 'Bisiklet', met: { hafif: 4.0, orta: 6.8, yoğun: 8.8 }, distance: true },
  swim: { label: 'Yüzme', met: { hafif: 5.8, orta: 8.3, yoğun: 9.8 }, distance: true },
  hiit: { label: 'HIIT', met: { hafif: 4.3, orta: 8.0, yoğun: 10.0 }, distance: false },
  rope: { label: 'İp atlama', met: { hafif: 8.8, orta: 11.8, yoğun: 12.3 }, distance: false },
  row: { label: 'Kürek', met: { hafif: 4.8, orta: 7.0, yoğun: 8.5 }, distance: true },
  elliptical: { label: 'Eliptik', met: { hafif: 4.6, orta: 5.0, yoğun: 6.3 }, distance: false },
  stairs: { label: 'Merdiven', met: { hafif: 4.0, orta: 9.0, yoğun: 9.0 }, distance: false },
}
export type CardioType = keyof typeof CARDIO
export type Intensity = 'hafif' | 'orta' | 'yoğun'

/**
 * Brüt ve net kalori. Net = (MET − 1) × kg × saat: dinlenme harcaması plan TDEE'sinde zaten var, Fit'e net eklenir.
 * Koşu/yürüyüşte mesafe varsa ACSM denklemi (koşu: 0,2 × m/dk + 3,5; yürüyüş: 0,1 × m/dk + 3,5 mL/kg/dk), nabız varsa Keytel (2005).
 */
export function cardioKcal(i: { type: CardioType; minutes: number; weightKg: number; intensity?: Intensity; distanceKm?: number | null; avgHr?: number | null; sex?: 'male' | 'female'; age?: number }): { gross: number; net: number; method: 'met' | 'acsm' | 'nabız'; met: number } {
  const h = i.minutes / 60
  let met = CARDIO[i.type].met[i.intensity ?? 'orta']
  let method: 'met' | 'acsm' | 'nabız' = 'met'
  if (i.distanceKm && i.minutes > 0 && (i.type === 'run' || i.type === 'walk')) {
    const mPerMin = (i.distanceKm * 1000) / i.minutes
    const vo2 = i.type === 'run' ? 0.2 * mPerMin + 3.5 : 0.1 * mPerMin + 3.5
    met = vo2 / 3.5; method = 'acsm'
  }
  let gross = met * i.weightKg * h
  if (i.avgHr && i.sex && i.age && i.avgHr >= 80 && i.avgHr <= 220) {
    const perMin = i.sex === 'male'
      ? (-55.0969 + 0.6309 * i.avgHr + 0.1988 * i.weightKg + 0.2017 * i.age) / 4.184
      : (-20.4022 + 0.4472 * i.avgHr - 0.1263 * i.weightKg + 0.074 * i.age) / 4.184
    if (perMin > 0) { gross = perMin * i.minutes; method = 'nabız'; met = gross / (i.weightKg * h) }
  }
  const net = Math.max(0, gross - i.weightKg * h)
  return { gross: Math.round(gross), net: Math.round(net), method, met: Math.round(met * 10) / 10 }
}

/** Ağırlık antrenmanı: yoğunluğa göre MET 3,5 (orta) ya da 6,0 (yoğun: dakikada 0,4+ çalışma seti). */
export function strengthKcal(minutes: number, weightKg: number, workSetCount: number): { gross: number; net: number; met: number } {
  const met = minutes > 0 && workSetCount / minutes >= 0.4 ? 6.0 : 3.5
  const h = minutes / 60
  return { gross: Math.round(met * weightKg * h), net: Math.round((met - 1) * weightKg * h), met }
}

/** Antrenman günü su hedefi eki: saat başına +500 ml, 50 ml'ye yuvarlı. */
export function workoutWaterBonus(minutes: number): number {
  return Math.round((500 * minutes) / 60 / 50) * 50
}
