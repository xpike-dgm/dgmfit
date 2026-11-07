// Özelleştirme: kart kaydı (saf veri). Her kart sabit bir kimlikle burada tanımlanır; kullanıcının tasarımı yalnızca
// kimlikleri ve ayarları saklar. Yeni kart = buraya tanım + ekranda çizici. Kart kaldırma/değiştirme = REGISTRY_VERSION
// artırılır ve CARD_MIGRATIONS'a eşleme yazılır (tests/cards.test.ts eksik eşlemeyi yakalar).
import type { ModuleId } from '../theme.ts'

/** Özelleştirilebilir ekranlar. Yeni ekran eklemek için buraya ve SCREENS'e ekle. */
export type ScreenId = 'today' | 'fit' | 'water' | 'food' | 'fitness' | 'mine'
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
  /** yalnızca Gelişmiş modun varsayılan düzeninde; Sade modda çekmecede bekler */
  advanced?: boolean
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
  /** Ö1b-3: kartın üstündeki hızlı eylem seçenekleri (ilki varsayılan); ✎ penceresinden seçilir */
  quick?: { id: string; label: string }[]
}

export const REGISTRY_VERSION = 1

export const SCREENS: Record<ScreenId, { title: string; path: string }> = {
  today: { title: 'Bugün', path: '/' },
  fit: { title: 'Fit', path: '/fit' },
  water: { title: 'Su', path: '/su' },
  food: { title: 'Yemek', path: '/yemek' },
  fitness: { title: 'Fitness', path: '/fitness' },
  mine: { title: 'Panom', path: '/panom' },
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
  // Fit
  { id: 'fit.header', screen: 'fit', module: 'plan', title: 'Plan bandı', desc: 'Trend kilo halkası, hedef, tahmini varış', sizes: ['full'], size: 'full', default: true, locked: 'top', since: 1, colorSlots: COLORS },
  { id: 'fit.goal', screen: 'fit', module: 'plan', title: 'Kilo grafiği', desc: 'Trend, plan ve tahmin çizgisi', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'fit.quality', screen: 'fit', module: 'plan', title: 'Kayıp/kazanım kalitesi', desc: 'Yağ mı kas mı: bel ve kuvvet değişimi', sizes: ['full'], size: 'full', default: true, conditional: 'Yeterli ölçü olunca görünür', since: 1, colorSlots: COLORS },
  { id: 'fit.trend', screen: 'fit', module: 'plan', title: 'Trend kilo', desc: 'Trend ve son tartı', sizes: ['half', 'full'], size: 'half', default: true, since: 1, colorSlots: COLORS },
  { id: 'fit.change', screen: 'fit', module: 'plan', title: 'Değişim', desc: 'Başlangıçtan bu yana', sizes: ['half', 'full'], size: 'half', default: true, since: 1, colorSlots: COLORS },
  { id: 'fit.tdee', screen: 'fit', module: 'plan', title: 'Ölçülen harcama', desc: 'Kayıt ve tartıdan hesaplanan günlük harcama', sizes: ['half', 'full'], size: 'half', default: true, advanced: true, since: 1, colorSlots: COLORS },
  { id: 'fit.plan-kcal', screen: 'fit', module: 'plan', title: 'Plan kalorisi', desc: 'Planın günlük kalorisi ve tahmini harcama', sizes: ['half', 'full'], size: 'half', default: true, advanced: true, since: 1, colorSlots: COLORS },
  { id: 'fit.today', screen: 'fit', module: 'plan', title: 'Bugün', desc: 'Bugünkü hedef ve gün kapatma', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'fit.balance', screen: 'fit', module: 'plan', title: 'Akıllı dengeleme', desc: 'Son günlerin farkı ve dağıtımı', sizes: ['full'], size: 'full', default: true, advanced: true, conditional: 'Kapanmış gün olunca görünür', since: 1, colorSlots: COLORS },
  { id: 'fit.milestone', screen: 'fit', module: 'social', title: 'Kilometre taşı paylaş', desc: 'En az 1 kg değişimde paylaşım kısayolu', sizes: ['full'], size: 'full', default: true, conditional: 'En az 1 kg değişimde görünür', since: 1, colorSlots: COLORS },
  { id: 'fit.tools', screen: 'fit', module: 'plan', title: 'Plan araçları', desc: '7 gün, kalori bankası, check-in, senaryo, karb döngüsü', sizes: ['full'], size: 'full', default: true, advanced: true, since: 1, colorSlots: COLORS },
  { id: 'fit.weigh', screen: 'fit', module: 'plan', title: 'Tartı', desc: 'Kilo girişi', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  // Fitness
  { id: 'fitness.header', screen: 'fitness', module: 'fitness', title: 'Fitness bandı', desc: 'Haftalık antrenman halkası, hacim, süre, kardiyo', sizes: ['full'], size: 'full', default: true, locked: 'top', since: 1, colorSlots: COLORS },
  { id: 'fitness.recovery', screen: 'fitness', module: 'fitness', title: 'Toparlanma', desc: 'Yorgunluk yüksekse hafif gün önerisi', sizes: ['full'], size: 'full', default: true, conditional: 'Toparlanma düşükse görünür', since: 1, colorSlots: COLORS },
  { id: 'fitness.next', screen: 'fitness', module: 'fitness', title: 'Sıradaki antrenman', desc: 'Programın sıradaki günü ve başlat', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'fitness.tools', screen: 'fitness', module: 'fitness', title: 'Fitness araçları', desc: 'Kas haritası, serbest antrenman, kardiyo, hareketler…', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'fitness.week', screen: 'fitness', module: 'fitness', title: 'Bu hafta', desc: 'Haftanın antrenman günleri', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'fitness.prs', screen: 'fitness', module: 'fitness', title: 'Son rekorlar', desc: 'Son kişisel rekorların', sizes: ['full'], size: 'full', default: true, conditional: 'Rekor olunca görünür', since: 1, colorSlots: COLORS },
  { id: 'fitness.recent', screen: 'fitness', module: 'fitness', title: 'Son antrenmanlar', desc: 'Son antrenman ve kardiyo kayıtların', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'fitness.programs', screen: 'fitness', module: 'fitness', title: 'Programlarım', desc: 'Programlar sayfasına kısayol (Sade mod)', sizes: ['half', 'full'], size: 'full', default: true, conditional: 'Gelişmiş modda araçlar kartında', since: 1, colorSlots: COLORS },
  // Su
  { id: 'water.header', screen: 'water', module: 'water', title: 'Su bandı', desc: 'Bugünkü su, hedef, kalan ve ideal tempo', sizes: ['full'], size: 'full', default: true, locked: 'top', since: 1, colorSlots: COLORS },
  { id: 'water.prediction', screen: 'water', module: 'water', title: 'Tahmin', desc: 'Bu tempoyla gün sonunda nereye varırsın', sizes: ['full'], size: 'full', default: true, conditional: 'Kayıt olunca görünür', since: 1, colorSlots: COLORS },
  { id: 'water.drinks', screen: 'water', module: 'water', title: 'İçecek türü', desc: 'Su, çay, kahve, maden suyu…', sizes: ['full'], size: 'full', default: true, since: 1 },
  { id: 'water.buttons', screen: 'water', module: 'water', title: 'Hızlı ekle', desc: 'Miktar düğmeleri ve sık kullandıkların', sizes: ['full'], size: 'full', default: true, since: 1 },
  { id: 'water.tools', screen: 'water', module: 'water', title: 'Söyle · Yudum · Özel', desc: 'Sesle, yudumla ya da özel miktarla ekleme', sizes: ['full'], size: 'full', default: true, since: 1 },
  { id: 'water.containers', screen: 'water', module: 'water', title: 'Kapların', desc: 'Bardak, şişe, termos', sizes: ['full'], size: 'full', default: true, since: 1 },
  { id: 'water.hourly', screen: 'water', module: 'water', title: 'Saatlik dağılım', desc: 'Gün içinde ne zaman içtin', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'water.logs', screen: 'water', module: 'water', title: 'Kayıtlar', desc: 'Bugünkü kayıtlar, düzenleme ve birleştirme', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'water.links', screen: 'water', module: 'water', title: 'İstatistik kısayolları', desc: 'İstatistikler ve önceki günler', sizes: ['full'], size: 'full', default: true, since: 1 },
  { id: 'food.header', screen: 'food', module: 'food', title: 'Yemek bandı', desc: 'Kalan kalori halkası ve makro hapları', sizes: ['full'], size: 'full', default: true, locked: 'top', since: 1, colorSlots: COLORS },
  { id: 'food.summary', screen: 'food', module: 'food', title: 'Günlük özet', desc: 'Gün değiştirme, kalori bütçesi ve makro çubukları', sizes: ['full'], size: 'full', default: true, locked: 'keep', since: 1, colorSlots: COLORS },
  { id: 'food.add', screen: 'food', module: 'food', title: 'Ekle', desc: 'Besin ekle, barkod, hızlı kalori', sizes: ['full'], size: 'full', default: true, since: 1 },
  { id: 'food.ai', screen: 'food', module: 'food', title: 'AI planlama', desc: 'AI menü, elimdekiler, restoran modu', sizes: ['full'], size: 'full', default: true, advanced: true, conditional: 'Bugünün günlüğünde görünür', since: 1 },
  { id: 'food.meals', screen: 'food', module: 'food', title: 'Öğünler', desc: 'Kahvaltı, öğle, akşam ve ara öğün kayıtları', sizes: ['full'], size: 'full', default: true, locked: 'keep', since: 1, colorSlots: COLORS },
  { id: 'food.detail', screen: 'food', module: 'food', title: 'Besin hedefleri', desc: 'Protein dağılımı, lif, mikro besin hedefleri', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'food.supplements', screen: 'food', module: 'food', title: 'Takviyeler', desc: 'Kendi takviyelerini işaretle', sizes: ['full'], size: 'full', default: true, conditional: 'Takviye tanımlayınca görünür', since: 1 },
  { id: 'food.micro', screen: 'food', module: 'food', title: 'Besin detayları', desc: 'Lif, şeker, sodyum, vitamin ve mineraller', sizes: ['full'], size: 'full', default: true, conditional: 'Mikro besin bilgisi olan kayıt eklenince görünür', since: 1 },
  { id: 'food.tip', screen: 'food', module: 'food', title: 'Koç notu', desc: 'Günün durumuna göre kısa öneri', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  // Ö1b-4: Kendi panom — modüller arası karışık ekran
  { id: 'mine.header', screen: 'mine', module: 'today', title: 'Pano bandı', desc: 'Panonun başlığı ve günün özeti', sizes: ['full'], size: 'full', default: true, locked: 'top', since: 1, colorSlots: COLORS },
  { id: 'mine.kcal', screen: 'mine', module: 'today', title: 'Kalan kalori', desc: 'Bugünkü kalori bütçesinden kalan', sizes: ['half', 'full'], size: 'half', default: false, since: 1, colorSlots: COLORS },
  { id: 'mine.water', screen: 'mine', module: 'water', title: 'Su', desc: 'Bugünkü su ve hızlı ekleme', sizes: ['half', 'full'], size: 'half', default: true, since: 1, colorSlots: COLORS },
  { id: 'mine.weight', screen: 'mine', module: 'plan', title: 'Kilo trendi', desc: 'Trend kilo ve hedefe kalan', sizes: ['half', 'full'], size: 'half', default: true, since: 1, colorSlots: COLORS },
  { id: 'mine.macros', screen: 'mine', module: 'food', title: 'Makrolar', desc: 'Protein, karbonhidrat, yağ', sizes: ['full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'mine.training', screen: 'mine', module: 'fitness', title: 'Antrenman', desc: 'Bugünkü antrenman ya da sıradaki gün', sizes: ['half', 'full'], size: 'full', default: true, since: 1, colorSlots: COLORS },
  { id: 'mine.recovery', screen: 'mine', module: 'fitness', title: 'Toparlanma', desc: 'Bugünkü toparlanma durumu', sizes: ['half', 'full'], size: 'full', default: true, conditional: 'Antrenman kaydı olunca görünür', since: 1, colorSlots: COLORS },
  { id: 'mine.meals', screen: 'mine', module: 'food', title: 'Bugünkü öğünler', desc: 'Öğün başına kalori', sizes: ['full'], size: 'full', default: false, since: 1, colorSlots: COLORS },
  { id: 'mine.coach', screen: 'mine', module: 'coach', title: 'Koç', desc: 'Günün notu', sizes: ['full'], size: 'full', default: false, since: 1, colorSlots: COLORS },
  { id: 'mine.streaks', screen: 'mine', module: 'today', title: 'Seriler', desc: 'Su, kayıt ve antrenman serilerin', sizes: ['full'], size: 'full', default: false, since: 1 },
]

/**
 * Kayıt değişiklikleri: sürüm N'e geçerken eski kimlik → yeni kimlik(ler). [] = kart kaldırıldı.
 * Örnek (ileride): { version: 2, map: { 'today.water': ['today.water-v2'] }, note: { 'today.water': 'Su kartı yenilendi' } }
 */
export const CARD_MIGRATIONS: { version: number; map: Record<string, string[]>; note?: Record<string, string> }[] = []

// Ö1b-3: hızlı eylem seçenekleri (kart çizicileri bu kimlikleri tanır)
const QUICK: Record<string, CardDef['quick']> = {
  'today.water': [{ id: '250', label: '+250 ml' }, { id: '330', label: '+330 ml (kutu)' }, { id: '500', label: '+500 ml (şişe)' }, { id: 'none', label: 'Düğme yok' }],
  'today.training': [{ id: 'start', label: 'Antrenmanı başlat' }, { id: 'cardio', label: 'Kardiyo ekle' }, { id: 'stats', label: 'İstatistikler' }],
  'today.fit': [{ id: 'plan', label: 'Plana git' }, { id: 'weigh', label: 'Tartıl' }],
  'today.macros': [{ id: 'none', label: 'Düğme yok' }, { id: 'add', label: 'Besin ekle' }],
  'mine.water': [{ id: '250', label: '+250 ml' }, { id: '330', label: '+330 ml (kutu)' }, { id: '500', label: '+500 ml (şişe)' }, { id: 'none', label: 'Düğme yok' }],
}
for (const c of CARDS) if (QUICK[c.id]) c.quick = QUICK[c.id]
/** Kartın geçerli hızlı eylemi (bilinmeyen seçim → varsayılan). */
export function quickOf(id: string, chosen?: unknown): string | null {
  const q = QUICK[id]
  if (!q) return null
  return q.some((o) => o.id === chosen) ? (chosen as string) : q[0].id
}

const byId = new Map(CARDS.map((c) => [c.id, c]))
// Ö5a: kullanıcı kartları (kart oluşturucu) `u.<ekran>.<kimlik>`; tanımı tasarımda, burada ortak bir kayıt üretilir
const USER_CARD = /^u\.(today|fit|water|food|fitness|mine)\.[a-z0-9]{6,12}$/
const SCREEN_MODULE: Record<ScreenId, ModuleId> = { today: 'today', fit: 'plan', water: 'water', food: 'food', fitness: 'fitness', mine: 'today' }
export function cardDef(id: string): CardDef | undefined {
  const c = byId.get(id)
  if (c || !id) return c
  const m = USER_CARD.exec(id)
  if (!m) return undefined
  const screen = m[1] as ScreenId
  return { id, screen, module: SCREEN_MODULE[screen], title: 'Kendi kartım', desc: 'Kart oluşturucuda tasarladığın kart', sizes: ['half', 'full'], size: 'half', default: false, since: 1, colorSlots: COLORS }
}
export function cardsFor(screen: ScreenId): CardDef[] { return CARDS.filter((c) => c.screen === screen) }
export function isScreen(s: string): s is ScreenId { return s in SCREENS }
