'use client'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import { btn } from '@/components/ui'
import { Mic, Spark } from '@/components/icons'
import { macrosFor, MEAL_LABEL, type MealId } from '@/lib/food'
import type { Nutrients } from '@/lib/nutrition'
import { shrinkImage } from '@/lib/client-image'
import { addMealItem } from '../actions'
import { addWater } from '../../su/actions'

type Cand = { id: number; name: string; sub: string | null; per100: Nutrients }
type Item = { name: string; grams: number; portion: string | null; drink: string | null; confidence: 'yüksek' | 'orta' | 'düşük'; candidates: Cand[] }
type Row = Item & { pick: number; g: string; water: boolean; on: boolean }
type Recog = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: (e: { error: string }) => void; onend: () => void }
const PROVIDER: Record<string, string> = { claude: 'Claude', openai: 'OpenAI', cache: 'önbellek' }
const WATER_DRINKS = new Set(['water', 'mineral', 'tea', 'coffee', 'ayran', 'juice', 'other'])

/** AI ile öğün: fotoğraf ya da yaz/söyle → kalemler → veritabanı eşleşmesi → kullanıcı onayı. Kalori veritabanından hesaplanır. */
export default function AiMeal({ day, meal, onAdded, ask }: { day: string; meal: MealId; onAdded: (lines: string[], kcal: number) => void; ask?: { text: string; n: number } | null }) {
  const [mode, setMode] = useState<null | 'text'>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [meta, setMeta] = useState<{ provider: string; note: string | null } | null>(null)
  const [m, setM] = useState<MealId>(meal)
  const [pending, start] = useTransition()
  const [listening, setListening] = useState(false)
  const [speech, setSpeech] = useState(false)
  const rec = useRef<Recog | null>(null)
  const box = useRef<HTMLElement>(null)
  const router = useRouter()
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    setSpeech(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
    return () => rec.current?.stop()
  }, [])

  // Aramada bulunamayan yemeği AI'ye sor: metni doldur, gönder ve kutuyu göster
  useEffect(() => {
    if (!ask?.text) return
    setMode('text'); setText(ask.text); void send({ text: ask.text })
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask?.n])

  const send = async (body: FormData | { text: string }) => {
    setBusy(true); setErr(null)
    try {
      const r = await fetch('/api/ai/meal', body instanceof FormData ? { method: 'POST', body } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({ error: 'AI yanıtı okunamadı' }))
      if (!r.ok) { setErr(j.error ?? 'AI isteği başarısız'); return }
      if (!j.items.length) { setErr(j.note ?? 'Fotoğrafta ya da metinde besin bulunamadı.'); return }
      setMeta({ provider: j.provider, note: j.note })
      setRows((j.items as Item[]).map((it) => ({ ...it, pick: it.candidates.length ? 0 : -1, g: String(it.grams), water: !!it.drink && WATER_DRINKS.has(it.drink), on: it.candidates.length > 0 || !!it.drink })))
    } catch { setErr('Bağlantı yok: AI için internet gerekli. Elle aramaya devam edebilirsin.') } finally { setBusy(false) }
  }
  const listen = () => {
    const w = window as unknown as { SpeechRecognition?: new () => Recog; webkitSpeechRecognition?: new () => Recog }
    const C = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!C) return
    const r = new C()
    r.lang = 'tr-TR'; r.interimResults = true; r.maxAlternatives = 1
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(' '))
    r.onerror = (e) => { setErr(e.error === 'not-allowed' ? 'Mikrofon izni verilmedi.' : 'Ses anlaşılamadı, yazarak deneyebilirsin.'); setListening(false) }
    r.onend = () => setListening(false)
    rec.current = r; setListening(true); r.start()
  }
  const totals = useMemo(() => (rows ?? []).filter((r) => r.on && r.pick >= 0).reduce((a, r) => a + macrosFor(r.candidates[r.pick].per100, Number(r.g.replace(',', '.')) || 0).kcal, 0), [rows])

  const confirm = () => start(async () => {
    if (!rows) return
    const lines: string[] = []
    let kcal = 0
    for (const r of rows.filter((x) => x.on)) {
      const g = Math.round(Number(r.g.replace(',', '.')) || 0)
      if (g < 1) continue
      if (r.pick >= 0) {
        const c = r.candidates[r.pick]
        const res = await addMealItem({ foodId: c.id, grams: g, portionLabel: null, portionQty: null, meal: m, day, source: 'ai' })
        if (res.ok) { lines.push(`${c.name} · ${res.kcal} kcal`); kcal += res.kcal; if (res.waterMl > 0) { lines.push(`${r.name} · ${res.waterMl} ml Su'ya`); continue } } else { setErr(res.error); return }
      }
      // yemek kaydı suyu zaten eklediyse (Su ayarı: yemeklerden gelen su) ikinci kez eklenmez
      if (r.water && r.drink) {
        const w = await addWater({ ml: Math.min(3000, g), drink: r.drink as never, source: 'voice', force: true })
        if (w.ok) lines.push(`${r.name} · ${Math.min(3000, g)} ml Su'ya`)
      }
    }
    setRows(null); setMeta(null); setText(''); setMode(null)
    onAdded(lines, kcal); router.refresh()
  })

  return (
    <section ref={box} className="card p-4 flex flex-col gap-3" aria-label="AI ile ekle" data-testid="ai-meal">
      <div className="flex items-center gap-2"><Spark size={18} className="text-acc" /><span className="font-bold text-[15px]">AI ile ekle</span><span className="text-[11px] text-mute ml-auto">kalori veritabanından hesaplanır</span></div>
      <div className="grid grid-cols-2 gap-2">
        <label className={`${btn.secondary} cursor-pointer ${busy ? 'opacity-50' : ''}`}>
          {busy && mode === null ? 'İnceleniyor…' : 'Fotoğrafla'}
          <input type="file" accept="image/*" capture="environment" className="sr-only" data-testid="ai-photo" disabled={busy} onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ''
            if (!f) return
            try { const fd = new FormData(); fd.set('file', await shrinkImage(f, 1280, 0.8), 'ogun.jpg'); await send(fd) } catch (x) { setErr((x as Error).message) }
          }} />
        </label>
        <button type="button" className={btn.secondary} disabled={busy} onClick={() => setMode(mode === 'text' ? null : 'text')}>Yaz ya da söyle</button>
      </div>
      {mode === 'text' ? (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 2) void send({ text }) }}>
          <div className="flex gap-2">
            <label htmlFor="ai-text" className="sr-only">Ne yedin?</label>
            <textarea id="ai-text" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ör: iki dilim ekmek, bir kase mercimek çorbası ve bir bardak ayran"
              className="flex-1 rounded-xl bg-surface-2 border border-line px-3 py-2 text-ink" />
            {speech ? <button type="button" onClick={() => (listening ? rec.current?.stop() : listen())} aria-pressed={listening} aria-label={listening ? 'Dinlemeyi durdur' : 'Söyle'}
              className={`w-12 rounded-xl flex items-center justify-center ${listening ? 'bg-acc text-acc-ink animate-pulse' : 'bg-surface-2 text-acc'}`}><Mic size={22} /></button> : null}
          </div>
          <button type="submit" className={btn.primary + ' h-12 text-[15px]'} disabled={busy || text.trim().length < 2}>{busy ? 'Ayrıştırılıyor…' : 'Ayrıştır'}</button>
        </form>
      ) : null}
      {err ? <p role="alert" className="text-[13px] text-orange">{err}</p> : null}

      <Sheet open={!!rows} onClose={() => setRows(null)} title="AI önerisi — kontrol et">
        {rows ? (
          <div className="flex flex-col gap-3 pb-4" data-testid="ai-review">
            {meta?.note ? <p className="text-[13px] text-orange">{meta.note}</p> : null}
            {rows.map((r, i) => {
              const c = r.pick >= 0 ? r.candidates[r.pick] : null
              const g = Number(r.g.replace(',', '.')) || 0
              const mm = c ? macrosFor(c.per100, g) : null
              return (
                <div key={i} className={`rounded-2xl bg-surface-2 px-3.5 py-3 flex flex-col gap-2 ${r.on ? '' : 'opacity-50'}`} data-testid="ai-row">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" aria-label={`${r.name} ekle`} checked={r.on} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, on: e.target.checked } : x)))} className="w-5 h-5" />
                    <span className="font-bold flex-1">{r.name}{r.portion ? <span className="text-mute font-normal"> · {r.portion}</span> : null}</span>
                    {r.confidence !== 'yüksek' ? <span className={`text-[11px] font-bold ${r.confidence === 'düşük' ? 'text-orange' : 'text-mute'}`}>{r.confidence} güven</span> : null}
                  </div>
                  {r.candidates.length ? (
                    <label className="flex flex-col gap-1 text-[12px] text-mute">Eşleşen besin
                      <select value={r.pick} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, pick: Number(e.target.value) } : x)))} className="h-11 rounded-xl bg-surface border border-line px-3 text-ink text-[14px]" aria-label={`${r.name} için besin`}>
                        {r.candidates.map((cc, k) => <option key={cc.id} value={k}>{cc.name}{cc.sub ? ` — ${cc.sub}` : ''}</option>)}
                        <option value={-1}>Hiçbiri (öğüne ekleme)</option>
                      </select>
                    </label>
                  ) : <p className="text-[12px] text-orange">Veritabanında eşleşme yok{r.drink ? '' : '; aramadan elle ekleyebilirsin'}.</p>}
                  <div className="flex items-center gap-2">
                    <label htmlFor={`ai-g-${i}`} className="text-[12px] text-mute">Miktar</label>
                    <input id={`ai-g-${i}`} inputMode="decimal" value={r.g} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, g: e.target.value } : x)))} className="w-20 h-10 rounded-xl bg-surface border border-line px-2 num text-right" />
                    <span className="text-[12px] text-mute">{r.drink ? 'ml' : 'g'}</span>
                    {mm ? <span className="ml-auto num text-[14px] font-bold" data-testid="ai-kcal">{mm.kcal} kcal</span> : null}
                  </div>
                  {/* P-7 fotoğraftan porsiyon: AI tahminini tek dokunuşla düzelt (az / tahmin / çok) */}
                  <div className="flex gap-1.5" role="group" aria-label={`${r.name} porsiyon düzeltme`}>
                    {([['Az', 0.7], ['Tahmin', 1], ['Çok', 1.4]] as const).map(([l, f]) => {
                      const g = Math.round((r.grams * f) / 5) * 5
                      return <button key={l} type="button" aria-pressed={Number(r.g) === g} onClick={() => setRows(rows.map((x, k) => (k === i ? { ...x, g: String(g) } : x)))} className={`h-9 px-3 rounded-full text-[12px] font-bold border ${Number(r.g) === g ? 'bg-acc text-acc-ink border-acc' : 'bg-surface border-line text-ink-2'}`}>{l} · {g}</button>
                    })}
                  </div>
                  {r.drink ? <label className="flex items-center gap-2 text-[12px] text-ink-2"><input type="checkbox" checked={r.water} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, water: e.target.checked } : x)))} className="w-4 h-4 accent-[var(--color-water)]" />Su takibine de ekle</label> : null}
                </div>
              )
            })}
            <label className="flex items-center justify-between text-sm font-semibold">Öğün
              <select value={m} onChange={(e) => setM(e.target.value as MealId)} className="h-11 rounded-xl bg-surface-2 border border-line px-3 font-normal">{(Object.keys(MEAL_LABEL) as MealId[]).map((k) => <option key={k} value={k}>{MEAL_LABEL[k]}</option>)}</select>
            </label>
            <button type="button" className={btn.primary} disabled={pending || !rows.some((r) => r.on)} onClick={confirm}>Ekle · {totals} kcal</button>
            <p className="text-[11px] text-mute text-center">Yanıt: {PROVIDER[meta?.provider ?? ''] ?? meta?.provider} · gramlar tahmindir, kontrol et.</p>
          </div>
        ) : null}
      </Sheet>
    </section>
  )
}
