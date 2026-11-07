'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { communityAction } from '@/app/(app)/profil/ozellestirme/actions'

export default function AdminDesign({ contest, announcements, screens }: {
  contest: { theme: string; description: string; entries: number } | null
  announcements: { id: string; title: string; active: boolean; endsAt: string | null }[]
  screens: { id: string; title: string; custom: boolean; count: number }[]
}) {
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  const [ct, setCt] = useState({ theme: contest?.theme ?? '', description: contest?.description ?? '' })
  const [an, setAn] = useState({ title: '', body: '', url: '', days: 7 })
  const run = (input: Record<string, unknown>, done: string) => start(async () => {
    const r = await communityAction(input).catch(() => null)
    setMsg(r?.ok ? done : r && !r.ok ? r.error : 'Olmadı'); if (r?.ok) router.refresh()
  })
  const field = 'h-11 rounded-xl bg-surface-2 border border-line px-3'
  return (
    <>
      <section aria-label="Yarışma" className="card p-4 flex flex-col gap-2" data-testid="admin-contest">
        <b className="text-[15px]">Bu haftanın yarışması</b>
        <span className="text-[12.5px] text-mute">{contest ? `Açık · ${contest.entries} katılım` : 'Bu hafta yarışma yok'}</span>
        <input aria-label="Tema" value={ct.theme} onChange={(e) => setCt({ ...ct, theme: e.target.value.slice(0, 60) })} placeholder="Tema (ör. Gece mavisi)" className={field} data-testid="contest-theme" />
        <textarea aria-label="Açıklama" value={ct.description} onChange={(e) => setCt({ ...ct, description: e.target.value.slice(0, 300) })} rows={2} placeholder="Kısa açıklama" className="rounded-xl bg-surface-2 border border-line px-3 py-2" />
        <button type="button" disabled={pending || ct.theme.trim().length < 2} onClick={() => run({ op: 'contest', ...ct }, 'Yarışma teması kaydedildi')} className="h-11 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40" data-testid="contest-save">{contest ? 'Temayı güncelle' : 'Yarışmayı başlat'}</button>
      </section>

      <section aria-label="Duyuru" className="card p-4 flex flex-col gap-2" data-testid="admin-announce">
        <b className="text-[15px]">Duyuru kartı</b>
        <span className="text-[12.5px] text-mute">Herkesin Bugün ekranında üstte görünür; kapatan bir daha görmez.</span>
        <input aria-label="Başlık" value={an.title} onChange={(e) => setAn({ ...an, title: e.target.value.slice(0, 80) })} placeholder="Başlık" className={field} data-testid="ann-title" />
        <textarea aria-label="Metin" value={an.body} onChange={(e) => setAn({ ...an, body: e.target.value.slice(0, 300) })} rows={2} placeholder="Metin" className="rounded-xl bg-surface-2 border border-line px-3 py-2" data-testid="ann-body" />
        <div className="flex gap-2">
          <input aria-label="Bağlantı" value={an.url} onChange={(e) => setAn({ ...an, url: e.target.value.slice(0, 300) })} placeholder="/profil/ozellestirme (isteğe bağlı)" className={`${field} flex-1 min-w-0`} />
          <label className="flex items-center gap-1 text-[12.5px] text-mute"><input aria-label="Gün" type="number" min={1} max={60} value={an.days} onChange={(e) => setAn({ ...an, days: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })} className={`${field} w-16`} />gün</label>
        </div>
        <button type="button" disabled={pending || an.title.trim().length < 2} onClick={() => run({ op: 'announce', title: an.title, body: an.body, url: an.url || null, days: an.days }, 'Duyuru yayında')} className="h-11 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40" data-testid="ann-save">Duyuruyu yayınla</button>
        {announcements.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 min-h-11 border-t border-line" data-ann={a.title}>
            <span className="flex flex-col min-w-0"><b className="text-[13.5px] truncate">{a.title}</b><span className="text-[11.5px] text-mute">{a.active ? `yayında${a.endsAt ? ' · ' + new Date(a.endsAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) + "'e kadar" : ''}` : 'kapalı'}</span></span>
            {a.active ? <button type="button" disabled={pending} onClick={() => run({ op: 'closeAnnouncement', id: a.id }, 'Duyuru kapatıldı')} className="h-9 px-3 rounded-full border border-line-2 text-[12.5px] font-bold" data-testid="ann-close">Kapat</button> : null}
          </div>
        ))}
      </section>

      <section aria-label="Varsayılan düzen" className="card px-4 py-1 flex flex-col" data-testid="admin-defaults">
        <b className="text-[15px] pt-3">Varsayılan düzen</b>
        <span className="text-[12.5px] text-mute pb-2">Ekranını kendi hesabında düzenle, sonra burada "Benimkini varsayılan yap". Özelleştirmemiş herkes bu düzeni görür; kendi düzeni olanlar etkilenmez.</span>
        {screens.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 min-h-[52px] border-t border-line" data-default-screen={s.id}>
            <span className="flex flex-col"><b className="text-[14px]">{s.title}</b><span className="text-[11.5px] text-mute">{s.custom ? `Yönetim varsayılanı · ${s.count} kart` : 'Kayıttaki varsayılan'}</span></span>
            <span className="flex gap-1.5">
              <button type="button" disabled={pending} onClick={() => { if (confirm(`${s.title}: senin düzenin herkesin varsayılanı olsun mu?`)) run({ op: 'defaultLayout', screen: s.id, reset: false }, `${s.title} varsayılanı güncellendi`) }} className="h-9 px-3 rounded-full bg-acc text-acc-ink text-[12px] font-extrabold" data-testid="default-set">Benimkini yap</button>
              {s.custom ? <button type="button" disabled={pending} onClick={() => run({ op: 'defaultLayout', screen: s.id, reset: true }, `${s.title} kayıttaki varsayılana döndü`)} className="h-9 px-3 rounded-full border border-line-2 text-[12px] font-bold" data-testid="default-reset">Sıfırla</button> : null}
            </span>
          </div>
        ))}
      </section>
      {msg ? <p role="status" className="text-[13px] font-bold text-ink-2 px-1">{msg}</p> : null}
    </>
  )
}
