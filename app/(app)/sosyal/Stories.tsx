'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtNum } from '@/lib/calc'
import { shrinkImage } from '@/lib/client-image'
import Sheet from '@/components/Sheet'
import { btn } from '@/components/ui'
import { storyAction } from './actions'

type S = { id: string; username: string; mine: boolean; body: string; data: { workout?: string; minutes?: number; volumeKg?: number }; media: string | null; createdAt: string }

/** 24 saatlik "Bugün salondaydım" kartları: kişi başına bir halka, dokununca kartlar. */
export default function Stories({ stories, mediaOn }: { stories: S[]; mediaOn: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const [create, setCreate] = useState(false)
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const people = [...new Set(stories.map((s) => s.username))]
  const upload = async (f: File) => {
    const fd = new FormData(); fd.set('file', await shrinkImage(f, 1080, 0.82), 'kart.jpg'); fd.set('kind', 'social')
    const r = await fetch('/api/media', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}))
    if (r.ok) setMedia(j.id); else setErr(j.error ?? 'Yüklenemedi')
  }
  return (
    <section aria-label="Bugün salondaydım" className="flex gap-3 overflow-x-auto pb-1" data-testid="stories">
      <button type="button" onClick={() => setCreate(true)} className="flex flex-col items-center gap-1 shrink-0 w-16">
        <span className="w-14 h-14 rounded-full border-2 border-dashed border-acc text-acc text-2xl flex items-center justify-center">+</span>
        <span className="text-[11px] text-mute text-center leading-tight">Salondaydım</span>
      </button>
      {people.map((u) => (
        <button key={u} type="button" onClick={() => setOpen(u)} className="flex flex-col items-center gap-1 shrink-0 w-16" data-testid="story-ring" aria-label={`${u} kartları`}>
          <span className="w-14 h-14 rounded-full p-[2px] bg-acc"><span className="w-full h-full rounded-full bg-surface-3 flex items-center justify-center font-bold uppercase">{u.slice(0, 1)}</span></span>
          <span className="text-[11px] truncate w-full text-center">{stories.find((s) => s.username === u)?.mine ? 'Sen' : u}</span>
        </button>
      ))}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={`${open ?? ''} · bugün`}>
        <div className="flex flex-col gap-3 pb-5" data-testid="story-view">
          {stories.filter((s) => s.username === open).map((s) => (
            <div key={s.id} className="rounded-2xl bg-surface-2 p-4 flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.media ? <img src={s.media} alt="" className="w-full rounded-xl object-cover" /> : null}
              {s.data.workout ? <span className="font-bold">🏋️ {s.data.workout} · {s.data.minutes} dk · {fmtNum(s.data.volumeKg ?? 0)} kg</span> : null}
              {s.body ? <p className="text-[15px]">{s.body}</p> : null}
              <span className="text-[11px] text-mute">{new Date(s.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })} · 24 saat sonra kaybolur</span>
              {s.mine ? <button type="button" className="self-start text-[12px] text-danger underline" onClick={async () => { await storyAction({ op: 'delete', id: s.id }); setOpen(null); router.refresh() }}>Sil</button> : null}
            </div>
          ))}
        </div>
      </Sheet>
      <Sheet open={create} onClose={() => setCreate(false)} title="Bugün salondaydım">
        <form className="flex flex-col gap-3 pb-5" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); const r = await storyAction({ op: 'create', body, mediaId: media }); setBusy(false); if (!r.ok) { setErr(r.error); return } setCreate(false); setBody(''); setMedia(null); router.refresh() }}>
          <p className="text-[13px] text-mute">Bugünkü antrenmanın varsa özeti otomatik eklenir. Yalnızca arkadaşların görür, 24 saat sonra kaybolur.</p>
          <label htmlFor="story-body" className="sr-only">Not</label>
          <input id="story-body" maxLength={200} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Kısa bir not (isteğe bağlı)" className="h-12 rounded-xl bg-surface-2 border border-line px-3" />
          {mediaOn ? <label className={`${btn.secondary} cursor-pointer`}>{media ? 'Fotoğraf eklendi ✓' : 'Fotoğraf ekle'}<input type="file" accept="image/*" className="sr-only" data-testid="story-photo" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f) }} /></label> : null}
          {err ? <p role="alert" className="text-[13px] text-orange">{err}</p> : null}
          <button type="submit" className={btn.primary} disabled={busy}>Kartı paylaş</button>
        </form>
      </Sheet>
    </section>
  )
}
