'use client'
// Ö6: kartın tam ekran düzenleyicisi (gösterilen tasarım: Vazgeç · "<kart> kartı" · Uygula; canlı önizleme; Renk | Boyut ve görünüm).
// Renk sekmesi: 4 alan (arka plan, başlık, metin, vurgu), alan başına 8 renk, okunurluk oranı, modül rengine dön, özel renk.
// Renkler "Uygula" ile düzenleyiciye geçer (Vazgeç geri alır); boyut/sıra/yığın/hızlı eylem değişiklikleri hemen uygulanır (Geri al ile döner).
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CARD_SLOTS, SLOT_LABEL, cardVars, contrast, readabilityNotes, type CardColors, type CardSlot } from '@/lib/cards/colors'
import type { CardDef, CardSize } from '@/lib/cards/registry'

const SHORT: Record<CardSlot, string> = { bg: 'Arka plan', title: 'Başlık', text: 'Metin', accent: 'Vurgu' }
const PAL: Record<CardSlot, string[]> = {
  bg: ['#172029', '#1C1F26', '#0F2A3D', '#2A1F33', '#1F2A1A', '#3A2418', '#E8F4FF', '#FFFFFF'],
  title: ['#6CC7FF', '#B6E35E', '#FFA06B', '#C9A7FF', '#5FD8C6', '#FF8A65', '#0A6DB5', '#14161B'],
  text: ['#ECEEF2', '#C3C7D0', '#FFFFFF', '#FFE8CC', '#D9F2FF', '#9AA0AB', '#14161B', '#3D4452'],
  accent: ['#6CC7FF', '#B6E35E', '#FFA06B', '#C9A7FF', '#5FD8C6', '#FF8A65', '#FFD166', '#0A6DB5'],
}

/** Etkin tema (data-theme ya da sistem ayarı). */
export function useMode(): 'light' | 'dark' {
  const [m, setM] = useState<'light' | 'dark'>('dark')
  useEffect(() => {
    const read = () => { const t = document.documentElement.getAttribute('data-theme'); setM(t === 'light' || t === 'dark' ? t : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') }
    read()
    const mq = matchMedia('(prefers-color-scheme: light)'); mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])
  return m
}

export interface StudioProps {
  def: CardDef
  node: ReactNode
  size: CardSize
  colors: CardColors
  tab: 'color' | 'layout'
  onApply: (c: CardColors) => void
  onClose: () => void
  /** Boyut ve görünüm sekmesinin içeriği (düzenleyicinin mevcut denetimleri) */
  layout: ReactNode
}

export default function CardStudio(p: StudioProps) {
  const mode = useMode()
  const hasColor = !!p.def.colorSlots
  const [tab, setTab] = useState<'color' | 'layout'>(hasColor ? p.tab : 'layout')
  const [draft, setDraft] = useState<CardColors>(p.colors)
  const [slot, setSlot] = useState<CardSlot>('bg')
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o } }, [])
  const set = (s: CardSlot, c: string | undefined) => setDraft((d) => { const n = { ...d }; if (c) n[s] = c.toUpperCase(); else delete n[s]; return n })
  const v = cardVars(draft)
  const themeBg = mode === 'light' ? '#FFFFFF' : '#1C1F26', themeText = mode === 'light' ? '#17191E' : '#ECEEF2'
  const ratio = contrast(draft.text ?? themeText, draft.bg ?? themeBg)
  const ok = ratio >= 4.5
  const notes = readabilityNotes(draft)
  const changed = JSON.stringify(draft) !== JSON.stringify(p.colors)
  if (!mounted) return null
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${p.def.title} kartı`} className="fixed inset-0 z-[70] bg-bg text-ink flex flex-col overflow-y-auto" data-testid="card-studio" data-mod="today">
      <div className="sticky top-0 z-10 bg-bg flex items-center justify-between px-3 pt-3 pb-1.5 safe-top">
        <button type="button" onClick={p.onClose} className="min-h-11 px-3 text-[14px] font-bold text-mute" data-testid="studio-cancel">Vazgeç</button>
        <b className="text-[16px] font-extrabold truncate px-2">{p.def.title} kartı</b>
        <button type="button" onClick={() => { if (changed) p.onApply(draft); p.onClose() }} className="min-h-11 px-[18px] rounded-full bg-acc text-acc-ink font-extrabold text-[14px]" data-testid="color-done">Uygula</button>
      </div>

      <div className="px-4 pt-2.5 pb-[18px] bg-[repeating-conic-gradient(var(--color-surface)_0_25%,var(--color-bg)_0_50%)] bg-[length:20px_20px]">
        <div className={`pointer-events-none flex flex-col [&>*]:flex-1 ${p.size === 'half' ? 'max-w-[62%]' : ''}`} aria-hidden style={v?.style} data-cc={v?.slots} data-testid="color-preview">{p.node}</div>
      </div>

      <div className="px-4 pt-3.5 pb-8 flex flex-col gap-3.5">
        {hasColor ? (
          <div role="tablist" aria-label="Düzenleme" className="grid grid-cols-2 p-1 rounded-[14px] bg-surface">
            {([['color', 'Renk'], ['layout', 'Boyut ve görünüm']] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={k === 'color' ? 'card-colors' : 'card-layout-tab'}
                className="min-h-10 rounded-[11px] text-[13px] font-bold text-mute aria-selected:bg-surface-3 aria-selected:text-ink aria-selected:font-extrabold">{l}</button>
            ))}
          </div>
        ) : null}

        {tab === 'color' && hasColor ? (
          <div className="flex flex-col gap-3.5" data-testid="color-editor">
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Renk alanı">
              {CARD_SLOTS.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={slot === s} onClick={() => setSlot(s)} data-slot-chip={s}
                  className="min-h-16 rounded-[14px] bg-surface flex flex-col items-center justify-center gap-1.5 text-[11.5px] font-bold border border-line aria-checked:border-2 aria-checked:border-acc">
                  <span className={`w-[22px] h-[22px] rounded-full border-2 ${draft[s] ? 'border-line-2' : 'border-dashed border-line-2'}`} style={{ background: draft[s] ?? 'transparent' }} />
                  {SHORT[s]}
                </button>
              ))}
            </div>
            {CARD_SLOTS.map((s) => (
              <div key={s} className={`flex flex-col gap-2 ${s === slot ? '' : 'hidden'}`} data-slot={s}>
                <span className="text-[12px] font-bold text-mute">{SHORT[s]} rengi</span>
                <div className="grid grid-cols-8 gap-2" role="radiogroup" aria-label={SLOT_LABEL[s]}>
                  {PAL[s].map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={draft[s] === c} aria-label={c} onClick={() => set(s, c)} data-swatch={c}
                      className="aspect-square min-h-9 rounded-full border-2 border-line-2 aria-checked:border-[3px] aria-checked:border-ink" style={{ background: c }} />
                  ))}
                </div>
                <input type="color" value={draft[s] ?? '#888888'} onChange={(e) => set(s, e.target.value)} className="sr-only" id={`cc-${s}`} data-testid={`color-input-${s}`} tabIndex={-1} />
              </div>
            ))}
            <div className={`flex items-center gap-2.5 p-3 rounded-2xl ${ok ? 'bg-[color-mix(in_oklab,var(--color-good)_14%,var(--color-surface))]' : 'bg-warn-bg'}`} data-testid="color-ratio">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ok ? 'var(--color-good)' : 'var(--color-warn)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></svg>
              <span className="text-[13px] leading-snug flex-1">Okunurluk <b className="num">{ratio.toFixed(1)}:1</b> · {ok ? 'rahat okunuyor' : 'düşük: metin rengi otomatik düzeltilecek'}</span>
            </div>
            {notes.length ? <ul className="flex flex-col gap-1 text-[12.5px] text-ink-2 px-1" data-testid="color-notes">{notes.map((n) => <li key={n}>⚠︎ {n}</li>)}</ul> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => setDraft({})} className="flex-1 min-h-11 rounded-full border border-line-2 text-[13px] font-bold" data-testid="color-reset">Modül rengine dön</button>
              <label htmlFor={`cc-${slot}`} className="flex-1 min-h-11 rounded-full border border-line-2 text-[13px] font-bold inline-flex items-center justify-center cursor-pointer">Özel renk…</label>
            </div>
            <p className="text-[12px] text-mute leading-relaxed">Yalnızca bu kart değişir. Modülün diğer ekranları kendi renginde kalır. {mode === 'light' ? 'Koyu' : 'Açık'} tema rengi otomatik türetilir.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4" data-testid="card-sheet">{p.layout}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
