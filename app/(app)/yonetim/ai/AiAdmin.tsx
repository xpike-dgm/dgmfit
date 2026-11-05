'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn, Eyebrow } from '@/components/ui'
import { resetCooldownAction, saveAiSettingsAction, saveProviderAction } from './actions'

type P = { id: 'claude' | 'openai'; enabled: boolean; priority: number; model: string; dailyTokenLimit: number; monthlyTokenLimit: number; hasKey: boolean; cooling: boolean }

export function ProviderForm({ p }: { p: P }) {
  const [v, setV] = useState({ enabled: p.enabled, priority: p.priority, model: p.model, daily: String(p.dailyTokenLimit), monthly: String(p.monthlyTokenLimit), key: '' })
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const save = (extra: { removeKey?: boolean } = {}) => start(async () => {
    const r = await saveProviderAction({ id: p.id, enabled: v.enabled, priority: v.priority, model: v.model, dailyTokenLimit: Number(v.daily) || 0, monthlyTokenLimit: Number(v.monthly) || 0, key: v.key || undefined, ...extra })
    setMsg(r.ok ? { ok: true, t: 'Kaydedildi.' } : { ok: false, t: r.error })
    if (r.ok) { setV({ ...v, key: '' }); router.refresh() }
  })
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); save() }}>
      <label className="flex items-center gap-3 text-sm min-h-[40px]"><input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} className="w-5 h-5 accent-[var(--color-lime)]" />Etkin</label>
      <div className="grid grid-cols-3 gap-2">
        <label htmlFor={`${p.id}-prio`} className="flex flex-col gap-1 text-[12px] font-semibold">Sıra
          <input id={`${p.id}-prio`} inputMode="numeric" value={v.priority} onChange={(e) => setV({ ...v, priority: Number(e.target.value) || 0 })} className="h-11 rounded-xl bg-surface-2 border border-line px-3 num" />
        </label>
        <label htmlFor={`${p.id}-model`} className="col-span-2 flex flex-col gap-1 text-[12px] font-semibold">Model
          <input id={`${p.id}-model`} value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} className="h-11 rounded-xl bg-surface-2 border border-line px-3" />
        </label>
        <label htmlFor={`${p.id}-daily`} className="col-span-1 flex flex-col gap-1 text-[12px] font-semibold">Günlük token
          <input id={`${p.id}-daily`} inputMode="numeric" value={v.daily} onChange={(e) => setV({ ...v, daily: e.target.value.replace(/\D/g, '') })} placeholder="0 = sınırsız" className="h-11 rounded-xl bg-surface-2 border border-line px-3 num" />
        </label>
        <label htmlFor={`${p.id}-monthly`} className="col-span-2 flex flex-col gap-1 text-[12px] font-semibold">Aylık token
          <input id={`${p.id}-monthly`} inputMode="numeric" value={v.monthly} onChange={(e) => setV({ ...v, monthly: e.target.value.replace(/\D/g, '') })} placeholder="0 = sınırsız" className="h-11 rounded-xl bg-surface-2 border border-line px-3 num" />
        </label>
      </div>
      <label htmlFor={`${p.id}-key`} className="flex flex-col gap-1 text-[12px] font-semibold">{p.hasKey ? 'Yeni anahtar (değiştirmek için)' : 'API anahtarı'}
        <input id={`${p.id}-key`} type="password" autoComplete="off" spellCheck={false} value={v.key} onChange={(e) => setV({ ...v, key: e.target.value })} placeholder={p.hasKey ? 'Boş bırakırsan aynı kalır' : 'Anahtarı yapıştır'} className="h-11 rounded-xl bg-surface-2 border border-line px-3" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={`${btn.primary} h-11 text-[15px] px-5`} disabled={pending}>Kaydet</button>
        {p.hasKey ? <button type="button" className={btn.ghost} disabled={pending} onClick={() => { if (confirm('Anahtar silinsin mi?')) save({ removeKey: true }) }}>Anahtarı sil</button> : null}
        {p.cooling ? <button type="button" className={btn.ghost} disabled={pending} onClick={() => start(async () => { await resetCooldownAction(p.id); router.refresh() })}>Beklemeyi sıfırla</button> : null}
      </div>
      {msg ? <p role="status" className={`text-[13px] ${msg.ok ? 'text-lime' : 'text-danger'}`}>{msg.t}</p> : null}
    </form>
  )
}

export function UserDailyForm({ value }: { value: number }) {
  const [v, setV] = useState(String(value))
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <form className="card p-5 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveAiSettingsAction(Number(v)); setMsg(r.ok ? 'Kaydedildi.' : r.error); if (r.ok) router.refresh() }) }}>
      <Eyebrow>Kullanıcı başına günlük AI hakkı</Eyebrow>
      <p className="text-[12px] text-mute">Uygulama ücretsiz olduğu için adil kullanım sınırı. Önbellekten gelen yanıtlar sayılmaz.</p>
      <div className="flex gap-2">
        <label htmlFor="ai-daily" className="sr-only">Günlük hak</label>
        <input id="ai-daily" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} className="flex-1 h-11 rounded-xl bg-surface-2 border border-line px-3 num" />
        <button type="submit" className={`${btn.secondary} h-11`} disabled={pending}>Kaydet</button>
      </div>
      {msg ? <p role="status" className="text-[13px] text-lime">{msg}</p> : null}
    </form>
  )
}
