// Su alışkanlığı analizi (kural tabanlı) ve rozetler — saf, testli (tests/water-insights.test.ts).
// Yalnızca su verisini kullanır; tıbbi yorum yapmaz. Spesifikasyon 7.4 ve 7.10.
import { computeStreak, fmtHm } from './water.ts'

export interface InsightDay { day: string; total: number; goal: number; count: number; firstAt: number | null }

export interface InsightInput {
  days: InsightDay[] // eskiden yeniye, son eleman bugün; en az son 28 gün
  hourlyAvg14: number[] // son 14 gün saatlik ortalama
  wake: number
  sleep: number
  reminders: { sent: number; acted: number; bestHour: number | null }
}

export interface Insight { id: string; tone: 'good' | 'warn' | 'info'; text: string }

const WD = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

export function waterInsights(i: InsightInput, max = 3): Insight[] {
  const closed = i.days.slice(0, -1) // bugün hariç
  const last14 = closed.slice(-14).filter((d) => d.count > 0)
  const last7 = closed.slice(-7).filter((d) => d.count > 0)
  const prev7 = closed.slice(-14, -7).filter((d) => d.count > 0)
  const out: Insight[] = []

  // 1) En zayıf 3 saatlik dilim
  if (last14.length >= 5) {
    const wakeH = Math.ceil(i.wake / 60), sleepH = Math.floor((i.sleep <= i.wake ? 1439 : i.sleep) / 60) - 1
    let best: { h: number; v: number } | null = null
    for (let h = wakeH; h + 3 <= sleepH; h++) {
      const v = i.hourlyAvg14[h] + i.hourlyAvg14[h + 1] + i.hourlyAvg14[h + 2]
      if (!best || v < best.v) best = { h, v }
    }
    const dayAvg = avg(last14.map((d) => d.total))
    if (best && best.v < dayAvg * 0.12) {
      out.push({ id: 'weak-window', tone: 'info', text: `Son 14 günde en az su içtiğin zaman dilimi ${fmtHm(best.h * 60)}–${fmtHm((best.h + 3) * 60)}. Bu saatlerde daha erken hatırlatma almak hedefini tamamlamanı kolaylaştırabilir.` })
    }
  }

  // 2) Son hafta önceki haftaya göre
  if (last7.length >= 4 && prev7.length >= 4) {
    const a = avg(last7.map((d) => d.total)), b = avg(prev7.map((d) => d.total))
    const ch = b ? Math.round(((a - b) / b) * 100) : 0
    if (ch >= 10) out.push({ id: 'trend-up', tone: 'good', text: `Son 7 günde günlük ortalaman bir önceki haftaya göre %${ch} arttı (${Math.round(a).toLocaleString('tr-TR')} ml).` })
    else if (ch <= -10) out.push({ id: 'trend-down', tone: 'warn', text: `Son 7 günde günlük ortalaman bir önceki haftaya göre %${-ch} düştü. Kısa bir hatırlatma aralığı denemek ister misin?` })
  }

  // 3) En zayıf gün (son 28 gün)
  const by = new Map<number, { met: number; n: number }>()
  for (const d of closed.slice(-28).filter((x) => x.count > 0)) {
    const w = new Date(d.day + 'T12:00:00Z').getUTCDay()
    const e = by.get(w) ?? { met: 0, n: 0 }
    e.n++; if (d.total >= d.goal) e.met++
    by.set(w, e)
  }
  const rates = [...by.entries()].filter(([, e]) => e.n >= 2).map(([w, e]) => ({ w, r: e.met / e.n }))
  if (rates.length >= 4) {
    const worst = rates.reduce((a, b) => (b.r < a.r ? b : a)), bestR = Math.max(...rates.map((x) => x.r))
    if (bestR - worst.r >= 0.3) out.push({ id: 'weak-weekday', tone: 'info', text: `${WD[worst.w]} günleri hedefi en az tamamladığın gün (%${Math.round(worst.r * 100)}). O gün için ayrı bir hedef ya da hatırlatma planı işe yarayabilir.` })
  }

  // 4) İlk suyun saati kayıyor mu?
  const f7 = last7.map((d) => d.firstAt).filter((x): x is number => x !== null)
  const fPrev = closed.slice(-21, -7).filter((d) => d.count > 0).map((d) => d.firstAt).filter((x): x is number => x !== null)
  if (f7.length >= 4 && fPrev.length >= 5) {
    const shift = Math.round(median(f7) - median(fPrev))
    if (shift >= 60) out.push({ id: 'morning-shift', tone: 'warn', text: `Sabah ilk suyunu son günlerde yaklaşık ${shift} dakika daha geç içiyorsun (ortalama ${fmtHm(median(f7))}). Uyanınca bir bardak su güne iyi bir başlangıç olur.` })
  }

  // 5) İstikrar
  if (last14.length >= 10) {
    const m = avg(last14.map((d) => d.total))
    const sd = Math.sqrt(avg(last14.map((d) => (d.total - m) ** 2)))
    if (m > 0 && sd / m < 0.15) out.push({ id: 'consistent', tone: 'good', text: `Son 14 gündür su düzenin çok istikrarlı: günlük miktarın ortalamadan yalnızca ±%${Math.round((sd / m) * 100)} sapıyor.` })
  }

  // 6) Hatırlatma etkinliği
  if (i.reminders.sent >= 10) {
    const r = i.reminders.acted / i.reminders.sent
    if (r >= 0.4) out.push({ id: 'reminders-work', tone: 'good', text: `Hatırlatmalardan sonra %${Math.round(r * 100)} oranında 20 dakika içinde su içtin${i.reminders.bestHour != null ? `; en etkili saat ${fmtHm(i.reminders.bestHour * 60)}` : ''}.` })
    else if (r < 0.15) out.push({ id: 'reminders-ignored', tone: 'info', text: 'Hatırlatmaların çoğu yanıtsız kalıyor. Yok saydığın saatlerde bildirimleri otomatik olarak azaltıyorum.' })
  }

  const order = { warn: 0, info: 1, good: 2 }
  return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, max)
}

// ───────── Rozetler ─────────

export interface Badge { id: string; title: string; desc: string; earnedDay: string | null }

const BADGES: { id: string; title: string; desc: string }[] = [
  { id: 'first-log', title: 'İlk yudum', desc: 'İlk su kaydını ekledin' },
  { id: 'first-goal', title: 'Hedef tamam', desc: 'Günlük su hedefine ilk kez ulaştın' },
  { id: 'streak-7', title: '7 günlük seri', desc: 'Üst üste 7 gün hedef (esnek seri)' },
  { id: 'streak-30', title: '30 günlük seri', desc: 'Üst üste 30 gün hedef (esnek seri)' },
  { id: 'perfect-week', title: 'Mükemmel hafta', desc: 'Pazartesi–Pazar her gün hedef' },
  { id: 'liters-100', title: '100 litre', desc: 'Toplam 100 litre su' },
  { id: 'early-bird', title: 'Erken kuş', desc: '5 gün uyanıştan sonraki 1 saatte su içtin' },
]

/** Rozetler veriden belirlenir; kazanılma günü, koşulun ilk sağlandığı gündür. */
export function computeBadges(days: InsightDay[], wake: number): Badge[] {
  const earned = new Map<string, string>()
  const set = (id: string, d: string) => { if (!earned.has(id)) earned.set(id, d) }
  let cum = 0, early = 0
  for (let k = 0; k < days.length; k++) {
    const d = days[k]
    if (d.count > 0) set('first-log', d.day)
    if (d.goal > 0 && d.total >= d.goal) set('first-goal', d.day)
    cum += d.total
    if (cum >= 100_000) set('liters-100', d.day)
    if (d.firstAt !== null && d.firstAt <= wake + 60) { early++; if (early >= 5) set('early-bird', d.day) }
    if (!earned.has('streak-30') || !earned.has('streak-7')) {
      const st = computeStreak(days.slice(0, k + 1).map((x) => ({ day: x.day, total: x.total, goal: x.goal }))).current
      if (st >= 7) set('streak-7', d.day)
      if (st >= 30) set('streak-30', d.day)
    }
    // Pazar günü: o hafta Pt–Pz hepsi hedef mi?
    if (new Date(d.day + 'T12:00:00Z').getUTCDay() === 0 && k >= 6) {
      const wk = days.slice(k - 6, k + 1)
      if (wk.every((x) => x.goal > 0 && x.total >= x.goal)) set('perfect-week', d.day)
    }
  }
  return BADGES.map((b) => ({ ...b, earnedDay: earned.get(b.id) ?? null }))
}
