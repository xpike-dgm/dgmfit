// Özelleştirme Ö5b: odak modları (Antrenman / Diyet / Tatil / Hastalık) ve Ramazan modu — saf kurallar
// (testleri tests/modes.test.ts). Mod; düzeni (öne alınan / gizlenen kartlar), bildirimleri ve hedef gösterimini birlikte değiştirir.
import type { ScreenId } from './cards/registry.ts'
import type { MealId } from './food.ts'

export type FocusMode = 'training' | 'diet' | 'vacation' | 'sick'
export interface ModeDef {
  id: FocusMode; label: string; emoji: string; desc: string
  /** ekran başına öne alınan kartlar (başlığın hemen altına, bu sırayla) */
  front: Partial<Record<ScreenId, string[]>>
  /** ekran başına gizlenen kartlar */
  hide: Partial<Record<ScreenId, string[]>>
  /** su ve öğün hatırlatmaları susar */
  quiet: boolean
  /** fazla/eksik kalori sonraki günlere dağıtılmaz (gün kapanışı 'paused') */
  pauseBalance: boolean
  /** Bugün'de mod kartının kısa notu (hedef gösterimi) */
  note: string
}

export const MODES: ModeDef[] = [
  { id: 'training', label: 'Antrenman', emoji: '🏋️', desc: 'Antrenman, protein ve toparlanma öne çıkar.',
    front: { today: ['today.training', 'today.post-protein', 'today.macros'], fitness: ['fitness.next', 'fitness.recovery'] }, hide: {},
    quiet: false, pauseBalance: false, note: 'Odak antrenman: protein hedefini ve toparlanmanı takip et.' },
  { id: 'diet', label: 'Diyet', emoji: '🥗', desc: 'Kalori, makrolar ve öğünler öne çıkar.',
    front: { today: ['today.macros', 'today.fit', 'today.water'] }, hide: { today: ['today.week-brief'] },
    quiet: false, pauseBalance: false, note: 'Odak beslenme: kalan kalori ve protein en üstte.' },
  { id: 'vacation', label: 'Tatil', emoji: '🏖️', desc: 'Dengeleme durur, hatırlatmalar susar. Kayıt tutmak serbest.',
    front: { today: ['today.water'] }, hide: { today: ['today.fit', 'today.week-brief', 'today.goal-choice'] },
    quiet: true, pauseBalance: true, note: 'Tatildesin: dengeleme duraklatıldı, hatırlatmalar sessiz. Keyfini çıkar.' },
  { id: 'sick', label: 'Hastalık', emoji: '🤒', desc: 'Antrenman önerisi kalkar, dengeleme durur, hatırlatmalar susar.',
    front: { today: ['today.water'] }, hide: { today: ['today.training', 'today.fit', 'today.week-brief', 'today.goal-choice', 'today.post-protein'], fitness: ['fitness.next'] },
    quiet: true, pauseBalance: true, note: 'Geçmiş olsun. Dinlen, bol sıvı al; antrenman ve dengeleme bekliyor.' },
]
export const modeDef = (id: string | null | undefined) => MODES.find((m) => m.id === id) ?? null

export interface ModeState {
  focus: FocusMode | null; focusFrom: string | null; focusUntil: string | null
  ramadan: boolean; sahur: string; iftar: string; ramadanUntil: string | null
}
export const DEFAULT_MODES: ModeState = { focus: null, focusFrom: null, focusUntil: null, ramadan: false, sahur: '04:45', iftar: '18:30', ramadanUntil: null }

const HM = /^([01]\d|2[0-3]):[0-5]\d$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
export function normalizeModes(x: Partial<ModeState> | null | undefined): ModeState {
  const o = x ?? {}
  const focus = modeDef(o.focus)?.id ?? null
  return {
    focus,
    focusFrom: focus && typeof o.focusFrom === 'string' && DAY.test(o.focusFrom) ? o.focusFrom : null,
    focusUntil: focus && typeof o.focusUntil === 'string' && DAY.test(o.focusUntil) ? o.focusUntil : null,
    ramadan: !!o.ramadan,
    sahur: typeof o.sahur === 'string' && HM.test(o.sahur) ? o.sahur : DEFAULT_MODES.sahur,
    iftar: typeof o.iftar === 'string' && HM.test(o.iftar) ? o.iftar : DEFAULT_MODES.iftar,
    ramadanUntil: o.ramadan && typeof o.ramadanUntil === 'string' && DAY.test(o.ramadanUntil) ? o.ramadanUntil : null,
  }
}

/** O gün geçerli odak modu (başlangıç–bitiş arası; bitiş dahil). */
export function focusOn(s: ModeState, day: string): ModeDef | null {
  if (!s.focus) return null
  if (s.focusFrom && day < s.focusFrom) return null
  if (s.focusUntil && day > s.focusUntil) return null
  return modeDef(s.focus)
}
export const ramadanOn = (s: ModeState, day: string) => s.ramadan && (!s.ramadanUntil || day <= s.ramadanUntil)

export const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
/** Oruç saati mi (sahur–iftar arası). */
export function fasting(nowMin: number, sahur: string, iftar: string) {
  const a = hm(sahur), b = hm(iftar)
  return a < b ? nowMin >= a && nowMin < b : nowMin >= a || nowMin < b
}
/** Ramazan su penceresi: iftardan sahura (su hatırlatma motorunda uyanık pencere yerine geçer). */
export function ramadanWaterWindow(sahur: string, iftar: string) { return { wake: hm(iftar), sleep: hm(sahur) } }

/** Ramazan'da öğün adları (kayıt kimlikleri değişmez). */
export const RAMADAN_LABEL: Record<MealId, string> = { breakfast: 'Sahur', lunch: 'Öğle (oruçsuz gün)', dinner: 'İftar', snack: 'İftar sonrası ara öğün' }
export function mealLabel(meal: MealId, base: string, ramadan: boolean) { return ramadan ? RAMADAN_LABEL[meal] : base }
/** Ramazan'da saate göre önerilen öğün: iftardan gece yarısına kadar ilk 90 dk iftar, sonra ara öğün; gece yarısından sahura sahur. */
export function ramadanMealFor(nowMin: number, sahur: string, iftar: string): MealId {
  const s = hm(sahur), i = hm(iftar)
  if (nowMin >= i && nowMin < i + 90) return 'dinner'
  if (nowMin >= i + 90) return 'snack'
  if (nowMin < s + 30) return 'breakfast'
  return 'dinner'
}
/** Oruçlu saatte iftara / oruçsuz saatte sahura kalan dakika. */
export function untilNext(nowMin: number, sahur: string, iftar: string): { to: 'iftar' | 'sahur'; min: number } {
  const target = fasting(nowMin, sahur, iftar) ? hm(iftar) : hm(sahur)
  return { to: fasting(nowMin, sahur, iftar) ? 'iftar' : 'sahur', min: (target - nowMin + 1440) % 1440 }
}
/** İftar sonrası protein kartı: iftardan sonraki 4 saatte ve protein hedefi tamamlanmadıysa. */
export function postIftarProtein(nowMin: number, iftar: string, eatenProtein: number, targetProtein: number): number | null {
  const since = (nowMin - hm(iftar) + 1440) % 1440
  if (since > 240) return null
  const left = Math.round(targetProtein - eatenProtein)
  return left > 5 ? left : null
}

/** Hatırlatma susturulsun mu: odak modu sessizse her zaman; Ramazan'da öğün hatırlatması oruç saatinde. */
export function remindersQuiet(s: ModeState, day: string, nowMin: number, kind: 'water' | 'meal'): boolean {
  if (focusOn(s, day)?.quiet) return true
  if (kind === 'meal' && ramadanOn(s, day) && fasting(nowMin, s.sahur, s.iftar)) return true
  return false
}

/** Düzene mod uygular: gizlenenler çıkar, öne alınanlar sabit başlığın altına bu sırayla gelir (ekranda yoksa eklenir). */
export function applyMode<T extends { id: string }>(screen: ScreenId, items: T[], m: ModeDef | null, make: (id: string) => T | null, isTop: (id: string) => boolean): T[] {
  if (!m) return items
  const hide = new Set(m.hide[screen] ?? [])
  const front = (m.front[screen] ?? []).filter((id) => !hide.has(id))
  const rest = items.filter((i) => !hide.has(i.id))
  const head = rest.filter((i) => isTop(i.id))
  const pulled: T[] = []
  for (const id of front) { const have = rest.find((i) => i.id === id); const it = have ?? make(id); if (it && !isTop(id)) pulled.push(it) }
  const ids = new Set(pulled.map((p) => p.id))
  return [...head, ...pulled, ...rest.filter((i) => !isTop(i.id) && !ids.has(i.id))]
}
