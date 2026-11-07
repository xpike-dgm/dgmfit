// Özelleştirme: tasarım (kullanıcının düzeni) ↔ kart kaydı. Saf; testleri tests/cards.test.ts.
// Tasarım verisi kişisel veri içermez (yalnızca kart kimlikleri, boyutlar, ileride renkler) → şablon olarak paylaşılabilir.
import { CARD_MIGRATIONS, REGISTRY_VERSION, cardDef, cardsFor, type CardDef, type CardSize, type ScreenId } from './registry.ts'

export interface LayoutItem { id: string; size?: CardSize }
export interface ScreenLayout { items: LayoutItem[]; /** kullanıcının bilerek kaldırdıkları (çekmecede "kaldırdıkların") */ removed?: string[] }
/** Kart başına ayar (Ö2: renkler; ileride görünüm türü, içerik seçenekleri). Bilinmeyen alanlar korunur. */
export interface CardSettings { colors?: Record<string, string>; [k: string]: unknown }
export interface Design {
  /** tasarımın kaydedildiği kart kaydı sürümü */
  v: number
  screens: Partial<Record<ScreenId, ScreenLayout>>
  cards?: Record<string, CardSettings>
}

export interface ResolvedItem { id: string; size: CardSize; def: CardDef }
export interface DrawerItem { def: CardDef; reason: 'removed' | 'new' | 'available' }
export interface ResolvedScreen { items: ResolvedItem[]; drawer: DrawerItem[]; notices: string[]; customized: boolean }

export const emptyDesign = (): Design => ({ v: REGISTRY_VERSION, screens: {} })

/** Eski sürümde kaydedilmiş tasarımı güncel kayda taşır (kimlik eşlemesi, kart ayarlarının taşınması). */
export function migrateDesign(d: Design): { design: Design; notices: string[] } {
  const notices: string[] = []
  let cur: Design = { v: d.v ?? REGISTRY_VERSION, screens: { ...d.screens }, cards: { ...(d.cards ?? {}) } }
  for (const m of CARD_MIGRATIONS.filter((x) => x.version > cur.v).sort((a, b) => a.version - b.version)) {
    const screens: Design['screens'] = {}
    for (const [sid, sl] of Object.entries(cur.screens) as [ScreenId, ScreenLayout][]) {
      const items: LayoutItem[] = []
      for (const it of sl.items) {
        const to = m.map[it.id]
        if (!to) { items.push(it); continue }
        if (m.note?.[it.id]) notices.push(m.note[it.id])
        for (const nid of to) items.push({ id: nid, size: it.size })
      }
      const removed = (sl.removed ?? []).flatMap((id) => m.map[id] ?? [id])
      screens[sid] = { items, removed }
    }
    const cards: Record<string, CardSettings> = {}
    for (const [id, s] of Object.entries(cur.cards ?? {})) for (const nid of m.map[id] ?? [id]) cards[nid] = s
    cur = { v: m.version, screens, cards }
  }
  return { design: { ...cur, v: REGISTRY_VERSION }, notices }
}

/** Varsayılan düzen: kayıttaki sırayla `default` kartlar. */
export function defaultItems(screen: ScreenId): LayoutItem[] {
  return cardsFor(screen).filter((c) => c.default).map((c) => ({ id: c.id }))
}

/**
 * Ekranın gösterilecek düzeni: göç → bilinmeyenleri at → kilitli kartları yerine koy → tekrarları ayıkla → boyutları doğrula.
 * Tasarımı olmayan (hiç özelleştirmemiş) kullanıcı her zaman güncel varsayılanı alır.
 */
export function resolveScreen(design: Design | null | undefined, screen: ScreenId): ResolvedScreen {
  const { design: d, notices } = design ? migrateDesign(design) : { design: null, notices: [] as string[] }
  const sl = d?.screens[screen]
  const customized = !!sl
  const raw = sl ? sl.items : defaultItems(screen)
  const seen = new Set<string>()
  let items: ResolvedItem[] = []
  for (const it of raw) {
    const def = cardDef(it.id)
    if (!def || def.screen !== screen) { if (sl) notices.push(`Bir kart artık yok (${it.id}); düzenin kalanı korundu.`); continue }
    if (seen.has(def.id)) continue
    seen.add(def.id)
    items.push({ id: def.id, size: it.size && def.sizes.includes(it.size) ? it.size : def.size, def })
  }
  // kilitli kartlar: 'top' her zaman başta; 'keep' eksikse varsayılan sıradaki yerine
  const all = cardsFor(screen)
  for (const def of all.filter((c) => c.locked)) {
    if (seen.has(def.id)) continue
    const at = def.locked === 'top' ? 0 : Math.min(items.length, all.filter((c) => c.default).findIndex((c) => c.id === def.id))
    items.splice(Math.max(0, at), 0, { id: def.id, size: def.size, def })
    seen.add(def.id)
  }
  const tops = items.filter((i) => i.def.locked === 'top')
  items = [...tops, ...items.filter((i) => i.def.locked !== 'top')]
  const removedSet = new Set(sl?.removed ?? [])
  const fromV = design?.v ?? REGISTRY_VERSION
  const drawer: DrawerItem[] = all.filter((c) => !seen.has(c.id) && !c.locked).map((def) => ({
    def, reason: removedSet.has(def.id) ? 'removed' : sl && def.since > fromV ? 'new' : def.default ? 'removed' : 'available',
  }))
  return { items, drawer, notices: [...new Set(notices)], customized }
}

// ---- düzenleme işlemleri (istemci ve sunucu ortak) ----

const locked = (items: LayoutItem[], i: number) => cardDef(items[i]?.id)?.locked === 'top'

/** `from` sıradaki kartı `to` sırasına taşır; en üstteki sabit kartların önüne geçemez. */
export function moveItem<T extends LayoutItem>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || locked(items, from)) return items
  const floor = items.findIndex((_, i) => !locked(items, i))
  const dest = Math.max(floor, Math.min(items.length - 1, to))
  if (dest === from) return items
  const next = items.slice()
  const [it] = next.splice(from, 1)
  next.splice(dest, 0, it)
  return next
}

export function removeItem<T extends LayoutItem>(items: T[], id: string): T[] {
  if (cardDef(id)?.locked) return items
  return items.filter((i) => i.id !== id)
}

export function addItem(items: LayoutItem[], id: string, at?: number): LayoutItem[] {
  const def = cardDef(id)
  if (!def || items.some((i) => i.id === id)) return items
  const floor = items.findIndex((_, i) => !locked(items, i))
  const pos = at === undefined ? items.length : Math.max(floor < 0 ? items.length : floor, Math.min(items.length, at))
  const next = items.slice()
  next.splice(pos, 0, { id, size: def.size })
  return next
}

export function setSize<T extends LayoutItem>(items: T[], id: string, size: CardSize): T[] {
  const def = cardDef(id)
  if (!def || !def.sizes.includes(size)) return items
  return items.map((i) => (i.id === id ? { ...i, size } : i))
}

/**
 * Kaydedilecek ekran düzenini doğrular: yalnızca bu ekranın bilinen kartları, tekrar yok, kilitliler eksikse eklenir.
 * `removed` = varsayılanda olup kullanıcının kaldırdıkları (çekmecede "kaldırdıkların" için).
 */
export function normalizeScreen(screen: ScreenId, items: LayoutItem[]): ScreenLayout {
  const r = resolveScreen({ v: REGISTRY_VERSION, screens: { [screen]: { items } } }, screen)
  const kept = r.items.map((i) => ({ id: i.id, ...(i.size !== i.def.size ? { size: i.size } : {}) }))
  const ids = new Set(kept.map((i) => i.id))
  return { items: kept, removed: cardsFor(screen).filter((c) => c.default && !ids.has(c.id)).map((c) => c.id) }
}
