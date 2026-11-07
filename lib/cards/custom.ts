// Özelleştirme Ö5a: kendi kartlarım (kart oluşturucu), kendi takip alanlarım, motivasyon kartları — saf kurallar
// (testleri tests/cards-custom.test.ts). Kullanıcı kartı kimliği `u.<ekran>.<kısa kimlik>`; tanımı Design.userCards'ta (kişisel).
import type { ScreenId } from './registry.ts'

export const USER_CARD_RE = /^u\.(today|fit|water|food|fitness|mine)\.[a-z0-9]{6,12}$/
export const isUserCard = (id: string) => USER_CARD_RE.test(id)
export const userCardScreen = (id: string): ScreenId | null => (USER_CARD_RE.exec(id)?.[1] as ScreenId) ?? null
export const newUserCardId = (screen: ScreenId, rand: string) => `u.${screen}.${rand.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10).padEnd(6, '0')}`
export const USER_CARDS_MAX = 24

export type Metric = 'water' | 'kcal' | 'protein' | 'weight' | 'workouts'
export const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'water', label: 'Su', unit: 'ml' }, { id: 'kcal', label: 'Kalori', unit: 'kcal' }, { id: 'protein', label: 'Protein', unit: 'g' },
  { id: 'weight', label: 'Kilo (trend)', unit: 'kg' }, { id: 'workouts', label: 'Antrenman', unit: 'antrenman' },
]
export type Period = 'today' | '7d' | '30d'
export const PERIODS: { id: Period; label: string; days: number }[] = [{ id: 'today', label: 'Bugün', days: 1 }, { id: '7d', label: 'Son 7 gün', days: 7 }, { id: '30d', label: 'Son 30 gün', days: 30 }]
export type View = 'number' | 'bar' | 'spark'

export type UserCard =
  | { kind: 'metric'; screen: ScreenId; title: string; metric: Metric; period: Period; view: View; goal?: number | null }
  | { kind: 'tracker'; screen: ScreenId; title: string; trackerId: string; period: Period; view: View }
  | { kind: 'quote'; screen: ScreenId; title: string; text: string }
  | { kind: 'countdown'; screen: ScreenId; title: string; date: string }
  | { kind: 'photo'; screen: ScreenId; title: string; mediaId: string }
  | { kind: 'records'; screen: ScreenId; title: string }

const SCREENS_OK = ['today', 'fit', 'water', 'food', 'fitness', 'mine']
const clean = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '')
/** Kullanıcı kartı tanımını doğrular; geçersizse null. */
export function normalizeUserCard(x: unknown): UserCard | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const screen = SCREENS_OK.includes(o.screen as string) ? (o.screen as ScreenId) : null
  const title = clean(o.title, 30)
  if (!screen || !title) return null
  const period = (['today', '7d', '30d'].includes(o.period as string) ? o.period : 'today') as Period
  const view = (['number', 'bar', 'spark'].includes(o.view as string) ? o.view : 'number') as View
  switch (o.kind) {
    case 'metric': {
      if (!METRICS.some((m) => m.id === o.metric)) return null
      const goal = typeof o.goal === 'number' && o.goal > 0 && o.goal < 1e6 ? o.goal : null
      return { kind: 'metric', screen, title, metric: o.metric as Metric, period, view, goal }
    }
    case 'tracker': return typeof o.trackerId === 'string' && /^[0-9a-f-]{36}$/.test(o.trackerId) ? { kind: 'tracker', screen, title, trackerId: o.trackerId, period, view } : null
    case 'quote': { const text = clean(o.text, 160); return text ? { kind: 'quote', screen, title, text } : null }
    case 'countdown': return typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? { kind: 'countdown', screen, title, date: o.date } : null
    case 'photo': return typeof o.mediaId === 'string' && /^[0-9a-f-]{36}$/.test(o.mediaId) ? { kind: 'photo', screen, title, mediaId: o.mediaId } : null
    case 'records': return { kind: 'records', screen, title }
    default: return null
  }
}

// ───────── kendi takip alanlarım ─────────
export type TrackerKind = 'count' | 'number' | 'scale' | 'yesno'
export const TRACKER_KINDS: { id: TrackerKind; label: string; hint: string }[] = [
  { id: 'count', label: 'Sayaç', hint: 'Fincan, sigara, adım gibi toplanan sayı' },
  { id: 'number', label: 'Ölçüm', hint: 'Uyku saati, nabız gibi günün değeri' },
  { id: 'scale', label: '1–5 puan', hint: 'Ruh hali, enerji, ağrı' },
  { id: 'yesno', label: 'Evet / hayır', hint: 'Vitamin aldım mı, esneme yaptım mı' },
]
export interface TrackerDef { name: string; unit: string; kind: TrackerKind; goal: number | null; goalDir: 'min' | 'max'; step: number; emoji: string }
export function normalizeTracker(x: Partial<TrackerDef>): TrackerDef | null {
  const name = clean(x.name, 24)
  if (name.length < 2) return null
  const kind = (TRACKER_KINDS.some((k) => k.id === x.kind) ? x.kind : 'count') as TrackerKind
  const step = kind === 'scale' || kind === 'yesno' ? 1 : typeof x.step === 'number' && x.step > 0 && x.step <= 1000 ? x.step : 1
  const goal = typeof x.goal === 'number' && x.goal > 0 && x.goal < 1e6 ? x.goal : null
  const emoji = typeof x.emoji === 'string' ? [...x.emoji.trim()].slice(0, 2).join('') : ''
  return { name, unit: kind === 'scale' ? '/5' : kind === 'yesno' ? '' : clean(x.unit, 10), kind, goal, goalDir: x.goalDir === 'max' ? 'max' : 'min', step, emoji }
}
/** Bir günün değeri: sayaçta toplam, ölçümde son değer, puanda ortalama, evet/hayırda kayıt varsa 1. */
export function dayValue(kind: TrackerKind, values: number[]): number | null {
  if (!values.length) return null
  if (kind === 'count') return values.reduce((a, v) => a + v, 0)
  if (kind === 'number') return values[values.length - 1]
  if (kind === 'scale') return Math.round((values.reduce((a, v) => a + v, 0) / values.length) * 10) / 10
  return values.some((v) => v > 0) ? 1 : 0
}
/** Dönem özeti: günlük seri (eski → yeni) ve dönem değeri (sayaç: günlük ortalama, diğerleri: kayıtlı günlerin ortalaması; tek gün → o gün). */
export function summarize(kind: TrackerKind, logs: { day: string; value: number }[], days: string[]) {
  const series = days.map((d) => dayValue(kind, logs.filter((l) => l.day === d).map((l) => l.value)))
  const have = series.filter((v): v is number => v !== null)
  const value = days.length === 1 ? series[0] : have.length ? Math.round((have.reduce((a, v) => a + v, 0) / (kind === 'count' ? days.length : have.length)) * 10) / 10 : null
  return { series, value, loggedDays: have.length }
}
/** Hedefe ilerleme (0–1): 'min' hedefinde değer/hedef, 'max' hedefinde (aşmamak) hedef aşılınca 1'in üstü. */
export const goalProgress = (value: number | null, goal: number | null) => (value === null || !goal ? null : Math.max(0, value / goal))

/** Geri sayım: hedef güne kalan gün (bugün 0; geçmişse negatif). */
export function daysUntil(date: string, today: string) { return Math.round((Date.parse(date + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86_400_000) }
