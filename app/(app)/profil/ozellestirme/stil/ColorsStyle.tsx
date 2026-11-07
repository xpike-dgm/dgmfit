'use client'
// Ö6: "Renkler ve stil" (gösterilen tasarım) — hazır paletler + fotoğraftan, modül renkleri, köşe / yazı tipi / yoğunluk.
// Değişiklikler hemen kaydedilir (tasarımda Kaydet düğmesi yok); renk seçici sürüklenirken kısa gecikmeyle.
import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MODULES, PALETTES, modulePalette, paletteColors, photoModuleColors, quantize, type Hex, type ModuleColors as MC } from '@/lib/cards/colors'
import type { StylePrefs } from '@/lib/cards/style'
import { SectionLabel } from '@/components/cards/StudioHeader'
import { saveModulesAction, saveStyleAction } from '../actions'

async function photoColors(f: File): Promise<Hex[]> {
  const bmp = await createImageBitmap(f)
  const w = 72, h = Math.max(1, Math.round((bmp.height / bmp.width) * 72))
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, w, h)
  return quantize(ctx.getImageData(0, 0, w, h).data, 8)
}

const MAIN_PALETTES = ['okyanus', 'gunbatimi', 'orman', 'mono']
const DGFIT_STRIP = ['#B6E35E', '#5FD8C6', '#6CC7FF', '#FFA06B', '#C9A7FF']
const same = (a: MC, b: MC | null) => !!b && MODULES.every((m) => (a[m.id] ?? '') === (b[m.id] ?? ''))
const pill = 'min-h-11 rounded-[12px] text-[13px] font-bold border transition aria-checked:border-2 aria-checked:border-acc aria-checked:bg-[color-mix(in_oklab,var(--color-acc)_10%,var(--color-surface-2))] border-line-2 bg-surface-2'

export default function ColorsStyle({ initial, style }: { initial: MC; style: StylePrefs }) {
  const [mc, setMc] = useState<MC>(initial)
  const [s, setS] = useState(style)
  const [photo, setPhoto] = useState<Hex[] | null>(null)
  const [more, setMore] = useState(false)
  const [morePal, setMorePal] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [, start] = useTransition()
  const file = useRef<HTMLInputElement>(null)
  const timer = useRef<number>(0)
  const router = useRouter()
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const saveColors = (v: MC, note = 'Renkler kaydedildi', delay = 0) => {
    setMc(v); setMsg(null)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => start(async () => {
      const r = await saveModulesAction(Object.keys(v).length ? v : null).catch(() => null)
      setMsg(r?.ok ? note : r && !r.ok ? r.error : 'Kaydedilemedi')
      if (r?.ok) router.refresh()
    }), delay)
  }
  const saveStyle = (patch: Partial<StylePrefs>) => {
    const old = s
    setS({ ...s, ...patch }); setMsg(null)
    start(async () => {
      const r = await saveStyleAction(patch).catch(() => null)
      if (!r?.ok) { setS(old); setMsg(r && !r.ok ? r.error : 'Kaydedilemedi') } else { setMsg('Kaydedildi'); router.refresh() }
    })
  }
  const color = (id: (typeof MODULES)[number]['id']) => mc[id] ?? MODULES.find((m) => m.id === id)!.base
  const first = MODULES.slice(0, 3), rest = MODULES.slice(3)
  const shown = more ? MODULES : first

  return (
    <div className="flex flex-col gap-3.5" data-mod="today" data-testid="colors-style">
      <SectionLabel>Hazır paletler</SectionLabel>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Hazır paletler" data-testid="palettes">
        <button type="button" role="radio" aria-checked={!Object.keys(mc).length} onClick={() => saveColors({}, 'DgFit renkleri kaydedildi')} data-palette="dgfit" className={`${pill} p-2.5 flex flex-col gap-2 text-left rounded-[16px]`}>
          <span className="flex">{DGFIT_STRIP.map((c, i) => <span key={i} className="flex-1 h-4 first:rounded-l-md last:rounded-r-md" style={{ background: c }} />)}</span>
          <span className="text-[12.5px] font-bold">DgFit</span>
        </button>
        {PALETTES.filter((p) => morePal || MAIN_PALETTES.includes(p.id) || same(mc, paletteColors(p.id))).map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={same(mc, paletteColors(p.id))} onClick={() => saveColors(paletteColors(p.id)!, `${p.name} uygulandı`)} data-palette={p.id}
            className={`${pill} p-2.5 flex flex-col gap-2 text-left rounded-[16px]`}>
            <span className="flex">{p.colors.slice(0, 5).map((c, i) => <span key={i} className="flex-1 h-4 first:rounded-l-md last:rounded-r-md" style={{ background: c }} />)}</span>
            <span className="text-[12.5px] font-bold leading-tight">{p.name}</span>
          </button>
        ))}
        <button type="button" onClick={() => file.current?.click()} className="rounded-[16px] border border-dashed border-line-2 p-2.5 flex flex-col items-center justify-center gap-1.5 text-[12.5px] font-bold text-ink-2 min-h-[72px]" data-testid="photo-pick">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M21 17l-5-5-8 8" /></svg>
          Fotoğraftan
        </button>
      </div>
      {!morePal ? <button type="button" onClick={() => setMorePal(true)} className="self-start -mt-1.5 text-[12.5px] font-bold text-mute" data-testid="palette-more">Diğer paletler: Pastel, Renk körlüğüne uygun, Yüksek kontrast ›</button> : null}
      <input ref={file} type="file" accept="image/*" className="sr-only" data-testid="photo-input"
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const cs = await photoColors(f); setPhoto(cs); setMsg(cs.length ? null : 'Fotoğrafta belirgin renk bulunamadı') } catch { setMsg('Fotoğraf okunamadı') } }} />
      {photo?.length ? (
        <div className="card rounded-[16px] p-3 flex flex-col gap-2" data-testid="photo-colors">
          <span className="text-[12.5px] text-mute">Fotoğrafın renkleri (fotoğraf yüklenmez, telefonunda işlenir)</span>
          <span className="flex gap-1">{photo.map((c) => <span key={c} className="flex-1 h-8 rounded-lg" style={{ background: c }} title={c} />)}</span>
          <button type="button" onClick={() => { saveColors(photoModuleColors(photo), 'Fotoğraf paleti uygulandı'); setPhoto(null) }} className="h-10 rounded-full bg-acc text-acc-ink font-extrabold text-[13px]" data-testid="photo-apply">Modüllere uygula</button>
        </div>
      ) : null}

      <section aria-label="Modül renkleri" className="card rounded-[20px] px-3.5 py-1 flex flex-col" data-testid="module-colors-editor">
        {shown.map((m, i) => (
          <label key={m.id} className={`min-h-[52px] flex items-center justify-between gap-3 cursor-pointer ${i ? 'border-t border-line' : ''}`} data-module-row={m.id}>
            <b className="text-[14.5px]">{m.label}</b>
            <span data-mod={m.id} className="w-8 h-8 rounded-full border-2 border-line-2 relative overflow-hidden shrink-0 bg-acc" style={mc[m.id] ? { background: modulePalette(color(m.id)).accD } : undefined}>
              <span className="sr-only">{m.label} rengi</span>
              <input type="color" value={color(m.id)} onChange={(e) => saveColors({ ...mc, [m.id]: e.target.value.toUpperCase() }, 'Renkler kaydedildi', 500)} className="absolute inset-0 opacity-0 cursor-pointer" data-testid={`module-color-${m.id}`} />
            </span>
          </label>
        ))}
        {!more ? (
          <button type="button" onClick={() => setMore(true)} className="min-h-[52px] flex items-center justify-between gap-3 border-t border-line text-left" data-testid="module-more">
            <b className="text-[14.5px] truncate">{rest.map((m) => m.label).join(', ')}</b><span className="text-[12.5px] text-mute shrink-0">{rest.length} daha ›</span>
          </button>
        ) : null}
      </section>

      <section aria-label="Stil" className="card rounded-[20px] p-3.5 flex flex-col gap-3">
        <div className="flex flex-col gap-2" data-testid="st-radius">
          <span className="text-[13px] font-bold">Köşeler</span>
          <div role="radiogroup" aria-label="Köşeler" className="grid grid-cols-3 gap-2">
            {([['sharp', 'Keskin', 'rounded-[4px]'], ['normal', 'Yumuşak', 'rounded-[12px]'], ['round', 'Yuvarlak', 'rounded-full']] as const).map(([v, l, r]) => (
              <button key={v} type="button" role="radio" aria-checked={s.radius === v} onClick={() => saveStyle({ radius: v })} className={`${pill} ${r}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2" data-testid="st-font">
          <span className="text-[13px] font-bold">Yazı tipi</span>
          <div role="radiogroup" aria-label="Yazı tipi" className="grid grid-cols-3 gap-2">
            {([['default', 'Manrope', 'font-sans'], ['grotesk', 'Grotesk', 'num'], ['serif', 'Klasik', '[font-family:Georgia,serif]']] as const).map(([v, l, f]) => (
              <button key={v} type="button" role="radio" aria-checked={s.font === v} onClick={() => saveStyle({ font: v })} className={`${pill} ${f} text-[14px]`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3" data-testid="st-density">
          <span className="text-[13px] font-bold">Yoğunluk</span>
          <div role="radiogroup" aria-label="Yoğunluk" className="flex p-1 rounded-[12px] bg-surface-2 gap-1">
            {([['compact', 'Sıkı'], ['normal', 'Normal'], ['airy', 'Ferah']] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={s.density === v} onClick={() => saveStyle({ density: v })}
                className="min-h-9 px-3 rounded-[9px] text-[13px] font-bold text-mute aria-checked:bg-surface-3 aria-checked:text-ink">{l}</button>
            ))}
          </div>
        </div>
      </section>

      <Link href="/profil/ozellestirme/stil/daha" className="card rounded-[20px] min-h-[52px] px-3.5 flex items-center justify-between gap-3" data-testid="style-more">
        <b className="text-[14px]">Daha fazla: simgeler, birimler, ses, erişilebilirlik</b><span className="text-mute">›</span>
      </Link>
      {msg ? <p role="status" className="text-[13px] font-bold text-ink-2 px-1">{msg}</p> : null}
      <p className="text-[12px] text-mute leading-relaxed">Bir kartın rengini yalnız o kartta değiştirmek için ekranda düzenleme modunda ✎’ye dokun.</p>
    </div>
  )
}
