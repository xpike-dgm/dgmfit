// Özelleştirme Ö2b: stil tercihleri (saf; testleri tests/cards-style.test.ts). Köşe, yoğunluk, yazı tipi, simge kalınlığı,
// bant arka planı, erişilebilirlik, dokunuş geri bildirimi, akşam renkleri ve birimler. Tasarım verisinde `Design.style`.
export type Radius = 'sharp' | 'normal' | 'round'
export type Density = 'compact' | 'normal' | 'airy'
export type Font = 'default' | 'grotesk' | 'rounded' | 'serif' | 'system'
export type IconWeight = 'thin' | 'normal' | 'bold'
export type BandKind = 'gradient' | 'flat' | 'photo'
export type Haptics = 'off' | 'light' | 'normal' | 'strong'
export interface Units { weight: 'kg' | 'lb'; volume: 'ml' | 'oz'; energy: 'kcal' | 'kJ'; length: 'cm' | 'in' }
export interface StylePrefs {
  radius: Radius; density: Density; font: Font; icons: IconWeight
  band: BandKind; bandMedia?: string | null
  motion: 'normal' | 'reduce'; contrast: 'normal' | 'high'
  haptics: Haptics; sound: boolean; warm: boolean
  units: Units
}
export const DEFAULT_UNITS: Units = { weight: 'kg', volume: 'ml', energy: 'kcal', length: 'cm' }
export const DEFAULT_STYLE: StylePrefs = { radius: 'normal', density: 'normal', font: 'default', icons: 'normal', band: 'gradient', bandMedia: null, motion: 'normal', contrast: 'normal', haptics: 'normal', sound: false, warm: false, units: DEFAULT_UNITS }

const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (ok.includes(v as T) ? (v as T) : d)
export function normalizeStyle(s: unknown): StylePrefs {
  const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
  const u = (o.units && typeof o.units === 'object' ? o.units : {}) as Record<string, unknown>
  const media = typeof o.bandMedia === 'string' && /^[0-9a-f-]{36}$/.test(o.bandMedia) ? o.bandMedia : null
  const band = pick(o.band, ['gradient', 'flat', 'photo'] as const, 'gradient')
  return {
    radius: pick(o.radius, ['sharp', 'normal', 'round'] as const, 'normal'),
    density: pick(o.density, ['compact', 'normal', 'airy'] as const, 'normal'),
    font: pick(o.font, ['default', 'grotesk', 'rounded', 'serif', 'system'] as const, 'default'),
    icons: pick(o.icons, ['thin', 'normal', 'bold'] as const, 'normal'),
    band: band === 'photo' && !media ? 'gradient' : band, bandMedia: media,
    motion: pick(o.motion, ['normal', 'reduce'] as const, 'normal'),
    contrast: pick(o.contrast, ['normal', 'high'] as const, 'normal'),
    haptics: pick(o.haptics, ['off', 'light', 'normal', 'strong'] as const, 'normal'),
    sound: o.sound === true, warm: o.warm === true,
    units: {
      weight: pick(u.weight, ['kg', 'lb'] as const, 'kg'), volume: pick(u.volume, ['ml', 'oz'] as const, 'ml'),
      energy: pick(u.energy, ['kcal', 'kJ'] as const, 'kcal'), length: pick(u.length, ['cm', 'in'] as const, 'cm'),
    },
  }
}

/** Kabuğa (ModShell) konacak öznitelikler: CSS bunlarla stili uygular. Varsayılanlar öznitelik üretmez. */
export function styleAttrs(s: StylePrefs): Record<string, string> {
  const a: Record<string, string> = {}
  if (s.radius !== 'normal') a['data-radius'] = s.radius
  if (s.density !== 'normal') a['data-density'] = s.density
  if (s.font !== 'default') a['data-font'] = s.font
  if (s.icons !== 'normal') a['data-icons'] = s.icons
  if (s.band !== 'gradient') a['data-band'] = s.band
  if (s.motion === 'reduce') a['data-motion'] = 'reduce'
  if (s.contrast === 'high') a['data-contrast'] = 'high'
  return a
}

/** Akşam renkleri: 20.00–06.00 arası sıcak ton (yerel saat dakikası). */
export const isWarmHour = (minute: number) => minute >= 20 * 60 || minute < 6 * 60

/** Titreşim süresi çarpanı (0 = kapalı). */
export const hapticScale = (h: Haptics) => ({ off: 0, light: 0.5, normal: 1, strong: 1.8 })[h]
