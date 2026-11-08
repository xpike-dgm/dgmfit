'use client'
import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Sheet from '@/components/Sheet'
import { designAction, templateAction } from '../actions'
import { CATEGORIES } from '@/lib/cards/templates'
import { ask } from '@/components/Confirm'
import { IconBox } from '@/components/cards/StudioUI'
import { SectionLabel } from '@/components/cards/StudioHeader'

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
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" disabled={pending} onClick={() => run({ op: 'create', name: 'Yeni tasarım', from: 'default' }, 'Varsayılandan yeni tasarım oluşturuldu')}
          className="card rounded-[20px] p-3.5 min-h-[92px] flex flex-col gap-2 text-left active:scale-[0.98] transition disabled:opacity-50" data-testid="design-new">
          <IconBox name="plus" mod="today" /><b className="text-[14px] leading-tight">Varsayılandan yeni</b>
        </button>
        {designs.some((d) => d.active) ? (
          <button type="button" disabled={pending} onClick={() => run({ op: 'create', name: `${designs.find((d) => d.active)!.name} (kopya)`, from: designs.find((d) => d.active)!.id }, 'Kopya oluşturuldu')}
            className="card rounded-[20px] p-3.5 min-h-[92px] flex flex-col gap-2 text-left active:scale-[0.98] transition disabled:opacity-50" data-testid="design-copy">
            <IconBox name="layout" mod="water" /><b className="text-[14px] leading-tight">Etkin olanı kopyala</b>
          </button>
        ) : null}
      </div>
      {msg ? <p role="status" className="text-[13px] font-bold text-ink-2 px-1 -mt-1">{msg}</p> : null}

      <div className="flex flex-col gap-2">
        <span className="px-1"><SectionLabel>Tasarımların</SectionLabel></span>
        <section aria-label="Tasarımlar" className="flex flex-col gap-2.5" data-testid="designs">
          {designs.length ? null : (
            <div className="card rounded-[22px] p-5 flex flex-col items-center text-center gap-2">
              <IconBox name="history" mod="plan" size="lg" />
              <b className="text-[15px]">Henüz kayıtlı tasarım yok</b>
              <span className="text-[13px] text-mute leading-snug max-w-[280px]">Bir ekranı düzenlediğinde “Benim düzenim” oluşur. Farklı günler için ayrı tasarımlar da kurabilirsin.</span>
            </div>
          )}
          {designs.map((d) => (
            <div key={d.id} className={`card rounded-[22px] p-3 flex items-center gap-3 ${d.active ? 'ring-2 ring-acc' : ''}`} data-design={d.name}>
              <span className="shrink-0">{d.preview}</span>
              <span className="flex-1 flex flex-col min-w-0 gap-0.5">
                <span className="flex items-center gap-2"><b className="text-[15.5px] font-extrabold truncate">{d.name}</b>{d.active ? <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-acc text-acc-ink shrink-0">ETKİN</span> : null}</span>
                <span className="text-[12.5px] text-mute">{d.summary}</span>
                <span className="text-[11.5px] text-mute">{when(d.updatedAt)}</span>
                <span className="flex gap-1.5 mt-1.5">
                  {!d.active ? <button type="button" disabled={pending} onClick={() => run({ op: 'activate', id: d.id }, `${d.name} etkin`)} className="h-9 px-4 rounded-full bg-acc text-acc-ink text-[12.5px] font-extrabold" data-testid="design-activate">Kullan</button> : null}
                  <button type="button" onClick={() => { setMenu(d); setName(d.name) }} className="h-9 px-3.5 rounded-full bg-surface-2 border border-line-2 text-[12.5px] font-bold inline-flex items-center gap-1" aria-label={`${d.name} seçenekleri`}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>Seçenekler
                  </button>
                </span>
              </span>
            </div>
          ))}
        </section>
        <p className="text-[12px] text-mute px-1 leading-snug">Birimlerin, tek el ayarın, sabitlediğin kartlar gibi kişisel ayarların tasarım değiştirince de seninle gelir.</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="px-1"><SectionLabel>Etkin tasarımın sürümleri</SectionLabel></span>
        <section aria-label="Sürümler" className="card rounded-[22px] px-4 py-2 flex flex-col" data-testid="versions">
          {!versions.length ? <p className="text-[13px] text-mute py-2">Her kaydettiğinde burada bir sürüm oluşur; istediğin ana geri dönebilirsin.</p> : null}
          {versions.map((v, i) => (
            <div key={v.id} className="flex items-stretch gap-3 min-h-[56px]" data-version={v.note}>
              <span className="w-4 flex flex-col items-center shrink-0" aria-hidden>
                <span className={`w-px flex-1 ${i ? 'bg-line-2' : 'bg-transparent'}`} />
                <span className={`w-3 h-3 rounded-full shrink-0 ${i === 0 ? 'bg-acc ring-4 ring-[color-mix(in_oklab,var(--color-acc)_25%,transparent)]' : 'bg-surface-3 border border-line-2'}`} />
                <span className={`w-px flex-1 ${i < versions.length - 1 ? 'bg-line-2' : 'bg-transparent'}`} />
              </span>
              <span className="flex-1 flex flex-col justify-center py-1.5"><b className="text-[14px]">{v.note || 'Kayıt'}</b><span className="text-[12px] text-mute">{when(v.at)}{i === 0 ? ' · şu anki' : ''}</span></span>
              {i > 0 ? <button type="button" disabled={pending} onClick={async () => { if (await ask('Tasarım bu sürüme dönsün mü? (Şu anki hâl de sürüm olarak kalır.)')) run({ op: 'restore', id: v.id }, 'Sürüm geri yüklendi') }} className="self-center h-9 px-3 rounded-full bg-surface-2 border border-line-2 text-[12.5px] font-bold" data-testid="version-restore">Geri yükle</button> : null}
            </div>
          ))}
        </section>
      </div>
      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name ?? ''}>
        {menu ? (
          <div className="flex flex-col gap-3 pb-4">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const id = menu.id; setMenu(null); run({ op: 'rename', id, name }, 'Ad değişti') }}>
              <label htmlFor="d-name" className="sr-only">Tasarım adı</label>
              <input id="d-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} className="flex-1 h-12 rounded-[14px] bg-surface-2 border border-line px-3.5" />
              <button type="submit" disabled={!name.trim()} className="h-12 px-4 rounded-full bg-acc text-acc-ink font-extrabold text-sm disabled:opacity-40">Kaydet</button>
            </form>
            <button type="button" onClick={() => { const d = menu; setMenu(null); run({ op: 'create', name: `${d.name} (kopya)`, from: d.id }, 'Kopya oluşturuldu') }} className="min-h-[56px] px-4 rounded-[18px] bg-surface-2 text-left font-bold flex items-center gap-3"><IconBox name="layout" mod="water" />Kopyasını oluştur</button>
            <button type="button" onClick={() => { const d = menu; setMenu(null); setMeta({ name: d.name, description: '', category: 'diger', tags: '', toFeed: true }); setPub(d) }} className="min-h-[56px] px-4 rounded-[18px] bg-surface-2 text-left font-bold flex items-center gap-3" data-testid="design-publish"><IconBox name="eye" mod="social" />Şablon olarak paylaş</button>
            {!menu.active ? <button type="button" onClick={async () => { const d = menu; setMenu(null); if ((await ask(`${d.name} silinsin mi?`))) run({ op: 'delete', id: d.id }, 'Silindi') }} className="h-12 rounded-full border border-danger-line text-danger font-bold" data-testid="design-delete">Sil</button> : <p className="text-[12.5px] text-mute">Etkin tasarım silinemez; önce başka birini kullan.</p>}
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
