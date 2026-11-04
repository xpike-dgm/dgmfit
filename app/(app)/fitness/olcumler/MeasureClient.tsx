'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btn, Eyebrow } from '@/components/ui'
import { Trash } from '@/components/icons'
import { addMeasurementAction, deleteMeasurementAction, deleteMediaAction } from '../actions'

const FIELDS = [['waistCm', 'Bel'], ['chestCm', 'Göğüs'], ['hipsCm', 'Kalça'], ['armCm', 'Kol'], ['thighCm', 'Uyluk'], ['calfCm', 'Baldır'], ['neckCm', 'Boyun'], ['bodyFatPct', 'Yağ %']] as const
type Key = (typeof FIELDS)[number][0]
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
          <label key={k} htmlFor={`m-${k}`} className="flex flex-col gap-1 text-[12px] font-semibold">{label}
            <input id={`m-${k}`} inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="h-11 rounded-xl bg-surface-2 border border-line px-2 num text-ink text-center" />
          </label>
        ))}
      </div>
      <p className="text-[11px] text-mute">İpucu: sabah, aç karnına ve aynı noktalardan ölç (bel: göbek hizası). Doldurmadığın alanlar boş kalır.</p>
      <button type="submit" className={btn.primary} disabled={pending}>Kaydet</button>
      {msg ? <p role="status" className={`text-[13px] ${msg.ok ? 'text-lime' : 'text-danger'}`}>{msg.t}</p> : null}
    </form>
  )
}

export function DeleteMeasure({ id }: { id: number }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return <button type="button" aria-label="Ölçüyü sil" disabled={pending} className="w-9 h-9 flex items-center justify-center text-mute" onClick={() => start(async () => { const r = await deleteMeasurementAction(id); if (r.ok) router.refresh() })}><Trash size={16} /></button>
}

/** Fotoğrafı tarayıcıda küçült (uzun kenar en çok 1280 px, JPEG %85) — EXIF/konum bilgisi de böylece düşer. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  const s = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Fotoğraf işlenemedi'))), 'image/jpeg', 0.85))
}

export async function uploadPhoto(file: File, fields: Record<string, string>): Promise<{ id?: string; error?: string }> {
  const fd = new FormData()
  fd.set('file', await shrink(file), 'foto.jpg')
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  const r = await fetch('/api/media', { method: 'POST', body: fd })
  const j = await r.json().catch(() => ({ error: 'Yükleme başarısız' }))
  return r.ok ? { id: j.id } : { error: j.error ?? 'Yükleme başarısız' }
}

export function Photos({ enabled, today, photos }: { enabled: boolean; today: string; photos: { id: string; day: string; pose: string | null }[] }) {
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
      {msg ? <p role="status" className={`text-[13px] ${msg.ok ? 'text-lime' : 'text-danger'}`}>{msg.t}</p> : null}
      {cmp.length === 2 ? (
        <div className="grid grid-cols-2 gap-2" data-testid="compare">
          {cmp.map((p) => <figure key={p.id} className="flex flex-col gap-1"><img src={`/api/media/${p.id}`} alt={`${short(p.day)} ${p.pose ?? ''}`} className="w-full aspect-[3/4] object-cover rounded-xl bg-surface-2" /><figcaption className="text-[12px] text-mute text-center">{short(p.day)}{p.pose ? ` · ${p.pose}` : ''}</figcaption></figure>)}
        </div>
      ) : photos.length >= 2 ? <p className="text-[12px] text-mute">Yan yana kıyaslamak için iki fotoğraf seç.</p> : null}
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <li key={p.id} className="relative">
            <button type="button" aria-pressed={sel.includes(p.id)} aria-label={`${short(p.day)} ${p.pose ?? ''} fotoğrafını seç`} onClick={() => setSel(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel.slice(-1), p.id])}
              className={`block w-full rounded-xl overflow-hidden border-2 ${sel.includes(p.id) ? 'border-lime' : 'border-transparent'}`}>
              <img src={`/api/media/${p.id}`} alt="" loading="lazy" className="w-full aspect-[3/4] object-cover bg-surface-2" />
            </button>
            <span className="text-[11px] text-mute">{short(p.day)}{p.pose ? ` · ${p.pose}` : ''}</span>
            <button type="button" aria-label="Fotoğrafı sil" disabled={pending} className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center" onClick={() => { if (confirm('Fotoğraf kalıcı olarak silinsin mi?')) start(async () => { const r = await deleteMediaAction(p.id); if (r.ok) { setSel(sel.filter((x) => x !== p.id)); router.refresh() } }) }}><Trash size={14} /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}
