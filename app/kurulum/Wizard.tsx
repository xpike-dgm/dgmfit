'use client'
import { useEffect, useMemo, useState, useTransition } from 'react'
import Ruler from '@/components/Ruler'
import { btn, Ring } from '@/components/ui'
import { Arrow, Back, Check, Female, Info, Male } from '@/components/icons'
import {
  ACTIVITY, GOALS, TEMPOS, ageFromBirthDate, bmi, bmiCategory, computePlan, daysForTempo, fmtNum, healthyWeightRange,
  type Activity, type GoalType, type Sex,
} from '@/lib/calc'
import { completeOnboarding } from './actions'

interface State {
  step: number
  sex?: Sex
  birthDate?: string
  heightCm: number
  weightKg: number
  activity?: Activity
  goal?: GoalType
  targetWeightKg: number
  tempo: 'easy' | 'balanced' | 'fast' | 'custom'
  customDays: number
  experience: 'new' | 'mid' | 'adv' | null
  trainingDays: number | null
  dietPref: string | null
  allergies: string[]
  wakeTime: string
  sleepTime: string
}

const KEY = 'dgfit:onboarding:v1'
const INITIAL: State = {
  step: 0, heightCm: 170, weightKg: 70, targetWeightKg: 65, tempo: 'balanced', customDays: 90,
  experience: null, trainingDays: null, dietPref: null, allergies: [], wakeTime: '07:30', sleepTime: '23:30',
}
const TOTAL = 11
const DIETS = ['Hepsini yerim', 'Vejetaryen', 'Vegan', 'Pesketaryen', 'Glutensiz', 'Laktozsuz', 'Ketojenik']
const ALLERGIES = ['Fıstık', 'Kuruyemiş', 'Süt', 'Yumurta', 'Gluten', 'Deniz ürünleri', 'Soya', 'Susam']

function maxBirthDate() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 16)
  return d.toISOString().slice(0, 10)
}

export default function Wizard({ username }: { username: string }) {
  const [s, setS] = useState<State>(INITIAL)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setS({ ...INITIAL, ...JSON.parse(raw) })
    } catch { /* yok */ }
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* yok */ }
  }, [s, loaded])

  const set = (p: Partial<State>) => setS((x) => ({ ...x, ...p }))
  const age = s.birthDate ? ageFromBirthDate(s.birthDate) : null
  const recomp = s.goal === 'recomp'

  // Hedef kilo adımı için yön kontrolü
  const target = recomp ? s.weightKg : s.targetWeightKg
  const days = useMemo(() => {
    if (recomp) return 90
    if (s.tempo === 'custom') return s.customDays
    const t = TEMPOS.find((x) => x.id === s.tempo)!
    return daysForTempo(s.weightKg, target, t.kgPerWeek)
  }, [recomp, s.tempo, s.customDays, s.weightKg, target])

  const plan = useMemo(() => {
    if (!s.sex || age === null || !s.activity || !s.goal) return null
    return computePlan({ sex: s.sex, age, heightCm: s.heightCm, weightKg: s.weightKg, activity: s.activity, goal: s.goal, targetWeightKg: target, days })
  }, [s.sex, age, s.heightCm, s.weightKg, s.activity, s.goal, target, days])

  const [hMin, hMax] = healthyWeightRange(s.heightCm)
  const targetErr =
    s.goal === 'lose' && s.targetWeightKg >= s.weightKg ? 'Kilo vermek için hedef, mevcut kilondan düşük olmalı.'
      : s.goal === 'gain' && s.targetWeightKg <= s.weightKg ? 'Kilo almak için hedef, mevcut kilondan yüksek olmalı.'
        : s.goal === 'lose' && s.targetWeightKg < hMin ? `Bu hedef sağlıklı aralığın altında. En az ${fmtNum(hMin, 1)} kg seçebilirsin.`
          : null

  // Atlanacak adımlar (rekompozisyonda hedef kilo ve tempo sorulmaz)
  const skip = (i: number) => recomp && (i === 7 || i === 8)
  const go = (dir: 1 | -1) => {
    setError(null)
    let n = s.step + dir
    while (n > 0 && n < TOTAL - 1 && skip(n)) n += dir
    set({ step: Math.max(0, Math.min(TOTAL - 1, n)) })
    window.scrollTo({ top: 0 })
  }

  const canNext = (() => {
    switch (s.step) {
      case 1: return !!s.sex
      case 2: return !!s.birthDate && age !== null && age >= 16 && age <= 100
      case 5: return !!s.activity
      case 6: return !!s.goal
      case 7: return !targetErr
      case 8: return !!plan && plan.allowed
      default: return true
    }
  })()

  const onGoalPick = (g: GoalType) => {
    const t = g === 'lose' ? Math.max(hMin, Math.round((s.weightKg - 5) * 2) / 2) : g === 'gain' ? Math.round((s.weightKg + 4) * 2) / 2 : s.weightKg
    set({ goal: g, targetWeightKg: t })
  }

  const submit = () => {
    if (!s.sex || !s.birthDate || !s.activity || !s.goal) return
    setError(null)
    start(async () => {
      const r = await completeOnboarding({
        sex: s.sex!, birthDate: s.birthDate!, heightCm: s.heightCm, weightKg: s.weightKg, activity: s.activity!, goal: s.goal!,
        targetWeightKg: target, days, experience: s.experience, trainingDays: s.trainingDays,
        dietPref: s.dietPref, allergies: s.allergies, wakeTime: s.wakeTime, sleepTime: s.sleepTime,
      })
      if (r?.error) setError(r.error)
      else try { localStorage.removeItem(KEY) } catch { /* yok */ }
    })
  }

  if (!loaded) return <div className="min-h-dvh" />

  const visibleTotal = recomp ? TOTAL - 2 : TOTAL
  const visibleIndex = recomp && s.step > 8 ? s.step - 2 : s.step
  const bmiNow = bmi(s.weightKg, s.heightCm)
  const bmiTarget = bmi(target, s.heightCm)

  return (
    <main className="min-h-dvh max-w-md mx-auto px-5 safe-top pb-6 flex flex-col">
      {s.step > 0 ? (
        <div className="flex items-center gap-3 pt-1">
          <button type="button" onClick={() => go(-1)} aria-label="Geri" className={btn.icon}><Back size={20} /></button>
          <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${visibleTotal - 1}, minmax(0, 1fr))` }} aria-label={`Adım ${visibleIndex} / ${visibleTotal - 1}`}>
            {Array.from({ length: visibleTotal - 1 }, (_, i) => (
              <span key={i} className="h-[5px] rounded-full transition-colors" style={{ background: i < visibleIndex ? 'var(--color-lime)' : 'var(--color-line)' }} />
            ))}
          </div>
          <span className="num text-sm text-mute w-10 text-right">{visibleIndex}/{visibleTotal - 1}</span>
        </div>
      ) : null}

      <section key={s.step} className="flex-1 flex flex-col animate-[fadeIn_.28s_ease]">
        {s.step === 0 && (
          <div className="flex-1 flex flex-col justify-center gap-6 pt-10">
            <span className="w-14 h-14 rounded-2xl bg-lime text-lime-ink flex items-center justify-center num font-bold text-xl">Dg</span>
            <h1 className="text-[34px] leading-[1.1] font-extrabold tracking-tight">Merhaba {username},<br />seni tanıyalım.</h1>
            <p className="text-ink-2 text-base leading-relaxed">Birkaç soruyla günlük kalori, makro ve su hedefini hesaplayıp sana özel planı oluşturacağız. Yaklaşık 1 dakika sürer.</p>
            <ul className="flex flex-col gap-3 text-[15px] text-ink-2">
              {['Kalori ve makro hedefi', 'Hedef kilona ulaşma tarihi', 'Kişisel su hedefi'].map((t) => (
                <li key={t} className="flex items-center gap-3"><span className="w-7 h-7 rounded-full bg-coach border border-coach-line text-lime flex items-center justify-center"><Check size={14} /></span>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {s.step === 1 && (
          <Q eyebrow="Profil" title="Cinsiyetin?" sub="Bazal metabolizma formülü biyolojik cinsiyete göre farklı hesaplanır.">
            <div className="grid grid-cols-2 gap-3">
              {([['male', 'Erkek', Male], ['female', 'Kadın', Female]] as const).map(([v, l, I]) => (
                <Choice key={v} selected={s.sex === v} onClick={() => set({ sex: v })} className="h-40 flex-col justify-center">
                  <I size={34} /><span className="text-lg font-extrabold">{l}</span>
                </Choice>
              ))}
            </div>
          </Q>
        )}

        {s.step === 2 && (
          <Q eyebrow="Profil" title="Doğum tarihin?" sub="Yaşın her yıl otomatik güncellenir. DgFit 16 yaş ve üzeri içindir.">
            <label htmlFor="bd" className="sr-only">Doğum tarihi</label>
            <input id="bd" type="date" max={maxBirthDate()} min="1926-01-01" value={s.birthDate ?? ''}
              onChange={(e) => set({ birthDate: e.target.value })}
              className="w-full h-16 rounded-2xl bg-surface border border-line px-4 text-xl num text-ink outline-none focus:border-lime" />
            {age !== null ? (
              <p className="mt-4 text-ink-2">{age >= 16 ? <><b className="num text-ink text-2xl">{age}</b> yaşındasın</> : <span className="text-danger font-bold">16 yaşından küçükler kayıt olamaz.</span>}</p>
            ) : null}
          </Q>
        )}

        {s.step === 3 && (
          <Q eyebrow="Profil" title="Boyun kaç?" sub="Cetveli kaydır veya ± butonlarını kullan.">
            <Big value={fmtNum(s.heightCm)} unit="cm" />
            <Ruler label="Boy" min={120} max={230} step={1} majorEvery={10} value={s.heightCm} onChange={(v) => set({ heightCm: v })} />
            <Steppers onMinus={() => set({ heightCm: Math.max(120, s.heightCm - 1) })} onPlus={() => set({ heightCm: Math.min(230, s.heightCm + 1) })} />
          </Q>
        )}

        {s.step === 4 && (
          <Q eyebrow="Profil" title="Şu anki kilon?" sub="Sabah aç karnına tartıldığın değer en doğrusudur.">
            <Big value={fmtNum(s.weightKg, 1)} unit="kg" />
            <div className="flex justify-center gap-2 mb-5">
              <Chip>VKİ {fmtNum(bmiNow, 1)} · {bmiCategory(bmiNow)}</Chip>
            </div>
            <Ruler label="Kilo" min={30} max={250} step={0.1} majorEvery={10} labelEvery={50} band={[hMin, hMax]} value={s.weightKg}
              format={(v) => String(Math.round(v))} onChange={(v) => set({ weightKg: v })} />
            <Steppers onMinus={() => set({ weightKg: Math.max(30, +(s.weightKg - 0.1).toFixed(1)) })} onPlus={() => set({ weightKg: Math.min(250, +(s.weightKg + 0.1).toFixed(1)) })} />
          </Q>
        )}

        {s.step === 5 && (
          <Q eyebrow="Yaşam tarzı" title="Ne kadar hareketlisin?" sub="Gün içindeki genel hareketini düşün; antrenmanlar ayrıca hesaba katılacak.">
            <div className="flex flex-col gap-2.5">
              {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
                <Choice key={a} selected={s.activity === a} onClick={() => set({ activity: a })} className="min-h-[68px] justify-between text-left">
                  <span className="flex flex-col"><span className="font-extrabold text-base">{ACTIVITY[a].label}</span><span className="text-[13px] text-mute">{ACTIVITY[a].hint}</span></span>
                  <span className="num text-sm text-mute">×{ACTIVITY[a].factor}</span>
                </Choice>
              ))}
            </div>
          </Q>
        )}

        {s.step === 6 && (
          <Q eyebrow="Hedefin" title="Kilo konusunda hedefin ne?" sub="Planın bu seçime göre şekillenir; istediğin zaman değiştirebilirsin.">
            <div className="flex flex-col gap-2.5">
              {(Object.keys(GOALS) as GoalType[]).map((g) => (
                <Choice key={g} selected={s.goal === g} onClick={() => onGoalPick(g)} className="min-h-[76px] text-left">
                  <span className="flex flex-col"><span className="font-extrabold text-base">{GOALS[g].label}</span><span className="text-[13px] text-mute">{GOALS[g].hint}</span></span>
                </Choice>
              ))}
            </div>
          </Q>
        )}

        {s.step === 7 && !recomp && (
          <Q eyebrow={`Hedefin · ${GOALS[s.goal ?? 'lose'].label}`} title="Hedef kilon kaç?" sub={`Şu an ${fmtNum(s.weightKg, 1)} kg'sın. Yeşil bant boyun için sağlıklı aralık (${fmtNum(hMin)}–${fmtNum(hMax)} kg).`}>
            <Big value={fmtNum(s.targetWeightKg, 1)} unit="kg" />
            <div className="flex justify-center gap-2 mb-5">
              <Chip>{s.targetWeightKg - s.weightKg > 0 ? '+' : '−'}{fmtNum(Math.abs(s.targetWeightKg - s.weightKg), 1)} kg</Chip>
              <Chip accent={bmiTarget >= 18.5 && bmiTarget < 25}>VKİ {fmtNum(bmiTarget, 1)} · {bmiCategory(bmiTarget)}</Chip>
            </div>
            <Ruler label="Hedef kilo" min={30} max={250} step={0.5} majorEvery={10} labelEvery={10} band={[hMin, hMax]} value={s.targetWeightKg}
              format={(v) => String(Math.round(v))} onChange={(v) => set({ targetWeightKg: v })} />
            <Steppers onMinus={() => set({ targetWeightKg: Math.max(30, s.targetWeightKg - 0.5) })} onPlus={() => set({ targetWeightKg: Math.min(250, s.targetWeightKg + 0.5) })} />
            {targetErr ? <p className="mt-4 text-sm font-semibold text-danger" role="alert">{targetErr}</p> : null}
          </Q>
        )}

        {s.step === 8 && !recomp && (
          <Q eyebrow="Tempo" title="Ne kadar sürede?" sub="Hazır bir tempo seç ya da gün sayısını kendin gir.">
            <div className="grid grid-cols-3 gap-2.5">
              {TEMPOS.map((t) => (
                <Choice key={t.id} selected={s.tempo === t.id} onClick={() => set({ tempo: t.id })} className="h-24 flex-col justify-center !gap-1">
                  <span className="font-extrabold">{t.label}</span>
                  <span className="num text-[13px] text-mute">{fmtNum(t.kgPerWeek, 2)} kg/hf</span>
                </Choice>
              ))}
            </div>
            <Choice selected={s.tempo === 'custom'} onClick={() => set({ tempo: 'custom' })} className="mt-2.5 min-h-[64px] justify-between">
              <span className="font-extrabold">Kendim belirleyeceğim</span>
              <span className="flex items-center gap-2">
                <input aria-label="Gün sayısı" type="number" inputMode="numeric" min={7} max={1100} value={s.customDays}
                  onClick={(e) => e.stopPropagation()} onFocus={() => set({ tempo: 'custom' })}
                  onChange={(e) => set({ customDays: Math.max(7, Math.min(1100, Number(e.target.value) || 7)), tempo: 'custom' })}
                  className="w-20 h-11 rounded-xl bg-surface-2 border border-line text-center num text-lg outline-none focus:border-lime" />
                <span className="text-mute text-sm">gün</span>
              </span>
            </Choice>
            {plan ? (
              <div className={`mt-5 rounded-[22px] p-4 flex flex-col gap-2 ${!plan.allowed ? 'bg-danger-bg border border-danger-line' : plan.safe ? 'bg-surface' : 'bg-warn-bg border border-warn-line'}`}>
                <div className="flex justify-between text-sm"><span className="text-mute">Süre</span><b className="num">{fmtNum(days)} gün · {endDateLabel(days)}</b></div>
                <div className="flex justify-between text-sm"><span className="text-mute">Haftalık değişim</span><b className="num">{fmtNum(plan.weeklyKg, 2)} kg</b></div>
                <div className="flex justify-between text-sm"><span className="text-mute">Günlük kalori</span><b className="num">{fmtNum(plan.dailyKcal)} kcal</b></div>
                {plan.warnings.map((w) => (
                  <p key={w} role={plan.allowed ? 'note' : 'alert'} className={`text-sm leading-relaxed mt-1 ${plan.allowed ? 'text-warn' : 'text-danger'}`}>{w}</p>
                ))}
                <div className="flex flex-wrap gap-2">
                  {!plan.allowed && plan.minDays > 0 ? (
                    <button type="button" className={btn.secondary + ' mt-1'} onClick={() => set({ tempo: 'custom', customDays: Math.max(7, plan.minDays) })}>
                      {fmtNum(Math.max(7, plan.minDays))} günü kullan
                    </button>
                  ) : null}
                  {!plan.safe && plan.safeDays > 0 && plan.safeDays !== days ? (
                    <button type="button" className={btn.secondary + ' mt-1'} onClick={() => set({ tempo: 'custom', customDays: Math.min(1100, plan.safeDays) })}>
                      Önerilen {fmtNum(plan.safeDays)} gün
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Q>
        )}

        {s.step === 9 && (
          <Q eyebrow="İsteğe bağlı" title="Biraz daha anlat" sub="Bu bilgiler antrenman, yemek önerileri ve su hatırlatmalarını kişiselleştirir. Atlayabilirsin.">
            <Group label="Spor deneyimin">
              {([['new', 'Yeni başlıyorum'], ['mid', 'Orta'], ['adv', 'İleri']] as const).map(([v, l]) => (
                <Pill key={v} on={s.experience === v} onClick={() => set({ experience: s.experience === v ? null : v })}>{l}</Pill>
              ))}
            </Group>
            <Group label="Haftada kaç gün antrenman?">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <Pill key={n} on={s.trainingDays === n} onClick={() => set({ trainingDays: s.trainingDays === n ? null : n })} num>{n}</Pill>)}
            </Group>
            <Group label="Beslenme tercihin">
              {DIETS.map((d) => <Pill key={d} on={s.dietPref === d} onClick={() => set({ dietPref: s.dietPref === d ? null : d })}>{d}</Pill>)}
            </Group>
            <Group label="Alerjilerin">
              {ALLERGIES.map((a) => (
                <Pill key={a} on={s.allergies.includes(a)} onClick={() => set({ allergies: s.allergies.includes(a) ? s.allergies.filter((x) => x !== a) : [...s.allergies, a] })}>{a}</Pill>
              ))}
            </Group>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <TimeField id="wake" label="Uyanış saati" value={s.wakeTime} onChange={(v) => set({ wakeTime: v })} />
              <TimeField id="sleep" label="Uyku saati" value={s.sleepTime} onChange={(v) => set({ sleepTime: v })} />
            </div>
          </Q>
        )}

        {s.step === 10 && plan && (
          <div className="flex-1 flex flex-col gap-4 pt-8">
            <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-lime">Planın hazır</span>
            <h1 className="text-[30px] leading-tight font-extrabold tracking-tight">
              {recomp ? 'Kilonu koruyup kas kazanma planın' : <>{fmtNum(target, 1)} kg hedefine <span className="text-lime">{endDateLabel(days)}</span></>}
            </h1>
            <div className="card p-5 flex items-center gap-5">
              <Ring value={1} size={112} stroke={11} label={`Günlük ${plan.dailyKcal} kalori`}>
                <div className="flex flex-col items-center"><span className="num text-2xl font-bold">{fmtNum(plan.dailyKcal)}</span><span className="text-xs text-mute">kcal/gün</span></div>
              </Ring>
              <div className="flex-1 flex flex-col gap-2.5">
                <Macro name="Protein" g={plan.proteinG} color="var(--color-lime)" />
                <Macro name="Karbonhidrat" g={plan.carbG} color="var(--color-orange)" />
                <Macro name="Yağ" g={plan.fatG} color="var(--color-violet)" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Harcaman" value={fmtNum(plan.tdee)} unit="kcal" />
              <Stat label={plan.dailyDelta <= 0 ? 'Günlük açık' : 'Günlük fazla'} value={fmtNum(Math.abs(plan.dailyDelta))} unit="kcal" />
              <Stat label="Su hedefi" value={fmtNum(plan.waterMl / 1000, 1)} unit="litre" />
            </div>
            <div className="flex gap-3 p-4 rounded-[18px] bg-surface text-sm leading-relaxed text-ink-2">
              <Info size={20} className="shrink-0 text-mute mt-0.5" />
              <span>3 hafta sonra gerçek kilo trendine göre harcaman yeniden ölçülür ve plan otomatik güncellenir. Öneriler tıbbi tavsiye yerine geçmez.</span>
            </div>
          </div>
        )}
      </section>

      {error ? <p className="text-sm font-semibold text-danger mb-3" role="alert">{error}</p> : null}
      <div className="pt-4 flex flex-col gap-2">
        {s.step < TOTAL - 1 ? (
          <button type="button" className={btn.primary} disabled={!canNext} onClick={() => go(1)}>
            {s.step === 0 ? 'Başlayalım' : 'Devam'} <Arrow size={20} />
          </button>
        ) : (
          <button type="button" className={btn.primary} disabled={pending || !plan} onClick={submit}>
            {pending ? 'Kaydediliyor…' : 'Planı başlat'} <Arrow size={20} />
          </button>
        )}
        {s.step === 9 ? <button type="button" className={btn.ghost} onClick={() => go(1)}>Atla</button> : null}
      </div>
    </main>
  )
}

function endDateLabel(days: number) {
  const d = new Date(Date.now() + (days - 1) * 86400000)
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }).format(d)
}

function Q({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col pt-8">
      <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-lime">{eyebrow}</span>
      <h1 className="mt-2.5 text-[30px] leading-[1.12] font-extrabold tracking-tight">{title}</h1>
      {sub ? <p className="mt-2.5 text-[15px] leading-relaxed text-mute">{sub}</p> : null}
      <div className="mt-8">{children}</div>
    </div>
  )
}

function Choice({ selected, onClick, children, className = '' }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`w-full flex items-center gap-3 px-5 py-4 rounded-[22px] border transition active:scale-[0.99] ${selected ? 'bg-coach border-lime text-ink' : 'bg-surface border-transparent text-ink'} ${className}`}>
      {children}
    </button>
  )
}

function Big({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="flex items-baseline justify-center gap-1.5 mb-5">
      <span className="num text-[76px] leading-none font-bold tracking-[-0.04em]">{value}</span>
      <span className="text-xl font-bold text-mute">{unit}</span>
    </div>
  )
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return <span className={`h-8 px-3 rounded-full flex items-center text-[13px] font-bold ${accent ? 'bg-coach border border-coach-line text-lime' : 'bg-surface-2 text-ink'}`}>{children}</span>
}

function Steppers({ onMinus, onPlus }: { onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="flex justify-center gap-3 mt-4">
      <button type="button" onClick={onMinus} aria-label="Azalt" className="w-14 h-12 rounded-2xl bg-surface text-2xl font-bold">−</button>
      <button type="button" onClick={onPlus} aria-label="Artır" className="w-14 h-12 rounded-2xl bg-surface text-2xl font-bold">+</button>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-bold mb-2.5">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Pill({ on, onClick, children, num }: { on: boolean; onClick: () => void; children: React.ReactNode; num?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`h-11 ${num ? 'w-11' : 'px-4'} rounded-full text-sm font-bold border transition ${on ? 'bg-lime text-lime-ink border-lime' : 'bg-surface text-ink-2 border-line'} ${num ? 'num' : ''}`}>
      {children}
    </button>
  )
}

function TimeField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold mb-2">{label}</label>
      <input id={id} type="time" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 rounded-2xl bg-surface border border-line px-3 num text-lg text-ink outline-none focus:border-lime" />
    </div>
  )
}

function Macro({ name, g, color }: { name: string; g: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 font-semibold"><span className="w-2 h-2 rounded-full" style={{ background: color }} />{name}</span>
      <b className="num">{g} g</b>
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-surface rounded-[20px] p-3.5 flex flex-col gap-0.5">
      <span className="text-xs text-mute">{label}</span>
      <span className="num text-xl font-bold">{value}</span>
      <span className="text-xs text-mute">{unit}</span>
    </div>
  )
}
