'use client'
// G1: tarayıcının confirm()/prompt() pencereleri yerine uygulama içi onay penceresi (kullanıcı: "web penceresi çıkıyor,
// uygulama hissinden çıkarıyor"). `ask` / `askText` her yerden çağrılır; (app) yerleşimindeki <ConfirmHost/> gösterir.
import { useEffect, useRef, useState } from 'react'
import { inferOk } from '@/lib/confirm'

export interface AskOptions { title?: string; ok?: string; cancel?: string; danger?: boolean }
interface Req extends AskOptions { message: string; input?: { placeholder?: string; initial?: string }; resolve: (v: boolean | string | null) => void }

let push: ((r: Req) => void) | null = null
/** İstek bir sonraki turda kuyruğa girer: `startTransition(async …)` içinden çağrılınca da pencere hemen açılsın
 *  (React 19'da geçiş içindeki durum güncellemesi işlem bitene kadar ekrana yansımaz → pencere hiç açılmıyordu). */
const enqueue = (r: Req) => { window.setTimeout(() => (push ? push(r) : r.resolve(r.input ? window.prompt(r.message) : window.confirm(r.message))), 0) }

export function ask(message: string, o: AskOptions = {}): Promise<boolean> {
  if (!push) return Promise.resolve(window.confirm(message))
  return new Promise((resolve) => enqueue({ message, ...o, resolve: (v) => resolve(v === true) }))
}

export function askText(message: string, o: AskOptions & { placeholder?: string; initial?: string } = {}): Promise<string | null> {
  if (!push) return Promise.resolve(window.prompt(message))
  return new Promise((resolve) => enqueue({ message, ...o, input: { placeholder: o.placeholder, initial: o.initial }, resolve: (v) => resolve(typeof v === 'string' ? v : null) }))
}

export default function ConfirmHost() {
  const [q, setQ] = useState<Req[]>([])
  const [text, setText] = useState('')
  const ref = useRef<HTMLDialogElement>(null)
  const cur = q[0]
  useEffect(() => { push = (r) => setQ((x) => [...x, r]); return () => { push = null } }, [])
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (cur && !d.open) { setText(cur.input?.initial ?? ''); d.showModal() }
    if (!cur && d.open) d.close()
  }, [cur])
  const done = (v: boolean) => {
    if (!cur) return
    cur.resolve(cur.input ? (v ? text : null) : v)
    setQ((x) => x.slice(1))
  }
  const inf = cur ? inferOk(cur.message) : { ok: 'Tamam', danger: false }
  const ok = cur?.ok ?? inf.ok, danger = cur?.danger ?? inf.danger
  return (
    <dialog ref={ref} role="alertdialog" aria-label={cur?.title ?? 'Onay'} data-testid="confirm"
      onCancel={(e) => { e.preventDefault(); done(false) }}
      onClick={(e) => { if (e.target === ref.current) done(false) }}
      className="m-auto w-[min(100%-32px,380px)] bg-transparent p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-[popIn_.2s_cubic-bezier(.2,.8,.2,1)]">
      {cur ? (
        <form method="dialog" onSubmit={(e) => { e.preventDefault(); done(true) }} className="rounded-[26px] bg-surface border border-line-2 p-5 flex flex-col gap-4 text-ink shadow-2xl">
          <div className="flex flex-col gap-1.5">
            {cur.title ? <b className="text-[17px] font-extrabold leading-tight">{cur.title}</b> : null}
            <p className={`${cur.title ? 'text-[14px] text-ink-2' : 'text-[16px] font-bold'} leading-snug`} data-testid="confirm-message">{cur.message}</p>
          </div>
          {cur.input ? (
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={cur.input.placeholder} maxLength={300}
              className="h-12 rounded-[14px] bg-surface-2 border border-line-2 px-3.5 text-[15px] outline-none focus:border-acc" data-testid="confirm-input" />
          ) : null}
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => done(false)} className="min-h-12 rounded-full bg-surface-2 border border-line-2 text-[14.5px] font-bold" data-testid="confirm-cancel">{cur.cancel ?? 'Vazgeç'}</button>
            <button type="submit" autoFocus={!cur.input} disabled={!!cur.input && !text.trim()}
              className={`min-h-12 rounded-full text-[14.5px] font-extrabold disabled:opacity-40 ${danger ? 'bg-[#E5484D] text-white' : 'bg-acc text-acc-ink'}`} data-testid="confirm-ok">{ok}</button>
          </div>
        </form>
      ) : null}
    </dialog>
  )
}
