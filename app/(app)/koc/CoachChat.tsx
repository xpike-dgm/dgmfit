'use client'
import AiOff from '@/components/AiOff'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import { btn, TopBar, hdrIcon } from '@/components/ui'
import { Chat, Gear, Mic, Next, Plus, Send, Spark, Trash } from '@/components/icons'
import { fmtNum } from '@/lib/calc'
import { SUPPORT } from '@/lib/safety'
import type { MessageView, StoredAction } from '@/lib/coach-data'
import { coachDecisionAction, deleteConversationAction, deleteMemoryAction, saveCoachPrefsAction, sendCoachAction } from './actions'
import { ask } from '@/components/Confirm'
import { addMealPlanAction } from '../yemek/actions'
import { MEALS, mealForTime, type MealId } from '@/lib/food'

type Recog = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: (e: { error: string }) => void; onend: () => void }
type Conv = { id: string; title: string; updatedAt: string }
const PROVIDER: Record<string, string> = { claude: 'Claude', openai: 'OpenAI' }
const SUGGEST = ['Bu hafta neden kilo vermedim?', 'Bu akşam 2 dilim pizza yersem ne olur?', 'Neden öğleden sonra su içmeyi unutuyorum?', 'Hedef tarihimi 2 hafta uzat', 'Bacak gününe bir hareket ekle']

export default function CoachChat(p: {
  aiOn: boolean; conversationId: string | null; initial: MessageView[]; draft: string; conversations: Conv[]; openSettings?: boolean
  prefs: { persona: string; insights: boolean; weeklyPush: boolean; nudges: boolean }; memories: { id: string; text: string }[]; personas: { id: string; label: string; hint: string }[]; left: number
}) {
  const [conv, setConv] = useState(p.conversationId)
  const [msgs, setMsgs] = useState<MessageView[]>(p.initial)
  const [text, setText] = useState(p.draft)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [left, setLeft] = useState(p.left)
  const [sheet, setSheet] = useState<null | 'settings' | 'history'>(p.openSettings ? 'settings' : null)
  const [prefs, setPrefs] = useState(p.prefs)
  const [mems, setMems] = useState(p.memories)
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
    const temp: MessageView = { id: 'tmp', role: 'user', content: q, actions: [], whatIf: null, mealPlan: null, safety: null, provider: null, createdAt: new Date().toISOString() }
    setMsgs((m) => [...m, temp]); setText('')
    const r = await sendCoachAction({ conversationId: conv, text: q }).catch(() => ({ ok: false as const, error: 'Bağlantı yok: koç için internet gerekli.' }))
    if (!r.ok) { setMsgs((m) => m.filter((x) => x.id !== 'tmp')); setText(q); setErr(r.error); setBusy(false); return }
    setMsgs((m) => [...m.filter((x) => x.id !== 'tmp'), r.user, r.reply])
    if (!conv) { setConv(r.conversationId); window.history.replaceState(null, '', `/koc?s=${r.conversationId}`) }
    if (r.reply.provider) setLeft((n) => Math.max(0, n - (r.calls || 1)))
    setMems(r.memories)
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

  const grow = (el: HTMLTextAreaElement | null) => { if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 148)}px` }
  const can = p.aiOn && !busy && text.trim().length >= 2

  return (
    <div className="px-4 flex flex-col h-dvh">
      <TopBar back="/" title="Koç" sub={<>{persona.label} · <span data-testid="coach-left">bugün {left} AI hakkı</span></>} right={
        <div className="flex gap-1.5">
          <button type="button" className={hdrIcon} aria-label="Sohbetler" onClick={() => setSheet('history')}><Chat size={19} /></button>
          <Link href="/koc?yeni=1" className={hdrIcon} aria-label="Yeni sohbet"><Plus size={19} /></Link>
          <button type="button" className={hdrIcon} aria-label="Koç ayarları" onClick={() => setSheet('settings')}><Gear size={19} /></button>
        </div>
      } />

      <div className="flex-1 overflow-y-auto overscroll-contain -mx-4 px-4 py-4 flex flex-col gap-3" aria-live="polite" data-testid="coach-messages">
        {!p.aiOn ? <AiOff what="AI koç sohbeti" alt={{ href: '/rapor', label: 'Kural tabanlı haftalık rapor' }} /> : null}
        {!msgs.length ? (
          <div className="flex flex-col items-center text-center gap-3 pt-4">
            <span className="w-16 h-16 rounded-[22px] band flex items-center justify-center shadow-sm"><Spark size={30} /></span>
            <h2 className="text-[20px] font-extrabold leading-tight">Merhaba, ben koçun</h2>
            <p className="text-[14px] text-ink-2 leading-relaxed max-w-[34ch]">Kalori, su, antrenman ve kilo verilerine bakarak cevap veririm. Önerdiğim bir değişiklik sen onaylamadan uygulanmaz.</p>
            <div className="w-full flex flex-col gap-2 mt-2">
              {SUGGEST.map((q) => (
                <button key={q} type="button" disabled={!p.aiOn || busy} onClick={() => void send(q)}
                  className="w-full text-left text-[14px] font-semibold px-4 min-h-12 rounded-2xl bg-surface border border-line flex items-center justify-between gap-3 disabled:opacity-50">
                  <span>{q}</span><Next size={16} className="text-acc shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {msgs.map((m) => (m.role === 'user' ? (
          <div key={m.id} className="self-end max-w-[85%] rounded-[22px] rounded-br-md bg-acc text-acc-ink px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words" data-testid="msg-user">{m.content}</div>
        ) : (
          <div key={m.id} className="self-start w-full flex gap-2 items-start" data-testid="msg-coach">
            <span className="w-8 h-8 rounded-xl band flex items-center justify-center shrink-0 mt-0.5" aria-hidden><Spark size={16} /></span>
            <div className="flex-1 min-w-0 flex flex-col gap-2 max-w-[calc(100%-40px)]">
              {m.safety === 'crisis' || m.safety === 'ed' ? <SupportCard kind={m.safety} /> : null}
              <div className="self-start rounded-[22px] rounded-tl-md bg-surface border border-line px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words">{m.content}</div>
              {m.safety === 'medical' ? <p className="text-[12px] text-mute px-1">Sağlık sorunu, ilaç ya da sakatlık konusunda hekimine danış; koç tıbbi tavsiye vermez.</p> : null}
              {m.whatIf ? <WhatIfCard w={m.whatIf} /> : null}
              {m.mealPlan ? <MealPlanCard p={m.mealPlan} /> : null}
              {m.actions.map((a, i) => <ActionCard key={i} a={a} onDecide={(d) => decide(m, i, d)} />)}
              {m.provider ? <span className="text-[11px] text-faint px-1">{PROVIDER[m.provider] ?? m.provider}</span> : null}
            </div>
          </div>
        )))}
        {busy ? (
          <div className="self-start flex gap-2 items-center" aria-busy="true" aria-label="Koç düşünüyor">
            <span className="w-8 h-8 rounded-xl band flex items-center justify-center shrink-0" aria-hidden><Spark size={16} /></span>
            <span className="rounded-[22px] rounded-tl-md bg-surface border border-line px-4 py-3.5 flex gap-1.5" aria-hidden>
              {[0, 1, 2].map((i) => <span key={i} className="w-2 h-2 rounded-full bg-mute animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />)}
            </span>
          </div>
        ) : null}
        <div ref={end} />
      </div>

      <form className="shrink-0 pt-2 pb-[max(env(safe-area-inset-bottom),10px)] flex flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); void send(text) }}>
        {err ? <p role="alert" className="text-[13px] text-danger px-2">{err}</p> : null}
        <div className={`flex items-end gap-1 rounded-[26px] bg-surface border px-2 py-1.5 transition-colors ${p.aiOn ? 'border-line focus-within:border-acc' : 'border-line opacity-60'}`}>
          <label htmlFor="coach-input" className="sr-only">Koça yaz</label>
          <textarea id="coach-input" ref={(el) => grow(el)} rows={1} maxLength={1000} value={text} disabled={!p.aiOn}
            onChange={(e) => { setText(e.target.value); grow(e.target) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text) } }}
            placeholder="Koça bir şey sor…" className="flex-1 min-w-0 bg-transparent px-2.5 py-2 text-[16px] leading-6 text-ink resize-none outline-none placeholder:text-faint" />
          {speech ? <button type="button" onClick={() => (listening ? rec.current?.stop() : listen())} aria-pressed={listening} aria-label={listening ? 'Dinlemeyi durdur' : 'Söyle'} disabled={!p.aiOn}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${listening ? 'bg-acc text-acc-ink animate-pulse' : 'text-mute'}`}><Mic size={20} /></button> : null}
          <button type="submit" aria-label="Gönder" disabled={!can}
            className="w-10 h-10 rounded-full bg-acc text-acc-ink flex items-center justify-center shrink-0 transition disabled:opacity-30 active:scale-95"><Send size={18} /></button>
        </div>
        <span className="text-[11px] text-faint text-center">Koç tıbbi tavsiye vermez · Enter gönderir, Shift+Enter yeni satır</span>
      </form>

      <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} title="Koç ayarları">
        <form className="flex flex-col gap-4 pb-5" onSubmit={(e) => { e.preventDefault(); start(async () => { await saveCoachPrefsAction(prefs); setSheet(null); router.refresh() }) }}>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-bold mb-1">Kişilik</legend>
            {p.personas.map((x) => (
              <label key={x.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${prefs.persona === x.id ? 'border-acc bg-surface-2' : 'border-line'}`}>
                <input type="radio" name="persona" value={x.id} checked={prefs.persona === x.id} onChange={() => setPrefs({ ...prefs, persona: x.id })} className=" w-4 h-4" />
                <span className="flex flex-col"><span className="font-bold">{x.label}</span><span className="text-[12px] text-mute">{x.hint}</span></span>
              </label>
            ))}
          </fieldset>
          <label className="flex items-center justify-between gap-3 text-[14px] font-semibold">Bugün ekranında günlük içgörü
            <input type="checkbox" checked={prefs.insights} onChange={(e) => setPrefs({ ...prefs, insights: e.target.checked })} className="w-5 h-5" /></label>
          <label className="flex items-center justify-between gap-3 text-[14px] font-semibold">Pazar akşamı haftalık rapor bildirimi
            <input type="checkbox" checked={prefs.weeklyPush} onChange={(e) => setPrefs({ ...prefs, weeklyPush: e.target.checked })} className="w-5 h-5" /></label>
          <label className="flex items-center justify-between gap-3 text-[14px] font-semibold"><span className="flex flex-col">Kendiliğinden yazan koç<span className="text-[12px] text-mute font-normal">Akşam proteinin geride kaldıysa kalanına uygun öğün önerisiyle bildirim (günde en çok 1)</span></span>
            <input type="checkbox" checked={prefs.nudges} onChange={(e) => setPrefs({ ...prefs, nudges: e.target.checked })} className="w-5 h-5 shrink-0" data-testid="coach-nudges" /></label>
          <fieldset className="flex flex-col gap-2" data-testid="coach-memories">
            <legend className="text-[14px] font-extrabold mb-1">Koçun hakkında bildikleri</legend>
            {mems.length ? mems.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2" data-memory={m.text}>
                <span className="flex-1 text-[13.5px] leading-snug">{m.text}</span>
                <button type="button" aria-label="Notu sil" onClick={() => start(async () => { await deleteMemoryAction(m.id); setMems((x) => x.filter((y) => y.id !== m.id)) })} className="w-9 h-9 rounded-full text-mute flex items-center justify-center shrink-0"><Trash size={16} /></button>
              </div>
            )) : <p className="text-[12.5px] text-mute">Henüz not yok. Sohbette "laktoz sevmiyorum", "sabah antrenman yapıyorum" gibi şeyler söylediğinde koç hatırlar.</p>}
          </fieldset>
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
              <button type="button" className={btn.icon} aria-label={`${c.title} sohbetini sil`} onClick={() => start(async () => { if (!(await ask('Bu sohbet kalıcı olarak silinsin mi?'))) return; await deleteConversationAction(c.id); setSheet(null); router.push('/koc?yeni=1') })}><Trash size={18} /></button>
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

/** Y2: koçun öğün önerisi kartı — veritabanından hesaplanan 2–3 besinlik öneriler, tek dokunuşla öğüne ekle. */
function MealPlanCard({ p }: { p: NonNullable<MessageView['mealPlan']> }) {
  const [done, setDone] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const nowMin = (() => { const d = new Date(); return (d.getUTCHours() * 60 + d.getUTCMinutes() + 180) % 1440 })()
  const [meal, setMeal] = useState<MealId>(mealForTime(nowMin))
  const lim = (['protein', 'carb', 'fat', 'kcal'] as const).filter((k) => p.limits[k] != null)
  const qs = new URLSearchParams({ ogun: meal, ...(p.limits.protein != null ? { p: String(p.limits.protein) } : {}), ...(p.limits.carb != null ? { k: String(p.limits.carb) } : {}), ...(p.limits.fat != null ? { y: String(p.limits.fat) } : {}), ...(p.limits.kcal != null ? { kcal: String(p.limits.kcal) } : {}) })
  if (!p.meals.length) return <p className="mt-2 rounded-2xl bg-surface-2 p-3 text-[13px] text-mute" data-testid="coach-mealplan">Bu sınırlarla uygun öneri bulunamadı.</p>
  return (
    <div className="mt-2 rounded-2xl bg-surface-2 p-3 flex flex-col gap-2.5" data-testid="coach-mealplan" data-mod="food">
      <span className="text-[12px] font-bold text-mute">Öğün önerisi · veritabanından{lim.length ? ` · en çok ${lim.map((k) => `${p.limits[k]}${k === 'kcal' ? ' kcal' : ' g'} ${({ protein: 'protein', carb: 'karb.', fat: 'yağ', kcal: '' } as const)[k]}`.trim()).join(', ')}` : ''}</span>
      {p.meals.slice(0, 2).map((m, i) => (
        <div key={i} className="rounded-xl bg-surface p-2.5 flex flex-col gap-1.5" data-testid="coach-mealplan-option">
          {m.items.map((it) => <span key={it.id} className="flex justify-between gap-2 text-[13.5px]"><b className="truncate">{it.name}</b><span className="num text-ink-2 shrink-0">{fmtNum(it.grams)} g</span></span>)}
          <span className="text-[12px] text-mute num">{fmtNum(m.totals.kcal)} kcal · P {fmtNum(m.totals.protein)} · K {fmtNum(m.totals.carb)} · Y {fmtNum(m.totals.fat)} g</span>
          <button type="button" disabled={pending || done === i} onClick={() => start(async () => { const r = await addMealPlanAction(meal, m.items.map((it) => ({ foodId: it.id, grams: it.grams }))); if (r.ok) setDone(i); else setErr(r.error) })}
            className="h-10 rounded-full bg-acc text-acc-ink text-[13px] font-extrabold disabled:opacity-60" data-testid="coach-mealplan-add">{done === i ? 'Eklendi ✓' : `${MEALS.find((x) => x.id === meal)?.label.replace(' yemeği', '')} öğününe ekle`}</button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <select aria-label="Öğün" value={meal} onChange={(e) => setMeal(e.target.value as MealId)} className="h-9 rounded-full bg-surface border border-line px-2 text-[12.5px] font-bold">{MEALS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
        <Link href={`/yemek/oneri?${qs}`} className="text-[12.5px] font-bold text-acc ml-auto">Tüm öneriler ›</Link>
      </div>
      {err ? <p role="alert" className="text-[12.5px] text-danger">{err}</p> : null}
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
      <p className="text-[14px]">Bugünkü kalan bütçe: <b className="num">{fmtNum(w.remainingBefore)}</b> → <b className={`num ${w.remainingAfter < 0 ? 'text-orange' : 'text-acc'}`} data-testid="whatif-after">{fmtNum(w.remainingAfter)} kcal</b></p>
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
          <button type="button" className="h-10 px-4 rounded-full bg-acc text-acc-ink font-bold text-[14px]" onClick={() => onDecide('confirm')}>Onayla</button>
          <button type="button" className="h-10 px-4 rounded-full border border-line-2 font-bold text-[14px]" onClick={() => onDecide('cancel')}>Vazgeç</button>
        </div>
      ) : <span className={`text-[13px] ${a.status === 'done' ? 'text-acc' : a.status === 'invalid' ? 'text-orange' : 'text-mute'}`}>{a.status === 'done' ? 'Uygulandı' : a.status === 'cancelled' ? 'Vazgeçildi' : a.error ?? 'Uygulanamadı'}</span>}
      {a.type === 'plan_menu' && a.status === 'done' ? <Link href="/yemek/plan" className="self-start text-[13px] font-bold text-acc">Menüyü aç</Link> : null}
      {a.type === 'goal_date' && a.status === 'pending' ? <span className="text-[12px] text-mute">Günlük kalorin bir sonraki haftalık check-in'de yeni tarihe göre ayarlanır.</span> : null}
    </div>
  )
}
