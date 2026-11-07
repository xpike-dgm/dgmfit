// Özelleştirme Ö1b-2: alt bar düzeni, eğer–ise kuralları, hedefe göre varsayılan, kullanım tercihleri. Saf; testleri tests/cards-prefs.test.ts.
// Hepsi tasarım verisinde (Design.nav / .rules / .prefs) durur: kişisel veri yok, şablonla paylaşılabilir.
import { SCREENS, cardDef, type ScreenId } from './registry.ts'
import type { LayoutItem } from './layout.ts'

// ───────── alt bar ─────────
export type NavTab = 'today' | 'plan' | 'water' | 'food' | 'fitness' | 'social'
export const NAV_TABS: { id: NavTab; label: string; href: string }[] = [
  { id: 'today', label: 'Bugün', href: '/' },
  { id: 'plan', label: 'Fit', href: '/fit' },
  { id: 'water', label: 'Su', href: '/su' },
  { id: 'food', label: 'Yemek', href: '/yemek' },
  { id: 'fitness', label: 'Fitness', href: '/fitness' },
  { id: 'social', label: 'Sosyal', href: '/sosyal' },
]
export interface NavLayout { order?: NavTab[]; hidden?: NavTab[] }
/** Bugün gizlenemez (ana sayfa); en az bu kadar sekme görünür kalır. */
export const NAV_MIN_VISIBLE = 3

/** Alt bar: sıralı görünen sekmeler. Bilinmeyen/tekrarlanan atılır, eksikler sona eklenir, kurallar uygulanır. */
export function resolveNav(nav: NavLayout | null | undefined): { visible: NavTab[]; hidden: NavTab[] } {
  const all = NAV_TABS.map((t) => t.id)
  const order: NavTab[] = []
  for (const id of nav?.order ?? []) if (all.includes(id) && !order.includes(id)) order.push(id)
  for (const id of all) if (!order.includes(id)) order.push(id)
  let hidden = order.filter((id) => (nav?.hidden ?? []).includes(id) && id !== 'today')
  while (order.length - hidden.length < NAV_MIN_VISIBLE) hidden = hidden.slice(0, -1)
  return { visible: order.filter((id) => !hidden.includes(id)), hidden }
}
export function normalizeNav(nav: NavLayout): NavLayout {
  const r = resolveNav(nav)
  return { order: [...r.visible, ...r.hidden], hidden: r.hidden }
}

// ───────── kurallar ─────────
export type Cond =
  | { kind: 'time'; from: number; to: number } // dakika (0–1439); from > to ise gece yarısını aşar
  | { kind: 'weekday'; days: number[] } // 0 = Pazar
  | { kind: 'training' } // bugün planlı antrenman günü ya da bugün antrenman kaydı var
  | { kind: 'rest' } // antrenman günü değil
  | { kind: 'goal'; goal: 'lose' | 'gain' | 'recomp' }
export type Action = { kind: 'top' | 'hide' | 'show'; card: string }
export interface Rule { id: string; name: string; on: boolean; when: Cond[]; then: Action[] }
export interface RuleCtx { minute: number; weekday: number; training: boolean; goal?: 'lose' | 'gain' | 'recomp' | null }
export const RULES_MAX = 20

export function condMatches(c: Cond, x: RuleCtx): boolean {
  switch (c.kind) {
    case 'time': return c.from <= c.to ? x.minute >= c.from && x.minute < c.to : x.minute >= c.from || x.minute < c.to
    case 'weekday': return c.days.includes(x.weekday)
    case 'training': return x.training
    case 'rest': return !x.training
    case 'goal': return x.goal === c.goal
  }
}
export const ruleMatches = (r: Rule, x: RuleCtx) => r.on && r.when.length > 0 && r.when.every((c) => condMatches(c, x))

/**
 * Kuralları ekran düzenine uygular (yalnız görüntüleme; kayıtlı düzen değişmez). Sıra: listede önce gelen kural önce
 * uygulanır; aynı kart için sonraki kural öncekini ezer. 'top' kartı sabit başlığın hemen altına alır (birden çok 'top'
 * olursa kural sırası korunur), 'hide' gizler, 'show' çekmecedeki kartı da gösterir. Kilitli kartlar gizlenemez.
 */
export function applyRules<T extends LayoutItem>(screen: ScreenId, items: T[], rules: Rule[] | undefined, x: RuleCtx, make: (id: string) => T | null): { items: T[]; applied: string[] } {
  const applied: string[] = []
  const state = new Map<string, Action['kind']>()
  const tops: string[] = []
  for (const r of rules ?? []) {
    if (!ruleMatches(r, x)) continue
    let hit = false
    for (const a of r.then) {
      const def = cardDef(a.card)
      if (!def || def.screen !== screen) continue
      if (a.kind === 'hide' && def.locked) continue
      if (a.kind === 'top' && def.locked === 'top') continue
      state.set(a.card, a.kind); hit = true
      if (a.kind === 'top') { const i = tops.indexOf(a.card); if (i >= 0) tops.splice(i, 1); tops.push(a.card) }
    }
    if (hit) applied.push(r.name)
  }
  if (!state.size) return { items, applied }
  let out = items.filter((i) => state.get(i.id) !== 'hide')
  for (const [id, k] of state) if ((k === 'show' || k === 'top') && !out.some((i) => i.id === id)) { const it = make(id); if (it) out.push(it) }
  const topIds = tops.filter((id) => state.get(id) === 'top')
  if (topIds.length) {
    const head = out.filter((i) => cardDef(i.id)?.locked === 'top')
    const lifted = topIds.map((id) => out.find((i) => i.id === id)).filter(Boolean) as T[]
    out = [...head, ...lifted, ...out.filter((i) => !head.includes(i) && !lifted.includes(i))]
  }
  return { items: out, applied }
}

/** Kural verisini doğrular: bilinmeyen kart, boş koşul/eylem, aralık dışı saat atılır. */
export function normalizeRules(rules: Rule[]): Rule[] {
  const out: Rule[] = []
  for (const r of rules.slice(0, RULES_MAX)) {
    const when = r.when.filter((c) => c.kind !== 'time' || (inMin(c.from) && inMin(c.to) && c.from !== c.to))
      .filter((c) => c.kind !== 'weekday' || c.days.length > 0)
      .map((c) => (c.kind === 'weekday' ? { ...c, days: [...new Set(c.days.filter((d) => d >= 0 && d <= 6))].sort() } : c))
    const then = r.then.filter((a) => { const d = cardDef(a.card); return !!d && !(a.kind === 'hide' && d.locked) })
    if (!when.length || !then.length) continue
    out.push({ id: r.id.slice(0, 40), name: (r.name.trim() || 'Kuralım').slice(0, 40), on: !!r.on, when, then: then.slice(0, 6) })
  }
  return out
}
const inMin = (m: number) => Number.isInteger(m) && m >= 0 && m < 1440

/** Hazır kurallar (stüdyoda tek dokunuşla açılır; kullanıcı düzenleyebilir). */
export const PRESET_RULES: Rule[] = [
  { id: 'preset-morning', name: 'Sabah düzeni', on: true, when: [{ kind: 'time', from: 5 * 60, to: 11 * 60 }], then: [{ kind: 'top', card: 'today.water' }] },
  { id: 'preset-training', name: 'Antrenman günü', on: true, when: [{ kind: 'training' }], then: [{ kind: 'top', card: 'today.training' }, { kind: 'top', card: 'fitness.next' }] },
  { id: 'preset-evening', name: 'Akşam düzeni', on: true, when: [{ kind: 'time', from: 18 * 60, to: 24 * 60 - 1 }], then: [{ kind: 'top', card: 'today.macros' }, { kind: 'top', card: 'food.add' }] },
  { id: 'preset-rest', name: 'Dinlenme günü', on: true, when: [{ kind: 'rest' }], then: [{ kind: 'hide', card: 'fitness.next' }] },
]

/** Kuralın Türkçe özeti ("Saat 05.00–11.00 arası → Su kartı üstte"). */
export function describeRule(r: Rule): string {
  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`
  const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
  const GOAL = { lose: 'kilo verme', gain: 'kilo alma', recomp: 'koruyup kas kazanma' }
  const w = r.when.map((c) => c.kind === 'time' ? `saat ${hm(c.from)}–${hm(c.to)}` : c.kind === 'weekday' ? c.days.map((d) => DAYS[d]).join(', ')
    : c.kind === 'training' ? 'antrenman günü' : c.kind === 'rest' ? 'dinlenme günü' : `hedef ${GOAL[c.goal]}`).join(' ve ')
  const VERB = { top: 'üstte', hide: 'gizli', show: 'görünür' }
  const t = r.then.map((a) => { const d = cardDef(a.card); return d ? `${SCREENS[d.screen].title} · ${d.title} ${VERB[a.kind]}` : '' }).filter(Boolean).join('; ')
  return `${w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1)} → ${t}`
}

// ───────── hedefe göre varsayılan ─────────
/** Özelleştirmemiş kullanıcının varsayılan düzeninde hedefe göre öne alınan kartlar (sabit başlığın altına, bu sırayla). */
export const GOAL_FRONT: Record<'lose' | 'gain' | 'recomp', Partial<Record<ScreenId, string[]>>> = {
  lose: { today: ['today.macros'], fit: ['fit.trend'] },
  gain: { today: ['today.training', 'today.macros'], fitness: ['fitness.next'] },
  recomp: { today: ['today.training'], fitness: ['fitness.next'] },
}
export function goalFront<T extends LayoutItem>(screen: ScreenId, items: T[], goal: 'lose' | 'gain' | 'recomp' | null | undefined): T[] {
  const front = (goal && GOAL_FRONT[goal]?.[screen]) || []
  if (!front.length) return items
  const head = items.filter((i) => cardDef(i.id)?.locked === 'top')
  const lifted = front.map((id) => items.find((i) => i.id === id)).filter(Boolean) as T[]
  return [...head, ...lifted, ...items.filter((i) => !head.includes(i) && !lifted.includes(i))]
}

// ───────── kullanım tercihleri ─────────
export interface UsePrefs { hand?: 'left' | 'right' | null; holdToEdit?: boolean }
export const normalizePrefs = (p: UsePrefs): UsePrefs => ({ hand: p.hand === 'left' || p.hand === 'right' ? p.hand : null, holdToEdit: p.holdToEdit !== false })
