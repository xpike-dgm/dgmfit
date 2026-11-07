'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import { PRESET_RULES, describeRule, ruleMatches, type Action, type Cond, type Rule, type RuleCtx } from '@/lib/cards/prefs'
import { SCREENS, cardDef, cardsFor, type ScreenId } from '@/lib/cards/registry'
import { saveRulesAction } from '../actions'

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const DAY_IDX = [1, 2, 3, 4, 5, 6, 0]
const VERB: Record<Action['kind'], string> = { top: 'Üste al', hide: 'Gizle', show: 'Göster' }
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const swClass = "appearance-none w-12 h-7 rounded-full bg-surface-3 relative shrink-0 transition checked:bg-acc before:content-[''] before:absolute before:top-1 before:left-1 before:w-5 before:h-5 before:rounded-full before:bg-white before:transition checked:before:translate-x-5"

interface Draft { id: string; name: string; time: [number, number] | null; days: number[]; day: 'any' | 'training' | 'rest'; goal: '' | 'lose' | 'gain' | 'recomp'; then: Action[] }
const toDraft = (r: Rule): Draft => ({
  id: r.id, name: r.name,
  time: (() => { const c = r.when.find((c) => c.kind === 'time'); return c && c.kind === 'time' ? [c.from, c.to] : null })(),
  days: (() => { const c = r.when.find((c) => c.kind === 'weekday'); return c && c.kind === 'weekday' ? c.days : [] })(),
  day: r.when.some((c) => c.kind === 'training') ? 'training' : r.when.some((c) => c.kind === 'rest') ? 'rest' : 'any',
  goal: (() => { const c = r.when.find((c) => c.kind === 'goal'); return c && c.kind === 'goal' ? c.goal : '' })(),
  then: r.then,
})
const fromDraft = (d: Draft, on: boolean): Rule => {
  const when: Cond[] = []
  if (d.time) when.push({ kind: 'time', from: d.time[0], to: d.time[1] })
  if (d.days.length) when.push({ kind: 'weekday', days: [...d.days].sort() })
  if (d.day !== 'any') when.push({ kind: d.day })
  if (d.goal) when.push({ kind: 'goal', goal: d.goal })
  return { id: d.id, name: d.name.trim() || 'Kuralım', on, when, then: d.then }
}
const newDraft = (): Draft => ({ id: 'r' + Date.now().toString(36), name: '', time: null, days: [], day: 'any', goal: '', then: [] })

export default function RulesEditor({ rules: init, now }: { rules: Rule[]; now: RuleCtx }) {
  const [rules, setRules] = useState(init)
  const [edit, setEdit] = useState<{ d: Draft; on: boolean; isNew: boolean } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const persist = (next: Rule[], done: string) => {
    const old = rules
    setRules(next); setMsg(null)
    start(async () => {
      const r = await saveRulesAction(next).catch(() => null)
      if (!r?.ok) { setRules(old); setMsg(r && !r.ok ? r.error : 'Kaydedilemedi') } else { setMsg(done); router.refresh() }
    })
  }
  const presets = PRESET_RULES.filter((p) => !rules.some((r) => r.id === p.id))
  return (
    <>
      <p className="text-[13px] text-mute px-1 leading-snug">Kurallar kayıtlı düzenini değiştirmez; koşul sağlandığında ekranı geçici olarak yeniden dizer. Aynı karta birden çok kural dokunursa listede alttaki geçerli olur.</p>
      <section aria-label="Kurallarım" className="card px-4 py-1 flex flex-col" data-testid="rules">
        <h2 className="text-[15px] font-extrabold pt-3 pb-1">Kurallarım</h2>
        {!rules.length ? <p className="text-[13px] text-mute pb-3">Henüz kural yok. Aşağıdaki hazır kurallardan birini ekle ya da kendin oluştur.</p> : null}
        {rules.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3 min-h-[64px] border-t border-line first:border-0" data-rule={r.id}>
            <button type="button" className="flex-1 flex flex-col text-left py-2 min-w-0" onClick={() => setEdit({ d: toDraft(r), on: r.on, isNew: false })}>
              <span className="flex items-center gap-2"><b className="text-[15px] truncate">{r.name}</b>{r.on && ruleMatches(r, now) ? <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-acc text-acc-ink shrink-0">ŞU AN</span> : null}</span>
              <span className="text-[12.5px] text-mute leading-snug">{describeRule(r)}</span>
            </button>
            <input type="checkbox" role="switch" aria-label={`${r.name} açık`} checked={r.on} disabled={pending} className={swClass} data-testid="rule-on"
              onChange={(e) => persist(rules.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)), e.target.checked ? 'Kural açıldı' : 'Kural kapatıldı')} />
          </div>
        ))}
        <button type="button" onClick={() => setEdit({ d: newDraft(), on: true, isNew: true })} disabled={rules.length >= 20}
          className="h-12 my-2 rounded-full border border-dashed border-line-2 font-bold text-[14px] disabled:opacity-40" data-testid="rule-new">+ Yeni kural</button>
      </section>

      {presets.length ? (
        <section aria-label="Hazır kurallar" className="card px-4 py-1 flex flex-col" data-testid="rule-presets">
          <h2 className="text-[15px] font-extrabold pt-3 pb-1">Hazır kurallar</h2>
          {presets.map((p) => (
            <div key={p.id} className="flex items-center gap-3 min-h-[64px] border-t border-line first:border-0">
              <span className="flex-1 flex flex-col py-2 min-w-0"><b className="text-[15px]">{p.name}</b><span className="text-[12.5px] text-mute leading-snug">{describeRule(p)}</span></span>
              <button type="button" disabled={pending} onClick={() => persist([...rules, p], `${p.name} eklendi`)} aria-label={`${p.name} ekle`}
                className="h-10 px-4 rounded-full bg-acc text-acc-ink text-[13px] font-extrabold shrink-0">Ekle</button>
            </div>
          ))}
        </section>
      ) : null}
      {msg ? <p role="status" className="text-[13px] font-bold text-ink-2 px-1">{msg}</p> : null}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.isNew ? 'Yeni kural' : 'Kuralı düzenle'}>
        {edit ? <Builder key={edit.d.id} draft={edit.d} pending={pending}
          onSave={(d) => { const r = fromDraft(d, edit.on); const exists = rules.some((x) => x.id === r.id); setEdit(null); persist(exists ? rules.map((x) => (x.id === r.id ? r : x)) : [...rules, r], 'Kural kaydedildi') }}
          onDelete={edit.isNew ? undefined : () => { const id = edit.d.id; setEdit(null); persist(rules.filter((x) => x.id !== id), 'Kural silindi') }} /> : null}
      </Sheet>
    </>
  )
}

function Builder({ draft, pending, onSave, onDelete }: { draft: Draft; pending: boolean; onSave: (d: Draft) => void; onDelete?: () => void }) {
  const [d, setD] = useState(draft)
  const [screen, setScreen] = useState<ScreenId>('today')
  const choices = cardsFor(screen).filter((c) => c.locked !== 'top')
  const [card, setCard] = useState(choices[0]?.id ?? '')
  const [kind, setKind] = useState<Action['kind']>('top')
  const def = cardDef(card)
  const hasCond = !!d.time || d.days.length > 0 || d.day !== 'any' || !!d.goal
  const ok = hasCond && d.then.length > 0
  const addAction = () => {
    if (!def || (kind === 'hide' && def.locked)) return
    setD({ ...d, then: [...d.then.filter((a) => a.card !== card), { kind, card }].slice(0, 6) })
  }
  return (
    <div className="flex flex-col gap-4 pb-4" data-testid="rule-builder">
      <div className="flex flex-col gap-1">
        <label htmlFor="rule-name" className="text-xs text-mute">Kuralın adı</label>
        <input id="rule-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value.slice(0, 40) })} placeholder="Ör. Hafta sonu" className="h-12 rounded-xl bg-surface-2 border border-line px-3 text-ink" />
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-[13px] font-extrabold mb-1">Eğer</legend>
        <label className="flex items-center justify-between gap-3 min-h-11">
          <span className="text-[14px] font-bold">Saat aralığı</span>
          <input type="checkbox" role="switch" checked={!!d.time} onChange={(e) => setD({ ...d, time: e.target.checked ? [6 * 60, 12 * 60] : null })} className={swClass} data-testid="cond-time" />
        </label>
        {d.time ? (
          <div className="flex items-center gap-2">
            <input type="time" aria-label="Başlangıç" value={hm(d.time[0])} onChange={(e) => setD({ ...d, time: [toMin(e.target.value), d.time![1]] })} className="flex-1 h-11 rounded-xl bg-surface-2 border border-line px-3 num" data-testid="cond-from" />
            <span className="text-mute">–</span>
            <input type="time" aria-label="Bitiş" value={hm(d.time[1])} onChange={(e) => setD({ ...d, time: [d.time![0], toMin(e.target.value)] })} className="flex-1 h-11 rounded-xl bg-surface-2 border border-line px-3 num" data-testid="cond-to" />
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <span className="text-[14px] font-bold">Günler <span className="text-[12px] text-mute font-normal">(seçilmezse her gün)</span></span>
          <div className="grid grid-cols-7 gap-1" role="group" aria-label="Günler">
            {DAY_IDX.map((w, i) => (
              <button key={w} type="button" aria-pressed={d.days.includes(w)} onClick={() => setD({ ...d, days: d.days.includes(w) ? d.days.filter((x) => x !== w) : [...d.days, w] })}
                className="h-10 rounded-full text-[12.5px] font-bold border border-line bg-surface-2 text-ink-2 aria-pressed:bg-acc aria-pressed:text-acc-ink aria-pressed:border-acc">{DAYS[i]}</button>
            ))}
          </div>
        </div>
        <div role="radiogroup" aria-label="Antrenman" className="grid grid-cols-3 gap-1 p-1 rounded-full bg-surface-2">
          {([['any', 'Her gün'], ['training', 'Antrenman günü'], ['rest', 'Dinlenme günü']] as const).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={d.day === v} onClick={() => setD({ ...d, day: v })}
              className="h-10 rounded-full text-[12.5px] font-bold text-mute aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-sm">{l}</button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="text-[14px] font-bold">Hedef</span>
          <select value={d.goal} onChange={(e) => setD({ ...d, goal: e.target.value as Draft['goal'] })} className="h-11 rounded-xl bg-surface-2 border border-line px-3">
            <option value="">Fark etmez</option><option value="lose">Kilo verme</option><option value="gain">Kilo alma</option><option value="recomp">Koruyup kas kazanma</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-[13px] font-extrabold mb-1">O zaman</legend>
        {d.then.map((a) => { const c = cardDef(a.card); return c ? (
          <div key={a.card} className="flex items-center gap-2 min-h-11 rounded-xl bg-surface-2 px-3" data-rule-action={a.card}>
            <span className="flex-1 text-[13.5px]"><b>{SCREENS[c.screen].title} · {c.title}</b> <span className="text-mute">{VERB[a.kind].toLocaleLowerCase('tr-TR')}</span></span>
            <button type="button" aria-label="Eylemi kaldır" onClick={() => setD({ ...d, then: d.then.filter((x) => x.card !== a.card) })} className="w-9 h-9 text-mute">✕</button>
          </div>) : null })}
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Ekran" value={screen} onChange={(e) => { const s = e.target.value as ScreenId; setScreen(s); setCard(cardsFor(s).filter((c) => c.locked !== 'top')[0]?.id ?? '') }} className="h-11 rounded-xl bg-surface-2 border border-line px-2" data-testid="act-screen">
            {(Object.keys(SCREENS) as ScreenId[]).map((s) => <option key={s} value={s}>{SCREENS[s].title}</option>)}
          </select>
          <select aria-label="Kart" value={card} onChange={(e) => setCard(e.target.value)} className="h-11 rounded-xl bg-surface-2 border border-line px-2" data-testid="act-card">
            {choices.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <div role="radiogroup" aria-label="Eylem" className="flex-1 grid grid-cols-3 gap-1 p-1 rounded-full bg-surface-2">
            {(['top', 'hide', 'show'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} disabled={k === 'hide' && !!def?.locked} onClick={() => setKind(k)}
                className="h-9 rounded-full text-[12.5px] font-bold text-mute aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-sm disabled:opacity-30">{VERB[k]}</button>
            ))}
          </div>
          <button type="button" onClick={addAction} disabled={!def || (kind === 'hide' && !!def.locked)} className="h-11 px-4 rounded-full border border-line-2 text-[13px] font-bold disabled:opacity-40" data-testid="act-add">Ekle</button>
        </div>
      </fieldset>

      {!ok ? <p className="text-[12.5px] text-mute">{hasCond ? 'En az bir eylem ekle.' : 'En az bir koşul seç.'}</p> : null}
      <button type="button" disabled={!ok || pending} onClick={() => onSave(d)} className="h-14 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40" data-testid="rule-save">Kaydet</button>
      {onDelete ? <button type="button" onClick={onDelete} className="h-12 rounded-full border border-danger-line text-danger font-bold">Kuralı sil</button> : null}
    </div>
  )
}
