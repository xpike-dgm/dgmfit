// Tema ve modül paleti (saf; istemci ve sunucu ortak).

export const THEME_COOKIE = 'dgfit_theme'
export type ThemePref = 'auto' | 'light' | 'dark'
export const THEMES: { id: ThemePref; label: string; hint: string }[] = [
  { id: 'auto', label: 'Otomatik', hint: 'Telefonun açık/koyu ayarını izler' },
  { id: 'light', label: 'Açık', hint: 'Her zaman açık tema' },
  { id: 'dark', label: 'Koyu', hint: 'Her zaman dengeli koyu tema' },
]
export function parseTheme(v: string | undefined | null): ThemePref {
  return v === 'light' || v === 'dark' ? v : 'auto'
}

/** Yazı boyutu (P-5): uygulama yakınlaştırmayı kapattığı için erişilebilirlik ayarı. Tüm arayüz orantılı büyür. */
export const TEXT_COOKIE = 'dgfit_text'
export type TextPref = 'normal' | 'lg' | 'xl'
export const TEXT_SIZES: { id: TextPref; label: string; hint: string }[] = [
  { id: 'normal', label: 'Normal', hint: 'Varsayılan boyut' },
  { id: 'lg', label: 'Büyük', hint: 'Yazılar ve düğmeler %10 büyük' },
  { id: 'xl', label: 'Çok büyük', hint: 'Yazılar ve düğmeler %20 büyük' },
]
export function parseTextSize(v: string | undefined | null): TextPref {
  return v === 'lg' || v === 'xl' ? v : 'normal'
}

export type ModuleId = 'today' | 'plan' | 'water' | 'food' | 'fitness' | 'social' | 'coach' | 'profile'

/** Bulunulan adresin renk modülü. */
export function moduleFor(path: string): ModuleId {
  const p = path.split('?')[0]
  const under = (b: string) => p === b || p.startsWith(b + '/')
  if (under('/fitness')) return 'fitness'
  if (under('/fit')) return 'plan'
  if (under('/su')) return 'water'
  if (under('/yemek')) return 'food'
  if (under('/sosyal') || under('/u')) return 'social'
  if (under('/koc') || under('/rapor')) return 'coach'
  if (under('/profil') || under('/yonetim')) return 'profile'
  return 'today'
}

/** Alt bar sekmesi: Bugün sekmesi profil, koç ve raporu da kapsar. */
export type TabId = 'today' | 'plan' | 'water' | 'food' | 'fitness' | 'social' | 'mine'
export function tabFor(path: string): TabId {
  const p = path.split('?')[0]
  if (p === '/panom' || p.startsWith('/panom/')) return 'mine'
  const m = moduleFor(path)
  return m === 'coach' || m === 'profile' ? 'today' : m
}

/** Ekranın altını kendisi kullanan odak sayfaları (canlı antrenman, koç sohbeti…): alt boşluk bırakılmaz. */
export function isFocusPage(path: string): boolean {
  const p = path.split('?')[0]
  return p === '/fitness/antrenman' || p === '/koc' || p === '/fitness/anatomi' || p.startsWith('/fitness/anatomi/') || p === '/fitness/kaydedilenler' || p === '/fitness/rekor' || /^\/fitness\/hareketler\/\d+$/.test(p)
}

/** Alt barın göründüğü sekme ana sayfaları. */
export const NAV_ROOTS = ['/', '/fit', '/su', '/yemek', '/fitness', '/sosyal', '/panom']

/** G1: alt bar yalnız sekme ana sayfalarında görünür; iç sayfalarda (ayarlar, ekleme, ayrıntı, canlı antrenman, koç…)
 *  gizlenir — bu sayfalarda geri düğmesi var (kullanıcı: "hesap ve ayarlara girince alt menü duruyor"). */
export function hidesNav(path: string): boolean {
  const p = path.split('?')[0].replace(/(.)\/$/, '$1')
  return !NAV_ROOTS.includes(p)
}
