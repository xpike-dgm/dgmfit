'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { createChallengeAction } from '../actions'

export default function NewChallenge({ templates, metrics, friends, groupId }: { templates: { key: string; title: string; days: number }[]; metrics: { key: string; label: string; unit: string }[]; friends: { id: string; username: string }[]; groupId?: string }) {
  const [scope, setScope] = useState<'friends' | 'duel' | 'group'>(groupId ? 'group' : 'friends')
  const [tpl, setTpl] = useState<string | null>(templates[0]?.key ?? null)
  const [metric, setMetric] = useState(metrics[0].key)
  const [target, setTarget] = useState('')
  const [days, setDays] = useState('7')
  const [title, setTitle] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const duel = scope === 'duel'
  const submit = async () => {
    setBusy(true); setErr(null)
    const r = await createChallengeAction({
      template: duel ? null : tpl, title: title || undefined, metric: (duel || !tpl ? metric : undefined) as never, target: target ? Number(target) : null,
      days: duel ? 7 : Number(days) || 7, param: metric === 'water_days' && !tpl ? 2500 : null, scope, inviteIds: sel, groupId: groupId ?? null,
    })
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    router.push(`/sosyal/meydan/${r.id}`)
  }
  return (
    <form className="card p-4 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit() }} data-testid="new-challenge">
      <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Yeni</span>
      {!groupId ? <div className="flex gap-1.5" role="group" aria-label="Tür">{([['friends', 'Meydan okuma'], ['duel', 'Düello (1’e 1, 7 gün)']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={scope === k} onClick={() => { setScope(k); setSel([]) }} className={`h-9 px-3 rounded-full text-[13px] font-bold ${scope === k ? 'bg-acc text-acc-ink' : 'bg-surface-2'}`}>{l}</button>)}</div> : null}
      {!duel ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Şablon">
          {templates.map((t) => <button key={t.key} type="button" aria-pressed={tpl === t.key} onClick={() => setTpl(t.key)} className={`h-9 px-3 rounded-full text-[13px] font-semibold ${tpl === t.key ? 'bg-ink text-bg' : 'bg-surface-2'}`}>{t.title}</button>)}
          <button type="button" aria-pressed={tpl === null} onClick={() => setTpl(null)} className={`h-9 px-3 rounded-full text-[13px] font-semibold ${tpl === null ? 'bg-ink text-bg' : 'bg-surface-2'}`}>Özel</button>
        </div>
      ) : null}
      {duel || tpl === null ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-semibold col-span-2">Ölçüt<select aria-label="Ölçüt" value={metric} onChange={(e) => setMetric(e.target.value)} className="h-11 rounded-xl bg-surface-2 border border-line px-2 font-normal">{metrics.map((m) => <option key={m.key} value={m.key}>{m.label} ({m.unit})</option>)}</select></label>
          {!duel ? <>
            <label htmlFor="ch-title" className="flex flex-col gap-1 text-[12px] font-semibold col-span-2">Başlık<input id="ch-title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-xl bg-surface-2 border border-line px-3 font-normal" /></label>
            <label htmlFor="ch-target" className="flex flex-col gap-1 text-[12px] font-semibold">Hedef (isteğe bağlı)<input id="ch-target" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ''))} className="h-11 rounded-xl bg-surface-2 border border-line px-3 font-normal" /></label>
            <label htmlFor="ch-days" className="flex flex-col gap-1 text-[12px] font-semibold">Süre (gün)<input id="ch-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} className="h-11 rounded-xl bg-surface-2 border border-line px-3 font-normal" /></label>
          </> : null}
        </div>
      ) : null}
      {!groupId ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Davet edilecekler">
          {friends.length ? friends.map((f) => <button key={f.id} type="button" aria-pressed={sel.includes(f.id)} onClick={() => setSel(duel ? [f.id] : sel.includes(f.id) ? sel.filter((x) => x !== f.id) : [...sel, f.id])} className={`h-9 px-3 rounded-full text-[13px] font-semibold ${sel.includes(f.id) ? 'bg-acc text-acc-ink' : 'bg-surface-2'}`}>{f.username}</button>) : <span className="text-[13px] text-mute">Önce arkadaş ekle.</span>}
        </div>
      ) : <p className="text-[12px] text-mute">Grubun tüm üyeleri davet edilir.</p>}
      {err ? <p role="alert" className="text-[13px] text-orange">{err}</p> : null}
      <button type="submit" className={btn.primary} disabled={busy}>{duel ? 'Düelloya davet et' : 'Başlat'}</button>
    </form>
  )
}
