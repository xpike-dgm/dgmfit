'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { feedbackReplyAction, feedbackStatusAction } from '../../actions'

type R = { ok: true; msg?: string } | { ok: false; error: string }
const QUICK = ['Teşekkürler, not aldık! Bir sonraki güncellemede bakacağız.', 'Düzelttik, uygulamayı yenileyip tekrar dener misin?', 'Biraz daha ayrıntı verebilir misin? Hangi ekranda, ne yaptığında oldu?']

export default function Reply({ id, status, hasReply }: { id: string; status: string; hasReply: boolean }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [close, setClose] = useState(true)
  const [msg, setMsg] = useState<R | null>(null)
  const [pending, start] = useTransition()
  const go = (f: () => Promise<R>, clear = false) => start(async () => { const r = await f(); setMsg(r); if (r.ok && clear) setText(''); router.refresh() })
  return (
    <section className="card p-4 flex flex-col gap-3" aria-label="Yanıtla">
      <h2 className="text-[15px] font-extrabold">{hasReply ? 'Yeni yanıt yaz' : 'Yanıtla'}</h2>
      <div className="flex flex-col gap-1.5">
        {QUICK.map((q) => <button key={q} type="button" onClick={() => setText(q)} className="text-left text-[13px] rounded-xl border border-line px-3 py-2 text-ink-2">{q}</button>)}
      </div>
      <textarea id="fb-reply" value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} rows={4} placeholder="Kullanıcıya yanıtın (geri bildirim sayfasında görür, bildirim açıksa telefonuna da gider)"
        className="w-full rounded-2xl bg-surface-2 border border-line px-4 py-3 text-[16px] outline-none focus:border-acc resize-none" />
      <label className="flex items-center gap-2.5 text-[14px] font-semibold"><input type="checkbox" checked={close} onChange={(e) => setClose(e.target.checked)} className="w-5 h-5" /> Yanıtla ve çözüldü olarak işaretle</label>
      <button type="button" className={btn.primary + ' h-12 text-[15px]'} disabled={pending || text.trim().length < 2} onClick={() => go(() => feedbackReplyAction(id, text, close), true)}>Yanıtı gönder</button>
      <div className="grid grid-cols-2 gap-2">
        {status !== 'done' ? <button type="button" disabled={pending} className={btn.secondary} onClick={() => go(() => feedbackStatusAction(id, 'done'))} data-testid="fb-done">Çözüldü</button>
          : <button type="button" disabled={pending} className={btn.secondary} onClick={() => go(() => feedbackStatusAction(id, 'seen'))}>Yeniden aç</button>}
        <button type="button" disabled={pending || status === 'new'} className={btn.secondary} onClick={() => go(() => feedbackStatusAction(id, 'new'))}>Okunmadı yap</button>
      </div>
      {msg ? <p role="status" className={`text-[13px] font-semibold ${msg.ok ? 'text-good' : 'text-danger'}`}>{msg.ok ? msg.msg : msg.error}</p> : null}
    </section>
  )
}
