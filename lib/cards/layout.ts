// Özelleştirme: tasarım (kullanıcının düzeni) ↔ kart kaydı. Saf; testleri tests/cards.test.ts.
// Tasarım verisi kişisel veri içermez (yalnızca kart kimlikleri, boyutlar, ileride renkler) → şablon olarak paylaşılabilir.
import { CARD_MIGRATIONS, REGISTRY_VERSION, cardDef, cardsFor, type CardDef, type CardSize, type ScreenId } from './registry.ts'
import type { Gestures, NavLayout, Rule, UsePrefs } from './prefs.ts'
import type { ModuleColors } from './colors.ts'
import type { StylePrefs } from './style.ts'
import { isUserCard, type UserCard } from './custom.ts'

/** `stack`: Ö1b-4 kart yığını — aynı yerde yana kaydırılarak gezilen ek kartlar (ilk kart `id`). */
export interface LayoutItem { id: string; size?: CardSize; stack?: string[] }
export interface ScreenLayout { items: LayoutItem[]; /** kullanıcının bilerek kaldırdıkları (çekmecede "kaldırdıkların") */ removed?: string[] }
/** Kart başına ayar (Ö2: renkler; ileride görünüm türü, içerik seçenekleri). Bilinmeyen alanlar korunur. */
export interface CardSettings { colors?: Record<string, string>; [k: string]: unknown }
export interface Design {
  /** tasarımın kaydedildiği kart kaydı sürümü */
  v: number
  screens: Partial<Record<ScreenId, ScreenLayout>>
  cards?: Record<string, CardSettings>
  /** Ö1b-2: alt bar sırası ve gizlenen sekmeler */
  nav?: NavLayout
  /** Ö1b-2: eğer–ise kuralları (görüntülemede uygulanır, kayıtlı düzeni değiştirmez) */
  rules?: Rule[]
  /** Ö1b-2: tek el, basılı tutunca düzenle */
  prefs?: UsePrefs
  /** Ö1b-3: kaydırma hareketleri (sabitlenen kartlar, bugünlük gizlenenler). Şablon paylaşımında taşınmaz. */
  gestures?: Gestures
  /** Ö2a: modül renkleri (tek renk; bant ve vurgu iki tema için türetilir) */
  modules?: ModuleColors
  /** Ö2b: stil (köşe, yoğunluk, yazı tipi, simge, bant, erişilebilirlik, dokunuş, akşam, birimler) */
  style?: Partial<StylePrefs>
  /** Ö3b: şablondan geldiyse kaynağı (remix ve paylaşımda "X'in şablonundan" için) */
  origin?: { templateId: string; name: string }
  /** Ö4: koç önerileri — "şimdi değil" denenler (kişisel) */
  insights?: { dismissed: string[] }
  /** Ö5a: kendi kartlarım (kimlik → tanım; kişisel, şablonla paylaşılmaz) */
  userCards?: Record<string, UserCard>
}

export interface ResolvedItem { id: string; size: CardSize; def: CardDef; stack?: string[] }
export const STACK_MAX = 4
export interface DrawerItem { def: CardDef; reason: 'removed' | 'new' | 'available' }
export interface ResolvedScreen { items: ResolvedItem[]; drawer: DrawerItem[]; notices: string[]; customized: boolean }

export const emptyDesign = (): Design => ({ v: REGISTRY_VERSION, screens: {} })

/** Eski sürümde kaydedilmiş tasarımı güncel kayda taşır (kimlik eşlemesi, kart ayarlarının taşınması). */
export function migrateDesign(d: Design): { design: Design; notices: string[] } {
  const notices: string[] = []
  let cur: Design = { ...d, v: d.v ?? REGISTRY_VERSION, screens: { ...d.screens }, cards: { ...(d.cards ?? {}) } }
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
      for (const it of items) if (it.stack) it.stack = it.stack.flatMap((id) => m.map[id] ?? [id])
      const removed = (sl.removed ?? []).flatMap((id) => m.map[id] ?? [id])
      screens[sid] = { items, removed }
    }
    const cards: Record<string, CardSettings> = {}
    for (const [id, s] of Object.entries(cur.cards ?? {})) for (const nid of m.map[id] ?? [id]) cards[nid] = s
    // kurallardaki kart kimlikleri de aynı eşlemeden geçer (kaldırılan kartın eylemi düşer, eylemsiz kural silinir)
    const rules = cur.rules?.map((r) => ({ ...r, then: r.then.flatMap((a) => (m.map[a.card] ?? [a.card]).map((card) => ({ ...a, card }))) })).filter((r) => r.then.length)
    const mapIds = (xs: string[]) => [...new Set(xs.flatMap((id) => m.map[id] ?? [id]))]
    const g = cur.gestures
    const gestures = g ? {
      ...(g.pins ? { pins: Object.fromEntries(Object.entries(g.pins).map(([s, ids]) => [s, mapIds(ids ?? [])])) } : {}),
      ...(g.daily ? { daily: { ...g.daily, hidden: mapIds(g.daily.hidden) } } : {}),
    } : undefined
    cur = { ...cur, v: m.version, screens, cards, ...(rules ? { rules } : {}), ...(gestures ? { gestures } : {}) }
  }
  return { design: { ...cur, v: REGISTRY_VERSION }, notices }
}

/** Ekranı çözerken bilinen kullanıcı bağlamı (varsayılan düzen buna göre değişir). */
export interface LayoutCtx { advanced?: boolean }
const isDefault = (c: CardDef, ctx: LayoutCtx) => c.default && (!c.advanced || !!ctx.advanced)

/** Varsayılan düzen: kayıttaki sırayla `default` kartlar (Gelişmiş kartlar yalnız Gelişmiş modda). */
export function defaultItems(screen: ScreenId, ctx: LayoutCtx = {}): LayoutItem[] {
  return cardsFor(screen).filter((c) => isDefault(c, ctx)).map((c) => ({ id: c.id }))
}

/**
 * Ekranın gösterilecek düzeni: göç → bilinmeyenleri at → kilitli kartları yerine koy → tekrarları ayıkla → boyutları doğrula.
 * Tasarımı olmayan (hiç özelleştirmemiş) kullanıcı her zaman güncel varsayılanı alır.
 */
export function resolveScreen(design: Design | null | undefined, screen: ScreenId, ctx: LayoutCtx = {}): ResolvedScreen {
  const { design: d, notices } = design ? migrateDesign(design) : { design: null, notices: [] as string[] }
  const sl = d?.screens[screen]
  const customized = !!sl
  const raw = sl ? sl.items : defaultItems(screen, ctx)
  const seen = new Set<string>()
  let items: ResolvedItem[] = []
  // Ö5a: kendi kartlarım — tanımı silinmiş kart sessizce düşer; başlık kullanıcının verdiği addır
  const uc = d?.userCards ?? {}
  const defOf = (id: string): CardDef | undefined => {
    const def = cardDef(id)
    if (!def || !isUserCard(id)) return def
    const u = uc[id]
    return u ? { ...def, title: u.title || def.title } : undefined
  }
  for (const it of raw) {
    const def = defOf(it.id)
    if (!def && isUserCard(it.id)) continue
    if (!def || def.screen !== screen) { if (sl) notices.push(`Bir kart artık yok (${it.id}); düzenin kalanı korundu.`); continue }
    if (seen.has(def.id)) continue
    seen.add(def.id)
    const r: ResolvedItem = { id: def.id, size: it.size && def.sizes.includes(it.size) ? it.size : def.size, def }
    // yığın: yalnız bu ekranın, kilitsiz, başka yerde olmayan kartları; sabit başlık yığılamaz
    if (it.stack?.length && def.locked !== 'top') {
      const st: string[] = []
      for (const sid of it.stack) {
        const sd = defOf(sid)
        if (!sd || sd.screen !== screen || sd.locked || seen.has(sid) || raw.some((x) => x.id === sid) || st.length >= STACK_MAX - 1) continue
        st.push(sid); seen.add(sid)
      }
      if (st.length) r.stack = st
    }
    items.push(r)
  }
  // kilitli kartlar: 'top' her zaman başta; 'keep' eksikse varsayılan sıradaki yerine
  const all = cardsFor(screen)
  for (const def of all.filter((c) => c.locked)) {
    if (seen.has(def.id)) continue
    const at = def.locked === 'top' ? 0 : Math.min(items.length, all.filter((c) => isDefault(c, ctx)).findIndex((c) => c.id === def.id))
    items.splice(Math.max(0, at), 0, { id: def.id, size: def.size, def })
    seen.add(def.id)
  }
  const tops = items.filter((i) => i.def.locked === 'top')
  items = [...tops, ...items.filter((i) => i.def.locked !== 'top')]
  const removedSet = new Set(sl?.removed ?? [])
  const fromV = design?.v ?? REGISTRY_VERSION
  const drawer: DrawerItem[] = all.filter((c) => !seen.has(c.id) && !c.locked).map((def) => ({
    def, reason: removedSet.has(def.id) ? 'removed' : sl && def.since > fromV ? 'new' : isDefault(def, ctx) ? 'removed' : 'available',
  }))
  for (const id of Object.keys(uc)) {
    if (seen.has(id) || !isUserCard(id)) continue
    const def = defOf(id)
    if (def?.screen === screen) drawer.push({ def, reason: 'available' })
  }
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

/** Kaldırır; yığının ilk kartı kaldırılırsa yığındaki kartlar onun yerine tek tek geçer. Yığındaki bir kart da kaldırılabilir. */
export function removeItem<T extends LayoutItem>(items: T[], id: string): T[] {
  if (cardDef(id)?.locked) return items
  const out: T[] = []
  for (const i of items) {
    if (i.id === id) { for (const sid of i.stack ?? []) out.push({ ...i, id: sid, size: cardDef(sid)?.size, stack: undefined }); continue }
    out.push(i.stack?.includes(id) ? { ...i, stack: i.stack.filter((x) => x !== id) } : i)
  }
  return out
}

export const stackedIds = (items: LayoutItem[]) => new Set(items.flatMap((i) => i.stack ?? []))

/** Kartı hemen altındaki kartla (ve onun yığınıyla) aynı yığında birleştirir. */
export function stackWithNext<T extends LayoutItem>(items: T[], id: string): T[] {
  const i = items.findIndex((x) => x.id === id)
  const a = items[i], b = items[i + 1]
  if (!a || !b || cardDef(a.id)?.locked === 'top' || cardDef(b.id)?.locked) return items
  const stack = [...(a.stack ?? []), b.id, ...(b.stack ?? [])]
  if (stack.length + 1 > STACK_MAX) return items
  // yan yana duran iki yarım kart yığılınca yığın tam genişliğe geçer (boşluk kalmasın)
  const da = cardDef(a.id)!
  const half = (x: LayoutItem) => (x.size ?? cardDef(x.id)?.size) === 'half'
  const size = half(a) && half(b) && da.sizes.includes('full') ? 'full' : a.size
  const next = items.slice()
  next.splice(i, 2, { ...a, size, stack })
  return next
}

/** Yığındaki kartı ayırır: yığının hemen arkasına tek kart olarak gelir. */
export function unstack<T extends LayoutItem>(items: T[], parent: string, child: string): T[] {
  const i = items.findIndex((x) => x.id === parent)
  const a = items[i]
  if (!a?.stack?.includes(child)) return items
  const next = items.slice()
  const rest = a.stack.filter((x) => x !== child)
  next.splice(i, 1, { ...a, stack: rest.length ? rest : undefined }, { id: child, size: cardDef(child)?.size } as T)
  return next
}

export function addItem(items: LayoutItem[], id: string, at?: number): LayoutItem[] {
  const def = cardDef(id)
  if (!def || items.some((i) => i.id === id) || stackedIds(items).has(id)) return items
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
export function normalizeScreen(screen: ScreenId, items: LayoutItem[], ctx: LayoutCtx = {}, userCards?: Design['userCards']): ScreenLayout {
  // Ö5a: kendi kartlarım yalnız tanımı varsa kalır (tanımlar kullanıcının tasarımından gelir)
  const r = resolveScreen({ v: REGISTRY_VERSION, screens: { [screen]: { items } }, ...(userCards ? { userCards } : {}) }, screen, ctx)
  const kept = r.items.map((i) => ({ id: i.id, ...(i.size !== i.def.size ? { size: i.size } : {}), ...(i.stack?.length ? { stack: i.stack } : {}) }))
  const ids = new Set(kept.flatMap((i) => [i.id, ...(i.stack ?? [])]))
  return { items: kept, removed: cardsFor(screen).filter((c) => isDefault(c, ctx) && !ids.has(c.id)).map((c) => c.id) }
}
