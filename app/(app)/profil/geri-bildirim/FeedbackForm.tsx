'use client'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FEEDBACK_AREAS, FEEDBACK_KINDS, type FeedbackKind } from '@/lib/access'
import { shrinkImage } from '@/lib/client-image'
import { btn } from '@/components/ui'
import { Bug, Bulb, Check, Close, Flag, Help, Image as ImageIcon } from '@/components/icons'
import { sendFeedbackAction } from './actions'

const ICON = { oneri: Bulb, hata: Bug, sikayet: Flag, diger: Help } as const
const PLACEHOLDER: Record<FeedbackKind, string> = {
  oneri: 'Ne eklensin ya da nasıl değişsin? Neden işine yarar?',
  hata: 'Ne yaptın, ne olmasını bekliyordun, ne oldu? Adım adım yazarsan hemen buluruz.',
  sikayet: 'Neyden memnun kalmadın? Ne olsaydı daha iyi olurdu?',
  diger: 'Aklındakini yaz.',
}

export default function FeedbackForm({ photo }: { photo: boolean }) {
  const router = useRouter()
  const [kind, setKind] = useState<FeedbackKind | null>(null)
  const [area, setArea] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [img, setImg] = useState<{ id: string; url: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [pending, start] = useTransition()
  const file = useRef<HTMLInputElement>(null)

  async function pick(f: File | undefined) {
    if (!f) return
    setUploading(true); setMsg(null)
    try {
      const small = await shrinkImage(f, 1600, 0.85)
      const fd = new FormData(); fd.set('file', small, 'ekran.jpg'); fd.set('kind', 'feedback')
      const r = await fetch('/api/media', { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Yüklenemedi')
      setImg({ id: j.id, url: URL.createObjectURL(small) })
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }) }
    finally { setUploading(false); if (file.current) file.current.value = '' }
  }

  function submit() {
    if (!kind) return
    setMsg(null)
    start(async () => {
      const device = { ua: navigator.userAgent, screen: `${window.innerWidth}×${window.innerHeight}@${window.devicePixelRatio}`, theme: document.documentElement.dataset.theme ?? 'auto' }
      const r = await sendFeedbackAction({ kind, area, body, mediaId: img?.id ?? null, device })
      if (!r.ok) { setMsg({ ok: false, t: r.error }); return }
      setKind(null); setArea(null); setBody(''); setImg(null)
      setMsg({ ok: true, t: 'Teşekkürler! Mesajın bize ulaştı. Yanıt verdiğimizde aşağıda görünecek.' })
      router.refresh()
    })
  }

  const len = body.trim().length
  return (
    <section className="card p-4 flex flex-col gap-4" aria-label="Yeni geri bildirim" data-testid="feedback-form">
      <div className="flex flex-col gap-2">
        <span className="text-[14px] font-bold">Ne hakkında?</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tür">
          {(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map((k) => {
            const I = ICON[k]; const on = kind === k
            return (
              <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setKind(k)}
                className={`text-left rounded-2xl border p-3 flex flex-col gap-1.5 transition active:scale-[0.98] ${on ? 'border-acc bg-acc/10' : 'border-line bg-surface-2'}`}>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? 'bg-acc text-acc-ink' : 'bg-surface-3 text-ink-2'}`}><I size={19} /></span>
                <b className="text-[14px] leading-tight">{FEEDBACK_KINDS[k].label}</b>
                <span className="text-[12px] text-mute leading-snug">{FEEDBACK_KINDS[k].hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      {kind ? (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-[14px] font-bold">Hangi bölüm? <span className="text-mute font-semibold">(isteğe bağlı)</span></span>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_AREAS.map((a) => (
                <button key={a} type="button" aria-pressed={area === a} onClick={() => setArea(area === a ? null : a)}
                  className={`h-9 px-3.5 rounded-full text-[13px] font-bold border transition ${area === a ? 'bg-acc text-acc-ink border-acc' : 'border-line-2 text-ink-2'}`}>{a}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fb-body" className="text-[14px] font-bold">Anlat</label>
            <textarea id="fb-body" value={body} onChange={(e) => setBody(e.target.value.slice(0, 2000))} rows={6} placeholder={PLACEHOLDER[kind]}
              className="w-full rounded-2xl bg-surface-2 border border-line px-4 py-3 text-[16px] leading-relaxed outline-none focus:border-acc resize-none" />
            <span className={`text-[12px] text-right num ${len && len < 10 ? 'text-orange' : 'text-mute'}`}>{len < 10 ? `en az 10 karakter · ${len}` : `${len} / 2000`}</span>
          </div>
          {photo ? (
            img ? (
              <div className="flex items-center gap-3 rounded-2xl border border-line p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="Eklenen ekran görüntüsü" className="w-16 h-16 rounded-xl object-cover" />
                <span className="text-[13px] font-semibold flex-1">Ekran görüntüsü eklendi</span>
                <button type="button" className={btn.icon} aria-label="Görüntüyü kaldır" onClick={() => setImg(null)}><Close size={18} /></button>
              </div>
            ) : (
              <label className={`${btn.secondary} w-full cursor-pointer ${uploading ? 'opacity-60' : ''}`}>
                <ImageIcon size={18} /> {uploading ? 'Yükleniyor…' : 'Ekran görüntüsü ekle'}
                <input ref={file} type="file" accept="image/*" className="sr-only" data-testid="feedback-photo" disabled={uploading} onChange={(e) => pick(e.target.files?.[0])} />
              </label>
            )
          ) : null}
          <p className="text-[12px] text-mute leading-snug">Sorunu bulabilmemiz için tarayıcı, ekran boyutu ve tema bilgisi de eklenir. Kişisel sağlık verilerin gönderilmez.</p>
          <button type="button" className={btn.primary} disabled={pending || uploading || len < 10} onClick={submit}>{pending ? 'Gönderiliyor…' : 'Gönder'}</button>
        </>
      ) : null}
      {msg ? <p role="status" className={`text-[14px] font-semibold flex gap-2 ${msg.ok ? 'text-good' : 'text-danger'}`}>{msg.ok ? <Check size={18} className="shrink-0 mt-0.5" /> : null}{msg.t}</p> : null}
    </section>
  )
}
