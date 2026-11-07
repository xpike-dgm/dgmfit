'use client'
// Ö2a: kartın renk ekranı (✎ → Renkler). Yalnız bu kartın arka plan / başlık / metin / vurgu renkleri değişir; modülün diğer
// yerleri etkilenmez. Seçilen renkler iki tema için türetilir, okunmayan seçim otomatik düzeltilir ve kullanıcıya söylenir.
import { useEffect, useState, type ReactNode } from 'react'
import { CARD_SLOTS, SLOT_LABEL, cardVars, readabilityNotes, themeColors, type CardColors, type CardSlot } from '@/lib/cards/colors'

const SWATCH: Record<CardSlot, string[]> = {
  bg: ['#FFFFFF', '#F8F1E7', '#FFF3BF', '#E6F4EA', '#E3F2FD', '#F3E8FF', '#FFE3E3', '#1C1F26', '#0F2A3D', '#1E3A2B', '#3B1F2B', '#2B2350'],
  title: ['#14161B', '#FFFFFF', '#0B4F8A', '#1E5B12', '#8A2E0C', '#5B2A9E'],
  text: ['#3D4452', '#E7E9EE', '#30577A', '#3E5A2C', '#6B3A1E', '#4A3A6E'],
  accent: ['#0B79C9', '#3F7F12', '#C2551F', '#D94A2B', '#7A3FC9', '#0E8B7E', '#E8590C', '#212121'],
}

/** Etkin tema (data-theme ya da sistem ayarı). */
function useMode(): 'light' | 'dark' {
  const [m, setM] = useState<'light' | 'dark'>('dark')
  useEffect(() => {
    const read = () => { const t = document.documentElement.getAttribute('data-theme'); setM(t === 'light' || t === 'dark' ? t : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') }
    read()
    const mq = matchMedia('(prefers-color-scheme: light)'); mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])
  return m
}

export default function ColorEditor({ title, node, value, onChange, onDone }: { title: string; node: ReactNode; value: CardColors; onChange: (c: CardColors) => void; onDone: () => void }) {
  const mode = useMode()
  const other = mode === 'light' ? 'dark' : 'light'
  const v = cardVars(value)
  const o = themeColors(value, other)
  const notes = readabilityNotes(value)
  const set = (slot: CardSlot, c: string | undefined) => { const n = { ...value }; if (c) n[slot] = c.toUpperCase(); else delete n[slot]; onChange(n) }
  return (
    <div className="flex flex-col gap-4 pb-4" data-testid="color-editor">
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-bold text-mute">ÖNİZLEME · {mode === 'light' ? 'AÇIK' : 'KOYU'} TEMA</span>
        <div className="pointer-events-none flex flex-col [&>*]:flex-1" aria-hidden style={v?.style} data-cc={v?.slots} data-testid="color-preview">{node}</div>
        <div className="flex items-center gap-2 text-[12px] text-mute">
          <span>{other === 'light' ? 'Açık' : 'Koyu'} temada:</span>
          <span className="flex-1 h-9 rounded-xl px-3 flex items-center justify-between border border-line" style={{ background: o.bg ?? (other === 'light' ? '#FFFFFF' : '#1C1F26') }}>
            <b style={{ color: o.title ?? (other === 'light' ? '#14161B' : '#F4F5F7') }}>{title}</b>
            <span className="h-6 px-2 rounded-full text-[11px] font-bold flex items-center" style={{ background: o.accent ?? '#888', color: o.accentInk ?? '#fff' }}>Düğme</span>
          </span>
        </div>
      </div>
      {CARD_SLOTS.map((slot) => (
        <fieldset key={slot} className="flex flex-col gap-2" data-slot={slot}>
          <legend className="text-[13px] font-bold mb-1 flex items-center gap-2">{SLOT_LABEL[slot]}{value[slot] ? <span className="num text-[11.5px] text-mute font-normal">{value[slot]}</span> : <span className="text-[11.5px] text-mute font-normal">temanın rengi</span>}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={SLOT_LABEL[slot]}>
            <button type="button" role="radio" aria-checked={!value[slot]} aria-label="Temanın rengi" onClick={() => set(slot, undefined)}
              className="w-9 h-9 rounded-full border-2 border-dashed border-line-2 text-[11px] font-bold text-mute aria-checked:border-solid aria-checked:border-acc aria-checked:ring-2 aria-checked:ring-acc/40">—</button>
            {SWATCH[slot].map((c) => (
              <button key={c} type="button" role="radio" aria-checked={value[slot] === c} aria-label={c} onClick={() => set(slot, c)} data-swatch={c}
                className="w-9 h-9 rounded-full border border-line-2 aria-checked:ring-[3px] aria-checked:ring-acc aria-checked:ring-offset-2 aria-checked:ring-offset-bg" style={{ background: c }} />
            ))}
            <label className="w-9 h-9 rounded-full border border-line-2 overflow-hidden relative cursor-pointer" title="Özel renk" style={{ background: 'conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}>
              <span className="sr-only">{SLOT_LABEL[slot]}: özel renk</span>
              <input type="color" value={value[slot] ?? '#888888'} onChange={(e) => set(slot, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" data-testid={`color-input-${slot}`} />
            </label>
          </div>
        </fieldset>
      ))}
      {notes.length ? <ul className="flex flex-col gap-1 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2" data-testid="color-notes">{notes.map((n) => <li key={n}>⚠︎ {n}</li>)}</ul> : null}
      <p className="text-[12px] text-mute leading-snug">Renkler yalnız bu kartta değişir. Açık ve koyu temada okunur olacak şekilde ayarlanır.</p>
      <div className="flex gap-2">
        {Object.keys(value).length ? <button type="button" onClick={() => onChange({})} className="h-12 px-4 rounded-full border border-line-2 font-bold text-[14px]" data-testid="color-reset">Sıfırla</button> : null}
        <button type="button" onClick={onDone} className="flex-1 h-12 rounded-full bg-acc text-acc-ink font-extrabold" data-testid="color-done">Tamam</button>
      </div>
    </div>
  )
}
