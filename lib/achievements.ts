// P-7 rozet/seri: modüller arası başarılar (saf; tests/achievements.test.ts). Su rozetleri lib/water-insights.ts'te.

export interface Achievement { id: string; module: 'food' | 'fitness' | 'fit'; title: string; desc: string; earnedDay: string | null }
export interface AchInput {
  /** gün başına öğün kalemi sayısı (yalnızca kayıt olan günler) */
  foodDays: { day: string; items: number }[]
  /** antrenman ve kardiyo günleri (tekrarlı olabilir) */
  workoutDays: string[]
  /** rekor tarihleri */
  prDays: string[]
  /** hedefe ulaşılan gün (varsa) */
  goalReachedDay: string | null
  /** uygulanan check-in tarihleri */
  checkinDays: string[]
  today: string
}

const DEFS: Omit<Achievement, 'earnedDay'>[] = [
  { id: 'food-first', module: 'food', title: 'İlk öğün', desc: 'İlk öğün kaydını ekledin' },
  { id: 'food-streak-7', module: 'food', title: '7 gün kayıt', desc: 'Üst üste 7 gün en az 2 kalem kaydettin' },
  { id: 'food-streak-30', module: 'food', title: '30 gün kayıt', desc: 'Üst üste 30 gün en az 2 kalem kaydettin' },
  { id: 'wo-first', module: 'fitness', title: 'İlk antrenman', desc: 'İlk antrenmanını tamamladın' },
  { id: 'wo-10', module: 'fitness', title: '10 antrenman', desc: 'Toplam 10 antrenman' },
  { id: 'wo-50', module: 'fitness', title: '50 antrenman', desc: 'Toplam 50 antrenman' },
  { id: 'wo-weeks-4', module: 'fitness', title: '4 hafta istikrar', desc: 'Üst üste 4 hafta, haftada en az 2 antrenman' },
  { id: 'pr-first', module: 'fitness', title: 'İlk rekor', desc: 'İlk kişisel rekorunu kırdın' },
  { id: 'pr-10', module: 'fitness', title: '10 rekor', desc: 'Toplam 10 kişisel rekor' },
  { id: 'checkin-4', module: 'fit', title: '4 check-in', desc: '4 haftalık check-in uyguladın' },
  { id: 'goal-reached', module: 'fit', title: 'Hedefe ulaştın', desc: 'Kilo hedefine ulaştın' },
]

const plus = (d: string, n: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
/** Haftanın pazartesisi (YYYY-MM-DD). */
export function mondayOf(d: string): string { const wd = new Date(d + 'T12:00:00Z').getUTCDay(); return plus(d, -((wd + 6) % 7)) }

/** Kayıt serisi: bugün ya da dün biten, üst üste en az 2 kalemli gün sayısı (bugün henüz kayıt yoksa seri bozulmaz). */
export function foodStreak(foodDays: { day: string; items: number }[], today: string): number {
  const ok = new Set(foodDays.filter((d) => d.items >= 2).map((d) => d.day))
  let d = ok.has(today) ? today : plus(today, -1), n = 0
  while (ok.has(d)) { n++; d = plus(d, -1) }
  return n
}

/** Antrenman haftası serisi: bu hafta (henüz bitmediyse geçen hafta) geriye, haftada en az `min` antrenman. */
export function trainingWeekStreak(workoutDays: string[], today: string, min = 2): number {
  const perWeek = new Map<string, number>()
  for (const d of workoutDays) { const w = mondayOf(d); perWeek.set(w, (perWeek.get(w) ?? 0) + 1) }
  let w = mondayOf(today)
  if ((perWeek.get(w) ?? 0) < min) w = plus(w, -7) // bu hafta henüz tamamlanmadı
  let n = 0
  while ((perWeek.get(w) ?? 0) >= min) { n++; w = plus(w, -7) }
  return n
}

export function computeAchievements(i: AchInput): Achievement[] {
  const earned = new Map<string, string>()
  const set = (id: string, d: string | undefined | null) => { if (d && !earned.has(id)) earned.set(id, d) }
  const food = [...i.foodDays].sort((a, b) => a.day.localeCompare(b.day))
  set('food-first', food.find((d) => d.items > 0)?.day)
  let run = 0, prev: string | null = null
  for (const d of food) {
    if (d.items < 2) { run = 0; prev = null; continue }
    run = prev && plus(prev, 1) === d.day ? run + 1 : 1; prev = d.day
    if (run >= 7) set('food-streak-7', d.day)
    if (run >= 30) set('food-streak-30', d.day)
  }
  const wo = [...i.workoutDays].sort()
  set('wo-first', wo[0]); set('wo-10', wo[9]); set('wo-50', wo[49])
  // 4 hafta üst üste ≥2: haftalar sırayla
  const perWeek = new Map<string, number>()
  for (const d of wo) { const w = mondayOf(d); perWeek.set(w, (perWeek.get(w) ?? 0) + 1) }
  const weeks = [...perWeek.keys()].sort()
  let wr = 0, pw: string | null = null
  for (const w of weeks) {
    if ((perWeek.get(w) ?? 0) < 2) { wr = 0; pw = null; continue }
    wr = pw && plus(pw, 7) === w ? wr + 1 : 1; pw = w
    if (wr >= 4) set('wo-weeks-4', plus(w, 6) < i.today ? plus(w, 6) : i.today)
  }
  const prs = [...i.prDays].sort()
  set('pr-first', prs[0]); set('pr-10', prs[9])
  set('checkin-4', [...i.checkinDays].sort()[3])
  set('goal-reached', i.goalReachedDay)
  return DEFS.map((d) => ({ ...d, earnedDay: earned.get(d.id) ?? null }))
}
