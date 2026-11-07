'use client'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MODULES, PALETTES, modulePalette, paletteColors, photoModuleColors, quantize, type Hex, type ModuleColors as MC } from '@/lib/cards/colors'
import { saveModulesAction } from '../actions'

/** Fotoğrafı küçültüp piksellerini okur (tarayıcıda; fotoğraf sunucuya gönderilmez). */
async function photoColors(f: File): Promise<Hex[]> {
  const bmp = await createImageBitmap(f)
  const w = 72, h = Math.max(1, Math.round((bmp.height / bmp.width) * 72))
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, w, h)
  return quantize(ctx.getImageData(0, 0, w, h).data, 8)
}

export default function ModuleColors({ initial }: { initial: MC }) {
  const [mc, setMc] = useState<MC>(initial)
  const [photo, setPhoto] = useState<Hex[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const file = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const changed = JSON.stringify(mc) !== JSON.stringify(initial)
  const save = (v: MC | null) => start(async () => {
    const r = await saveModulesAction(v && Object.keys(v).length ? v : null).catch(() => null)
    setMsg(r?.ok ? 'Renkler kaydedildi' : r && !r.ok ? r.error : 'Kaydedilemedi')
    if (r?.ok) router.refresh()
  })
  const color = (id: (typeof MODULES)[number]['id']) => mc[id] ?? MODULES.find((m) => m.id === id)!.base
  return (
    <>
      <section aria-label="Modüller" className="card px-4 py-1 flex flex-col" data-testid="module-colors-editor">
        <h2 className="text-[15px] font-extrabold pt-3 pb-1">Modül renkleri</h2>
        <p className="text-[12.5px] text-mute pb-2 leading-snug">Bir modülün rengi o bölümün bandını, düğmelerini ve vurgularını değiştirir. Açık ve koyu tema için okunur tonlar otomatik seçilir.</p>
        {MODULES.map((m, i) => {
          const pal = modulePalette(color(m.id))
          return (
            <div key={m.id} className={`flex items-center gap-3 min-h-[60px] ${i ? 'border-t border-line' : ''}`} data-module-row={m.id}>
              <span aria-hidden className="w-16 h-10 rounded-xl shrink-0" style={{ background: `linear-gradient(160deg, ${pal.m1}, ${pal.m2})` }} />
              <span className="flex-1 flex flex-col"><b className="text-[15px]">{m.label}</b><span className="num text-[12px] text-mute">{mc[m.id] ? color(m.id) : 'varsayılan'}</span></span>
              <span aria-hidden className="h-8 px-3 rounded-full text-[12px] font-bold flex items-center" style={{ background: pal.accL, color: '#fff' }}>Düğme</span>
              <label className="w-10 h-10 rounded-full border-2 border-line-2 overflow-hidden relative cursor-pointer shrink-0" style={{ background: color(m.id) }}>
                <span className="sr-only">{m.label} rengi</span>
                <input type="color" value={color(m.id)} onChange={(e) => { setMc({ ...mc, [m.id]: e.target.value.toUpperCase() }); setMsg(null) }} className="absolute inset-0 opacity-0 cursor-pointer" data-testid={`module-color-${m.id}`} />
              </label>
            </div>
          )
        })}
      </section>

      <section aria-label="Hazır paletler" className="card p-4 flex flex-col gap-2" data-testid="palettes">
        <h2 className="text-[15px] font-extrabold">Hazır paletler</h2>
        <div className="grid grid-cols-2 gap-2">
          {PALETTES.map((p) => (
            <button key={p.id} type="button" onClick={() => { setMc(paletteColors(p.id)!); setMsg(`${p.name} uygulandı; kaydetmeyi unutma`) }} data-palette={p.id}
              className="rounded-[16px] bg-surface-2 border border-line p-2.5 flex flex-col gap-1.5 text-left">
              <span className="flex gap-0.5">{p.colors.map((c, i) => <span key={i} className="flex-1 h-5 first:rounded-l-md last:rounded-r-md" style={{ background: c }} />)}</span>
              <span className="text-[12.5px] font-bold leading-tight">{p.name}{p.a11y ? <span className="ml-1 text-[10.5px] font-extrabold text-acc">ERİŞİLEBİLİR</span> : null}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Fotoğraftan palet" className="card p-4 flex flex-col gap-2" data-testid="photo-palette">
        <h2 className="text-[15px] font-extrabold">Fotoğraftan palet</h2>
        <p className="text-[12.5px] text-mute leading-snug">Sevdiğin bir fotoğrafı seç; baskın renkleri modüllere dağıtılır. Fotoğraf yalnız telefonunda işlenir, yüklenmez.</p>
        <input ref={file} type="file" accept="image/*" className="sr-only" data-testid="photo-input"
          onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const cs = await photoColors(f); setPhoto(cs); setMsg(cs.length ? null : 'Fotoğrafta belirgin renk bulunamadı') } catch { setMsg('Fotoğraf okunamadı') } }} />
        <button type="button" onClick={() => file.current?.click()} className="h-11 rounded-full border border-line-2 font-bold text-[14px]">Fotoğraf seç</button>
        {photo?.length ? (
          <div className="flex flex-col gap-2" data-testid="photo-colors">
            <span className="flex gap-1">{photo.map((c) => <span key={c} className="flex-1 h-8 rounded-lg" style={{ background: c }} title={c} />)}</span>
            <button type="button" onClick={() => { setMc(photoModuleColors(photo)); setMsg('Fotoğraf paleti uygulandı; kaydetmeyi unutma') }} className="h-11 rounded-full bg-surface-2 border border-line font-bold text-[14px]" data-testid="photo-apply">Modüllere uygula</button>
          </div>
        ) : null}
      </section>

      {msg ? <p role="status" className="text-[13px] font-bold text-ink-2 px-1">{msg}</p> : null}
      <div className="flex gap-2">
        {Object.keys(initial).length ? <button type="button" disabled={pending} onClick={() => { setMc({}); save(null) }} className="h-12 px-4 rounded-full border border-line-2 font-bold text-[14px]">Varsayılana dön</button> : null}
        <button type="button" disabled={pending || !changed} onClick={() => save(mc)} className="flex-1 h-12 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40" data-testid="colors-save">Kaydet</button>
      </div>
    </>
  )
}
