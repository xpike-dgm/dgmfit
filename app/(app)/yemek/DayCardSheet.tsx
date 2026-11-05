'use client'
import { useEffect, useState } from 'react'
import Sheet from '@/components/Sheet'
import { btn, hdrIcon } from '@/components/ui'
import { Check, Download, Share } from '@/components/icons'
import { CARD_KINDS, type CardKind } from '@/lib/day-card'

/** Yemek bandının sağ üstündeki Kaydet: günün özetini iki şablondan biriyle PNG olarak indirir ya da paylaşır. */
export default function DayCardSheet({ day }: { day: string }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<CardKind>('a')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [canShare, setCanShare] = useState(false)
  // Önizlemeler pencere her açıldığında taze üretilir (gün içinde değişen kayıtlar)
  const [stamp, setStamp] = useState(0)
  useEffect(() => { if (open) { setStamp(Date.now()); setMsg(null) } }, [open])
  useEffect(() => {
    try { setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([new Uint8Array(1)], 'x.png', { type: 'image/png' })] })) } catch { setCanShare(false) }
  }, [])
  const url = (k: CardKind) => `/api/yemek/gorsel?gun=${day}&tip=${k}&t=${stamp}`
  const name = `dgfit-${day}-${kind === 'a' ? 'kart' : 'hikaye'}.png`

  async function get(): Promise<Blob> {
    const r = await fetch(url(kind))
    if (!r.ok) throw new Error('Görsel oluşturulamadı')
    return r.blob()
  }
  async function save() {
    setBusy(true); setMsg(null)
    try {
      const blob = await get()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = name
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      setMsg({ ok: true, t: 'Görsel cihazına indirildi.' })
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy(false) }
  }
  async function share() {
    setBusy(true); setMsg(null)
    try {
      const blob = await get()
      await navigator.share({ files: [new File([blob], name, { type: 'image/png' })], title: 'DgFit günlük özet' })
    } catch (e) { if ((e as Error).name !== 'AbortError') setMsg({ ok: false, t: 'Paylaşılamadı; Görseli indir ile cihazına alabilirsin.' }) } finally { setBusy(false) }
  }

  return (
    <>
      <button type="button" className={hdrIcon} aria-label="Günün özet görseli" onClick={() => setOpen(true)} data-testid="daycard-open"><Download size={20} /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Günün özet görseli">
        <div className="flex flex-col gap-4 pb-4" data-testid="daycard-sheet">
          <p className="text-[13.5px] text-mute leading-snug">Aldığın kalori, makrolar, öğünler, mikro besinler, takviyeler ve su tek görselde. Şablonu seç:</p>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Şablon">
            {(Object.keys(CARD_KINDS) as CardKind[]).map((k) => {
              const on = kind === k
              return (
                <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setKind(k)} data-testid={`daycard-${k}`}
                  className={`rounded-2xl border-2 p-2 flex flex-col gap-2 text-left transition ${on ? 'border-acc bg-acc/10' : 'border-line'}`}>
                  <span className="relative block w-full rounded-xl overflow-hidden bg-surface-3" style={{ aspectRatio: `${CARD_KINDS[k].w} / ${CARD_KINDS[k].h}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {open && stamp ? <img src={url(k)} alt={`${CARD_KINDS[k].label} önizlemesi`} className="absolute inset-0 w-full h-full object-cover" /> : null}
                    {on ? <span className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-acc text-acc-ink flex items-center justify-center"><Check size={16} /></span> : null}
                  </span>
                  <span className="px-1"><b className="text-[14px] block">{CARD_KINDS[k].label}</b><span className="text-[12px] text-mute">{CARD_KINDS[k].hint}</span></span>
                </button>
              )
            })}
          </div>
          <button type="button" className={btn.primary} disabled={busy} onClick={save} data-testid="daycard-save"><Download size={20} /> {busy ? 'Hazırlanıyor…' : 'Görseli indir'}</button>
          {canShare ? <button type="button" className={btn.secondary} disabled={busy} onClick={share}><Share size={18} /> Paylaş</button> : null}
          {msg ? <p role="status" className={`text-[13.5px] font-semibold ${msg.ok ? 'text-good' : 'text-danger'}`}>{msg.t}</p> : null}
        </div>
      </Sheet>
    </>
  )
}
