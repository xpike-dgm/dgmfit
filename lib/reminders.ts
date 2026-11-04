// Akıllı su hatırlatma karar motoru — saf fonksiyon, her dakika her kullanıcı için çalıştırılır.
// Spesifikasyon 7.2. Testleri: tests/reminders.test.ts
import { awakeWindow, fmtHm, idealAt } from './water.ts'

export interface SentReminder { at: number; kind: 'remind' | 'summary' | 'test'; acted: boolean | null } // at: gün içi dakika

export interface ReminderInput {
  now: number // gün içi dakika
  wake: number
  sleep: number
  goal: number
  total: number // bugünkü efektif ml
  lastDrink: number | null // bugünkü son kayıt (dakika)
  sentToday: SentReminder[] // zamana göre sıralı
  /** Son 14 günde saat başına ortalama içilen ml (alışkanlık) */
  habit: number[]
  /** Son 14 günde saat başına gönderilen ve işe yarayan hatırlatma sayısı */
  hourStats: { sent: number; acted: number }[]
  maxPerDay: number
  quiet: [number, number][] // sessiz aralıklar (dakika)
  summaryEnabled: boolean
  weakestHour?: number | null // gün sonu özetinde yarın için öneri
}

export type Decision =
  | { send: false; reason: string }
  | { send: true; kind: 'remind' | 'summary'; amount: number; title: string; body: string; tag: string }

export const MIN_SPACING = 45
export const IGNORE_STREAK = 3
export const IGNORE_SILENCE = 120
export const MAX_SUGGEST = 400

function inQuiet(now: number, quiet: [number, number][]) {
  return quiet.some(([a, b]) => (a <= b ? now >= a && now < b : now >= a || now < b))
}

function round50(v: number) { return Math.round(v / 50) * 50 }

/** Ardışık, işe yaramamış (acted=false) son hatırlatma sayısı. */
export function ignoredStreak(sent: SentReminder[]): number {
  let n = 0
  for (let i = sent.length - 1; i >= 0; i--) {
    const s = sent[i]
    if (s.kind !== 'remind') continue
    if (s.acted === false) n++
    else break
  }
  return n
}

const TEMPLATES = [
  (a: number) => ({ title: 'Su molası', body: `${a} ml içmenin tam zamanı.` }),
  (a: number) => ({ title: 'Bir bardak su?', body: `Hedefine yetişmek için şimdi ${a} ml yeterli.` }),
  (a: number) => ({ title: 'Susuz kalma', body: `Son kayıttan bu yana bir süre geçti. ${a} ml iyi gelir.` }),
  (a: number) => ({ title: 'Küçük bir adım', body: `${a} ml ile ideal temponu yakalarsın.` }),
]

export function decideReminder(i: ReminderInput): Decision {
  const [w, s] = awakeWindow(i.wake, i.sleep)
  const now = i.now < w && s > 1440 ? i.now + 1440 : i.now
  const lastSent = i.sentToday.length ? i.sentToday[i.sentToday.length - 1] : null

  // Gün sonu özeti: uykudan 1 saat önce, bir kez
  const summaryAt = s - 60
  if (i.summaryEnabled && now >= summaryAt && now < s && !i.sentToday.some((x) => x.kind === 'summary')) {
    const pct = i.goal ? Math.round((i.total / i.goal) * 100) : 0
    const met = i.total >= i.goal
    const tip = !met && i.weakestHour != null ? ` Yarın ${fmtHm(i.weakestHour * 60)} civarına dikkat: en çok unuttuğun saatler.` : ''
    return {
      send: true, kind: 'summary', amount: 0, tag: 'water-summary',
      title: met ? 'Bugünkü su hedefi tamam' : 'Günün su özeti',
      body: met ? `${i.total.toLocaleString('tr-TR')} ml içtin, hedefin %${pct}'i. Harika gidiyorsun.`
        : `Bugün ${i.total.toLocaleString('tr-TR')} ml içtin, hedefin %${pct}'i.${tip}`,
    }
  }

  if (now < w + 30 || now > s - 60) return { send: false, reason: 'uyanık pencere dışında' }
  if (inQuiet(i.now, i.quiet)) return { send: false, reason: 'sessiz saat' }
  if (i.total >= i.goal) return { send: false, reason: 'hedef tamam' }
  const reminds = i.sentToday.filter((x) => x.kind === 'remind')
  if (reminds.length >= i.maxPerDay) return { send: false, reason: 'günlük tavan' }
  if (lastSent && now - lastSent.at < MIN_SPACING) return { send: false, reason: 'son bildirim çok yakın' }
  if (ignoredStreak(i.sentToday) >= IGNORE_STREAK && lastSent && now - lastSent.at < IGNORE_SILENCE) {
    return { send: false, reason: 'art arda yok sayıldı, sessizlik' }
  }

  const ideal = idealAt(i.goal, i.wake, i.sleep, i.now)
  const deficit = ideal - i.total
  if (deficit < -0.1 * i.goal) return { send: false, reason: 'idealin önünde' }

  let interval = deficit > 0.25 * i.goal ? 60 : deficit > 0 ? 90 : 150
  const hour = Math.floor((((i.now % 1440) + 1440) % 1440) / 60)
  const habit = i.habit[hour] ?? 0
  if (habit < 60 && deficit > 0) interval *= 0.75 // genelde unuttuğu saat → daha erken
  else if (habit >= 200) interval *= 1.2 // genelde zaten içtiği saat → bekle
  const hs = i.hourStats[hour]
  if (hs && hs.sent >= 4 && hs.acted / hs.sent < 0.15) interval *= 1.5 // sürekli yok sayılan saat → azalt

  const since = now - (i.lastDrink ?? w)
  if (since < interval) return { send: false, reason: `son içmeden bu yana ${since} dk < ${Math.round(interval)} dk` }

  // Kalanı tek seferde içmeye zorlamadan ölçülü öneri
  const amount = Math.max(150, Math.min(MAX_SUGGEST, round50(deficit > 0 ? deficit : 200)))
  const t = TEMPLATES[reminds.length % TEMPLATES.length](amount)
  return { send: true, kind: 'remind', amount, tag: 'water-remind', ...t }
}
