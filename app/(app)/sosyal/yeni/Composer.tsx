'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { POST_KINDS, type PostKind } from '@/lib/social'
import { MEAL_LABEL, type MealId } from '@/lib/food'
import { shrinkImage } from '@/lib/client-image'
import { SUPPORT } from '@/lib/safety'
import { createPostAction } from '../actions'

type Opt = { id: string; label: string }
const AUD = [['friends', 'Arkadaşlar'], ['public', 'Herkese açık'], ['selected', 'Seçilenler']] as const

export default function Composer(p: { initialKind: string; initialRef: string | null; today: string; mediaOn: boolean; workouts: Opt[]; prs: Opt[]; recipes: Opt[]; programs: Opt[]; friends: { id: string; username: string }[]; progress: Opt[] }) {
  const [kind, setKind] = useState<PostKind>(p.initialKind as PostKind)
  const [ref, setRef] = useState<string | null>(p.initialRef)
  const [meal, setMeal] = useState<MealId>('lunch')
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<{ id: string; url: string }[]>([])
  const [audience, setAudience] = useState<'friends' | 'public' | 'selected'>(p.initialKind === 'progress' ? 'selected' : 'friends')
  const [sel, setSel] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [support, setSupport] = useState<'ed' | 'crisis' | null>(null)
  const router = useRouter()
  const options: Record<string, Opt[]> = { workout: p.workouts, pr: p.prs, recipe: p.recipes, program: p.programs, progress: p.progress }
  const list = options[kind]
  const upload = async (f: File) => {
    setErr(null)
    const fd = new FormData(); fd.set('file', await shrinkImage(f, 1280, 0.82), 'foto.jpg'); fd.set('kind', 'social'); fd.set('day', p.today)
    const r = await fetch('/api/media', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}))
    if (!r.ok) { setErr(j.error ?? 'Yüklenemedi'); return }
    setMedia((m) => [...m, { id: j.id, url: `/api/media/${j.id}` }])
  }
  const submit = async () => {
    setBusy(true); setErr(null)
    const r = await createPostAction({
      kind, body, mediaIds: kind === 'progress' ? (ref ? [ref] : []) : media.map((m) => m.id), audience: kind === 'progress' ? 'selected' : audience, audienceIds: sel,
      ref: kind === 'meal' ? `${p.today}:${meal}` : kind === 'progress' ? null : ref,
    }).catch(() => ({ ok: false as const, error: 'Bağlantı yok' }))
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    if (r.support) { setSupport(r.support); return }
    router.push(`/sosyal/p/${r.id}`)
  }
  if (support) return (
    <div className="flex flex-col gap-3" data-testid="post-support">
      <div className="rounded-[20px] border border-water/50 bg-surface px-4 py-3 flex flex-col gap-1"><b className="text-water">{SUPPORT[support].title}</b><p className="text-[14px] text-ink-2">{SUPPORT[support].body}</p></div>
      <p className="text-[13px] text-mute">Gönderin şimdilik yalnızca sana görünüyor ve incelemeye alındı.</p>
      <button type="button" className={btn.secondary} onClick={() => router.push('/sosyal')}>Akışa dön</button>
    </div>
  )
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void submit() }} data-testid="composer">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Gönderi türü">
        {(Object.keys(POST_KINDS) as PostKind[]).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setRef(null); if (k === 'progress') setAudience('selected') }} className={`h-9 px-3 rounded-full text-[13px] font-bold ${kind === k ? 'bg-acc text-acc-ink' : 'bg-surface-2'}`}>{POST_KINDS[k]}</button>)}
      </div>
      {list ? (
        <label className="flex flex-col gap-1 text-[13px] font-semibold">{kind === 'progress' ? 'İlerleme fotoğrafı' : 'Paylaşılacak kayıt'}
          <select value={ref ?? ''} onChange={(e) => setRef(e.target.value || null)} className="h-12 rounded-xl bg-surface-2 border border-line px-3 font-normal" aria-label="Paylaşılacak kayıt">
            <option value="">Seç…</option>{list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {!list.length ? <span className="text-[12px] text-mute font-normal">Henüz paylaşılacak kayıt yok.</span> : null}
        </label>
      ) : null}
      {kind === 'meal' ? <label className="flex flex-col gap-1 text-[13px] font-semibold">Bugünkü öğün<select value={meal} onChange={(e) => setMeal(e.target.value as MealId)} className="h-12 rounded-xl bg-surface-2 border border-line px-3 font-normal">{(Object.keys(MEAL_LABEL) as MealId[]).map((k) => <option key={k} value={k}>{MEAL_LABEL[k]}</option>)}</select></label> : null}
      {kind === 'milestone' ? <p className="text-[13px] text-mute">Yalnızca değişim paylaşılır (ör. "−6 kg"); kilon görünmez.</p> : null}
      {kind === 'program' ? <p className="text-[13px] text-mute">Programın tüm günleri ve hareketleri paylaşılır; görenler kendi programlarına kaydedebilir. Kişisel (kendi eklediğin) hareketler paylaşılmaz.</p> : null}
      {kind === 'streak' ? <p className="text-[13px] text-mute">Güncel su serin paylaşılır.</p> : null}
      <label htmlFor="post-body" className="sr-only">Metin</label>
      <textarea id="post-body" rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Bir şeyler yaz…" className="rounded-2xl bg-surface-2 border border-line px-4 py-3" />
      {kind !== 'progress' && p.mediaOn ? (
        <div className="flex flex-wrap gap-2 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {media.map((m) => <img key={m.id} src={m.url} alt="" className="w-16 h-16 rounded-xl object-cover" />)}
          {media.length < 4 ? <label className="h-16 w-16 rounded-xl border border-dashed border-line-2 flex items-center justify-center text-2xl cursor-pointer" aria-label="Fotoğraf ekle">+<input type="file" accept="image/*" className="sr-only" data-testid="post-photo" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f) }} /></label> : null}
        </div>
      ) : null}
      {kind !== 'progress' ? (
        <fieldset className="flex gap-1.5"><legend className="text-[13px] font-semibold mb-1.5">Kimler görsün?</legend>
          {AUD.map(([k, l]) => <button key={k} type="button" aria-pressed={audience === k} onClick={() => setAudience(k)} className={`h-9 px-3 rounded-full text-[13px] font-bold ${audience === k ? 'bg-ink text-bg' : 'bg-surface-2'}`}>{l}</button>)}
        </fieldset>
      ) : <p className="text-[13px] text-mute">İlerleme fotoğrafı yalnızca seçtiğin arkadaşlara görünür.</p>}
      {audience === 'selected' || kind === 'progress' ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Seçilen arkadaşlar">
          {p.friends.length ? p.friends.map((f) => <button key={f.id} type="button" aria-pressed={sel.includes(f.id)} onClick={() => setSel(sel.includes(f.id) ? sel.filter((x) => x !== f.id) : [...sel, f.id])} className={`h-9 px-3 rounded-full text-[13px] font-semibold ${sel.includes(f.id) ? 'bg-acc text-acc-ink' : 'bg-surface-2'}`}>{f.username}</button>) : <span className="text-[13px] text-mute">Önce arkadaş ekle.</span>}
        </div>
      ) : null}
      {err ? <p role="alert" className="text-[13px] text-orange">{err}</p> : null}
      <button type="submit" className={btn.primary} disabled={busy}>{busy ? 'Paylaşılıyor…' : 'Paylaş'}</button>
      <p className="text-[11px] text-faint text-center">Konum asla paylaşılmaz. Gönderiler topluluk kurallarına göre denetlenir.</p>
    </form>
  )
}
