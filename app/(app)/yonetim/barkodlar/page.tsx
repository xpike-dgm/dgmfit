import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin'
import { barcodeMissList } from '@/lib/admin-data'
import { TopBar } from '@/components/ui'
import { ago } from '../ui'

export const metadata: Metadata = { title: 'Bulunamayan barkodlar · Yönetim' }
export const dynamic = 'force-dynamic'

/** Kullanıcıların okutup bulamadığı barkodlar. Bir kullanıcı ürünü eklediğinde listeden düşer ve herkes bulur. */
export default async function Page() {
  await requireAdmin()
  const list = await barcodeMissList()
  return (
    <div className="px-4 flex flex-col gap-3 pb-6">
      <TopBar back="/yonetim" title="Bulunamayan barkodlar" sub={`${list.length} ürün eksik`} />
      <p className="text-[13px] text-mute px-1">Bu barkodlar Open Food Facts'te ve kullanıcıların eklediği ürünlerde yok. Bir kullanıcı ürünü etiketiyle eklediğinde listeden düşer ve barkodu okutan herkes bulur.</p>
      <ul className="card px-4 py-1" data-testid="barcode-misses">
        {list.length === 0 ? <li className="py-4 text-[13.5px] text-mute">Eksik ürün yok.</li> : null}
        {list.map((m) => (
          <li key={m.code} className="flex items-center justify-between gap-3 min-h-[52px] border-t border-line first:border-t-0">
            <span className="flex flex-col min-w-0">
              <b className="num text-[15px]">{m.code}</b>
              <span className="text-[12px] text-mute">{m.count} kez okutuldu · son {ago(m.lastAt)}</span>
            </span>
            <a href={`https://www.google.com/search?q=${m.code}`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-acc shrink-0">Ara</a>
          </li>
        ))}
      </ul>
    </div>
  )
}
