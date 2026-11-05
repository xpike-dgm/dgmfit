// Sosyal kuralları — saf, testli (tests/social.test.ts). Spesifikasyon 8: varsayılan her şey özel; izleyici ilişkisine göre görünürlük.

export type Visibility = 'public' | 'friends' | 'private'
export type ItemVis = 'none' | 'friends' | 'public'
export type Audience = 'public' | 'friends' | 'selected'
export type Relation = 'self' | 'friend' | 'follower' | 'none' | 'blocked'
export const ITEMS = ['prs', 'stats', 'workouts', 'meals', 'water', 'photos'] as const
export type Item = (typeof ITEMS)[number]
export const ITEM_LABEL: Record<Item, string> = { prs: 'PR vitrini', stats: 'İstatistik kartları', workouts: 'Antrenmanlar', meals: 'Öğünler', water: 'Su', photos: 'Fotoğraflar' }
export const DEFAULT_ITEMS: Record<Item, ItemVis> = { prs: 'none', stats: 'none', workouts: 'none', meals: 'none', water: 'none', photos: 'none' }

export const REACTIONS = { guc: '💪', ates: '🔥', alkis: '👏', kupa: '🏆' } as const
export type Reaction = keyof typeof REACTIONS

export const POST_KINDS = { text: 'Gönderi', workout: 'Antrenman', pr: 'Rekor', recipe: 'Tarif', program: 'Program', meal: 'Öğün', streak: 'Seri', milestone: 'Kilometre taşı', progress: 'İlerleme fotoğrafı' } as const
export type PostKind = keyof typeof POST_KINDS

export const GOAL_BADGE: Record<string, string> = { lose: 'Kilo veriyor', gain: 'Bulk', recomp: 'Rekompozisyon' }

/** Profil sayfası: temel bilgiler (ad, avatar, rozet) ve ayrıntılar (vitrin, gönderiler) kimlere açık. */
export function profileAccess(rel: Relation, vis: Visibility): { basic: boolean; detail: boolean; canRequest: boolean; canFollow: boolean } {
  if (rel === 'blocked') return { basic: false, detail: false, canRequest: false, canFollow: false }
  if (rel === 'self') return { basic: true, detail: true, canRequest: false, canFollow: false }
  if (rel === 'friend') return { basic: true, detail: true, canRequest: false, canFollow: false }
  if (vis === 'public') return { basic: true, detail: true, canRequest: true, canFollow: rel !== 'follower' }
  if (vis === 'friends') return { basic: true, detail: false, canRequest: true, canFollow: false }
  return { basic: false, detail: false, canRequest: false, canFollow: false } // gizli: aramada da görünmez
}

/** Öğe (PR vitrini, istatistik…) izleyiciye görünür mü. Gizli profilde yalnızca arkadaşlar; takipçi yalnızca "public" öğeyi görür. */
export function itemVisible(rel: Relation, vis: Visibility, item: ItemVis): boolean {
  if (rel === 'self') return true
  if (rel === 'blocked' || item === 'none') return false
  if (rel === 'friend') return true
  return item === 'public' && vis === 'public'
}

/** Gönderi izleyiciye görünür mü. Moderasyonda bekleyen/gizli gönderiyi yalnızca yazar görür. */
export function postVisible(rel: Relation, p: { audience: Audience; audienceIds: string[]; moderation: string }, viewerId: string, authorVis: Visibility): boolean {
  if (rel === 'self') return true
  if (rel === 'blocked' || p.moderation !== 'ok') return false
  if (p.audience === 'selected') return rel === 'friend' && p.audienceIds.includes(viewerId)
  if (p.audience === 'friends') return rel === 'friend'
  return rel === 'friend' || authorVis === 'public' // herkese açık gönderi: gizli/arkadaş profilinde yine yalnızca arkadaşlara
}

const KIND_BOOST: Record<string, number> = { pr: 3, milestone: 3, workout: 2, streak: 1.5, progress: 1, recipe: 1, meal: 0.5, text: 0.5 }

/**
 * Önerilen akış puanı: yenilik (12 saatlik yarı ömür) × (1 + yakın arkadaş + başarı türü + etkileşim).
 * Kronolojik görünüm bu puanı kullanmaz.
 */
export function feedScore(p: { createdAt: number; kind: string; close: boolean; reactions: number; comments: number; mine: boolean }, now: number): number {
  const ageH = Math.max(0, (now - p.createdAt) / 3_600_000)
  const decay = Math.pow(0.5, ageH / 12)
  const boost = 1 + (p.close ? 2 : 0) + (KIND_BOOST[p.kind] ?? 0) + Math.min(2, Math.log2(1 + p.reactions + 2 * p.comments) / 3) - (p.mine ? 0.5 : 0)
  return Math.round(decay * boost * 1000) / 1000
}

/**
 * Arkadaş önerisi puanı: ortak arkadaş × 3 + aynı salon 4 + aynı hedef 1. Zaten arkadaş, istek bekleyen, engelli ve gizli profiller çağıran tarafından elenir.
 */
export function suggestionScore(i: { mutual: number; sameGym: boolean; sameGoal: boolean }): number {
  return i.mutual * 3 + (i.sameGym ? 4 : 0) + (i.sameGoal ? 1 : 0)
}

/** Kilometre taşı metni: yalnızca değişim ("−6 kg"), mutlak kilo asla. */
export function milestoneText(startKg: number, nowKg: number, goal: string): string | null {
  const d = Math.round((nowKg - startKg) * 10) / 10
  if (Math.abs(d) < 1) return null
  const s = (d < 0 ? '−' : '+') + String(Math.abs(d)).replace('.', ',') + ' kg'
  return goal === 'gain' ? `${s} kas ve kilo yolculuğunda` : `${s} hedef yolculuğunda`
}

/** Antrenman günü serisi: art arda en az 1 antrenman yapılan en uzun hafta sayısı (haftada ≥1), gün listesinden. */
export function longestWeekStreak(days: string[]): number {
  const weeks = [...new Set(days.map((d) => { const t = Date.parse(d + 'T12:00:00Z'); const dow = (new Date(t).getUTCDay() + 6) % 7; return Math.round((t - dow * 86400000) / (7 * 86400000)) }))].sort((a, b) => a - b)
  let best = 0, cur = 0, prev: number | null = null
  for (const w of weeks) { cur = prev !== null && w === prev + 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = w }
  return best
}
