'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn, Eyebrow } from '@/components/ui'
import { Trash } from '@/components/icons'
import { addMeasurementAction, deleteMeasurementAction, deleteMediaAction } from '../actions'
import { shrinkImage } from '@/lib/client-image'
import { fmtNum } from '@/lib/calc'
import { compareDays, type Snap } from '@/lib/progress-compare'
import { ask } from '@/components/Confirm'

const FIELDS = [['waistCm', 'Bel'], ['chestCm', 'Göğüs'], ['hipsCm', 'Kalça'], ['armCm', 'Kol'], ['thighCm', 'Uyluk'], ['calfCm', 'Baldır'], ['neckCm', 'Boyun'], ['bodyFatPct', 'Yağ']] as const
type Key = (typeof FIELDS)[number][0]
const LABEL: Record<string, string> = Object.fromEntries(FIELDS)
const num = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : null)
const short = (d: string) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d + 'T12:00:00Z'))

export function MeasureForm({ today }: { today: string }) {
  const [day, setDay] = useState(today)
  const [v, setV] = useState<Record<Key, string>>(Object.fromEntries(FIELDS.map(([k]) => [k, ''])) as Record<Key, string>)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <form className="card p-5 flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault()
      start(async () => {
        const r = await addMeasurementAction({ day, note: null, ...(Object.fromEntries(FIELDS.map(([k]) => [k, num(v[k])])) as Record<Key, number | null>) })
        if (!r.ok) { setMsg({ ok: false, t: r.error }); return }
        setMsg({ ok: true, t: 'Ölçüler kaydedildi.' }); setV(Object.fromEntries(FIELDS.map(([k]) => [k, ''])) as Record<Key, string>); router.refresh()
      })
    }}>
      <Eyebrow>Vücut ölçüsü ekle</Eyebrow>
      <label htmlFor="m-day" className="flex items-center justify-between text-sm font-semibold">Tarih
        <input id="m-day" type="date" max={today} value={day} onChange={(e) => setDay(e.target.value)} className="h-11 rounded-xl bg-surface-2 border border-line px-3 text-ink font-normal" />
      </label>
      <div className="grid grid-cols-4 gap-2">
        {FIELDS.map(([k, label]) => (
          <label key={k} htmlFor={`m-${k}`} className="flex flex-col gap-1 text-[12px] font-semibold">{label} <span className="text-mute font-normal">({k === 'bodyFatPct' ? '%' : 'cm'})</span>
            <input id={`m-${k}`} inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="h-11 rounded-xl bg-surface-2 border border-line px-2 num text-ink text-center" />
          </label>
        ))}
      </div>
      <p className="text-[11px] text-mute">İpucu: sabah, aç karnına ve aynı noktalardan ölç (bel: göbek hizası). Doldurmadığın alanlar boş kalır.</p>
      <button type="submit" className={btn.primary} disabled={pending}>Kaydet</button>
      {msg ? <p role="status" className={`text-[13px] ${msg.ok ? 'text-acc' : 'text-danger'}`}>{msg.t}</p> : null}
    </form>
  )
}

export function DeleteMeasure({ id }: { id: number }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return <button type="button" aria-label="Ölçüyü sil" disabled={pending} className="w-9 h-9 flex items-center justify-center text-mute" onClick={() => start(async () => { const r = await deleteMeasurementAction(id); if (r.ok) router.refresh() })}><Trash size={16} /></button>
}

export async function uploadPhoto(file: File, fields: Record<string, string>): Promise<{ id?: string; error?: string }> {
  const fd = new FormData()
  fd.set('file', await shrinkImage(file), 'foto.jpg')
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  const r = await fetch('/api/media', { method: 'POST', body: fd })
  const j = await r.json().catch(() => ({ error: 'Yükleme başarısız' }))
  return r.ok ? { id: j.id } : { error: j.error ?? 'Yükleme başarısız' }
}

export function Photos({ enabled, today, photos, measures = [], weights = [] }: { enabled: boolean; today: string; photos: { id: string; day: string; pose: string | null }[]; measures?: Snap[]; weights?: { day: string; kg: number }[] }) {
  const [split, setSplit] = useState(50)
  const [mode, setMode] = useState<'side' | 'slide'>('side')
  const [pose, setPose] = useState('ön')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()
  const cmp = sel.map((id) => photos.find((p) => p.id === id)!).filter(Boolean).sort((a, b) => a.day.localeCompare(b.day))
  return (
    <section className="card p-5 flex flex-col gap-3" aria-label="İlerleme fotoğrafları" data-testid="photos">
      <Eyebrow>İlerleme fotoğrafları</Eyebrow>
      <p className="text-[12px] text-mute leading-relaxed">Fotoğraflar sunucuda şifreli saklanır ve yalnızca sen görebilirsin; paylaşılmaz. Yüklemeden önce telefonunda küçültülür, konum bilgisi silinir.</p>
      {!enabled ? <p className="text-[13px] text-orange">Fotoğraf saklama şu an kapalı.</p> : (
        <div className="flex gap-2 items-center">
          <label htmlFor="ph-pose" className="sr-only">Poz</label>
          <select id="ph-pose" value={pose} onChange={(e) => setPose(e.target.value)} className="h-11 rounded-xl bg-surface-2 border border-line px-3 text-ink">
            <option value="ön">Ön</option><option value="yan">Yan</option><option value="arka">Arka</option>
          </select>
          <label className={`${btn.secondary} flex-1 cursor-pointer ${busy ? 'opacity-50' : ''}`}>
            {busy ? 'Yükleniyor…' : 'Fotoğraf ekle'}
            <input type="file" accept="image/*" className="sr-only" data-testid="photo-input" disabled={busy} onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ''
              if (!f) return
              setBusy(true); setMsg(null)
              try { const r = await uploadPhoto(f, { kind: 'progress', day: today, pose }); setMsg(r.error ? { ok: false, t: r.error } : { ok: true, t: 'Fotoğraf eklendi.' }); if (!r.error) router.refresh() }
              catch (err) { setMsg({ ok: false, t: (err as Error).message }) } finally { setBusy(false) }
            }} />
          </label>
        </div>
      )}
      {msg ? <p role="status" className={`text-[13px] ${msg.ok ? 'text-acc' : 'text-danger'}`}>{msg.t}</p> : null}
      {cmp.length === 2 ? (() => {
        const c = compareDays(cmp[0].day, cmp[1].day, measures, weights)
        const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNum(Math.abs(v), 1)
        return (
          <div className="flex flex-col gap-2" data-testid="compare">
            <div className="flex gap-1.5" role="group" aria-label="Karşılaştırma görünümü">
              {(['side', 'slide'] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`h-9 px-3 rounded-full text-[13px] font-bold border ${mode === m ? 'bg-acc text-acc-ink border-acc' : 'bg-surface-2 text-ink-2 border-line'}`}>{m === 'side' ? 'Yan yana' : 'Kaydırarak'}</button>)}
            </div>
            {mode === 'side' ? (
              <div className="grid grid-cols-2 gap-2">
                {cmp.map((p) => <figure key={p.id} className="flex flex-col gap-1"><img src={`/api/media/${p.id}`} alt={`${short(p.day)} ${p.pose ?? ''}`} className="w-full aspect-[3/4] object-cover rounded-xl bg-surface-2" /><figcaption className="text-[12px] text-mute text-center">{short(p.day)}{p.pose ? ` · ${p.pose}` : ''}</figcaption></figure>)}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-surface-2 select-none" data-testid="compare-slide">
                  <img src={`/api/media/${cmp[1].id}`} alt={`${short(cmp[1].day)} (sonra)`} className="absolute inset-0 w-full h-full object-cover" />
                  <img src={`/api/media/${cmp[0].id}`} alt={`${short(cmp[0].day)} (önce)`} className="absolute inset-0 w-full h-full object-cover" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} />
                  <span aria-hidden className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow" style={{ left: `${split}%` }} />
                  <span className="absolute left-2 top-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white">{short(cmp[0].day)}</span>
                  <span className="absolute right-2 top-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white">{short(cmp[1].day)}</span>
                </div>
                <label className="flex items-center gap-3 text-[12px] text-mute"><span className="sr-only">Önce / sonra oranı</span>
                  <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="flex-1 h-11" aria-label="Önce / sonra kaydırıcısı" />
                </label>
              </div>
            )}
            <p className="text-[13px] text-ink-2 leading-relaxed" data-testid="compare-summary">
              {c.days} gün arayla{c.weight !== null ? ` · kilo ${sign(c.weight)} kg` : ''}{c.deltas.length ? ` · ${c.deltas.map((d) => `${LABEL[d.key] ?? d.key} ${sign(d.delta)}${d.key === 'bodyFatPct' ? ' puan' : ' cm'}`).join(' · ')}` : ''}
              {c.weight === null && !c.deltas.length ? ' · bu tarihlerin yakınında (±7 gün) tartı ya da ölçü yok' : ''}
            </p>
          </div>
        )
      })() : photos.length >= 2 ? <p className="text-[12px] text-mute">Yan yana kıyaslamak için iki fotoğraf seç.</p> : null}
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <li key={p.id} className="relative">
            <button type="button" aria-pressed={sel.includes(p.id)} aria-label={`${short(p.day)} ${p.pose ?? ''} fotoğrafını seç`} onClick={() => setSel(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel.slice(-1), p.id])}
              className={`block w-full rounded-xl overflow-hidden border-2 ${sel.includes(p.id) ? 'border-acc' : 'border-transparent'}`}>
              <img src={`/api/media/${p.id}`} alt="" loading="lazy" className="w-full aspect-[3/4] object-cover bg-surface-2" />
            </button>
            <span className="text-[11px] text-mute">{short(p.day)}{p.pose ? ` · ${p.pose}` : ''}</span>
            <button type="button" aria-label="Fotoğrafı sil" disabled={pending} className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center" onClick={async () => { if ((await ask('Fotoğraf kalıcı olarak silinsin mi?'))) start(async () => { const r = await deleteMediaAction(p.id); if (r.ok) { setSel(sel.filter((x) => x !== p.id)); router.refresh() } }) }}><Trash size={14} /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}
