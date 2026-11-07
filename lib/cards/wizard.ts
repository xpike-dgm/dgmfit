// Özelleştirme Ö1b-3: düzen sihirbazı. 5 cevap → Bugün düzeni, alt bar, tek el, hazır kurallar. Saf; testleri tests/cards-wizard.test.ts.
import { cardDef, cardsFor } from './registry.ts'
import type { LayoutItem } from './layout.ts'
import { PRESET_RULES, type NavTab, type Rule } from './prefs.ts'

export interface WizardAnswers {
  focus: 'weight' | 'strength' | 'health'
  /** en sık kaydettiklerin (sırayla önem) */
  logs: ('food' | 'water' | 'training')[]
  detail: 'simple' | 'detailed'
  hand: 'right' | 'left' | 'both'
  time: 'morning' | 'evening' | 'all'
}
export interface WizardResult {
  today: LayoutItem[]
  nav: { order: NavTab[]; hidden: NavTab[] }
  hand: 'left' | 'right' | null
  rules: Rule[]
  summary: string[]
}

export const WIZARD_QUESTIONS = [
  { key: 'focus', q: 'Seni en çok ne ilgilendiriyor?', options: [['weight', 'Kilom ve kalori'], ['strength', 'Kuvvet ve kas'], ['health', 'Genel sağlık, su, düzen']] },
  { key: 'logs', q: 'En sık neyi kaydediyorsun?', multi: true, options: [['food', 'Yemek'], ['water', 'Su'], ['training', 'Antrenman']] },
  { key: 'detail', q: 'Ne kadar ayrıntı görmek istersin?', options: [['simple', 'Sade, az kart'], ['detailed', 'Ayrıntılı, hepsi görünsün']] },
  { key: 'hand', q: 'Telefonu çoğunlukla hangi elinle kullanıyorsun?', options: [['right', 'Sağ'], ['left', 'Sol'], ['both', 'İki elle']] },
  { key: 'time', q: 'Uygulamayı en çok ne zaman açıyorsun?', options: [['morning', 'Sabah'], ['evening', 'Akşam'], ['all', 'Gün boyu']] },
] as const

const LOG_CARD = { food: 'today.macros', water: 'today.water', training: 'today.training' } as const
const LOG_TAB: Record<WizardAnswers['logs'][number], NavTab> = { food: 'food', water: 'water', training: 'fitness' }
const FOCUS_FRONT: Record<WizardAnswers['focus'], string[]> = {
  weight: ['today.macros', 'today.fit'],
  strength: ['today.training', 'today.macros'],
  health: ['today.water', 'today.macros'],
}
const SIMPLE_DROP = ['today.week-brief', 'today.partner', 'today.streaks']

export function wizardDesign(a: WizardAnswers): WizardResult {
  const all = cardsFor('today')
  // varsayılan kartlar (+ ayrıntılıda Seriler), sonra odak ve kayıt sırasına göre öne alınanlar
  let ids = all.filter((c) => c.default || (a.detail === 'detailed' && c.id === 'today.streaks')).map((c) => c.id)
  if (a.detail === 'simple') ids = ids.filter((id) => !SIMPLE_DROP.includes(id))
  const front = [...new Set([...FOCUS_FRONT[a.focus], ...a.logs.map((l) => LOG_CARD[l])])].filter((id) => ids.includes(id))
  const head = ids.filter((id) => cardDef(id)?.locked === 'top')
  ids = [...head, ...front, ...ids.filter((id) => !head.includes(id) && !front.includes(id))]
  // Fit ve Su yarım boyutta yan yana kalsın: hangisi önce geliyorsa yerinde kalır, diğeri hemen arkasına gelir
  if (ids.includes('today.fit') && ids.includes('today.water')) {
    const [first, second] = ids.indexOf('today.fit') < ids.indexOf('today.water') ? ['today.fit', 'today.water'] : ['today.water', 'today.fit']
    ids = ids.filter((id) => id !== second); ids.splice(ids.indexOf(first) + 1, 0, second)
  }
  const today = ids.map((id) => ({ id }))

  const tabs: NavTab[] = ['today', ...a.logs.map((l) => LOG_TAB[l])]
  if (a.focus === 'weight') tabs.push('plan')
  if (a.focus === 'strength') tabs.push('fitness')
  const order = [...new Set([...tabs, 'plan', 'water', 'food', 'fitness', 'social'] as NavTab[])]
  const nav = { order, hidden: [] as NavTab[] }

  const rules: Rule[] = []
  if (a.time === 'morning') rules.push(PRESET_RULES.find((r) => r.id === 'preset-morning')!)
  if (a.time === 'evening') rules.push(PRESET_RULES.find((r) => r.id === 'preset-evening')!)
  if (a.focus === 'strength' || a.logs.includes('training')) rules.push(PRESET_RULES.find((r) => r.id === 'preset-training')!)

  const hand = a.hand === 'both' ? null : a.hand
  const summary = [
    `Bugün ekranı: ${front.map((id) => cardDef(id)!.title).join(', ') || 'varsayılan sıra'} üstte${a.detail === 'simple' ? '; az kullanılan kartlar çekmecede' : '; Seriler kartı eklendi'}`,
    `Alt bar: ${order.slice(0, 4).map((t) => ({ today: 'Bugün', plan: 'Fit', water: 'Su', food: 'Yemek', fitness: 'Fitness', social: 'Sosyal', mine: 'Panom' })[t]).join(', ')}…`,
    hand ? `Tek el modu: ${hand === 'left' ? 'sol' : 'sağ'} el` : 'Tek el modu kapalı',
    rules.length ? `Kurallar: ${rules.map((r) => r.name).join(', ')}` : 'Kural eklenmedi',
  ]
  return { today, nav, hand, rules, summary }
}

/** Sihirbazın kurallarını mevcut kurallara ekler (aynı kimlikli kural varsa açılır, tekrar eklenmez). */
export function mergeRules(cur: Rule[], add: Rule[]): Rule[] {
  const out = cur.map((r) => (add.some((a) => a.id === r.id) ? { ...r, on: true } : r))
  for (const r of add) if (!out.some((x) => x.id === r.id)) out.push(r)
  return out
}
