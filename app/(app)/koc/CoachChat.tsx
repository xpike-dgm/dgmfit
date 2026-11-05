'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import { btn, TopBar } from '@/components/ui'
import { Gear, Mic, Spark, Trash } from '@/components/icons'
import { fmtNum } from '@/lib/calc'
import { SUPPORT } from '@/lib/safety'
import type { MessageView, StoredAction } from '@/lib/coach-data'
import { coachDecisionAction, deleteConversationAction, saveCoachPrefsAction, sendCoachAction } from './actions'

type Recog = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: (e: { error: string }) => void; onend: () => void }
type Conv = { id: string; title: string; updatedAt: string }
const PROVIDER: Record<string, string> = { claude: 'Claude', openai: 'OpenAI' }
const SUGGEST = ['Bu hafta neden kilo vermedim?', 'Bu akşam 2 dilim pizza yersem ne olur?', 'Neden öğleden sonra su içmeyi unutuyorum?', 'Hedef tarihimi 2 hafta uzat', 'Bacak gününe bir hareket ekle']

export default function CoachChat(p: {
  aiOn: boolean; conversationId: string | null; initial: MessageView[]; draft: string; conversations: Conv[]
  prefs: { persona: string; insights: boolean; weeklyPush: boolean }; personas: { id: string; label: string; hint: string }[]; left: number
}) {
  const [conv, setConv] = useState(p.conversationId)
  const [msgs, setMsgs] = useState<MessageView[]>(p.initial)
  const [text, setText] = useState(p.draft)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [left, setLeft] = useState(p.left)
  const [sheet, setSheet] = useState<null | 'settings' | 'history'>(null)
  const [prefs, setPrefs] = useState(p.prefs)
  const [listening, setListening] = useState(false)
  const [speech, setSpeech] = useState(false)
  const [, start] = useTransition()
  const rec = useRef<Recog | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const router = useRouter()
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    setSpeech(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
    return () => rec.current?.stop()
  }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, busy])

  const send = async (t: string) => {
    const q = t.trim()
    if (q.length < 2 || busy) return
    setBusy(true); setErr(null)
    const temp: MessageView = { id: 'tmp', role: 'user', content: q, actions: [], whatIf: null, safety: null, provider: null, createdAt: new Date().toISOString() }
    setMsgs((m) => [...m, temp]); setText('')
    const r = await sendCoachAction({ conversationId: conv, text: q }).catch(() => ({ ok: false as const, error: 'Bağlantı yok: koç için internet gerekli.' }))
    if (!r.ok) { setMsgs((m) => m.filter((x) => x.id !== 'tmp')); setText(q); setErr(r.error); setBusy(false); return }
    setMsgs((m) => [...m.filter((x) => x.id !== 'tmp'), r.user, r.reply])
    if (!conv) { setConv(r.conversationId); window.history.replaceState(null, '', `/koc?s=${r.conversationId}`) }
    if (r.reply.provider) setLeft((n) => Math.max(0, n - 1))
    setBusy(false)
  }
  const decide = (m: MessageView, i: number, decision: 'confirm' | 'cancel') => start(async () => {
    const r = await coachDecisionAction({ messageId: m.id, index: i, decision })
    if (!r.ok) { setErr(r.error); return }
    setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, actions: x.actions.map((a, k) => (k === i ? r.action : a)) } : x)))
    router.refresh()
  })
  const listen = () => {
    const w = window as unknown as { SpeechRecognition?: new () => Recog; webkitSpeechRecognition?: new () => Recog }
    const C = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!C) return
    const r = new C()
    r.lang = 'tr-TR'; r.interimResults = true
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(' '))
    r.onerror = (e) => { setErr(e.error === 'not-allowed' ? 'Mikrofon izni verilmedi.' : 'Ses anlaşılamadı, yazarak deneyebilirsin.'); setListening(false) }
    r.onend = () => setListening(false)
    rec.current = r; setListening(true); r.start()
  }
  const persona = p.personas.find((x) => x.id === prefs.persona) ?? p.personas[0]

  return (
    <div className="px-4 pt-4 flex flex-col gap-3 min-h-[calc(100dvh-140px)]">
      <TopBar back="/" title="Koç" right={<button type="button" className={btn.icon} aria-label="Koç ayarları" onClick={() => setSheet('settings')}><Gear size={20} /></button>} />
      <div className="flex items-center gap-2 px-1">
        <span className="text-[13px] text-mute">Kişilik: <b className="text-ink">{persona.label}</b></span>
        <button type="button" className="ml-auto h-9 px-3 rounded-full bg-surface-2 text-[13px] font-semibold" onClick={() => setSheet('history')}>Sohbetler</button>
        <Link href="/koc?yeni=1" className="h-9 px-3 rounded-full bg-surface-2 text-[13px] font-semibold inline-flex items-center">Yeni</Link>
      </div>

      {!p.aiOn ? <p role="alert" className="card p-4 text-[14px] text-orange">AI koç şu an kullanılamıyor (sağlayıcı yok ya da limitler doldu). Günlük içgörü ve haftalık rapor kural tabanlı çalışmaya devam eder.</p> : null}

      <div className="flex flex-col gap-3 flex-1" aria-live="polite" data-testid="coach-messages">
        {!msgs.length ? (
          <div className="card p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2"><Spark size={18} className="text-lime" /><span className="font-bold">Merhaba! Tüm verilerine bakarak cevap veririm.</span></div>
            <p className="text-[13px] text-mute">Kalori, su, antrenman ve kilo trendini birlikte yorumlarım. Hedef tarihini değiştirmek, programa hareket eklemek ya da su kaydı gibi işleri önerebilirim; sen onaylamadan hiçbir şey değişmez.</p>
            <div className="flex flex-wrap gap-2">{SUGGEST.map((s) => <button key={s} type="button" className="text-left text-[13px] px-3 py-2 rounded-2xl bg-surface-2" disabled={!p.aiOn || busy} onClick={() => void send(s)}>{s}</button>)}</div>
          </div>
        ) : null}
        {msgs.map((m) => (m.role === 'user' ? (
          <div key={m.id} className="self-end max-w-[85%] rounded-[20px] rounded-br-md bg-lime text-lime-ink px-4 py-2.5 text-[15px] whitespace-pre-wrap" data-testid="msg-user">{m.content}</div>
        ) : (
          <div key={m.id} className="self-start max-w-[92%] flex flex-col gap-2" data-testid="msg-coach">
            {m.safety === 'crisis' || m.safety === 'ed' ? <SupportCard kind={m.safety} /> : null}
            <div className="rounded-[20px] rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</div>
            {m.safety === 'medical' ? <p className="text-[12px] text-mute px-1">Sağlık sorunu, ilaç ya da sakatlık konusunda hekimine danış; koç tıbbi tavsiye vermez.</p> : null}
            {m.whatIf ? <WhatIfCard w={m.whatIf} /> : null}
            {m.actions.map((a, i) => <ActionCard key={i} a={a} onDecide={(d) => decide(m, i, d)} />)}
            {m.provider ? <span className="text-[11px] text-faint px-1">{PROVIDER[m.provider] ?? m.provider}</span> : null}
          </div>
        )))}
        {busy ? <div className="self-start rounded-[20px] bg-surface-2 px-4 py-3 text-[14px] text-mute animate-pulse" aria-busy="true">Koç düşünüyor…</div> : null}
        <div ref={end} />
      </div>

      {err ? <p role="alert" className="text-[13px] text-orange px-1">{err}</p> : null}
      <form className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] bg-bg pt-2 pb-1 flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); void send(text) }}>
        <div className="flex gap-2 items-end">
          <label htmlFor="coach-input" className="sr-only">Koça yaz</label>
          <textarea id="coach-input" rows={1} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} disabled={!p.aiOn}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text) } }}
            placeholder="Koça sor…" className="flex-1 min-h-12 max-h-32 rounded-[22px] bg-surface-2 border border-line px-4 py-3 text-ink resize-none" />
          {speech ? <button type="button" onClick={() => (listening ? rec.current?.stop() : listen())} aria-pressed={listening} aria-label={listening ? 'Dinlemeyi durdur' : 'Söyle'} disabled={!p.aiOn}
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${listening ? 'bg-lime text-lime-ink animate-pulse' : 'bg-surface-2 text-lime'}`}><Mic size={22} /></button> : null}
          <button type="submit" className="h-12 px-5 rounded-full bg-lime text-lime-ink font-extrabold shrink-0 disabled:opacity-40" disabled={!p.aiOn || busy || text.trim().length < 2}>Gönder</button>
        </div>
        <span className="text-[11px] text-faint px-2" data-testid="coach-left">Bugün kalan AI hakkı: {left} · Koç tıbbi tavsiye vermez.</span>
      </form>

      <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} title="Koç ayarları">
        <form className="flex flex-col gap-4 pb-5" onSubmit={(e) => { e.preventDefault(); start(async () => { await saveCoachPrefsAction(prefs); setSheet(null); router.refresh() }) }}>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-bold mb-1">Kişilik</legend>
            {p.personas.map((x) => (
              <label key={x.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${prefs.persona === x.id ? 'border-lime bg-surface-2' : 'border-line'}`}>
                <input type="radio" name="persona" value={x.id} checked={prefs.persona === x.id} onChange={() => setPrefs({ ...prefs, persona: x.id })} className="accent-[var(--color-lime)] w-4 h-4" />
                <span className="flex flex-col"><span className="font-bold">{x.label}</span><span className="text-[12px] text-mute">{x.hint}</span></span>
              </label>
            ))}
          </fieldset>
          <label className="flex items-center justify-between gap-3 text-[14px] font-semibold">Bugün ekranında günlük içgörü
            <input type="checkbox" checked={prefs.insights} onChange={(e) => setPrefs({ ...prefs, insights: e.target.checked })} className="w-5 h-5 accent-[var(--color-lime)]" /></label>
          <label className="flex items-center justify-between gap-3 text-[14px] font-semibold">Pazar akşamı haftalık rapor bildirimi
            <input type="checkbox" checked={prefs.weeklyPush} onChange={(e) => setPrefs({ ...prefs, weeklyPush: e.target.checked })} className="w-5 h-5 accent-[var(--color-lime)]" /></label>
          <p className="text-[12px] text-mute">Mesajların yalnızca sana cevap üretmek için AI sağlayıcısına gönderilir; model eğitiminde kullanılmaz. Sohbetleri istediğin zaman silebilirsin.</p>
          <button type="submit" className={btn.primary}>Kaydet</button>
          <Link href="/rapor" className={btn.secondary}>Haftalık raporlar</Link>
        </form>
      </Sheet>

      <Sheet open={sheet === 'history'} onClose={() => setSheet(null)} title="Sohbetler">
        <ul className="flex flex-col gap-2 pb-5">
          {p.conversations.length ? p.conversations.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-2xl bg-surface-2 pl-4 pr-1 py-1">
              <Link href={`/koc?s=${c.id}`} className="flex-1 py-2 text-[14px] font-semibold truncate" onClick={() => setSheet(null)}>{c.title}</Link>
              <button type="button" className={btn.icon} aria-label={`${c.title} sohbetini sil`} onClick={() => start(async () => { if (!confirm('Bu sohbet kalıcı olarak silinsin mi?')) return; await deleteConversationAction(c.id); setSheet(null); router.push('/koc?yeni=1') })}><Trash size={18} /></button>
            </li>
          )) : <li className="text-[14px] text-mute">Henüz sohbet yok.</li>}
        </ul>
      </Sheet>
    </div>
  )
}

function SupportCard({ kind }: { kind: 'crisis' | 'ed' }) {
  const s = SUPPORT[kind]
  return (
    <div role="note" className="rounded-[20px] border border-water/50 bg-surface px-4 py-3 flex flex-col gap-1" data-testid="support-card">
      <span className="font-bold text-water">{s.title}</span>
      <p className="text-[14px] leading-relaxed text-ink-2">{s.body}</p>
      {kind === 'crisis' ? <a href="tel:112" className="mt-1 self-start h-10 px-4 rounded-full bg-water text-water-ink font-bold inline-flex items-center">112'yi ara</a> : null}
    </div>
  )
}

function WhatIfCard({ w }: { w: NonNullable<MessageView['whatIf']> }) {
  const days = w.spread.length, avg = days ? Math.round(-w.spread.reduce((a, s) => a + s.kcal, 0) / days) : 0
  return (
    <div className="rounded-[20px] border border-line bg-surface px-4 py-3 flex flex-col gap-2" data-testid="whatif">
      <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Ne olur? · veritabanından</span>
      <ul className="flex flex-col gap-1 text-[14px]">
        {w.items.map((it, i) => (
          <li key={i} className="flex justify-between gap-2"><span>{it.foodName ?? it.name} <span className="text-mute">· {fmtNum(it.grams)} g</span></span>
            <span className="num font-bold">{it.kcal === null ? 'eşleşme yok' : `${fmtNum(it.kcal)} kcal`}</span></li>
        ))}
      </ul>
      <p className="text-[14px]">Bugünkü kalan bütçe: <b className="num">{fmtNum(w.remainingBefore)}</b> → <b className={`num ${w.remainingAfter < 0 ? 'text-orange' : 'text-lime'}`} data-testid="whatif-after">{fmtNum(w.remainingAfter)} kcal</b></p>
      <p className="text-[13px] text-ink-2">{w.diff > 0
        ? <>Gün böyle kapanırsa <b className="num">{fmtNum(w.diff)} kcal</b> fark sonraki {days} güne dağıtılır (günde ortalama {fmtNum(avg)} kcal daha az){w.leftover ? `; ${fmtNum(Math.abs(w.leftover))} kcal sığmaz` : ''}.</>
        : 'Bütçe içinde kalırsın; sonraki günlere etkisi olmaz.'}</p>
      {w.unmatched ? <p className="text-[12px] text-mute">{w.unmatched} besin veritabanında bulunamadı, toplama katılmadı.</p> : null}
    </div>
  )
}

function ActionCard({ a, onDecide }: { a: StoredAction; onDecide: (d: 'confirm' | 'cancel') => void }) {
  return (
    <div className="rounded-[20px] border border-coach-line bg-coach px-4 py-3 flex flex-col gap-2" data-testid="coach-action" data-status={a.status}>
      <span className="text-[14px] font-semibold">{a.label}</span>
      {a.status === 'pending' ? (
        <div className="flex gap-2">
          <button type="button" className="h-10 px-4 rounded-full bg-lime text-lime-ink font-bold text-[14px]" onClick={() => onDecide('confirm')}>Onayla</button>
          <button type="button" className="h-10 px-4 rounded-full border border-line-2 font-bold text-[14px]" onClick={() => onDecide('cancel')}>Vazgeç</button>
        </div>
      ) : <span className={`text-[13px] ${a.status === 'done' ? 'text-lime' : a.status === 'invalid' ? 'text-orange' : 'text-mute'}`}>{a.status === 'done' ? 'Uygulandı' : a.status === 'cancelled' ? 'Vazgeçildi' : a.error ?? 'Uygulanamadı'}</span>}
      {a.type === 'plan_menu' && a.status === 'done' ? <Link href="/yemek/plan" className="self-start text-[13px] font-bold text-lime">Menüyü aç</Link> : null}
      {a.type === 'goal_date' && a.status === 'pending' ? <span className="text-[12px] text-mute">Günlük kalorin bir sonraki haftalık check-in'de yeni tarihe göre ayarlanır.</span> : null}
    </div>
  )
}
