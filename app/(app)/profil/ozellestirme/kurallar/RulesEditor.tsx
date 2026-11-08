'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import { Group, Ico, IconBox, chipClass, segClass, switchClass, type IconName } from '@/components/cards/StudioUI'
import { ask } from '@/components/Confirm'
import { PRESET_RULES, describeRule, ruleMatches, type Action, type Cond, type Rule, type RuleCtx } from '@/lib/cards/prefs'
import { SCREENS, cardDef, cardsFor, type ScreenId } from '@/lib/cards/registry'
import { saveRulesAction } from '../actions'

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const DAY_IDX = [1, 2, 3, 4, 5, 6, 0]
const VERB: Record<Action['kind'], string> = { top: 'Üste al', hide: 'Gizle', show: 'Göster' }
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const swClass = switchClass

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
      <button type="button" onClick={() => setEdit({ d: newDraft(), on: true, isNew: true })} disabled={rules.length >= 20}
        className="min-h-14 rounded-[20px] bg-acc text-acc-ink font-extrabold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-40" data-testid="rule-new"><Ico name="plus" size={20} />Yeni kural</button>
      {msg ? <p role="status" className="text-[13px] font-bold text-ink-2 px-1 -mt-1">{msg}</p> : null}

      {rules.length ? (
        <Group label="Kurallarım" testId="rules" footer="Kurallar kayıtlı düzenini değiştirmez; koşul sağlandığında ekranı geçici olarak yeniden dizer. Aynı karta birden çok kural dokunursa listede alttaki geçerli olur.">
          {rules.map((r, i) => {
            const live = r.on && ruleMatches(r, now)
            return (
              <div key={r.id} className="flex items-center gap-3 min-h-[72px] px-3.5 py-2" data-rule={r.id}>
                <button type="button" className="flex-1 flex items-center gap-3 text-left min-w-0" onClick={() => setEdit({ d: toDraft(r), on: r.on, isNew: false })}>
                  <IconBox name={ruleIcon(r)} mod={r.on ? 'coach' : 'profile'} />
                  <span className="flex flex-col min-w-0 gap-0.5">
                    <span className="flex items-center gap-2"><b className="text-[15px] font-extrabold truncate">{r.name}</b>{live ? <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-good text-bg shrink-0">ŞU AN</span> : null}</span>
                    <span className="text-[12.5px] text-mute leading-snug line-clamp-2">{describeRule(r)}</span>
                  </span>
                </button>
                <input type="checkbox" role="switch" aria-label={`${r.name} açık`} checked={r.on} disabled={pending} className={swClass} data-testid="rule-on"
                  onChange={(e) => persist(rules.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)), e.target.checked ? 'Kural açıldı' : 'Kural kapatıldı')} />
              </div>
            )
          })}
        </Group>
      ) : (
        <div className="card rounded-[22px] p-5 flex flex-col items-center text-center gap-2" data-testid="rules">
          <IconBox name="rule" mod="coach" size="lg" />
          <b className="text-[15px]">Henüz kural yok</b>
          <span className="text-[13px] text-mute leading-snug max-w-[290px]">“Sabah su kartı üstte”, “antrenman gününde antrenman kartı başta” gibi. Hazır kurallardan birini ekle ya da kendin kur.</span>
        </div>
      )}

      {presets.length ? (
        <Group label="Hazır kurallar" testId="rule-presets">
          {presets.map((p) => (
            <div key={p.id} className="flex items-center gap-3 min-h-[68px] px-3.5 py-2">
              <IconBox name={ruleIcon(p)} mod="coach" />
              <span className="flex-1 flex flex-col min-w-0 gap-0.5"><b className="text-[15px] font-extrabold">{p.name}</b><span className="text-[12.5px] text-mute leading-snug">{describeRule(p)}</span></span>
              <button type="button" disabled={pending} onClick={() => persist([...rules, p], `${p.name} eklendi`)} aria-label={`${p.name} ekle`}
                className="h-9 px-3.5 rounded-full bg-surface-2 border border-line-2 text-[13px] font-extrabold shrink-0 inline-flex items-center gap-1"><Ico name="plus" size={15} />Ekle</button>
            </div>
          ))}
        </Group>
      ) : null}

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.isNew ? 'Yeni kural' : 'Kuralı düzenle'}>
        {edit ? <Builder key={edit.d.id} draft={edit.d} pending={pending}
          onSave={(d) => { const r = fromDraft(d, edit.on); const exists = rules.some((x) => x.id === r.id); setEdit(null); persist(exists ? rules.map((x) => (x.id === r.id ? r : x)) : [...rules, r], 'Kural kaydedildi') }}
          onDelete={edit.isNew ? undefined : async () => { const id = edit.d.id; if (!(await ask('Bu kural silinsin mi?'))) return; setEdit(null); persist(rules.filter((x) => x.id !== id), 'Kural silindi') }} /> : null}
      </Sheet>
    </>
  )
}

function ruleIcon(r: Rule): IconName {
  const k = r.when[0]?.kind
  return k === 'time' ? 'clock' : k === 'weekday' ? 'calendar' : k === 'training' || k === 'rest' ? 'dumbbell' : k === 'goal' ? 'target' : 'rule'
}

const GOALS: [Draft['goal'], string][] = [['', 'Fark etmez'], ['lose', 'Kilo verme'], ['gain', 'Kilo alma'], ['recomp', 'Kas kazanma']]
const VERB_ICON: Record<Action['kind'], string> = { top: '↑', hide: '⦸', show: '◉' }

/** G1: kural kurucu — "Eğer" ve "O zaman" iki kart; koşullar simgeli satırlar, eylem ekran çipi → kart çipi → eylem. Altta canlı özet. */
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
  const box = 'rounded-[20px] bg-surface-2 border border-line p-3.5 flex flex-col gap-3'
  const tag = (t: string, mod: string) => <span data-mod={mod} className="self-start text-[11px] font-extrabold tracking-[0.08em] px-2.5 py-1 rounded-full bg-acc text-acc-ink">{t}</span>
  const condRow = (icon: IconName, title: string, sub: string | null, ctl: React.ReactNode) => (
    <div className="flex items-center gap-3 min-h-11">
      <span className="w-9 h-9 rounded-[11px] bg-surface text-ink-2 flex items-center justify-center shrink-0"><Ico name={icon} size={18} /></span>
      <span className="flex-1 flex flex-col min-w-0 leading-tight"><b className="text-[14px]">{title}</b>{sub ? <span className="text-[12px] text-mute">{sub}</span> : null}</span>
      {ctl}
    </div>
  )
  const summary = hasCond || d.then.length ? describeRule(fromDraft(d, true)) : null
  return (
    <div className="flex flex-col gap-3.5" data-testid="rule-builder" data-mod="today">
      <input id="rule-name" aria-label="Kuralın adı" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value.slice(0, 40) })} placeholder="Kurala bir ad ver (ör. Hafta sonu)"
        className="h-12 rounded-[14px] bg-surface-2 border border-line px-3.5 text-[16px] font-bold text-ink outline-none focus:border-acc" />

      <section className={box} aria-label="Eğer">
        {tag('EĞER', 'coach')}
        {condRow('clock', 'Saat aralığı', d.time ? null : 'Belirli saatlerde', <input type="checkbox" role="switch" aria-label="Saat aralığı" checked={!!d.time} onChange={(e) => setD({ ...d, time: e.target.checked ? [6 * 60, 12 * 60] : null })} className={swClass} data-testid="cond-time" />)}
        {d.time ? (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 -mt-1">
            <input type="time" aria-label="Başlangıç" value={hm(d.time[0])} onChange={(e) => setD({ ...d, time: [toMin(e.target.value), d.time![1]] })} className="h-11 rounded-[12px] bg-surface border border-line px-3 num text-center" data-testid="cond-from" />
            <span className="text-mute">–</span>
            <input type="time" aria-label="Bitiş" value={hm(d.time[1])} onChange={(e) => setD({ ...d, time: [d.time![0], toMin(e.target.value)] })} className="h-11 rounded-[12px] bg-surface border border-line px-3 num text-center" data-testid="cond-to" />
          </div>
        ) : null}
        <div className="h-px bg-line" />
        {condRow('calendar', 'Günler', d.days.length ? null : 'Seçmezsen her gün', null)}
        <div className="grid grid-cols-7 gap-1" role="group" aria-label="Günler">
          {DAY_IDX.map((w, i) => (
            <button key={w} type="button" aria-pressed={d.days.includes(w)} onClick={() => setD({ ...d, days: d.days.includes(w) ? d.days.filter((x) => x !== w) : [...d.days, w] })}
              className="aspect-square max-h-11 rounded-full text-[12px] font-bold bg-surface text-ink-2 border border-line aria-pressed:bg-acc aria-pressed:text-acc-ink aria-pressed:border-acc" data-mod="coach">{DAYS[i]}</button>
          ))}
        </div>
        <div className="h-px bg-line" />
        {condRow('dumbbell', 'Gün türü', null, null)}
        <div role="radiogroup" aria-label="Antrenman" className="grid grid-cols-3 gap-1 p-1 rounded-full bg-surface">
          {([['any', 'Her gün'], ['training', 'Antrenman'], ['rest', 'Dinlenme']] as const).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={d.day === v} onClick={() => setD({ ...d, day: v })} className={`${segClass} aria-checked:bg-surface-3`}>{l}</button>
          ))}
        </div>
        <div className="h-px bg-line" />
        {condRow('target', 'Hedef', null, null)}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Hedef" data-mod="coach">
          {GOALS.map(([v, l]) => <button key={v || 'any'} type="button" role="radio" aria-checked={d.goal === v} onClick={() => setD({ ...d, goal: v })} className={`${chipClass} bg-surface`}>{l}</button>)}
        </div>
      </section>

      <section className={box} aria-label="O zaman">
        {tag('O ZAMAN', 'today')}
        {d.then.length ? (
          <div className="flex flex-col gap-1.5">
            {d.then.map((a) => { const c = cardDef(a.card); return c ? (
              <div key={a.card} className="flex items-center gap-2.5 min-h-12 rounded-[14px] bg-surface px-3" data-rule-action={a.card}>
                <span data-mod={c.module} className="w-7 h-7 rounded-full bg-acc text-acc-ink text-[14px] font-extrabold flex items-center justify-center shrink-0" aria-hidden>{VERB_ICON[a.kind]}</span>
                <span className="flex-1 min-w-0 text-[13.5px] leading-tight"><b>{c.title}</b> <span className="text-mute">· {SCREENS[c.screen].title} · {VERB[a.kind].toLocaleLowerCase('tr-TR')}</span></span>
                <button type="button" aria-label="Eylemi kaldır" onClick={() => setD({ ...d, then: d.then.filter((x) => x.card !== a.card) })} className="w-9 h-9 rounded-full text-mute flex items-center justify-center">✕</button>
              </div>) : null })}
          </div>
        ) : <p className="text-[12.5px] text-mute -mt-1">Hangi kart üste çıksın, gizlensin ya da görünsün?</p>}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-3.5 px-3.5" role="radiogroup" aria-label="Ekran" data-testid="act-screen">
          {(Object.keys(SCREENS) as ScreenId[]).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={screen === s} onClick={() => { setScreen(s); setCard(cardsFor(s).filter((c) => c.locked !== 'top')[0]?.id ?? '') }} className={`${chipClass} bg-surface`} data-mod="today">{SCREENS[s].title}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-[148px] overflow-y-auto" role="radiogroup" aria-label="Kart" data-testid="act-card">
          {choices.map((c) => <button key={c.id} type="button" role="radio" aria-checked={card === c.id} onClick={() => setCard(c.id)} data-act-card={c.id} className={`${chipClass} bg-surface !min-h-9 !px-3 !text-[12.5px]`} data-mod="today">{c.title}</button>)}
        </div>
        <div className="flex gap-2">
          <div role="radiogroup" aria-label="Eylem" className="flex-1 grid grid-cols-3 gap-1 p-1 rounded-full bg-surface">
            {(['top', 'hide', 'show'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} disabled={k === 'hide' && !!def?.locked} onClick={() => setKind(k)} className={`${segClass} aria-checked:bg-surface-3 disabled:opacity-30`}>{VERB[k]}</button>
            ))}
          </div>
          <button type="button" onClick={addAction} disabled={!def || (kind === 'hide' && !!def.locked)} data-mod="today"
            className="h-12 px-4 rounded-full bg-acc text-acc-ink text-[13.5px] font-extrabold disabled:opacity-40 inline-flex items-center gap-1" data-testid="act-add"><Ico name="plus" size={16} />Ekle</button>
        </div>
      </section>

      {summary ? <p className="text-[13px] leading-snug rounded-[14px] bg-[color-mix(in_oklab,var(--color-acc)_10%,var(--color-surface-2))] px-3.5 py-3" data-mod="coach" data-testid="rule-summary"><b>Özet: </b>{summary}</p> : null}
      <div className="sheet-actions z-10 -mx-5 px-5 pt-3 bg-gradient-to-t from-surface via-surface to-transparent flex flex-col gap-2">
        {!ok ? <p className="text-[12.5px] text-mute text-center">{hasCond ? 'En az bir eylem ekle.' : 'En az bir koşul seç.'}</p> : null}
        <div className="flex gap-2">
          {onDelete ? <button type="button" onClick={onDelete} aria-label="Kuralı sil" className="h-14 w-14 rounded-full border border-danger-line text-danger flex items-center justify-center shrink-0"><Ico name="trash" size={20} /></button> : null}
          <button type="button" disabled={!ok || pending} onClick={() => onSave(d)} className="flex-1 h-14 rounded-full bg-acc text-acc-ink font-extrabold text-[15px] disabled:opacity-40" data-testid="rule-save">Kuralı kaydet</button>
        </div>
      </div>
    </div>
  )
}
