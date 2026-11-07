import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { listTemplates } from '@/lib/cards/templates-data'
import { CATEGORIES, isCategory, type Sort } from '@/lib/cards/templates'
import { TopBar } from '@/components/ui'
import MiniPreview from '@/components/cards/MiniPreview'

export const metadata = { title: 'Şablon kütüphanesi' }
const SORTS: [Sort, string][] = [['featured', 'Öne çıkan'], ['popular', 'Popüler'], ['new', 'Yeni'], ['saved', 'Kaydettiklerim'], ['mine', 'Benimkiler']]

/** Ö3b: topluluğun tasarım şablonları — arama, kategori, sıralama; önizleme kişisel veri içermez. */
export default async function Page(props: { searchParams: Promise<{ sira?: string; kat?: string; q?: string; onay?: string }> }) {
  const u = await requireUser()
  const sp = await props.searchParams
  const sort = (SORTS.find(([s]) => s === sp.sira)?.[0] ?? 'featured') as Sort
  const kat = isCategory(sp.kat) ? sp.kat : null
  const pending = u.admin && sp.onay === '1'
  const list = await listTemplates(u.id, { sort, category: kat, q: sp.q, admin: u.admin, pending })
  const href = (o: { sira?: string; kat?: string | null }) => {
    const q = new URLSearchParams()
    const s = o.sira ?? sort, k = o.kat === undefined ? kat : o.kat
    if (s !== 'featured') q.set('sira', s); if (k) q.set('kat', k); if (sp.q) q.set('q', sp.q)
    return `/profil/ozellestirme/sablonlar${q.size ? '?' + q : ''}`
  }
  const chip = 'h-9 px-3.5 rounded-full text-[13px] font-bold border shrink-0 inline-flex items-center'
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="library">
      <TopBar back="/profil/ozellestirme" title="Şablon kütüphanesi" sub="Topluluğun tasarımları" />
      <form className="flex gap-2" action="/profil/ozellestirme/sablonlar">
        <label htmlFor="tq" className="sr-only">Şablon ara</label>
        <input id="tq" name="q" defaultValue={sp.q ?? ''} placeholder="Ara: ad, açıklama, etiket" className="flex-1 h-11 rounded-full bg-surface-2 border border-line px-4" />
        {sort !== 'featured' ? <input type="hidden" name="sira" value={sort} /> : null}
        {kat ? <input type="hidden" name="kat" value={kat} /> : null}
        <button type="submit" className="h-11 px-4 rounded-full bg-acc text-acc-ink font-bold text-[14px]">Ara</button>
      </form>
      <nav aria-label="Sıralama" className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5">
        {SORTS.map(([s, l]) => <Link key={s} href={href({ sira: s })} aria-current={s === sort && !pending ? 'page' : undefined} className={`${chip} ${s === sort && !pending ? 'bg-acc text-acc-ink border-acc' : 'bg-surface border-line text-ink-2'}`}>{l}</Link>)}
        {u.admin ? <Link href="/profil/ozellestirme/sablonlar?onay=1" aria-current={pending ? 'page' : undefined} className={`${chip} ${pending ? 'bg-acc text-acc-ink border-acc' : 'bg-surface border-line text-ink-2'}`}>Onay bekleyenler</Link> : null}
      </nav>
      <nav aria-label="Kategoriler" className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5">
        <Link href={href({ kat: null })} className={`${chip} ${!kat ? 'bg-ink text-bg border-ink' : 'bg-surface border-line text-ink-2'}`}>Tümü</Link>
        {CATEGORIES.map((c) => <Link key={c.id} href={href({ kat: c.id })} className={`${chip} ${kat === c.id ? 'bg-ink text-bg border-ink' : 'bg-surface border-line text-ink-2'}`}>{c.label}</Link>)}
      </nav>
      {!list.length ? <p className="card p-4 text-[14px] text-mute">{sort === 'mine' ? 'Henüz şablon paylaşmadın. Tasarımlarım → Seçenekler → "Şablon olarak paylaş".' : sort === 'saved' ? 'Kaydettiğin şablon yok.' : 'Bu aramada şablon yok.'}</p> : null}
      <div className="grid grid-cols-2 gap-2.5">
        {list.map((t) => (
          <Link key={t.id} href={`/profil/ozellestirme/sablonlar/${t.id}`} className="card p-2.5 flex flex-col gap-2" data-template={t.name}>
            <div className="flex justify-center"><MiniPreview design={t.data} width={110} label={`${t.name} önizlemesi`} /></div>
            <span className="flex items-center gap-1.5 min-w-0">{t.featured ? <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-acc text-acc-ink shrink-0">HAFTANIN</span> : null}<b className="text-[14px] truncate">{t.name}</b></span>
            <span className="text-[11.5px] text-mute truncate">@{t.owner}{t.status !== 'public' ? ` · ${t.status === 'pending' ? 'onay bekliyor' : 'gizli'}` : ''}</span>
            <span className="text-[11.5px] text-mute num">♥ {t.likes} · {t.uses} kullanım</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
