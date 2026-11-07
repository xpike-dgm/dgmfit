'use client'
// Özelleştirme (Ö1): kart panosu. Normal modda kartları düzene göre dizer; düzenleme modunda (?duzenle=1)
// basılı tutup sürükleme, − ile kaldırma, ✎ ile kart ayarları, çekmeceden ekleme, geri alma ve kaydetme sunar.
// Kart içerikleri sunucuda çizilir ve `nodes` ile gelir; bu bileşen yalnızca yerleşimi yönetir (yeni kart = kayıt + çizici).
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { cardDef, SCREENS, type CardSize, type ScreenId } from '@/lib/cards/registry'
import { STACK_MAX, addItem, moveItem, removeItem, setSize, stackWithNext, unstack, type LayoutItem } from '@/lib/cards/layout'
import { hideTodayAction, pinCardAction, resetLayoutAction, saveLayoutAction } from '@/app/(app)/profil/ozellestirme/actions'
import { canHideToday, canPin } from '@/lib/cards/prefs'
import { cardVars, type CardColors } from '@/lib/cards/colors'
import CardStudio from './CardStudio'
import { isUserCard as isUserCardId } from '@/lib/cards/custom'
import { trackTap, trackView } from './usage-tracker'

/** Ö2a: kartın renk değişkenleri (sarmalayıcıya yayılır). */
const ccAttrs = (c: CardColors | undefined): { style?: Record<string, string>; 'data-cc'?: string } => { const v = cardVars(c); return v ? { style: v.style, 'data-cc': v.slots } : {} }
import Sheet from '@/components/Sheet'
import Link from 'next/link'
import { useDesignPrefs } from './DesignPrefs'

type Item = { id: string; size: CardSize; stack?: string[] }
interface Props {
  screen: ScreenId
  items: Item[]
  nodes: Record<string, ReactNode>
  drawer: { id: string; reason: 'removed' | 'new' | 'available' }[]
  editing: boolean
  notices?: string[]
  /** Ö1b-2: şu an uygulanan kuralların adları (düzen geçici olarak değişti) */
  applied?: string[]
  /** Ö1b-3: kart başına seçili hızlı eylem */
  quick?: Record<string, string>
  /** Ö1b-3: üste sabitlenen kartlar */
  pinned?: string[]
  /** Ö2a: kart renkleri */
  colors?: Record<string, CardColors>
  /** Ö3c: sabit başlığın hemen altına konan kart dışı içerik (duyuru) */
  afterHeader?: ReactNode
  /** Ö5b: düzeni değiştiren odak modu (ör. 'Hastalık modu') */
  mode?: string | null
  /** Ö5a: kendi kartlarımın adları (kayıttaki genel ad yerine) */
  titles?: Record<string, string>
}

const TitleCtx = createContext<Record<string, string>>({})
/** Kart tanımı; kendi kartlarımda başlık kullanıcının verdiği ad. */
function useDefOf() {
  const t = useContext(TitleCtx)
  return (id: string) => { const d = cardDef(id); return d && t[id] ? { ...d, title: t[id] } : d }
}

const HOLD_MS = 350
const SLOP = 8

export default function CardBoard(p: Props) {
  return <TitleCtx.Provider value={p.titles ?? {}}>{p.editing ? <Editor {...p} /> : <Board {...p} />}</TitleCtx.Provider>
}

const HOLD_EDIT_MS = 600
/** Basılı tutulunca düzenlemeye geçmeyecek öğeler (dokunulabilir içerik). */
const INTERACTIVE = 'a,button,input,select,textarea,label,summary,details,[role=button],[role=slider],[role=dialog],[contenteditable],[data-no-hold]'

const SW = 168 // açık kartta görünen eylem alanı genişliği

/** Ö1b-4: kart yığını — kartlar aynı yerde yana kaydırılarak (scroll-snap) gezilir; noktalar hangi kartta olunduğunu gösterir. */
function StackCard({ id, size, ids, nodes, colors }: { id: string; size: CardSize; ids: string[]; nodes: Record<string, ReactNode>; colors?: Record<string, CardColors> }) {
  const defOf = useDefOf()
  const ref = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const go = (i: number) => { const el = ref.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }) }
  return (
    <div className={`${size === 'full' ? 'col-span-2' : ''} min-w-0 flex flex-col gap-1.5`} data-card={id} data-stack={ids.length} role="group" aria-roledescription="kart yığını" aria-label={`${defOf(id)?.title} ve ${ids.length - 1} kart daha`}>
      <div ref={ref} onScroll={(e) => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))) }}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-[24px]">
        {ids.map((cid, i) => (
          <div key={cid} className="w-full shrink-0 snap-start flex flex-col [&>*]:flex-1" data-stack-card={cid} aria-hidden={i !== at} inert={i !== at ? true : undefined} {...ccAttrs(colors?.[cid])}>{nodes[cid]}</div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5" role="tablist" aria-label="Yığındaki kartlar">
        {ids.map((cid, i) => (
          <button key={cid} type="button" role="tab" aria-selected={i === at} aria-label={defOf(cid)?.title} onClick={() => go(i)} data-testid="stack-dot"
            className="w-6 h-6 flex items-center justify-center"><span className={`block rounded-full transition-all ${i === at ? 'w-4 h-1.5 bg-acc' : 'w-1.5 h-1.5 bg-line-2'}`} /></button>
        ))}
      </div>
    </div>
  )
}

/** Bir öğenin atası yatay kaydırılabiliyor mu (içerikteki yatay şeritlerde kart kaydırması devreye girmesin). */
function inHScroll(el: HTMLElement | null, stop: HTMLElement) {
  for (let n = el; n && n !== stop; n = n.parentElement) {
    const ox = getComputedStyle(n).overflowX
    if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true
  }
  return false
}

/**
 * Ö1b-3: sola kaydırılınca "Bugünlük gizle" ve "Üste sabitle" eylemlerini açan kart sarmalayıcı. Dokunmatikte
 * touch olayları (dikey kaydırma tarayıcıda kalır, yatay kilitlenince sayfa kaymaz), farede işaretçi olayları kullanılır.
 */
function SwipeCard({ id, size, pinned, open, onOpen, onAct, colors, children }: { id: string; size: CardSize; pinned: boolean; open: boolean; onOpen: (o: boolean) => void; onAct: (k: 'hide' | 'pin') => void; colors?: CardColors; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [dx, setDx] = useState(0)
  const [drag, setDrag] = useState(false)
  const g = useRef<{ x: number; y: number; base: number; axis: 'x' | 'y' | null } | null>(null)
  const swallow = useRef(0)
  const openRef = useRef(open); openRef.current = open
  useEffect(() => { if (!g.current) setDx(open ? -SW : 0) }, [open])
  const begin = (x: number, y: number, t: EventTarget | null) => {
    const el = t as HTMLElement
    if (el.closest('input,select,textarea,[role=slider],[data-no-swipe],[data-swipe-act]') || inHScroll(el, ref.current!)) return false
    g.current = { x, y, base: openRef.current ? -SW : 0, axis: null }
    return true
  }
  const moveTo = (x: number, y: number) => {
    const s = g.current
    if (!s) return false
    const ddx = x - s.x, ddy = y - s.y
    if (!s.axis && Math.hypot(ddx, ddy) > 8) s.axis = Math.abs(ddx) > Math.abs(ddy) * 1.2 ? 'x' : 'y'
    if (s.axis !== 'x') return false
    setDrag(true)
    setDx(Math.max(-SW - 36, Math.min(0, s.base + ddx)))
    return true
  }
  const finish = () => {
    const s = g.current
    g.current = null
    setDrag(false)
    if (!s || s.axis !== 'x') return
    swallow.current = Date.now()
    setDx((v) => { const o = v < -SW / 2; onOpen(o); return o ? -SW : 0 })
  }
  useEffect(() => {
    const el = ref.current!
    const ts = (e: TouchEvent) => { if (e.touches.length === 1) begin(e.touches[0].clientX, e.touches[0].clientY, e.target) }
    const tm = (e: TouchEvent) => { if (g.current && moveTo(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault() }
    const te = () => finish()
    el.addEventListener('touchstart', ts, { passive: true })
    el.addEventListener('touchmove', tm, { passive: false })
    el.addEventListener('touchend', te); el.addEventListener('touchcancel', te)
    return () => { el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); el.removeEventListener('touchcancel', te) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const mouseDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !begin(e.clientX, e.clientY, e.target)) return
    const mv = (ev: PointerEvent) => { moveTo(ev.clientX, ev.clientY) }
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); finish() }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }
  const shown = dx < -4
  return (
    <div ref={ref} className={`${size === 'full' ? 'col-span-2' : ''} relative min-w-0 flex flex-col`} data-card={id} data-swiped={open ? '' : undefined}
      onPointerDown={mouseDown} onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest('[data-swipe-act]')) return
        // kaydırmanın sonundaki tıklama yutulur (bağlantı açılmaz); açık kartta dokunuş kartı kapatır
        if (Date.now() - swallow.current < 350) { e.preventDefault(); e.stopPropagation(); return }
        if (open) { e.preventDefault(); e.stopPropagation(); onOpen(false) }
      }}>
      {shown ? (
        <div className="absolute inset-y-0 right-0 flex gap-2 items-stretch py-1" style={{ width: SW }} data-swipe-act>
          {canHideToday(id) ? <button type="button" onClick={() => onAct('hide')} data-testid="swipe-hide" className="flex-1 rounded-[20px] bg-surface-3 text-ink text-[12.5px] font-extrabold flex flex-col items-center justify-center gap-1 px-1 text-center leading-tight">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M3 3l18 18M10.6 6.1A10 10 0 0122 12a17 17 0 01-3 3.7M6.6 6.6A17 17 0 002 12s3.6 7 10 7a9.6 9.6 0 004.4-1.1" /></svg>Bugünlük gizle</button> : null}
          {canPin(id) ? <button type="button" onClick={() => onAct('pin')} data-testid="swipe-pin" className="flex-1 rounded-[20px] bg-acc text-acc-ink text-[12.5px] font-extrabold flex flex-col items-center justify-center gap-1 px-1 text-center leading-tight">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z" /></svg>{pinned ? 'Sabiti kaldır' : 'Üste sabitle'}</button> : null}
        </div>
      ) : null}
      {(() => { const cc = ccAttrs(colors); return <div className={`relative flex-1 flex flex-col [&>*]:flex-1 ${drag ? '' : 'transition-transform duration-200'}`} data-cc={cc['data-cc']} style={{ ...cc.style, ...(dx ? { transform: `translateX(${dx}px)` } : {}) }}>{children}</div> })()}
    </div>
  )
}

/** Normal görünüm: kartlar + (açıksa) kart dışı/etkileşimsiz bir yere basılı tutunca "Ekranı düzenle" balonu. */
function Board(p: Props) {
  const defOf = useDefOf()
  const router = useRouter()
  const { holdToEdit } = useDesignPrefs()
  const [pop, setPop] = useState<{ x: number; y: number } | null>(null)
  const t = useRef<{ timer: number; x: number; y: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const cancel = () => { if (t.current) { clearTimeout(t.current.timer); t.current = null } }
  useEffect(() => cancel, [])
  useEffect(() => {
    if (!pop) return
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('[data-hold-pop]')) setPop(null) }
    const t2 = setTimeout(() => window.addEventListener('pointerdown', close), 0)
    const onScroll = () => setPop(null)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { clearTimeout(t2); window.removeEventListener('pointerdown', close); window.removeEventListener('scroll', onScroll) }
  }, [pop])
  const down = (e: React.PointerEvent) => {
    if (!holdToEdit || e.button > 0 || (e.target as HTMLElement).closest(INTERACTIVE)) return
    const r = box.current!.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    cancel()
    t.current = { x: e.clientX, y: e.clientY, timer: window.setTimeout(() => {
      t.current = null
      window.getSelection()?.removeAllRanges()
      navigator.vibrate?.(12)
      setPop({ x: Math.max(70, Math.min(r.width - 70, x)), y })
    }, HOLD_EDIT_MS) }
  }
  const move = (e: React.PointerEvent) => { if (t.current && Math.hypot(e.clientX - t.current.x, e.clientY - t.current.y) > 10) cancel() }
  const applied = p.applied?.length ? p.applied : null
  // Ö4: kullanım ölçümü — her kart sayfa başına bir kez "görüldü"; içindeki dokunuşlar "dokunma"
  useEffect(() => {
    const root = box.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const seen = new Set<string>()
    const io = new IntersectionObserver((es) => { for (const e of es) { const id = (e.target as HTMLElement).dataset.card; if (e.isIntersecting && id && !seen.has(id)) { seen.add(id); trackView(id) } } }, { threshold: 0.5 })
    root.querySelectorAll<HTMLElement>('[data-card]').forEach((el) => io.observe(el))
    const onClick = (ev: MouseEvent) => { const id = (ev.target as HTMLElement).closest<HTMLElement>('[data-card]')?.dataset.card; if (id && (ev.target as HTMLElement).closest('a,button')) trackTap(id) }
    root.addEventListener('click', onClick, true)
    return () => { io.disconnect(); root.removeEventListener('click', onClick, true) }
  }, [p.items])
  // Ö1b-3: kaydırma hareketleri — bir anda tek kart açık; gizleme iyimser, "Geri al" ile döner
  const [openId, setOpenId] = useState<string | null>(null)
  const [gone, setGone] = useState<string[]>([])
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null)
  useEffect(() => { if (!toast) return; const t2 = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t2) }, [toast])
  useEffect(() => { setGone([]) }, [p.items])
  const act = (id: string, kind: 'hide' | 'pin') => {
    setOpenId(null)
    const title = defOf(id)?.title ?? 'Kart'
    if (kind === 'hide') {
      setGone((g) => [...g, id])
      void hideTodayAction(id, true).then((r) => {
        if (!r.ok) { setGone((g) => g.filter((x) => x !== id)); setToast({ text: r.error }); return }
        setToast({ text: `${title} bugünlük gizlendi`, undo: () => { setToast(null); setGone((g) => g.filter((x) => x !== id)); void hideTodayAction(id, false).then(() => router.refresh()) } })
        router.refresh()
      })
    } else {
      const on = !(p.pinned ?? []).includes(id)
      void pinCardAction(id, on).then((r) => {
        setToast({ text: !r.ok ? r.error : on ? `${title} üste sabitlendi` : `${title} sabitlemesi kaldırıldı`, undo: r.ok ? () => { setToast(null); void pinCardAction(id, !on).then(() => router.refresh()) } : undefined })
        router.refresh()
      })
    }
  }
  return (
    <div ref={box} className="relative flex flex-col gap-3" onPointerDown={down} onPointerMove={move} onPointerUp={cancel} onPointerCancel={cancel}
      onContextMenu={(e) => { if (pop || t.current) e.preventDefault() }}>
      <div className="grid grid-cols-2 gap-3" data-testid="card-board">
        {p.items.flatMap((it, i) => [it, ...(i === 0 && p.afterHeader ? [{ id: '__after', size: 'full' as CardSize }] : [])]).map((it) => it.id === '__after' ? <div key="__after" className="col-span-2">{p.afterHeader}</div> : p.nodes[it.id] && !gone.includes(it.id) ? (
          it.stack?.some((sid) => p.nodes[sid]) ? (
            <StackCard key={it.id} id={it.id} size={it.size} ids={[it.id, ...it.stack.filter((sid) => p.nodes[sid])]} nodes={p.nodes} colors={p.colors} />
          ) : canHideToday(it.id) || canPin(it.id) ? (
            <SwipeCard key={it.id} id={it.id} size={it.size} pinned={(p.pinned ?? []).includes(it.id)} open={openId === it.id}
              onOpen={(o) => setOpenId(o ? it.id : null)} onAct={(k) => act(it.id, k)} colors={p.colors?.[it.id]}>{p.nodes[it.id]}</SwipeCard>
          ) : <div key={it.id} className={`${it.size === 'full' ? 'col-span-2' : ''} min-w-0 flex flex-col [&>*]:flex-1`} data-card={it.id} {...ccAttrs(p.colors?.[it.id])}>{p.nodes[it.id]}</div>
        ) : null)}
      </div>
      {toast ? (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-[96px] z-40 max-w-[calc(100%-32px)] w-max flex items-center gap-3 pl-4 pr-2 h-12 rounded-full bg-ink text-bg shadow-lg text-[13.5px] font-bold" data-testid="swipe-toast">
          <span className="truncate">{toast.text}</span>
          {toast.undo ? <button type="button" onClick={toast.undo} className="h-9 px-3 rounded-full bg-bg/15 font-extrabold shrink-0" data-testid="swipe-undo">Geri al</button> : null}
        </div>
      ) : null}
      {p.mode ? <Link href="/profil/ozellestirme/modlar" className="self-center inline-flex items-center h-8 px-3 rounded-full bg-surface-2 border border-line text-[12px] font-bold text-mute" data-testid="mode-applied">Mod: {p.mode}</Link> : null}
      {applied ? (
        <Link href="/profil/ozellestirme/kurallar" className="self-center inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-surface-2 border border-line text-[12px] font-bold text-mute" data-testid="rule-applied">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h11M4 12h7M4 17h11M17 10l3 3-3 3" /></svg>
          Kural: {applied.join(', ')}
        </Link>
      ) : null}
      {pop ? (
        <div data-hold-pop className="absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+10px)] animate-[fadeUp_.15s_ease-out]" style={{ left: pop.x, top: pop.y }}>
          <button type="button" onClick={() => { setPop(null); router.push(SCREENS[p.screen].path + '?duzenle=1') }} data-testid="hold-edit"
            className="h-11 px-4 rounded-full bg-ink text-bg text-[14px] font-extrabold shadow-lg inline-flex items-center gap-2 whitespace-nowrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
            Ekranı düzenle
          </button>
        </div>
      ) : null}
    </div>
  )
}

const MODULE_NAME: Record<string, string> = { today: 'Bugün', plan: 'Fit', water: 'Su', food: 'Yemek', fitness: 'Fitness', social: 'Sosyal', coach: 'Koç', profile: 'Profil' }
/** Çekmecedeki küçük görsel (tasarım: modül renginde soyut kart çizimi). */
function Thumb({ id }: { id: string }) {
  const n = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 3
  return (
    <span className="w-[72px] h-[52px] shrink-0 rounded-[12px] border border-[color-mix(in_oklab,var(--color-acc)_25%,var(--color-line))] bg-[color-mix(in_oklab,var(--color-acc)_12%,var(--color-surface))] flex items-center justify-center p-2" aria-hidden>
      {n === 0 ? <span className="w-full flex flex-col gap-1"><span className="h-1.5 w-2/3 rounded-full bg-acc" /><span className="h-1 w-full rounded-full bg-acc/40" /><span className="h-1 w-4/5 rounded-full bg-acc/40" /></span>
        : n === 1 ? <span className="w-full h-full flex items-end gap-1">{[45, 70, 55, 90].map((h, i) => <span key={i} className="flex-1 rounded-t-[3px] bg-acc" style={{ height: `${h}%` }} />)}</span>
        : <span className="w-7 h-7 rounded-full" style={{ background: 'conic-gradient(var(--color-acc) 0 70%, color-mix(in oklab, var(--color-acc) 25%, transparent) 70% 100%)', WebkitMask: 'radial-gradient(circle, transparent 52%, #000 53%)', mask: 'radial-gradient(circle, transparent 52%, #000 53%)' }} />}
    </span>
  )
}

function Editor(p: Props) {
  const defOf = useDefOf()
  const router = useRouter()
  const left = useDesignPrefs().hand === 'left'
  const [items, setItems] = useState<Item[]>(p.items)
  const [history, setHistory] = useState<Item[][]>([])
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; dx: number; dy: number; w: number; h: number } | null>(null)
  const [studio, setStudio] = useState<{ id: string; tab: 'color' | 'layout' } | null>(null)
  const [pickColor, setPickColor] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'removed' | 'all' | 'mine'>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(p.notices?.length ? p.notices.join(' ') : null)
  const [flash, setFlash] = useState<string | null>(null)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const rects = useRef(new Map<string, DOMRect>())
  const hold = useRef<{ timer: number; x: number; y: number; id: string; el: HTMLElement } | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const dragRef = useRef(drag)
  dragRef.current = drag
  const [quick, setQuick] = useState<Record<string, string>>(p.quick ?? {})
  const [pins, setPins] = useState<string[]>(p.pinned ?? [])
  const [colors, setColors] = useState<Record<string, CardColors>>(p.colors ?? {})
  const colorsChanged = JSON.stringify(colors) !== JSON.stringify(p.colors ?? {})
  const changed = JSON.stringify(items) !== JSON.stringify(p.items) || JSON.stringify(quick) !== JSON.stringify(p.quick ?? {}) || colorsChanged
  const path = SCREENS[p.screen].path

  const commit = useCallback((next: Item[]) => {
    if (next === itemsRef.current) return
    setHistory((h) => [...h.slice(-30), itemsRef.current])
    setItems(next)
  }, [])

  // alt menü düzenlemede gizlenir (kaydedilmemiş değişiklikle sayfadan çıkılmasın)
  useEffect(() => {
    document.documentElement.dataset.editing = '1'
    return () => { delete document.documentElement.dataset.editing }
  }, [])

  // çekmeceden sürüklerken pencere görünmez olur (açık kalır: dokunulan öğe DOM'da kalmalı, yoksa dokunma olayları kopar)
  useEffect(() => {
    if (drag) document.documentElement.dataset.dragging = '1'
    else delete document.documentElement.dataset.dragging
  }, [drag !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  // FLIP: sıra değişince kartlar kayarak yerine geçer
  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    for (const [id, el] of refs.current) {
      const now = el.getBoundingClientRect()
      const old = rects.current.get(id)
      if (old && !reduce && (old.left !== now.left || old.top !== now.top) && id !== dragRef.current?.id) {
        el.animate([{ transform: `translate(${old.left - now.left}px, ${old.top - now.top}px)` }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' })
      }
      rects.current.set(id, now)
    }
  })

  // sürükleme sırasında: işaretçiyi izle, altındaki kartın yerine taşı, kenarlarda kaydır
  useEffect(() => {
    if (!drag) return
    let raf = 0
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      setDrag({ ...d, x: e.clientX, y: e.clientY })
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const list = itemsRef.current
        const from = list.findIndex((i) => i.id === d.id)
        for (let i = 0; i < list.length; i++) {
          const el = refs.current.get(list[i].id)
          if (!el || list[i].id === d.id) continue
          const r = el.getBoundingClientRect()
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            const next = moveItem(list, from, i)
            if (next !== list) setItems(next)
            break
          }
        }
        if (e.clientY < 90) window.scrollBy(0, -12)
        else if (e.clientY > window.innerHeight - 90) window.scrollBy(0, 12)
      })
    }
    const onUp = () => {
      cancelAnimationFrame(raf)
      setDrag(null)
      setDrawerOpen(false)
    }
    const stopTouch = (e: TouchEvent) => e.preventDefault() // sürüklerken sayfa kaymasın
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('touchmove', stopTouch, { passive: false })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('touchmove', stopTouch)
    }
  }, [drag !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  const startHold = (e: React.PointerEvent, id: string, fromDrawer = false) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-card-btn]')) return
    if (!fromDrawer && defOf(id)?.locked === 'top') return
    const el = e.currentTarget as HTMLElement
    const x = e.clientX, y = e.clientY
    const timer = window.setTimeout(() => {
      hold.current = null
      navigator.vibrate?.(12)
      setHistory((h) => [...h.slice(-30), itemsRef.current])
      if (fromDrawer) {
        // çekmeceden: işaretçinin altındaki karta göre yerleştir, sonra sürüklemeye devam
        let at = itemsRef.current.length
        itemsRef.current.forEach((it, i) => { const r = refs.current.get(it.id)?.getBoundingClientRect(); if (r && y < r.top + r.height / 2 && at === itemsRef.current.length) at = i })
        setItems(addItem(itemsRef.current, id, at) as Item[])
        setDrag({ id, x, y, dx: 150, dy: 40, w: 300, h: 88 })
        return
      }
      const r = el.getBoundingClientRect()
      setDrag({ id, x, y, dx: x - r.left, dy: y - r.top, w: r.width, h: r.height })
    }, HOLD_MS)
    hold.current = { timer, x, y, id, el }
  }
  const moveHold = (e: React.PointerEvent) => {
    const h = hold.current
    if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > SLOP) { clearTimeout(h.timer); hold.current = null }
  }
  const endHold = () => { if (hold.current) { clearTimeout(hold.current.timer); hold.current = null } }

  const undo = () => setHistory((h) => { if (!h.length) return h; setItems(h[h.length - 1]); return h.slice(0, -1) })
  const remove = (id: string) => { commit(removeItem(items, id)); setMsg(`${defOf(id)?.title} kaldırıldı · çekmeceden geri ekleyebilirsin`) }
  const add = (id: string) => {
    commit(addItem(items, id) as Item[])
    setDrawerOpen(false); setFlash(id)
    window.setTimeout(() => refs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
    window.setTimeout(() => setFlash(null), 1400)
  }
  const step = (id: string, by: number) => { const i = items.findIndex((x) => x.id === id); commit(moveItem(items, i, i + by)) }

  const done = async () => {
    setBusy(true)
    const settings: Record<string, { quick?: string; colors?: CardColors | null }> = Object.fromEntries(Object.entries(quick).filter(([id, q]) => (p.quick ?? {})[id] !== q).map(([id, q]) => [id, { quick: q }]))
    // renk değişen kartlar (temizlenen = null)
    for (const id of new Set([...Object.keys(colors), ...Object.keys(p.colors ?? {})])) {
      if (JSON.stringify(colors[id] ?? {}) === JSON.stringify(p.colors?.[id] ?? {})) continue
      settings[id] = { ...settings[id], colors: colors[id] && Object.keys(colors[id]).length ? colors[id] : null }
    }
    const r = await saveLayoutAction(p.screen, items.map((i): LayoutItem => ({ id: i.id, size: i.size, ...(i.stack?.length ? { stack: i.stack } : {}) })), settings)
    setBusy(false)
    if (!r.ok) { setMsg(r.error); return }
    router.replace(path); router.refresh()
  }
  const cancel = () => { if (!changed || confirm('Değişiklikler kaydedilmeden çıkılsın mı?')) router.replace(path) }
  const reset = async () => {
    if (!confirm('Bu ekran varsayılan düzene dönsün mü?')) return
    setBusy(true); await resetLayoutAction(p.screen); setBusy(false)
    router.replace(path); router.refresh()
  }

  const inDrawer = p.drawer.filter((d) => !items.some((i) => i.id === d.id))
    .concat(p.items.filter((i) => !items.some((x) => x.id === i.id)).map((i) => ({ id: i.id, reason: 'removed' as const })))
    .filter((d, i, a) => a.findIndex((x) => x.id === d.id) === i)

  const studioDef = studio ? defOf(studio.id) : null
  const studioIdx = studio ? items.findIndex((i) => i.id === studio.id) : -1
  const openStudio = (id: string, tab: 'color' | 'layout') => { setPickColor(false); setStudio({ id, tab }) }
  const q = search.trim().toLocaleLowerCase('tr')
  const match = (id: string) => { const d = defOf(id); return !q || `${d?.title} ${d?.desc}`.toLocaleLowerCase('tr').includes(q) }
  const removedList = inDrawer.filter((d) => d.reason === 'removed' && match(d.id))
  const otherList = inDrawer.filter((d) => d.reason !== 'removed' && match(d.id))
  const shownRemoved = filter === 'mine' ? removedList.filter((d) => isUserCardId(d.id)) : filter === 'all' || filter === 'removed' ? removedList : []
  const shownOther = filter === 'mine' ? otherList.filter((d) => isUserCardId(d.id)) : filter === 'all' ? otherList : []
  const drawerRow = (d: { id: string; reason: 'removed' | 'new' | 'available' }) => {
    const def = defOf(d.id)!
    return (
      <div key={d.id} role="button" tabIndex={0} aria-label={`${def.title} ekle`} data-mod={def.module}
        onClick={() => add(d.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); add(d.id) } }}
        onPointerDown={(e) => startHold(e, d.id, true)} onPointerMove={moveHold} onPointerUp={endHold} onPointerCancel={endHold} onContextMenu={(e) => e.preventDefault()}
        className={`flex items-center gap-3 p-2.5 rounded-[18px] bg-surface-2 select-none touch-pan-y cursor-pointer text-left ${d.reason === 'new' ? 'border border-acc' : 'border border-transparent'}`} data-drawer-card={d.id}>
        <Thumb id={d.id} />
        <span className="flex flex-col gap-0.5 flex-1 min-w-0">
          <b className="text-[14.5px] font-extrabold flex items-center gap-1.5 min-w-0"><span className="truncate">{def.title}</span>{d.reason === 'new' ? <span className="text-[10.5px] font-extrabold px-1.5 rounded-full bg-acc text-acc-ink shrink-0">YENİ</span> : null}</b>
          <span className="text-[12px] text-mute leading-snug line-clamp-2">{MODULE_NAME[def.module] ?? ''}{d.reason === 'removed' ? ' · kaldırdığın kart' : def.desc ? ` · ${def.desc}` : ''}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-mute shrink-0" aria-hidden><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
      </div>
    )
  }
  const tb = 'min-h-10 px-3.5 rounded-full bg-surface-2 border border-line-2 text-[13px] font-bold inline-flex items-center gap-1.5 shrink-0 disabled:opacity-40'

  return (
    <div className="flex flex-col gap-3" data-testid="card-editor" data-mod="today">
      <div className="sticky top-0 z-40 -mx-4 bg-surface border-b border-line">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <button type="button" onClick={cancel} className="min-h-11 px-3 text-[14px] font-bold text-mute">Vazgeç</button>
          <span className="flex flex-col items-center leading-tight"><b className="text-[15px] font-extrabold">{SCREENS[p.screen].title}</b><span className="text-[11.5px] font-bold text-acc">Düzenleniyor</span></span>
          <button type="button" onClick={done} disabled={busy} className="min-h-11 px-[18px] rounded-full bg-acc text-acc-ink font-extrabold text-[14px] disabled:opacity-50" data-testid="edit-done">{busy ? '…' : 'Bitti'}</button>
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 py-2.5 border-t border-line [scrollbar-width:none]">
          <button type="button" onClick={undo} disabled={!history.length} className={tb} data-testid="edit-undo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></svg>Geri al
          </button>
          <button type="button" onClick={() => setDrawerOpen(true)} className={tb} data-testid="open-drawer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>Kart ekle {inDrawer.length ? <span className="num text-[11px] px-[7px] py-px rounded-full bg-acc text-acc-ink">{inDrawer.length}</span> : null}
          </button>
          <button type="button" onClick={() => { setPickColor((v) => !v); setMsg(null) }} aria-pressed={pickColor} className={`${tb} aria-pressed:border-acc`} data-testid="edit-color">
            <span className="w-3.5 h-3.5 rounded-full" style={{ background: 'conic-gradient(#B6E35E, #6CC7FF, #A9A4FF, #FFA06B, #B6E35E)' }} aria-hidden />Renk
          </button>
        </div>
      </div>
      <p className="text-[12.5px] text-mute text-center" role="status">{msg ?? (pickColor ? 'Rengini değiştirmek istediğin karta dokun' : 'Taşımak için kartı basılı tut ve sürükle')}</p>

      <div className="grid grid-cols-2 gap-3 select-none [-webkit-touch-callout:none] pt-1">
        {items.map((it, idx) => {
          const def = defOf(it.id)!
          const dragging = drag?.id === it.id
          const node = p.nodes[it.id]
          return (
            <div key={it.id} ref={(el) => { if (el) refs.current.set(it.id, el); else refs.current.delete(it.id) }}
              role="group" aria-label={def.title} data-edit-card={it.id} data-index={idx}
              onPointerDown={(e) => startHold(e, it.id)} onPointerMove={moveHold} onPointerUp={endHold} onPointerCancel={endHold} onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => { if (pickColor && !(e.target as HTMLElement).closest('[data-card-btn]')) openStudio(it.id, 'color') }}
              className={`relative min-w-0 rounded-[24px] touch-pan-y ${it.size === 'full' ? 'col-span-2' : ''} ${flash === it.id ? 'ring-2 ring-acc ring-offset-2 ring-offset-bg' : ''} ${pickColor && def.colorSlots ? 'outline-2 outline-dashed outline-acc/60 outline-offset-2 cursor-pointer' : ''}`}>
              <div className={`h-full rounded-[24px] flex flex-col ${dragging ? 'opacity-0' : def.locked === 'top' ? '' : 'card-wiggle'}`} style={{ animationDelay: `${(idx % 3) * 90}ms` }}>
                <div className="pointer-events-none flex-1 flex flex-col [&>*]:flex-1" aria-hidden {...ccAttrs(colors[it.id])}>
                  {node ?? <div className="rounded-[20px] border-2 border-dashed border-line-2 px-4 py-3 flex flex-col justify-center gap-0.5 min-h-[64px]" data-testid="card-placeholder"><b className="text-[13px]">{def.title}</b><span className="text-[12px] text-mute leading-snug">{def.conditional ?? def.desc}</span></div>}
                </div>
              </div>
              {dragging ? <div className="absolute inset-0 rounded-[20px] border-2 border-dashed border-water bg-water/5 flex items-center justify-center text-[12px] font-bold text-water" aria-hidden>Buraya bırak</div> : null}
              {!dragging && (pins.includes(def.id) || it.stack?.length) ? (
                <div className={`absolute -top-2 flex gap-1 z-10 ${left ? 'right-3' : 'left-3'}`} aria-hidden>
                  {pins.includes(def.id) ? <span className="text-[10.5px] font-extrabold px-1.5 py-0.5 rounded-full bg-surface-3 text-ink-2 shadow">SABİT</span> : null}
                  {it.stack?.length ? <span className="text-[10.5px] font-extrabold px-1.5 py-0.5 rounded-full bg-acc text-acc-ink shadow" data-testid="stack-badge">+{it.stack.length} YIĞIN</span> : null}
                </div>
              ) : null}
              {!dragging ? (
                <div className={`absolute -top-2.5 flex gap-1.5 z-10 ${left ? '-left-1.5' : '-right-1.5'}`} data-card-ctl>
                  <button type="button" data-card-btn aria-label={`${def.title} kartını düzenle`} onClick={() => openStudio(it.id, def.colorSlots ? 'color' : 'layout')}
                    className="w-8 h-8 rounded-full bg-ink text-bg shadow-[0_2px_8px_rgba(0,0,0,.4)] flex items-center justify-center hit">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                  </button>
                  {def.locked ? (
                    <span className="w-8 h-8 rounded-full bg-surface-3 text-mute flex items-center justify-center shadow" title="Bu kart kaldırılamaz" aria-label={`${def.title} kaldırılamaz`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                    </span>
                  ) : (
                    <button type="button" data-card-btn aria-label={`${def.title} kartını kaldır`} onClick={() => remove(it.id)} data-testid="card-remove"
                      className="w-8 h-8 rounded-full bg-[#E5484D] text-white shadow-[0_2px_8px_rgba(0,0,0,.4)] flex items-center justify-center hit">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      <button type="button" onClick={reset} disabled={busy} className="self-center min-h-11 px-4 text-[13px] font-bold text-mute" data-testid="edit-reset">Bu ekranı varsayılana döndür</button>

      {drag ? (
        <div className="fixed z-50 pointer-events-none" aria-hidden
          style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w, transform: 'rotate(-2deg) scale(1.04)', filter: 'drop-shadow(0 18px 30px rgba(0,0,0,.45))' }}>
          <div className="flex flex-col [&>*]:flex-1 rounded-[20px] ring-1 ring-water">{p.nodes[drag.id] ?? <div className="card p-4"><b>{defOf(drag.id)?.title}</b></div>}</div>
        </div>
      ) : null}

      <div>
        <Sheet open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Kart ekle">
          <div className="flex flex-col gap-2.5 pb-4" data-testid="card-drawer">
            <label className="relative">
              <span className="sr-only">Kart ara</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kart ara" className="w-full h-12 rounded-[14px] bg-surface-2 border border-line pl-10 pr-3 text-[15px]" data-testid="drawer-search" />
            </label>
            <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]" role="radiogroup" aria-label="Kartlar">
              {([['removed', `Kaldırdıkların${removedList.length ? ` ${removedList.length}` : ''}`], ['all', 'Tüm kartlar'], ['mine', 'Kendi kartlarım']] as const).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)}
                  className="h-9 px-3 rounded-full border border-line-2 text-[13px] font-bold shrink-0 aria-checked:bg-ink aria-checked:text-bg aria-checked:border-ink">{l}</button>
              ))}
            </div>
            {!shownRemoved.length && !shownOther.length ? <p className="text-[14px] text-mute py-5 text-center">{filter === 'mine' ? 'Bu ekran için çekmecede kendi kartın yok. Kart oluşturucuda yapabilirsin.' : q ? 'Bu aramada kart yok.' : filter === 'removed' ? 'Kaldırdığın kart yok.' : 'Bu ekrandaki bütün kartlar zaten yerinde.'}</p> : null}
            {shownRemoved.map(drawerRow)}
            {shownOther.length ? <span className="text-[12px] font-bold tracking-[0.06em] uppercase text-mute pt-2">Henüz eklemediklerin</span> : null}
            {shownOther.map(drawerRow)}
            <p className="text-[12px] text-mute text-center pt-1">Kartı basılı tutup yukarı sürükle ya da dokun: en alta eklenir.</p>
          </div>
        </Sheet>
      </div>

      {studio && studioDef ? (
        <CardStudio key={studio.id} def={studioDef} node={p.nodes[studio.id] ?? <div className="card p-4 flex flex-col gap-1"><b>{studioDef.title}</b><span className="text-mute text-[13px]">{studioDef.conditional ?? studioDef.desc}</span></div>}
          size={items[studioIdx]?.size ?? studioDef.size} colors={colors[studio.id] ?? {}} tab={studio.tab} onClose={() => setStudio(null)}
          onApply={(c) => setColors((m) => { const n = { ...m }; if (Object.keys(c).length) n[studio.id] = c; else delete n[studio.id]; return n })}
          layout={<>
            <p className="text-[13px] text-mute leading-relaxed">{studioDef.desc}{studioDef.conditional ? ` · ${studioDef.conditional}` : ''}</p>
            {studioDef.sizes.length > 1 ? (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-bold">Boyut</span>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Boyut">
                  {studioDef.sizes.map((s) => {
                    const on = items[studioIdx]?.size === s
                    return <button key={s} type="button" role="radio" aria-checked={on} onClick={() => commit(setSize(items, studioDef.id, s))}
                      className={`min-h-11 rounded-[12px] text-[14px] font-bold border ${on ? 'border-2 border-acc bg-[color-mix(in_oklab,var(--color-acc)_12%,var(--color-surface-2))]' : 'bg-surface-2 border-line'}`}>{s === 'half' ? 'Yarım' : 'Tam genişlik'}</button>
                  })}
                </div>
              </div>
            ) : null}
            {studioDef.locked !== 'top' ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => step(studioDef.id, -1)} disabled={studioIdx <= 1} className="min-h-11 rounded-[12px] bg-surface-2 border border-line text-[14px] font-bold disabled:opacity-40" data-testid="card-up">Yukarı taşı</button>
                <button type="button" onClick={() => step(studioDef.id, 1)} disabled={studioIdx >= items.length - 1} className="min-h-11 rounded-[12px] bg-surface-2 border border-line text-[14px] font-bold disabled:opacity-40" data-testid="card-down">Aşağı taşı</button>
              </div>
            ) : <p className="text-[13px] text-mute">Bu kart ekranın en üstünde sabit.</p>}
            {studioDef.locked !== 'top' && studioIdx >= 0 ? (() => {
              const cur = items[studioIdx], nxt = items[studioIdx + 1]
              const canStack = !!nxt && !defOf(nxt.id)?.locked && (cur.stack?.length ?? 0) + 1 + (nxt.stack?.length ?? 0) + 1 <= STACK_MAX
              return (
                <div className="flex flex-col gap-2" data-testid="stack-controls">
                  <span className="text-[13px] font-bold">Yığın <span className="text-[12px] text-mute font-normal">· kartlar aynı yerde yana kaydırılarak gezilir</span></span>
                  {cur.stack?.map((sid) => (
                    <div key={sid} className="flex items-center justify-between gap-2 min-h-11 rounded-[12px] bg-surface-2 px-3" data-stack-child={sid}>
                      <span className="text-[13.5px] font-bold">{defOf(sid)?.title}</span>
                      <button type="button" onClick={() => commit(unstack(items, cur.id, sid))} className="h-9 px-3 rounded-full border border-line-2 text-[12.5px] font-bold" data-testid="card-unstack">Ayır</button>
                    </div>
                  ))}
                  {nxt ? <button type="button" disabled={!canStack} onClick={() => commit(stackWithNext(items, cur.id))} data-testid="card-stack"
                    className="min-h-11 rounded-[12px] bg-surface-2 border border-line text-[14px] font-bold disabled:opacity-40">Alttaki kartla yığ ({defOf(nxt.id)?.title})</button> : null}
                </div>
              )
            })() : null}
            {studioDef.quick ? (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-bold">Hızlı eylem</span>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Hızlı eylem" data-testid="quick-pick">
                  {studioDef.quick.map((qq) => {
                    const on = (quick[studioDef.id] ?? studioDef.quick![0].id) === qq.id
                    return <button key={qq.id} type="button" role="radio" aria-checked={on} onClick={() => setQuick({ ...quick, [studioDef.id]: qq.id })}
                      className={`min-h-11 px-2 rounded-[12px] text-[13.5px] font-bold border ${on ? 'border-2 border-acc bg-[color-mix(in_oklab,var(--color-acc)_12%,var(--color-surface-2))]' : 'bg-surface-2 border-line'}`}>{qq.label}</button>
                  })}
                </div>
              </div>
            ) : null}
            {canPin(studioDef.id) ? (
              <label className="flex items-center justify-between gap-3 min-h-11 cursor-pointer">
                <span className="flex flex-col"><b className="text-[14px]">Üste sabitle</b><span className="text-[12px] text-mute">Kurallardan önce, başlığın hemen altında durur</span></span>
                <input type="checkbox" role="switch" checked={pins.includes(studioDef.id)} data-testid="card-pin"
                  onChange={(e) => { const on = e.target.checked, id = studioDef.id; setPins(on ? [...pins, id] : pins.filter((x) => x !== id)); void pinCardAction(id, on).then((r) => { if (!r.ok) { setPins((ps) => (on ? ps.filter((x) => x !== id) : [...ps, id])); setMsg(r.error) } }) }}
                  className="appearance-none w-12 h-7 rounded-full bg-surface-3 relative shrink-0 transition checked:bg-acc before:content-[''] before:absolute before:top-1 before:left-1 before:w-5 before:h-5 before:rounded-full before:bg-white before:transition checked:before:translate-x-5" />
              </label>
            ) : null}
          </>} />
      ) : null}
    </div>
  )
}
