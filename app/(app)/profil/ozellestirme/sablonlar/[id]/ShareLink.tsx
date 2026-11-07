'use client'
// Ö3c: şablon bağlantısı + QR (girişsiz önizleme sayfası /t/[id]). QR sunucuda kütüphaneyle üretilmiş SVG'dir (kullanıcı metni içermez).
import { useState } from 'react'

export default function ShareLink({ link, qr, name }: { link: string; qr: string; name: string }) {
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <section aria-label="Bağlantı ve QR" className="card p-4 flex flex-col gap-2 items-center" data-testid="share-link">
      <b className="self-start text-[15px]">Bağlantı ve QR</b>
      <span className="self-start text-[12.5px] text-mute">Uygulamayı kullanmayanlar da girişsiz önizleyebilir.</span>
      <div className="w-[168px] h-[168px] rounded-xl overflow-hidden bg-white" aria-label="QR kod" role="img" dangerouslySetInnerHTML={{ __html: qr }} />
      <code className="text-[12px] text-ink-2 break-all text-center" data-testid="share-url">{link}</code>
      <div className="flex gap-2">
        <button type="button" onClick={() => navigator.clipboard?.writeText(link).then(() => setMsg('Bağlantı kopyalandı'), () => setMsg('Kopyalanamadı'))} className="h-10 px-4 rounded-full border border-line-2 text-[13px] font-bold">Kopyala</button>
        <button type="button" onClick={() => (navigator.share ? navigator.share({ title: name, url: link }).catch(() => null) : setMsg('Paylaşım bu tarayıcıda yok; bağlantıyı kopyala'))} className="h-10 px-4 rounded-full bg-acc text-acc-ink text-[13px] font-extrabold">Paylaş</button>
      </div>
      {msg ? <p role="status" className="text-[12.5px] font-bold text-ink-2">{msg}</p> : null}
    </section>
  )
}
