// Özelleştirme Ö3: tasarımın kişisel ve paylaşılabilir kısımları (saf; testleri tests/cards-share.test.ts).
// Kişisel: kaydırma hareketleri, kullanım tercihleri (tek el, basılı tut), birimler, titreşim/ses, akşam, erişilebilirlik,
// bant fotoğrafı. Bunlar tasarımlar arasında kullanıcıyla birlikte taşınır, şablonla paylaşılmaz.
import type { Design } from './layout.ts'
import { normalizeStyle, type StylePrefs } from './style.ts'
import { REGISTRY_VERSION } from './registry.ts'

const PERSONAL_STYLE = ['units', 'haptics', 'sound', 'warm', 'motion', 'contrast', 'bandMedia'] as const
export interface Personal { gestures?: Design['gestures']; prefs?: Design['prefs']; style?: Partial<StylePrefs>; insights?: Design['insights'] }

export function personalPart(d: Design | null | undefined): Personal {
  if (!d) return {}
  const st = d.style ? Object.fromEntries(PERSONAL_STYLE.filter((k) => k in d.style!).map((k) => [k, d.style![k]])) : undefined
  return { ...(d.gestures ? { gestures: d.gestures } : {}), ...(d.prefs ? { prefs: d.prefs } : {}), ...(d.insights ? { insights: d.insights } : {}), ...(st && Object.keys(st).length ? { style: st } : {}) }
}

/** Kişisel kısmı tasarıma uygular (kişisel alanlar `p`'den gelir; bant fotoğrafı yoksa fotoğraflı bant degradeye döner). */
export function withPersonal(d: Design, p: Personal): Design {
  const look = d.style ? Object.fromEntries(Object.entries(d.style).filter(([k]) => !(PERSONAL_STYLE as readonly string[]).includes(k))) : {}
  const style = normalizeStyle({ ...look, ...(p.style ?? {}) })
  const out: Design = { ...d, style }
  delete out.gestures; delete out.prefs; delete out.insights
  if (p.gestures) out.gestures = p.gestures
  if (p.prefs) out.prefs = p.prefs
  if (p.insights) out.insights = p.insights
  return out
}

/** Şablon olarak paylaşılacak hâl: kişisel kısım ve bant fotoğrafı çıkarılır. */
export function shareable(d: Design): Design {
  const s = withPersonal(d, {})
  const style: Partial<StylePrefs> = { ...s.style }
  for (const k of PERSONAL_STYLE) delete style[k]
  if (style.band === 'photo') style.band = 'gradient'
  return { v: d.v ?? REGISTRY_VERSION, screens: s.screens ?? {}, ...(s.cards ? { cards: s.cards } : {}), ...(s.nav ? { nav: s.nav } : {}), ...(s.rules ? { rules: s.rules } : {}), ...(s.modules ? { modules: s.modules } : {}), style }
}

export type ApplyMode = 'all' | 'colors' | 'layout'
const COLOR_STYLE = ['radius', 'density', 'font', 'icons', 'band'] as const
/**
 * Şablonu mevcut tasarıma uygular. 'colors': modül/kart renkleri + görünüm stili; 'layout': ekran düzenleri, alt bar,
 * kurallar, hızlı eylemler; 'all': ikisi. Kullanıcının kişisel kısmı her durumda korunur.
 */
export function applyTemplate(cur: Design, tpl: Design, mode: ApplyMode): Design {
  const t = shareable(tpl)
  const personal = personalPart(cur)
  let next: Design = { ...cur }
  if (mode === 'all' || mode === 'layout') {
    next.screens = t.screens
    if (t.nav) next.nav = t.nav; else delete next.nav
    if (t.rules) next.rules = t.rules; else delete next.rules
  }
  if (mode === 'all' || mode === 'colors') {
    if (t.modules) next.modules = t.modules; else delete next.modules
    const st: Partial<StylePrefs> = { ...(next.style ?? {}) }
    for (const k of COLOR_STYLE) { if (t.style?.[k] !== undefined) (st as Record<string, unknown>)[k] = t.style[k]; else delete st[k] }
    next.style = st
  }
  // kart ayarları: renkler 'colors' ile, hızlı eylem 'layout' ile gelir
  const cards: NonNullable<Design['cards']> = {}
  for (const id of new Set([...Object.keys(cur.cards ?? {}), ...Object.keys(t.cards ?? {})])) {
    const mine = cur.cards?.[id] ?? {}, theirs = t.cards?.[id] ?? {}
    const c: Record<string, unknown> = { ...mine }
    if (mode !== 'layout') { if (theirs.colors) c.colors = theirs.colors; else delete c.colors }
    if (mode !== 'colors') { if (theirs.quick !== undefined) c.quick = theirs.quick; else delete c.quick }
    if (Object.keys(c).length) cards[id] = c
  }
  next.cards = cards
  next = withPersonal(next, personal)
  return next
}
