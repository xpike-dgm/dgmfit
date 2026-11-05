'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/components/ui'
import { ITEMS, ITEM_LABEL, type Item, type ItemVis } from '@/lib/social'
import { shrinkImage } from '@/lib/client-image'
import { saveProfileAction } from '../actions'

type Init = { bio: string; gym: string; visibility: string; items: Record<Item, ItemVis>; showGoal: boolean; showcase: number[]; notify: Record<string, boolean>; avatar: string | null }
const VIS = [['public', 'Herkese açık', 'Herkes profilini ve herkese açık gönderilerini görür, takip edebilir'], ['friends', 'Yalnızca arkadaşlar', 'Adın ve rozetin aramada görünür; ayrıntılar yalnızca arkadaşlara'], ['private', 'Gizli', 'Aramada görünmezsin; yalnızca mevcut arkadaşların görür']] as const
const IV = [['none', 'Kapalı'], ['friends', 'Arkadaşlar'], ['public', 'Herkes']] as const

export type SocialPart = 'profile' | 'privacy' | 'items' | 'notify' | 'invite'

export default function SocialSettings({ initial, mediaOn, invite, qr, exercises, notifyKinds, part }: { initial: Init; mediaOn: boolean; invite: string; qr: string; exercises: { id: number; name: string }[]; notifyKinds: [string, string][]; part: SocialPart }) {
  const [v, setV] = useState(initial)
  const [avatarId, setAvatarId] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const upload = async (f: File) => {
    const fd = new FormData(); fd.set('file', await shrinkImage(f, 512, 0.85), 'avatar.jpg'); fd.set('kind', 'avatar')
    const r = await fetch('/api/media', { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg(j.error ?? 'Yüklenemedi'); return }
    setAvatarId(j.id); setV({ ...v, avatar: `/api/media/${j.id}` })
  }
  const save = async () => {
    setBusy(true); setMsg(null)
    const r = await saveProfileAction({ bio: v.bio, gym: v.gym, visibility: v.visibility as 'friends', items: v.items, showGoal: v.showGoal, showcase: v.showcase, notify: v.notify, ...(avatarId !== undefined ? { avatarId } : {}) })
    setBusy(false); setMsg(r.ok ? 'Kaydedildi' : r.error); router.refresh()
  }
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void save() }} data-testid="social-settings">
      {part === 'profile' ? (
        <section className="card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {v.avatar ? <img src={v.avatar} alt="Profil fotoğrafı" className="w-16 h-16 rounded-full object-cover" /> : <span className="w-16 h-16 rounded-full bg-surface-3" aria-hidden />}
            {mediaOn ? <label className={`${btn.secondary} cursor-pointer`}>Fotoğraf seç<input type="file" accept="image/*" className="sr-only" data-testid="avatar-input" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f) }} /></label> : null}
            {v.avatar ? <button type="button" className="text-[12px] text-mute underline" onClick={() => { setAvatarId(null); setV({ ...v, avatar: null }) }}>Kaldır</button> : null}
          </div>
          <label htmlFor="sp-bio" className="flex flex-col gap-1 text-[13px] font-semibold">Biyografi<textarea id="sp-bio" rows={2} maxLength={200} value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} className="rounded-xl bg-surface-2 border border-line px-3 py-2 font-normal" /></label>
          <label htmlFor="sp-gym" className="flex flex-col gap-1 text-[13px] font-semibold">Spor salonu (isteğe bağlı)<input id="sp-gym" maxLength={60} value={v.gym} onChange={(e) => setV({ ...v, gym: e.target.value })} className="h-11 rounded-xl bg-surface-2 border border-line px-3 font-normal" /></label>
          <label className="flex items-center justify-between text-[14px] font-semibold">Hedef rozetini göster<input type="checkbox" checked={v.showGoal} onChange={(e) => setV({ ...v, showGoal: e.target.checked })} className="w-5 h-5" /></label>
        </section>
      ) : null}
      {part === 'privacy' ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="Profil görünürlüğü">
          <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Profil görünürlüğü</span>
          {VIS.map(([k, l, h]) => (
            <label key={k} className={`flex items-start gap-3 rounded-2xl px-4 py-3 border ${v.visibility === k ? 'border-acc bg-surface-2' : 'border-line'}`}>
              <input type="radio" name="vis" value={k} checked={v.visibility === k} onChange={() => setV({ ...v, visibility: k })} className="mt-1" />
              <span className="flex flex-col"><b>{l}</b><span className="text-[12px] text-mute">{h}</span></span>
            </label>
          ))}
        </section>
      ) : null}
      {part === 'items' ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="Öğe bazında görünürlük">
          <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Profilde kim neyi görsün</span>
          {ITEMS.map((it) => (
            <label key={it} className="flex items-center justify-between gap-2 text-[14px]">{ITEM_LABEL[it]}
              <select aria-label={ITEM_LABEL[it]} value={v.items[it]} onChange={(e) => setV({ ...v, items: { ...v.items, [it]: e.target.value as ItemVis } })} className="h-10 rounded-full bg-surface-2 border border-line px-3 text-[13px]">{IV.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </label>
          ))}
          <p className="text-[12px] text-mute">Kilo ve vücut verileri hiçbir ayarda gösterilmez.</p>
        </section>
      ) : null}
      {part === 'items' ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="Vitrin hareketleri">
          <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">PR vitrini (en fazla 6)</span>
          {exercises.length ? <div className="flex flex-wrap gap-1.5">{exercises.map((e) => { const on = v.showcase.includes(e.id); return (
            <button key={e.id} type="button" aria-pressed={on} onClick={() => setV({ ...v, showcase: on ? v.showcase.filter((x) => x !== e.id) : v.showcase.length < 6 ? [...v.showcase, e.id] : v.showcase })} className={`h-9 px-3 rounded-full text-[13px] font-semibold ${on ? 'bg-acc text-acc-ink' : 'bg-surface-2'}`}>{e.name}</button>
          ) })}</div> : <p className="text-[13px] text-mute">Antrenman kaydettikçe rekorların burada listelenir.</p>}
        </section>
      ) : null}
      {part === 'notify' ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="Bildirimler">
          <span className="text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Sosyal bildirimler</span>
          {notifyKinds.map(([k, l]) => <label key={k} className="flex items-center justify-between text-[14px]">{l}<input type="checkbox" checked={v.notify[k] !== false} onChange={(e) => setV({ ...v, notify: { ...v.notify, [k]: e.target.checked } })} className="w-5 h-5" /></label>)}
        </section>
      ) : null}
      {part !== 'invite' ? <>
        {msg ? <p role="status" className="text-[13px] text-acc px-1">{msg}</p> : null}
        <button type="submit" className={btn.primary} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
      </> : null}
      {part === 'invite' ? (
        <section className="card p-5 flex flex-col gap-3 items-center" aria-label="Davet">
          <span className="self-start text-[12px] font-bold tracking-[0.08em] uppercase text-mute">Davet linki ve QR</span>
          <div className="rounded-2xl overflow-hidden bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} aria-label="Davet QR kodu" role="img" />
          <code className="text-[12px] break-all text-ink-2" data-testid="invite-link">{invite}</code>
          <button type="button" className={btn.secondary} onClick={async () => {
            const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> }
            try { if (nav.share) await nav.share({ title: 'DgFit\'te arkadaşım ol', url: invite }); else { await navigator.clipboard.writeText(invite); setCopied(true) } } catch { /* iptal */ }
          }}>{copied ? 'Kopyalandı' : 'Linki paylaş'}</button>
        </section>
      ) : null}
    </form>
  )
}
