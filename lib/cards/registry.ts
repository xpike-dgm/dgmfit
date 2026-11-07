// Özelleştirme: kart kaydı (saf veri). Her kart sabit bir kimlikle burada tanımlanır; kullanıcının tasarımı yalnızca
// kimlikleri ve ayarları saklar. Yeni kart = buraya tanım + ekranda çizici. Kart kaldırma/değiştirme = REGISTRY_VERSION
// artırılır ve CARD_MIGRATIONS'a eşleme yazılır (tests/cards.test.ts eksik eşlemeyi yakalar).
import type { ModuleId } from '../theme.ts'

/** Özelleştirilebilir ekranlar. Yeni ekran eklemek için buraya ve SCREENS'e ekle. */
export type ScreenId = 'today'
export type CardSize = 'half' | 'full'

export interface CardDef {
  id: string
  screen: ScreenId
  /** renk modülü (kart çerçevesi bu modülün vurgusunu alır) */
  module: ModuleId
  title: string
  /** çekmecede görünen kısa açıklama */
  desc: string
  /** desteklenen boyutlar; ilki varsayılan değildir, `size` varsayılandır */
  sizes: CardSize[]
  size: CardSize
  /** varsayılan düzende var mı (yoksa yalnızca çekmecede) */
  default: boolean
  /**
   * kilit: 'top' = ekranın en üstünde sabit, taşınmaz/kaldırılamaz; 'keep' = taşınabilir ama kaldırılamaz
   * (güvenlik ve hedef seçimi gibi kullanıcının kaçırmaması gereken kartlar)
   */
  locked?: 'top' | 'keep'
  /** yalnızca belirli durumlarda içerik gösterir (ör. hedefe ulaşınca); düzenlemede yer tutucuyla görünür */
  conditional?: string
  /** kartın eklendiği kayıt sürümü (çekmecede "Yeni" etiketi için) */
  since: number
  /** ileride renk düzenleyicinin sunacağı alanlar (Ö2) */
  colorSlots?: string[]
}

export const REGISTRY_VERSION = 1

export const SCREENS: Record<ScreenId, { title: string; path: string }> = {
  today: { title: 'Bugün', path: '/' },
}

const COLORS = ['bg', 'title', 'text', 'accent']

export const CARDS: CardDef[] = [
  { id: 'today.header', screen: 'today', module: 'today', title: 'Kalori ve hafta', desc: 'Selam, kalan kalori halkası ve hafta halkaları', sizes: ['full'], size: 'full', default: true, locked: 'top', since: 1, colorSlots: COLORS },
  { id: 'today.macros', screen: 'today', module: 'today', title: 'Makrolar', desc: 'Protein, karbonhidrat, yağ ve günün dengelemesi', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'today.goal-choice', screen: 'today', module: 'plan', title: 'Hedef seçimi', desc: 'Hedefe ulaşınca ya da süre dolunca ne yapacağını sorar', sizes: ['full'], size: 'full', default: true, locked: 'keep', conditional: 'Hedefe ulaşınca ya da hedef tarih geçince görünür', since: 1 },
  { id: 'today.week-brief', screen: 'today', module: 'coach', title: 'Geçen hafta', desc: 'Pazartesi–salı: geçen haftanın 4 sayısı ve bir öneri', sizes: ['full'], size: 'full', default: true, conditional: 'Pazartesi ve salı görünür', since: 1, colorSlots: COLORS },
  { id: 'today.partner', screen: 'today', module: 'social', title: 'Antrenman partneri', desc: 'Partnerin bugün antrenman yaptıysa haber verir', sizes: ['full'], size: 'full', default: true, conditional: 'Partnerin antrenman yapınca görünür', since: 1, colorSlots: COLORS },
  { id: 'today.post-protein', screen: 'today', module: 'food', title: 'Antrenman sonrası protein', desc: 'Antrenmandan sonra protein önerisi', sizes: ['full'], size: 'full', default: true, conditional: 'Antrenmandan sonraki saatlerde görünür', since: 1, colorSlots: COLORS },
  { id: 'today.fit', screen: 'today', module: 'plan', title: 'Fit', desc: 'Trend kilo, hedefe ilerleme', sizes: ['half', 'full'], size: 'half', default: true, since: 1, colorSlots: COLORS },
  { id: 'today.water', screen: 'today', module: 'water', title: 'Su', desc: 'Bugünkü su ve tek dokunuşla ekleme', sizes: ['half', 'full'], size: 'half', default: true, since: 1, colorSlots: COLORS },
  { id: 'today.training', screen: 'today', module: 'fitness', title: 'Antrenman', desc: 'Sıradaki antrenman ya da bugün yapılan', sizes: ['half', 'full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'today.coach', screen: 'today', module: 'coach', title: 'Koç', desc: 'Günün içgörüsü ve koça soru', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'today.streaks', screen: 'today', module: 'today', title: 'Seriler', desc: 'Yemek kaydı, su ve antrenman serilerin', sizes: ['half', 'full'], size: 'full', default: false, since: 1, colorSlots: COLORS },
]

/**
 * Kayıt değişiklikleri: sürüm N'e geçerken eski kimlik → yeni kimlik(ler). [] = kart kaldırıldı.
 * Örnek (ileride): { version: 2, map: { 'today.water': ['today.water-v2'] }, note: { 'today.water': 'Su kartı yenilendi' } }
 */
export const CARD_MIGRATIONS: { version: number; map: Record<string, string[]>; note?: Record<string, string> }[] = []

const byId = new Map(CARDS.map((c) => [c.id, c]))
export function cardDef(id: string): CardDef | undefined { return byId.get(id) }
export function cardsFor(screen: ScreenId): CardDef[] { return CARDS.filter((c) => c.screen === screen) }
export function isScreen(s: string): s is ScreenId { return s in SCREENS }
