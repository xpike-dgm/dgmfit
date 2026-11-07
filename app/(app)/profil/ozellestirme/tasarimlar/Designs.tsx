'use client'
import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import { designAction, templateAction } from '../actions'
import { CATEGORIES } from '@/lib/cards/templates'

type D = { id: string; name: string; active: boolean; updatedAt: string; summary: string; preview: ReactNode }
const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Designs({ designs, versions }: { designs: D[]; versions: { id: string; note: string; at: string }[] }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [menu, setMenu] = useState<D | null>(null)
  const [name, setName] = useState('')
  const [pub, setPub] = useState<D | null>(null)
  const [meta, setMeta] = useState({ name: '', description: '', category: 'diger', tags: '', toFeed: true })
  const [pending, start] = useTransition()
  const router = useRouter()
  const run = (input: unknown, done: string) => start(async () => {
    const r = await designAction(input).catch(() => null)
    setMsg(r?.ok ? done : r && !r.ok ? r.error : 'Olmadı'); if (r?.ok) router.refresh()
  })
  return (
    <>
      <section aria-label="Tasarımlar" className="card px-4 py-1 flex flex-col" data-testid="designs">
        {designs.length ? null : <p className="text-[13px] text-mute py-3">Henüz kayıtlı tasarım yok; bir ekranı düzenlediğinde "Benim düzenim" oluşur.</p>}
        {designs.map((d, i) => (
          <div key={d.id} className={`flex items-center gap-3 py-3 ${i ? 'border-t border-line' : ''}`} data-design={d.name}>
            {d.preview}
            <span className="flex-1 flex flex-col min-w-0">
              <span className="flex items-center gap-2"><b className="text-[15px] truncate">{d.name}</b>{d.active ? <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-acc text-acc-ink shrink-0">ETKİN</span> : null}</span>
              <span className="text-[12px] text-mute">{d.summary}</span>
              <span className="text-[11.5px] text-mute">{when(d.updatedAt)}</span>
            </span>
            <span className="flex flex-col gap-1.5 items-end shrink-0">
              {!d.active ? <button type="button" disabled={pending} onClick={() => run({ op: 'activate', id: d.id }, `${d.name} etkin`)} className="h-9 px-3 rounded-full bg-acc text-acc-ink text-[12.5px] font-extrabold" data-testid="design-activate">Kullan</button> : null}
              <button type="button" onClick={() => { setMenu(d); setName(d.name) }} className="h-9 px-3 rounded-full border border-line-2 text-[12.5px] font-bold" aria-label={`${d.name} seçenekleri`}>Seçenekler</button>
            </span>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 py-3 border-t border-line">
          <button type="button" disabled={pending} onClick={() => run({ op: 'create', name: 'Yeni tasarım', from: 'default' }, 'Varsayılandan yeni tasarım oluşturuldu')} className="h-11 rounded-full border border-dashed border-line-2 text-[13px] font-bold" data-testid="design-new">+ Varsayılandan</button>
          {designs.some((d) => d.active) ? <button type="button" disabled={pending} onClick={() => run({ op: 'create', name: `${designs.find((d) => d.active)!.name} (kopya)`, from: designs.find((d) => d.active)!.id }, 'Kopya oluşturuldu')} className="h-11 rounded-full border border-dashed border-line-2 text-[13px] font-bold" data-testid="design-copy">+ Etkin olanı kopyala</button> : null}
        </div>
      </section>
      <p className="text-[12px] text-mute px-1 leading-snug">Birimlerin, tek el ayarın, sabitlediğin kartlar gibi kişisel ayarların tasarım değiştirince de seninle gelir.</p>

      <section aria-label="Sürümler" className="card px-4 py-1 flex flex-col" data-testid="versions">
        <h2 className="text-[15px] font-extrabold pt-3 pb-1">Etkin tasarımın sürümleri</h2>
        {!versions.length ? <p className="text-[13px] text-mute pb-3">Her kaydettiğinde burada bir sürüm oluşur; istediğin ana geri dönebilirsin.</p> : null}
        {versions.map((v, i) => (
          <div key={v.id} className="flex items-center gap-3 min-h-[52px] border-t border-line first:border-0" data-version={v.note}>
            <span className="flex-1 flex flex-col"><b className="text-[14px]">{v.note || 'Kayıt'}</b><span className="text-[12px] text-mute">{when(v.at)}{i === 0 ? ' · şu anki' : ''}</span></span>
            {i > 0 ? <button type="button" disabled={pending} onClick={() => { if (confirm('Tasarım bu sürüme dönsün mü? (Şu anki hâl de sürüm olarak kalır.)')) run({ op: 'restore', id: v.id }, 'Sürüm geri yüklendi') }} className="h-9 px-3 rounded-full border border-line-2 text-[12.5px] font-bold" data-testid="version-restore">Geri yükle</button> : null}
          </div>
        ))}
      </section>
      {msg ? <p role="status" className="text-[13px] font-bold text-ink-2 px-1">{msg}</p> : null}

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name ?? ''}>
        {menu ? (
          <div className="flex flex-col gap-3 pb-4">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const id = menu.id; setMenu(null); run({ op: 'rename', id, name }, 'Ad değişti') }}>
              <label htmlFor="d-name" className="sr-only">Tasarım adı</label>
              <input id="d-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} className="flex-1 h-12 rounded-xl bg-surface-2 border border-line px-3" />
              <button type="submit" disabled={!name.trim()} className="h-12 px-4 rounded-full bg-acc text-acc-ink font-extrabold text-sm disabled:opacity-40">Kaydet</button>
            </form>
            <button type="button" onClick={() => { const d = menu; setMenu(null); run({ op: 'create', name: `${d.name} (kopya)`, from: d.id }, 'Kopya oluşturuldu') }} className="min-h-[52px] px-4 rounded-[18px] bg-surface-2 text-left font-bold">Kopyasını oluştur</button>
            <button type="button" onClick={() => { const d = menu; setMenu(null); setMeta({ name: d.name, description: '', category: 'diger', tags: '', toFeed: true }); setPub(d) }} className="min-h-[52px] px-4 rounded-[18px] bg-surface-2 text-left font-bold" data-testid="design-publish">Şablon olarak paylaş</button>
            {!menu.active ? <button type="button" onClick={() => { const d = menu; setMenu(null); if (confirm(`${d.name} silinsin mi?`)) run({ op: 'delete', id: d.id }, 'Silindi') }} className="h-12 rounded-full border border-danger-line text-danger font-bold" data-testid="design-delete">Sil</button> : <p className="text-[12.5px] text-mute">Etkin tasarım silinemez; önce başka birini kullan.</p>}
          </div>
        ) : null}
      </Sheet>
      <Sheet open={!!pub} onClose={() => setPub(null)} title="Şablon olarak paylaş">
        {pub ? (
          <form className="flex flex-col gap-3 pb-4" data-testid="publish-form" onSubmit={(e) => {
            e.preventDefault(); const d = pub; setPub(null)
            start(async () => {
              const r = await templateAction({ op: 'publish', designId: d.id, name: meta.name, description: meta.description, category: meta.category, tags: meta.tags.split(/[\s,]+/).filter(Boolean), toFeed: meta.toFeed }).catch(() => null)
              if (!r?.ok) { setMsg(r && !r.ok ? r.error : 'Paylaşılamadı'); return }
              setMsg(r.status === 'public' ? 'Şablon paylaşıldı' : 'Şablon onay bekliyor'); router.push(`/profil/ozellestirme/sablonlar/${r.id}`)
            })
          }}>
            <p className="text-[12.5px] text-mute leading-snug">Paylaşılanlar: kart düzeni, renkler, stil, kurallar. Paylaşılmayanlar: kilo, kalori, birimler, tek el ayarı, sabitlediklerin, bant fotoğrafın.</p>
            <label className="flex flex-col gap-1"><span className="text-xs text-mute">Ad</span><input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value.slice(0, 40) })} className="h-12 rounded-xl bg-surface-2 border border-line px-3" data-testid="pub-name" /></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-mute">Açıklama (isteğe bağlı)</span><textarea value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value.slice(0, 300) })} rows={2} className="rounded-xl bg-surface-2 border border-line px-3 py-2" data-testid="pub-desc" /></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-mute">Kategori</span>
              <select value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} className="h-12 rounded-xl bg-surface-2 border border-line px-3" data-testid="pub-category">{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-mute">Etiketler (boşlukla ayır)</span><input value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value.slice(0, 80) })} placeholder="gece mavi sade" className="h-12 rounded-xl bg-surface-2 border border-line px-3" data-testid="pub-tags" /></label>
            <label className="flex items-center justify-between gap-3 min-h-11"><span className="text-[14px] font-bold">Sosyal akışta arkadaşlarımla da paylaş</span>
              <input type="checkbox" checked={meta.toFeed} onChange={(e) => setMeta({ ...meta, toFeed: e.target.checked })} data-testid="pub-feed" /></label>
            <button type="submit" disabled={meta.name.trim().length < 2 || pending} className="h-14 rounded-full bg-acc text-acc-ink font-extrabold disabled:opacity-40" data-testid="pub-submit">Paylaş</button>
          </form>
        ) : null}
      </Sheet>
    </>
  )
}
