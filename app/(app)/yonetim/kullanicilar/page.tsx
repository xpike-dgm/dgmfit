import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { listUsers, type UserSort } from '@/lib/admin-data'
import { TopBar, btn } from '@/components/ui'
import { Check, Close, Next, Search } from '@/components/icons'
import { approveAllAction, setStatusAction } from '../actions'
import ActionButton from '../ActionButton'
import { Avatar, Chips, StatusPill, ago } from '../ui'

export const metadata: Metadata = { title: 'Kullanıcılar · Yönetim' }
export const dynamic = 'force-dynamic'

const SORTS: { id: UserSort; label: string }[] = [{ id: 'new', label: 'En yeni' }, { id: 'seen', label: 'Son görülen' }, { id: 'name', label: 'Ada göre' }]

export default async function Page(props: { searchParams: Promise<{ durum?: string; q?: string; sira?: string }> }) {
  await requireAdmin()
  const sp = await props.searchParams
  const status = ['pending', 'approved', 'blocked'].includes(sp.durum ?? '') ? sp.durum! : ''
  const sort = (SORTS.find((s) => s.id === sp.sira)?.id ?? 'new') as UserSort
  const q = (sp.q ?? '').slice(0, 60)
  const { rows, counts } = await listUsers({ status: status || undefined, q, sort })
  const href = (o: { durum?: string; sira?: string }) => {
    const u = new URLSearchParams()
    const d = o.durum ?? status; if (d) u.set('durum', d)
    if (q) u.set('q', q)
    const s = o.sira ?? sort; if (s !== 'new') u.set('sira', s)
    const t = u.toString(); return '/yonetim/kullanicilar' + (t ? '?' + t : '')
  }
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="admin-users">
      <TopBar back="/yonetim" title="Kullanıcılar" sub={`${counts.all} hesap · ${counts.pending} onay bekliyor`} />
      <form className="relative" role="search" action="/yonetim/kullanicilar">
        {status ? <input type="hidden" name="durum" value={status} /> : null}
        {sort !== 'new' ? <input type="hidden" name="sira" value={sort} /> : null}
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-mute pointer-events-none" />
        <input name="q" defaultValue={q} type="search" placeholder="Kullanıcı adı ya da e-posta" aria-label="Kullanıcı ara"
          className="w-full h-12 rounded-full bg-surface border border-line pl-11 pr-4 text-[16px] outline-none focus:border-acc" />
      </form>
      <Chips items={[
        { href: href({ durum: '' }), label: 'Tümü', n: counts.all, on: !status },
        { href: href({ durum: 'pending' }), label: 'Onay bekleyen', n: counts.pending, on: status === 'pending' },
        { href: href({ durum: 'approved' }), label: 'Onaylı', n: counts.approved, on: status === 'approved' },
        { href: href({ durum: 'blocked' }), label: 'Askıda / reddedilen', n: counts.blocked, on: status === 'blocked' },
      ]} />
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span className="text-mute">{rows.length} sonuç{q ? ` · “${q}”` : ''}</span>
        <span className="flex gap-1">{SORTS.map((s) => <Link key={s.id} replace href={href({ sira: s.id })} className={`px-2.5 py-1 rounded-full font-bold ${s.id === sort ? 'bg-surface-3 text-ink' : 'text-mute'}`}>{s.label}</Link>)}</span>
      </div>
      {status === 'pending' && rows.length > 1 ? (
        <ActionButton action={approveAllAction} args={[]} className={btn.secondary + ' w-full'} confirm={`${rows.length} hesabın hepsi onaylansın mı?`} testId="approve-all"><Check size={18} /> Hepsini onayla ({rows.length})</ActionButton>
      ) : null}
      <section className="card px-2 py-1 flex flex-col" aria-label="Kullanıcı listesi">
        {rows.length ? rows.map((r, i) => (
          <div key={r.id} className={`flex items-center gap-3 px-2 py-2.5 ${i ? 'border-t border-line' : ''}`} data-testid="user-row" data-username={r.username}>
            <Link href={`/yonetim/kullanicilar/${r.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar name={r.username} />
              <span className="flex flex-col min-w-0 flex-1">
                <span className="flex items-center gap-1.5 min-w-0"><b className="text-[15px] truncate">@{r.username}</b>{r.admin ? <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-acc text-acc-ink shrink-0">YÖNETİCİ</span> : null}</span>
                <span className="text-[12px] text-mute truncate">{r.email}</span>
                <span className="text-[11.5px] text-mute truncate">Kayıt {ago(r.createdAt)} · görüldü {ago(r.lastSeenAt)}{!r.onboarded && r.status === 'approved' ? ' · kurulum yok' : ''}{r.aiDaily !== null ? ` · AI ${r.aiDaily}/gün` : ''}</span>
              </span>
            </Link>
            {r.status === 'pending' ? (
              <span className="flex gap-1.5 shrink-0">
                <ActionButton action={setStatusAction} args={[r.id, 'rejected']} confirm={`@${r.username} reddedilsin mi?`} className="w-10 h-10 rounded-full border border-line-2 flex items-center justify-center text-danger" testId="quick-reject"><Close size={18} /><span className="sr-only">Reddet</span></ActionButton>
                <ActionButton action={setStatusAction} args={[r.id, 'approved']} className="w-10 h-10 rounded-full bg-acc text-acc-ink flex items-center justify-center" testId="quick-approve"><Check size={18} /><span className="sr-only">Onayla</span></ActionButton>
              </span>
            ) : (
              <Link href={`/yonetim/kullanicilar/${r.id}`} className="flex items-center gap-1 shrink-0" aria-label={`@${r.username} ayrıntı`}><StatusPill status={r.status} /><Next size={16} className="text-mute" /></Link>
            )}
          </div>
        )) : <p className="text-[14px] text-mute p-4 text-center">{status === 'pending' ? 'Onay bekleyen kayıt yok.' : 'Eşleşen kullanıcı yok.'}</p>}
      </section>
    </div>
  )
}
