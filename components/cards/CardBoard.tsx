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
import ColorEditor from './ColorEditor'
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

function Editor(p: Props) {
  const defOf = useDefOf()
  const router = useRouter()
  const left = useDesignPrefs().hand === 'left'
  const [items, setItems] = useState<Item[]>(p.items)
  const [history, setHistory] = useState<Item[][]>([])
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; dx: number; dy: number; w: number; h: number } | null>(null)
  const [sheet, setSheet] = useState<string | null>(null)
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
  const [colorFor, setColorFor] = useState<string | null>(null)
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
  const sheetDef = sheet ? defOf(sheet) : null
  const sheetIdx = sheet ? items.findIndex((i) => i.id === sheet) : -1

  return (
    <div className="flex flex-col gap-3" data-testid="card-editor">
      <div className="sticky top-0 z-40 -mx-4 px-3 pt-2 pb-2.5 bg-bg/95 backdrop-blur border-b border-line flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button type="button" onClick={cancel} className="h-11 px-3 text-[14px] font-bold text-mute">Vazgeç</button>
          <span className="flex flex-col items-center leading-tight"><b className="text-[15px]">{SCREENS[p.screen].title}</b><span className="text-[11.5px] font-bold text-acc">Düzenleniyor</span></span>
          <button type="button" onClick={done} disabled={busy} className="h-11 px-5 rounded-full bg-acc text-acc-ink font-extrabold text-[14px] disabled:opacity-50" data-testid="edit-done">{busy ? '…' : 'Bitti'}</button>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <button type="button" onClick={undo} disabled={!history.length} className="h-10 px-3.5 rounded-full bg-surface-2 border border-line-2 text-[13px] font-bold disabled:opacity-40 shrink-0">Geri al</button>
          <button type="button" onClick={() => setDrawerOpen(true)} className="h-10 px-3.5 rounded-full bg-surface-2 border border-line-2 text-[13px] font-bold inline-flex items-center gap-1.5 shrink-0" data-testid="open-drawer">
            + Kart ekle {inDrawer.length ? <span className="num text-[11px] px-1.5 rounded-full bg-acc text-acc-ink">{inDrawer.length}</span> : null}
          </button>
          <button type="button" onClick={reset} disabled={busy} className="h-10 px-3.5 rounded-full text-[13px] font-bold text-mute shrink-0">Varsayılana dön</button>
        </div>
      </div>
      <p className="text-[12.5px] text-mute text-center -mt-1" role="status">{msg ?? 'Taşımak için kartı basılı tut ve sürükle'}</p>

      <div className="grid grid-cols-2 gap-3 select-none [-webkit-touch-callout:none]">
        {items.map((it, idx) => {
          const def = defOf(it.id)!
          const dragging = drag?.id === it.id
          const node = p.nodes[it.id]
          return (
            <div key={it.id} ref={(el) => { if (el) refs.current.set(it.id, el); else refs.current.delete(it.id) }}
              role="group" aria-label={def.title} data-edit-card={it.id} data-index={idx}
              onPointerDown={(e) => startHold(e, it.id)} onPointerMove={moveHold} onPointerUp={endHold} onPointerCancel={endHold} onContextMenu={(e) => e.preventDefault()}
              className={`relative min-w-0 rounded-[24px] touch-pan-y ${it.size === 'full' ? 'col-span-2' : ''} ${flash === it.id ? 'ring-2 ring-acc ring-offset-2 ring-offset-bg' : ''}`}>
              <div className={`h-full rounded-[24px] flex flex-col ${dragging ? 'opacity-0' : def.locked === 'top' ? '' : 'card-wiggle'}`} style={{ animationDelay: `${(idx % 3) * 90}ms` }}>
                {def.locked !== 'top' ? <div className={`h-9 flex items-center gap-2 min-w-0 ${left ? 'pl-[76px] pr-1.5 justify-end' : 'pl-1.5 pr-[76px]'}`} aria-hidden><b className="text-[12px] font-extrabold text-mute truncate">{def.title}</b>{pins.includes(def.id) ? <span className="text-[10.5px] font-extrabold px-1.5 py-0.5 rounded-full bg-surface-3 text-ink-2 shrink-0">SABİT</span> : null}{it.stack?.length ? <span className="text-[10.5px] font-extrabold px-1.5 py-0.5 rounded-full bg-acc text-acc-ink shrink-0" data-testid="stack-badge">+{it.stack.length} YIĞIN</span> : null}</div> : null}
                <div className="pointer-events-none flex-1 flex flex-col [&>*]:flex-1" aria-hidden {...ccAttrs(colors[it.id])}>
                  {node ?? <div className="rounded-[20px] border-2 border-dashed border-line-2 px-4 py-2.5 flex items-center min-h-[52px]" data-testid="card-placeholder"><span className="text-[12.5px] text-mute leading-snug">{def.conditional ?? def.desc}</span></div>}
                </div>
              </div>
              {dragging ? <div className="absolute inset-0 rounded-[24px] border-2 border-dashed border-acc bg-acc/5" aria-hidden /> : null}
              <div className={`absolute flex gap-1.5 z-10 ${def.locked === 'top' ? (left ? '-top-2.5 -left-1.5' : '-top-2.5 -right-1.5') : (left ? 'top-0.5 left-0' : 'top-0.5 right-0')}`} data-card-ctl>
                <button type="button" data-card-btn aria-label={`${def.title} kartını düzenle`} onClick={() => setSheet(it.id)}
                  className="w-8 h-8 rounded-full bg-ink text-bg shadow-md flex items-center justify-center hit">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                </button>
                {def.locked ? (
                  <span className="w-8 h-8 rounded-full bg-surface-3 text-mute flex items-center justify-center" title="Bu kart kaldırılamaz" aria-label={`${def.title} kaldırılamaz`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                  </span>
                ) : (
                  <button type="button" data-card-btn aria-label={`${def.title} kartını kaldır`} onClick={() => remove(it.id)} data-testid="card-remove"
                    className="w-8 h-8 rounded-full bg-danger text-white shadow-md flex items-center justify-center hit">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {drag ? (
        <div className="fixed z-50 pointer-events-none" aria-hidden
          style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w, transform: 'rotate(-2deg) scale(1.04)', filter: 'drop-shadow(0 18px 30px rgba(0,0,0,.45))' }}>
          <div className="flex flex-col [&>*]:flex-1">{p.nodes[drag.id] ?? <div className="card p-4"><b>{defOf(drag.id)?.title}</b></div>}</div>
        </div>
      ) : null}

      <div>
        <Sheet open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Kart ekle">
          <div className="flex flex-col gap-2 pb-4" data-testid="card-drawer">
            {!inDrawer.length ? <p className="text-[14px] text-mute py-6 text-center">Bu ekrandaki bütün kartlar zaten yerinde.</p> : null}
            {inDrawer.map((d) => {
              const def = defOf(d.id)!
              return (
                <div key={d.id} data-mod={def.module} onPointerDown={(e) => startHold(e, d.id, true)} onPointerMove={moveHold} onPointerUp={endHold} onPointerCancel={endHold} onContextMenu={(e) => e.preventDefault()}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-surface-2 select-none touch-pan-y" data-drawer-card={d.id}>
                  <span className="w-1.5 self-stretch rounded-full bg-acc" aria-hidden />
                  <span className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <b className="text-[14px] flex items-center gap-1.5">{def.title}{d.reason === 'new' ? <span className="text-[10.5px] font-extrabold px-1.5 rounded-full bg-acc text-acc-ink">YENİ</span> : null}</b>
                    <span className="text-[12px] text-mute leading-snug">{d.reason === 'removed' ? 'Kaldırdığın kart · ' : ''}{def.desc}</span>
                  </span>
                  <button type="button" data-card-btn onClick={() => add(d.id)} className="h-10 px-3.5 rounded-full bg-acc text-acc-ink text-[13px] font-bold shrink-0" aria-label={`${def.title} ekle`}>Ekle</button>
                </div>
              )
            })}
            <p className="text-[12px] text-mute text-center pt-1">Dokun: en alta eklenir · basılı tutup sürükle: istediğin yere</p>
          </div>
        </Sheet>
      </div>

      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheetDef?.title ?? 'Kart'}>
        {sheetDef ? (
          <div className="flex flex-col gap-4 pb-4" data-testid="card-sheet">
            <p className="text-[13px] text-mute leading-relaxed">{sheetDef.desc}{sheetDef.conditional ? ` · ${sheetDef.conditional}` : ''}</p>
            {sheetDef.sizes.length > 1 ? (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-bold">Boyut</span>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Boyut">
                  {sheetDef.sizes.map((s) => {
                    const on = items[sheetIdx]?.size === s
                    return <button key={s} type="button" role="radio" aria-checked={on} onClick={() => commit(setSize(items, sheetDef.id, s))}
                      className={`h-11 rounded-xl text-[14px] font-bold border ${on ? 'bg-acc text-acc-ink border-acc' : 'bg-surface-2 border-line'}`}>{s === 'half' ? 'Yarım' : 'Tam genişlik'}</button>
                  })}
                </div>
              </div>
            ) : null}
            {sheetDef.locked !== 'top' ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => step(sheetDef.id, -1)} disabled={sheetIdx <= 1} className="h-11 rounded-xl bg-surface-2 border border-line text-[14px] font-bold disabled:opacity-40" data-testid="card-up">Yukarı taşı</button>
                <button type="button" onClick={() => step(sheetDef.id, 1)} disabled={sheetIdx >= items.length - 1} className="h-11 rounded-xl bg-surface-2 border border-line text-[14px] font-bold disabled:opacity-40" data-testid="card-down">Aşağı taşı</button>
              </div>
            ) : <p className="text-[13px] text-mute">Bu kart ekranın en üstünde sabit.</p>}
            {sheetDef.locked !== 'top' && sheetIdx >= 0 ? (() => {
              const cur = items[sheetIdx], nxt = items[sheetIdx + 1]
              const canStack = !!nxt && !defOf(nxt.id)?.locked && (cur.stack?.length ?? 0) + 1 + (nxt.stack?.length ?? 0) + 1 <= STACK_MAX
              return (
                <div className="flex flex-col gap-2" data-testid="stack-controls">
                  <span className="text-[13px] font-bold">Yığın <span className="text-[12px] text-mute font-normal">· kartlar aynı yerde yana kaydırılarak gezilir</span></span>
                  {cur.stack?.map((sid) => (
                    <div key={sid} className="flex items-center justify-between gap-2 min-h-11 rounded-xl bg-surface-2 px-3" data-stack-child={sid}>
                      <span className="text-[13.5px] font-bold">{defOf(sid)?.title}</span>
                      <button type="button" onClick={() => commit(unstack(items, cur.id, sid))} className="h-9 px-3 rounded-full border border-line-2 text-[12.5px] font-bold" data-testid="card-unstack">Ayır</button>
                    </div>
                  ))}
                  {nxt ? <button type="button" disabled={!canStack} onClick={() => commit(stackWithNext(items, cur.id))} data-testid="card-stack"
                    className="h-11 rounded-xl bg-surface-2 border border-line text-[14px] font-bold disabled:opacity-40">Alttaki kartla yığ ({defOf(nxt.id)?.title})</button> : null}
                </div>
              )
            })() : null}
            {sheetDef.quick ? (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-bold">Hızlı eylem</span>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Hızlı eylem" data-testid="quick-pick">
                  {sheetDef.quick.map((q) => {
                    const on = (quick[sheetDef.id] ?? sheetDef.quick![0].id) === q.id
                    return <button key={q.id} type="button" role="radio" aria-checked={on} onClick={() => setQuick({ ...quick, [sheetDef.id]: q.id })}
                      className={`min-h-11 px-2 rounded-xl text-[13.5px] font-bold border ${on ? 'bg-acc text-acc-ink border-acc' : 'bg-surface-2 border-line'}`}>{q.label}</button>
                  })}
                </div>
              </div>
            ) : null}
            {canPin(sheetDef.id) ? (
              <label className="flex items-center justify-between gap-3 min-h-11 cursor-pointer">
                <span className="flex flex-col"><b className="text-[14px]">Üste sabitle</b><span className="text-[12px] text-mute">Kurallardan önce, başlığın hemen altında durur</span></span>
                <input type="checkbox" role="switch" checked={pins.includes(sheetDef.id)} data-testid="card-pin"
                  onChange={(e) => { const on = e.target.checked, id = sheetDef.id; setPins(on ? [...pins, id] : pins.filter((x) => x !== id)); void pinCardAction(id, on).then((r) => { if (!r.ok) { setPins((ps) => (on ? ps.filter((x) => x !== id) : [...ps, id])); setMsg(r.error) } }) }}
                  className="appearance-none w-12 h-7 rounded-full bg-surface-3 relative shrink-0 transition checked:bg-acc before:content-[''] before:absolute before:top-1 before:left-1 before:w-5 before:h-5 before:rounded-full before:bg-white before:transition checked:before:translate-x-5" />
              </label>
            ) : null}
            {sheetDef.colorSlots ? (
              <button type="button" onClick={() => { const id = sheetDef.id; setSheet(null); setColorFor(id) }} data-testid="card-colors"
                className="h-12 rounded-xl bg-surface-2 border border-line text-[14px] font-bold flex items-center justify-between px-4">
                <span>Renkler</span>
                <span className="flex items-center gap-1">{Object.values(colors[sheetDef.id] ?? {}).map((c) => <span key={c} className="w-4 h-4 rounded-full border border-line-2" style={{ background: c }} />)}<span className="text-mute ml-1">›</span></span>
              </button>
            ) : null}
            <button type="button" onClick={() => setSheet(null)} className="h-12 rounded-full bg-acc text-acc-ink font-extrabold">Tamam</button>
          </div>
        ) : null}
      </Sheet>
      <Sheet open={!!colorFor} onClose={() => setColorFor(null)} title={colorFor ? `${defOf(colorFor)?.title} · renkler` : 'Renkler'}>
        {colorFor ? <ColorEditor title={defOf(colorFor)?.title ?? ''} node={p.nodes[colorFor] ?? <div className="card p-4"><b>{defOf(colorFor)?.title}</b><p className="text-mute">Örnek metin</p></div>}
          value={colors[colorFor] ?? {}} onChange={(c) => setColors((m) => { const n = { ...m }; if (Object.keys(c).length) n[colorFor] = c; else delete n[colorFor]; return n })}
          onDone={() => setColorFor(null)} /> : null}
      </Sheet>
    </div>
  )
}
