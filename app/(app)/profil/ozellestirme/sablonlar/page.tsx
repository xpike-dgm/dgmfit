import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { listTemplates } from '@/lib/cards/templates-data'
import { CATEGORIES, isCategory, type Sort } from '@/lib/cards/templates'
import StudioHeader from '@/components/cards/StudioHeader'
import MiniPreview from '@/components/cards/MiniPreview'
import { UseButton, UseModeBox } from './LibraryUse'

export const metadata = { title: 'Şablon kütüphanesi' }
const SORTS: [Sort, string][] = [['featured', 'Öne çıkan'], ['popular', 'Popüler'], ['new', 'Yeni'], ['saved', 'Kaydettiklerim'], ['mine', 'Benimkiler']]

/** Ö3b/Ö6: topluluğun tasarım şablonları (gösterilen tasarım) — arama, tek sıra çip, haftanın şablonu, ızgara, "Kullan'a basınca". */
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
  const showHero = sort === 'featured' && !kat && !sp.q && !pending && list.length > 0
  const hero = showHero ? list[0] : null
  const grid = hero ? list.slice(1) : list
  const chip = 'h-9 px-3.5 rounded-full text-[13px] font-bold border shrink-0 inline-flex items-center'
  const on = 'bg-acc text-acc-ink border-acc', off = 'bg-surface border-line-2 text-ink'
  return (
    <div className="px-4 flex flex-col gap-3.5 pb-6" data-mod="social" data-testid="library">
      <StudioHeader back="/profil/ozellestirme" title="Şablon kütüphanesi" right={
        <Link href="/profil/ozellestirme/tasarimlar" aria-label="Tasarımını paylaş" className="w-11 h-11 rounded-full bg-surface-2 inline-flex items-center justify-center shrink-0" data-testid="library-share">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></svg>
        </Link>} />
      <form action="/profil/ozellestirme/sablonlar" role="search" className="relative">
        <label htmlFor="tq" className="sr-only">Şablon ara</label>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input id="tq" name="q" type="search" enterKeyHint="search" defaultValue={sp.q ?? ''} placeholder="Şablon ya da tasarımcı ara" className="w-full h-12 rounded-[14px] bg-surface border border-line pl-10 pr-4 text-[15px]" />
        {sort !== 'featured' ? <input type="hidden" name="sira" value={sort} /> : null}
        {kat ? <input type="hidden" name="kat" value={kat} /> : null}
      </form>
      <nav aria-label="Sıralama ve kategoriler" className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5 [scrollbar-width:none]">
        {SORTS.map(([s, l]) => <Link key={s} href={href({ sira: s })} aria-current={s === sort && !pending ? 'page' : undefined} className={`${chip} ${s === sort && !pending ? on : off}`}>{l}</Link>)}
        {CATEGORIES.map((c) => <Link key={c.id} href={href({ kat: kat === c.id ? null : c.id })} aria-current={kat === c.id ? 'page' : undefined} className={`${chip} ${kat === c.id ? 'bg-ink text-bg border-ink' : off}`}>{c.label}</Link>)}
        {u.admin ? <Link href="/profil/ozellestirme/sablonlar?onay=1" aria-current={pending ? 'page' : undefined} className={`${chip} ${pending ? on : off}`}>Onay bekleyenler</Link> : null}
      </nav>

      {hero ? (
        <section aria-label="Haftanın şablonu" className="card rounded-[24px] p-3.5 flex gap-3.5" data-template={hero.name} data-testid="library-hero">
          <Link href={`/profil/ozellestirme/sablonlar/${hero.id}`} className="shrink-0"><MiniPreview design={hero.data} width={92} label={`${hero.name} önizlemesi`} /></Link>
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <span className="text-[11.5px] font-extrabold tracking-[0.06em] uppercase text-acc">{hero.featured ? 'Haftanın şablonu' : 'Öne çıkan'}</span>
            <b className="num text-[19px] font-bold leading-tight truncate">{hero.name}</b>
            <span className="text-[12.5px] text-mute truncate">@{hero.owner} · {hero.uses} kişi kullanıyor</span>
            <span className="flex flex-wrap gap-1.5">{[CATEGORIES.find((c) => c.id === hero.category)?.label, ...hero.tags.slice(0, 2)].filter(Boolean).map((t) => <span key={t} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-surface-2 text-ink-2">{t}</span>)}</span>
            <span className="flex gap-2 mt-auto pt-2"><UseButton id={hero.id} /><Link href={`/profil/ozellestirme/sablonlar/${hero.id}`} className="min-h-11 px-4 rounded-full border border-line-2 font-bold text-[14px] inline-flex items-center">Önizle</Link></span>
          </div>
        </section>
      ) : null}

      {!list.length ? <p className="card p-4 text-[14px] text-mute">{sort === 'mine' ? 'Henüz şablon paylaşmadın. Sağ üstteki paylaş düğmesiyle tasarımını şablon olarak paylaşabilirsin.' : sort === 'saved' ? 'Kaydettiğin şablon yok.' : 'Bu aramada şablon yok.'}</p> : null}
      <div className="grid grid-cols-2 gap-2.5">
        {grid.map((t) => (
          <Link key={t.id} href={`/profil/ozellestirme/sablonlar/${t.id}`} className="card rounded-[20px] p-2.5 flex flex-col gap-1.5" data-template={t.name}>
            <div className="h-[104px] rounded-[14px] overflow-hidden bg-bg" aria-hidden><MiniPreview design={t.data} width={150} frame={false} label={`${t.name} önizlemesi`} /></div>
            <b className="text-[14px] font-extrabold truncate pt-1">{t.featured ? '★ ' : ''}{t.name}</b>
            <span className="text-[12px] text-mute truncate num">@{t.owner} · {t.likes} ♡{t.status !== 'public' ? ` · ${t.status === 'pending' ? 'onay bekliyor' : 'gizli'}` : ''}</span>
          </Link>
        ))}
      </div>

      <UseModeBox />
      <Link href="/profil/ozellestirme/yarisma" className="card rounded-[20px] min-h-[56px] px-3.5 flex items-center justify-between gap-3" data-testid="studio-contest">
        <span className="flex flex-col"><b className="text-[14px]">Tasarım yarışması</b><span className="text-[12px] text-mute">Haftalık tema, oy ver, rozet kazan</span></span><span className="text-mute">›</span>
      </Link>
    </div>
  )
}
