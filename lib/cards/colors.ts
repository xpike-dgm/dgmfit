// Özelleştirme Ö2a: renk hesapları (saf; testleri tests/cards-colors.test.ts). Kart renkleri, modül renkleri, hazır paletler,
// fotoğraftan palet. Kullanıcı rengi bir kez seçer; açık ve koyu tema için okunur değerler buradan türetilir (WCAG kontrastı).
import type { ModuleId } from '../theme.ts'

export type Hex = string
export const isHex = (s: unknown): s is Hex => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s)

type RGB = [number, number, number]
export const rgb = (h: Hex): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
export const hex = ([r, g, b]: RGB): Hex => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()

/** Göreli parlaklık (WCAG 2.x). */
export function luminance(h: Hex): number {
  const c = rgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export function contrast(a: Hex, b: Hex): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** a'dan b'ye t oranında karışım (0 = a, 1 = b). */
export function mix(a: Hex, b: Hex, t: number): Hex {
  const [p, q] = [rgb(a), rgb(b)]
  return hex([0, 1, 2].map((i) => p[i] + (q[i] - p[i]) * t) as RGB)
}

const INK_DARK = '#14161B', INK_LIGHT = '#FFFFFF'
/** Zemin üstünde en okunur yazı rengi (siyaha yakın ya da beyaz). */
export const autoInk = (bg: Hex): Hex => (contrast(bg, INK_DARK) >= contrast(bg, INK_LIGHT) ? INK_DARK : INK_LIGHT)

/** `fg` zeminde en az `min` kontrast verene kadar açılır ya da koyulaşır (gerekmiyorsa aynen döner). */
export function ensureContrast(fg: Hex, bg: Hex, min = 4.5): Hex {
  if (contrast(fg, bg) >= min) return fg
  const toward = luminance(bg) > 0.4 ? '#000000' : '#FFFFFF'
  for (let t = 0.1; t <= 1.0001; t += 0.1) { const c = mix(fg, toward, t); if (contrast(c, bg) >= min) return c }
  return autoInk(bg)
}

// ───────── kart renkleri ─────────
export const CARD_SLOTS = ['bg', 'title', 'text', 'accent'] as const
export type CardSlot = (typeof CARD_SLOTS)[number]
export type CardColors = Partial<Record<CardSlot, Hex>>
export const SLOT_LABEL: Record<CardSlot, string> = { bg: 'Arka plan', title: 'Başlık', text: 'Metin', accent: 'Vurgu (düğme, halka)' }

/** Temaların varsayılan kart zemini (kontrast hesabında kullanıcının seçmediği zemin için). */
export const SURFACE = { light: '#FFFFFF', dark: '#1C1F26' } as const
const DARK_BASE = '#16181D'

/** Kullanıcının zemin renginin koyu temadaki karşılığı: açık zemin koyulaştırılır, renk tonu korunur. */
export function darkBg(bg: Hex): Hex { return luminance(bg) > 0.18 ? mix(bg, DARK_BASE, 0.72) : bg }

export interface ThemeColors { bg?: Hex; title: Hex | null; text: Hex | null; accent: Hex | null; accentInk: Hex | null }
/** Seçilen kart renklerinden bir tema için okunur takım (null = temanın kendi rengi). */
export function themeColors(c: CardColors, mode: 'light' | 'dark'): ThemeColors {
  const bg = c.bg ? (mode === 'dark' ? darkBg(c.bg) : c.bg) : undefined
  const ground = bg ?? SURFACE[mode]
  const title = c.title ? ensureContrast(c.title, ground, 4.5) : bg ? autoInk(bg) : null
  const text = c.text ? ensureContrast(c.text, ground, 4.5) : bg ? (autoInk(bg) === INK_LIGHT ? mix(INK_LIGHT, bg, 0.12) : mix(INK_DARK, bg, 0.18)) : null
  const accent = c.accent ? ensureContrast(c.accent, ground, 3) : null
  return { bg, title, text, accent, accentInk: accent ? autoInk(accent) : null }
}

/** Kartın okunurluk uyarıları (seçilen renk otomatik düzeltildiyse kullanıcıya söylenir). */
export function readabilityNotes(c: CardColors): string[] {
  const notes: string[] = []
  for (const mode of ['light', 'dark'] as const) {
    const ground = c.bg ? (mode === 'dark' ? darkBg(c.bg) : c.bg) : SURFACE[mode]
    const name = mode === 'light' ? 'açık temada' : 'koyu temada'
    if (c.title && contrast(c.title, ground) < 4.5) notes.push(`Başlık rengi ${name} zor okunuyor; otomatik ayarlandı.`)
    if (c.text && contrast(c.text, ground) < 4.5) notes.push(`Metin rengi ${name} zor okunuyor; otomatik ayarlandı.`)
    if (c.accent && contrast(c.accent, ground) < 3) notes.push(`Vurgu rengi ${name} zeminden ayrışmıyor; otomatik ayarlandı.`)
  }
  return [...new Set(notes)]
}

/** Kart sarmalayıcısına konacak CSS değişkenleri (her iki tema için) ve hangi alanların seçildiği. */
export function cardVars(c: CardColors | undefined): { style: Record<string, string>; slots: string } | null {
  if (!c || !CARD_SLOTS.some((s) => isHex(c[s]))) return null
  const style: Record<string, string> = {}
  const slots = new Set<string>()
  for (const mode of ['light', 'dark'] as const) {
    const t = themeColors(c, mode), k = mode === 'light' ? 'l' : 'd'
    if (t.bg) { style[`--cc${k}-bg`] = t.bg; slots.add('bg') }
    if (t.title) { style[`--cc${k}-title`] = t.title; slots.add('title') }
    if (t.text) { style[`--cc${k}-text`] = t.text; slots.add('text') }
    if (t.accent) { style[`--cc${k}-acc`] = t.accent; style[`--cc${k}-acc-ink`] = t.accentInk!; slots.add('acc') }
  }
  return { style, slots: [...slots].join(' ') }
}

export function normalizeCardColors(c: unknown): CardColors | undefined {
  if (!c || typeof c !== 'object') return undefined
  const out: CardColors = {}
  for (const s of CARD_SLOTS) { const v = (c as Record<string, unknown>)[s]; if (isHex(v)) out[s] = v.toUpperCase() }
  return Object.keys(out).length ? out : undefined
}

// ───────── modül renkleri ve paletler ─────────
export const MODULES: { id: ModuleId; label: string; base: Hex }[] = [
  { id: 'today', label: 'Bugün', base: '#3F7F12' },
  { id: 'plan', label: 'Fit', base: '#0E8B7E' },
  { id: 'water', label: 'Su', base: '#0B79C9' },
  { id: 'food', label: 'Yemek', base: '#C2551F' },
  { id: 'fitness', label: 'Fitness', base: '#D94A2B' },
  { id: 'social', label: 'Sosyal', base: '#4B4FD6' },
  { id: 'coach', label: 'Koç', base: '#7A3FC9' },
  { id: 'profile', label: 'Profil', base: '#3D4452' },
]
export type ModuleColors = Partial<Record<ModuleId, Hex>>

/**
 * Tek renkten modül paleti: bant degradesinin iki ucu (m1, m2) ve iki temadaki vurgu (açıkta beyaz yazıyla, koyuda
 * koyu yazıyla okunur). globals.css'teki `[data-mod]` değişkenlerinin karşılığı.
 */
export function modulePalette(base: Hex): { m1: Hex; m2: Hex; accL: Hex; accD: Hex } {
  const m1 = luminance(base) > 0.35 ? ensureContrast(base, '#FFFFFF', 3) : base
  const m2 = mix(m1, '#FFFFFF', 0.25)
  const accL = ensureContrast(m1, '#FFFFFF', 4.5) // açık tema: vurgu üstünde beyaz yazı
  const accD = ensureContrast(mix(base, '#FFFFFF', 0.35), '#14161B', 6) // koyu tema: koyu yazı
  return { m1, m2, accL, accD }
}

/** Tasarımdaki modül renklerinden <style> içeriği (yalnız değiştirilen modüller). */
export function moduleCss(mc: ModuleColors | undefined): string {
  if (!mc) return ''
  return MODULES.filter((m) => isHex(mc[m.id])).map((m) => {
    const p = modulePalette(mc[m.id]!)
    return `[data-mod="${m.id}"]{--m1:${p.m1};--m2:${p.m2};--acc-l:${p.accL};--acc-d:${p.accD}}`
  }).join('')
}

export function normalizeModuleColors(mc: unknown): ModuleColors | undefined {
  if (!mc || typeof mc !== 'object') return undefined
  const out: ModuleColors = {}
  for (const m of MODULES) { const v = (mc as Record<string, unknown>)[m.id]; if (isHex(v)) out[m.id] = v.toUpperCase() }
  return Object.keys(out).length ? out : undefined
}

/** Hazır paletler (modül sırasıyla: Bugün, Fit, Su, Yemek, Fitness, Sosyal, Koç, Profil). */
export const PALETTES: { id: string; name: string; colors: Hex[]; a11y?: boolean }[] = [
  { id: 'okyanus', name: 'Okyanus', colors: ['#0F6E8C', '#1287A8', '#0B5FA5', '#2A7F9E', '#14527A', '#3B5BA9', '#4F4AA8', '#33475B'] },
  { id: 'gunbatimi', name: 'Gün batımı', colors: ['#C2410C', '#D9480F', '#B4235A', '#E8590C', '#C92A2A', '#A61E4D', '#862E9C', '#5C3D2E'] },
  { id: 'orman', name: 'Orman', colors: ['#2B6A2F', '#3F7F12', '#1F6F5C', '#7A5C1E', '#5C6B1F', '#2F5D50', '#4A5D23', '#3B4A3F'] },
  { id: 'pastel', name: 'Pastel', colors: ['#7BA05B', '#5FA8A0', '#6A9FD4', '#E29A6B', '#E07A7A', '#9C8ADE', '#B48ACF', '#8A94A6'] },
  { id: 'mono', name: 'Tek renk', colors: ['#3D4452', '#3D4452', '#3D4452', '#3D4452', '#3D4452', '#3D4452', '#3D4452', '#3D4452'] },
  { id: 'renkkörü', name: 'Renk körlüğüne uygun', colors: ['#0072B2', '#009E73', '#56B4E9', '#E69F00', '#D55E00', '#CC79A7', '#6A51A3', '#4D4D4D'], a11y: true },
  { id: 'kontrast', name: 'Yüksek kontrast', colors: ['#1B5E20', '#004D40', '#0D47A1', '#BF360C', '#B71C1C', '#311B92', '#4A148C', '#212121'], a11y: true },
]
export const paletteColors = (id: string): ModuleColors | null => {
  const p = PALETTES.find((x) => x.id === id)
  return p ? Object.fromEntries(MODULES.map((m, i) => [m.id, p.colors[i]])) as ModuleColors : null
}

// ───────── fotoğraftan palet ─────────
/**
 * Piksellerden (RGBA dizisi) en baskın `k` rengi çıkarır: 4 bit/kanal kovalara sayım + birbirine çok yakın renkleri eleme.
 * Çok açık/çok koyu ve gri pikseller bant rengi olamayacağı için ağırlığı düşürülür. Deterministik.
 */
export function quantize(px: ArrayLike<number>, k = 6): Hex[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i + 3 < px.length; i += 4) {
    if (px[i + 3] < 128) continue
    const r = px[i], g = px[i + 1], b = px[i + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    e.n++; e.r += r; e.g += g; e.b += b
    buckets.set(key, e)
  }
  const cands = [...buckets.values()].map((e) => {
    const c = hex([e.r / e.n, e.g / e.n, e.b / e.n])
    const [r, g, b] = rgb(c), mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    const sat = mx ? (mx - mn) / mx : 0, l = luminance(c)
    const w = e.n * (0.25 + sat) * (l < 0.02 || l > 0.85 ? 0.15 : 1)
    return { c, w }
  }).sort((a, b) => b.w - a.w || (a.c < b.c ? -1 : 1))
  const out: Hex[] = []
  const dist = (a: Hex, b: Hex) => { const [p, q] = [rgb(a), rgb(b)]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }
  for (const { c } of cands) { if (out.every((o) => dist(o, c) > 48)) out.push(c); if (out.length >= k) break }
  return out
}

/** Fotoğraftan çıkan renkleri modüllere dağıtır (baskın renk Bugün'e; renk azsa döngüyle). */
export function photoModuleColors(colors: Hex[]): ModuleColors {
  if (!colors.length) return {}
  return Object.fromEntries(MODULES.map((m, i) => [m.id, colors[i % colors.length]])) as ModuleColors
}
