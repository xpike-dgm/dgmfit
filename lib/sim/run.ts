// Senaryo koşucusu: sanal vücut + kullanıcı davranışı, uygulamanın GERÇEK saf motorlarıyla gün gün.
// Uygulama tarafı (plan, gün kapanışı, dengeleme, check-in, trend, tahmin) lib/calc.ts ve lib/fit.ts'ten çağrılır;
// burada yalnızca veritabanının yerini tutan bellek içi durum vardır (fit-data.ts ile aynı sıra ve kurallar).
import { calorieFloor, computePlan, HARD_MAX_WEEKLY_KG, maxWeeklyKg } from '../calc.ts'
import { balanceWindow, CHECKIN_MAX_STEP, checkinCompute, closureDiff, distributeDiff, scaleMacros, targetKcal, trendSeries, type PlanDay } from '../fit.ts'
import { bodyFatOf, makeBody, scaleReading, stepBody, trueTdee, weightOf } from './body.ts'
import { rng, seedOf } from './rng.ts'
import type { Scenario } from './scenarios.ts'

const START = '2027-01-04' // pazartesi; gerçek tarih önemsiz
const plus = (d: string, n: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const dow = (d: string) => new Date(d + 'T12:00:00Z').getUTCDay()

export type Severity = 'error' | 'warn'
export interface Finding { code: string; severity: Severity; day: number; detail: string }

export interface DayLog { i: number; target: number; intake: number; logged: number | null; weighed: number | null; trend: number | null; trueKg: number; fatPct: number; checkin: number | null }

export interface SimResult {
  id: string; goal: string; startKg: number; targetKg: number; planDays: number
  endTrend: number | null; endTrueKg: number; reachedDay: number | null; leanChange: number; fatChange: number
  minTarget: number; maxTarget: number; checkins: number; findings: Finding[]
  /** "İş birliği yapan" kullanıcı: tam/iyi uyum, doğru kayıt, düzenli tartı, check-in uygular — sonuç kontrolleri buna göre */
  cooperative: boolean
  days?: DayLog[]
}

export function runScenario(s: Scenario, keepDays = false): SimResult {
  const r = rng(seedOf(s.id + ':run'))
  const floor = calorieFloor(s.sex)
  const plan = computePlan({ sex: s.sex, age: s.age, heightCm: s.heightCm, weightKg: s.weightKg, activity: s.activity, goal: s.goal, targetWeightKg: s.targetWeightKg, days: s.planDays })
  // uygulamadaki goals satırı (kurulum)
  const goal = { type: s.goal, startWeightKg: s.weightKg, targetWeightKg: s.targetWeightKg, startDate: START, endDate: plus(START, plan.days - 1), dailyKcal: plan.dailyKcal, protein: plan.proteinG, carb: plan.carbG, fat: plan.fatG }
  const adj = new Map<string, number>() // gün → toplam dengeleme düzeltmesi
  const weights = new Map<string, number>([[START, s.weightKg]]) // kurulumda tartı yazılır
  const closed = new Map<string, { kind: string; eaten: number }>()
  let lastCheckin = START
  const body = makeBody({ sex: s.sex, age: s.age, heightCm: s.heightCm, weightKg: s.weightKg, bodyFatPct: s.bodyFatPct, activityFactor: s.activityTrue, metabolicBias: s.metabolicBias, training: s.training })
  const lean0 = body.leanKg, fat0 = body.fatKg
  const findings: Finding[] = []
  const add = (code: string, severity: Severity, day: number, detail: string) => { if (findings.filter((f) => f.code === code).length < 3) findings.push({ code, severity, day, detail }) }
  const trainWeekdays = [1, 3, 5, 2, 4, 6, 0].slice(0, s.trainDays)
  const totalDays = plan.days + s.tailDays
  const vacFrom = s.vacation ? Math.floor(plan.days * 0.4) : -1
  const illFrom = s.illness ? Math.floor(plan.days * 0.6) : -1
  const typoDay = s.typoWeight ? Math.floor(plan.days * 0.3) + 3 : -1
  const days: DayLog[] = []
  let minT = Infinity, maxT = -Infinity, checkins = 0, reachedDay: number | null = null
  let lastDir = 0, reversalsAfterReach = 0
  let endTrend: number | null = null

  for (let i = 0; i < totalDays; i++) {
    const d = plus(START, i)
    const target = targetKcal(goal.dailyKcal, adj.get(d) ?? 0, floor) // fit-data dayTargets ile aynı
    const macros = scaleMacros({ kcal: goal.dailyKcal, protein: goal.protein, carb: goal.carb, fat: goal.fat }, target)
    // ---- değişmezler (her gün)
    if (!Number.isFinite(target)) add('NAN', 'error', i, 'hedef kalori sayı değil')
    if (target < floor) add('FLOOR', 'error', i, `hedef ${target} < taban ${floor}`)
    if (Math.abs(target - goal.dailyKcal) > 251) add('DAYCAP', 'error', i, `günlük düzeltme ${target - goal.dailyKcal} > 250`) // dayCap üst sınırı
    const mk = macros.protein * 4 + macros.carb * 4 + macros.fat * 9
    if (Math.abs(mk - target) > Math.max(40, target * 0.05)) add('MACRO', 'error', i, `makrolar ${Math.round(mk)} kcal ≠ hedef ${target} (P${macros.protein} K${macros.carb} Y${macros.fat}; taban ${goal.dailyKcal} P${goal.protein} K${goal.carb} Y${goal.fat})`)
    minT = Math.min(minT, target); maxT = Math.max(maxT, target)

    // ---- kullanıcının günü
    const vac = vacFrom >= 0 && i >= vacFrom && i < vacFrom + 7
    const ill = illFrom >= 0 && i >= illFrom && i < illFrom + 7
    const trains = !ill && trainWeekdays.includes(dow(d)) && s.trainDays > 0
    const exTrue = trains ? (s.training === 'none' ? 220 : 300) * (body.leanKg / 55) : 0
    const appBurned = trains ? Math.round(exTrue * (1.1 + r.normal(0, 0.15))) : 0 // uygulamanın antrenman kalorisi tahmini
    const budget = target + appBurned
    const weekend = dow(d) === 0 || dow(d) === 6
    let f = 1
    if (s.adherence === 'perfect') f = 1 + r.normal(0, 0.03)
    else if (s.adherence === 'good') f = 1 + r.normal(0.03, 0.07)
    else if (s.adherence === 'loose') f = 1 + r.normal(0.1, 0.12) + (weekend ? 0.15 : 0)
    else f = 1 + r.normal(-0.1, 0.08)
    if (vac) f += 0.3
    if (ill) f -= 0.35
    const intake = Math.max(600, Math.round(budget * f))
    const proteinOk = s.adherence === 'perfect' || s.adherence === 'good' || (s.adherence === 'loose' && r.chance(0.5))
    stepBody(body, intake, exTrue, trains, proteinOk, r)

    // ---- kayıt ve tartı (uygulamanın gördüğü)
    let logged: number | null = null, items = 0
    if (!vac && !r.chance(s.skipLogP)) {
      logged = Math.round(intake * (1 - s.underreport) * (r.chance(0.04) ? 0.45 : 1))
      items = 4
    }
    const weighs = !vac && (s.weighing === 'daily' || (s.weighing === 'thrice' && r.chance(3 / 7)) || (s.weighing === 'weekly' && i % 7 === 0) || (s.weighing === 'irregular' && r.chance(0.25)))
    let weighed: number | null = null
    if (weighs && i > 0) { weighed = scaleReading(body, r); if (i === typoDay) weighed = Math.round((weighed + 10) * 10) / 10; weights.set(d, weighed) }

    // ---- gün kapanışı (ertesi gün, 03.00'ten sonra): fit-data closeDay ile aynı sıra
    const today = plus(d, 1)
    const c = closureDiff({ eaten: logged ?? 0, target, burned: appBurned, items })
    closed.set(d, { kind: c.kind, eaten: logged ?? 0 })
    if (c.diff !== 0) {
      const win = balanceWindow(d, today, goal.endDate)
      if (win) {
        const upcoming: PlanDay[] = []
        for (let x = win.first; x <= win.last; x = plus(x, 1)) upcoming.push({ day: x, base: goal.dailyKcal, current: targetKcal(goal.dailyKcal, adj.get(x) ?? 0, floor) - goal.dailyKcal })
        const res = distributeDiff(c.diff, upcoming, floor)
        for (const a of res.adjustments) adj.set(a.day, (adj.get(a.day) ?? 0) + a.kcal)
      }
    }

    // ---- haftalık check-in (uygulama "zamanı geldi" der; kullanıcı uygular)
    let ck: number | null = null
    const from = plus(today, -28) > START ? plus(today, -28) : START
    const series = trendSeries(weights, from, today)
    const intakeBy = new Map<string, number | null>()
    for (const [k, v] of closed) if (k >= from && ['balanced', 'over', 'under', 'exception'].includes(v.kind)) intakeBy.set(k, v.eaten)
    const cc = checkinCompute({ goal: { type: s.goal, startWeightKg: goal.startWeightKg, targetWeightKg: goal.targetWeightKg, startDate: goal.startDate, endDate: goal.endDate, dailyKcal: goal.dailyKcal }, series, intakeBy, today, lastCheckin, floor })
    if (cc.due && cc.proposal && cc.tdee.tdee && s.appliesCheckin) {
      if (Math.abs(cc.proposal.delta) > CHECKIN_MAX_STEP) add('STEP', 'error', i, `check-in adımı ${cc.proposal.delta}`)
      const m = scaleMacros({ kcal: goal.dailyKcal, protein: goal.protein, carb: goal.carb, fat: goal.fat }, cc.proposal.kcal)
      if (cc.proposal.delta !== 0) {
        const dir = Math.sign(cc.proposal.delta)
        if (reachedDay !== null && lastDir !== 0 && dir !== lastDir) reversalsAfterReach++
        lastDir = dir
      }
      ck = cc.proposal.delta
      goal.dailyKcal = m.kcal; goal.carb = m.carb; goal.fat = m.fat
      lastCheckin = today; checkins++
      // kas hedefli kullanıcı hedefe ulaştıktan sonra harcamanın belirgin altına çekiliyor mu?
      if (s.goal === 'gain' && reachedDay !== null && goal.dailyKcal < cc.tdee.tdee - 150) add('GAIN_PUSHED_DEFICIT', 'warn', i, `kas hedefli kullanıcı hedefe ulaştıktan sonra ${goal.dailyKcal} kcal (ölçülen harcama ${cc.tdee.tdee}) — açığa sokuluyor`)
    }
    const trend = series.at(-1)?.trend ?? null
    if (reachedDay === null && trend !== null && i > 3 && s.goal !== 'recomp') {
      if ((s.goal === 'gain' && trend >= s.targetWeightKg - 0.3) || (s.goal === 'lose' && trend <= s.targetWeightKg + 0.3)) reachedDay = i
    }
    if (i === plan.days - 1) endTrend = trend
    if (keepDays) days.push({ i, target, intake, logged, weighed, trend, trueKg: Math.round(weightOf(body) * 10) / 10, fatPct: Math.round(bodyFatOf(body) * 10) / 10, checkin: ck })
  }

  // ---- sonuç kontrolleri
  const cooperative = (s.adherence === 'perfect' || s.adherence === 'good') && s.underreport <= 0.05 && s.skipLogP <= 0.05 && (s.weighing === 'daily' || s.weighing === 'thrice') && s.appliesCheckin && !s.typoWeight
  const diff = s.targetWeightKg - s.weightKg
  const endKg = endTrend ?? weightOf(body)
  if (cooperative && s.goal !== 'recomp' && plan.days >= 28) {
    const tol = Math.max(1, Math.abs(diff) * 0.25)
    if (Math.abs(endKg - s.targetWeightKg) > tol) add('MISS', 'warn', plan.days, `plan sonunda trend ${endKg.toFixed(1)} kg, hedef ${s.targetWeightKg} (tolerans ±${tol.toFixed(1)})`)
  }
  if (cooperative && s.goal === 'recomp' && Math.abs(endKg - s.weightKg) > 2) add('RECOMP_DRIFT', 'warn', plan.days, `koruma hedefinde kilo ${s.weightKg} → ${endKg.toFixed(1)}`)
  if (reversalsAfterReach >= 3) add('OSCILLATION', 'warn', plan.days, `hedefe ulaştıktan sonra check-in yönü ${reversalsAfterReach} kez değişti`)
  const safeWeekly = Math.max(maxWeeklyKg(s.goal, s.weightKg), plan.weeklyKg)
  if (cooperative && s.goal !== 'recomp' && reachedDay !== null && reachedDay > 7) {
    const rate = (Math.abs(diff) / reachedDay) * 7
    if (rate > Math.max(1.5 * safeWeekly, 0.25) && rate > HARD_MAX_WEEKLY_KG * 0.5) add('TOO_FAST', 'warn', reachedDay, `hedefe haftada ${rate.toFixed(2)} kg ile ulaşıldı (güvenli ${safeWeekly.toFixed(2)})`)
  }
  if (s.goal === 'gain' && reachedDay !== null && reachedDay < plan.days * 0.5) add('GAIN_EARLY_NO_PROMPT', 'warn', reachedDay, `kas hedefli kullanıcı hedefe ${reachedDay}. günde ulaştı (plan ${plan.days} gün); uygulama sonraki adımı sormuyor`)
  void trueTdee
  return {
    id: s.id, goal: s.goal, startKg: s.weightKg, targetKg: s.targetWeightKg, planDays: plan.days,
    endTrend: endTrend === null ? null : Math.round(endTrend * 10) / 10, endTrueKg: Math.round(weightOf(body) * 10) / 10, reachedDay,
    leanChange: Math.round((body.leanKg - lean0) * 10) / 10, fatChange: Math.round((body.fatKg - fat0) * 10) / 10,
    minTarget: minT, maxTarget: maxT, checkins, findings, cooperative, days: keepDays ? days : undefined,
  }
}

/** Altın dosya için kısa özet (küçük sayısal farklar gürültü olmasın diye yuvarlanır). */
export function goldenOf(r: SimResult): string {
  return [r.goal, r.endTrend, r.reachedDay, r.minTarget, r.maxTarget, r.checkins, r.findings.map((f) => f.code).sort().join('+') || '-'].join('|')
}
