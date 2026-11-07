import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { screenLayout } from '@/lib/cards/design-data'
import { SCREENS } from '@/lib/cards/registry'
import { TopBar } from '@/components/ui'
import ResetButton from './ResetButton'

export const metadata = { title: 'Özelleştirme' }

const SOON: [string, string][] = [
  ['Renkler ve stil', 'Palet, kart renkleri, yazı tipi'],
  ['Modlar', 'Odak, Ramazan, tek el'],
  ['Kendi kartlarım', 'Kart oluştur, takip ekle'],
  ['Tasarımlarım', 'Sürümler, geri al'],
  ['Şablon kütüphanesi', 'Topluluğun tasarımları'],
]

/** Özelleştirme stüdyosu (Ö1): mevcut düzenin önizlemesi + ekran düzenleme. Diğer bölümler sonraki aşamalarda. */
export default async function Page() {
  const u = await requireUser()
  const today = await screenLayout(u.id, 'today')
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="studio">
      <TopBar back="/profil" title="Özelleştirme" sub="Kartları taşı, kaldır, ekle" />
      <section aria-label="Mevcut tasarım" className="card p-4 flex gap-4 items-center">
        <div aria-hidden className="w-[96px] shrink-0 rounded-[18px] border-2 border-line-2 bg-bg p-1.5 grid grid-cols-2 gap-1 content-start" style={{ minHeight: 172 }}>
          {today.items.slice(0, 9).map((i) => (
            <div key={i.id} data-mod={i.def.module} className={`${i.size === 'full' ? 'col-span-2' : ''} rounded-md ${i.def.locked === 'top' ? 'h-8 band' : 'h-5 bg-[color-mix(in_oklab,var(--color-acc)_28%,var(--color-surface-2))]'}`} />
          ))}
        </div>
        <div className="flex flex-col gap-2.5 flex-1 min-w-0">
          <span className="text-[12px] font-bold text-mute tracking-[0.06em] uppercase">Kullandığın düzen</span>
          <b className="text-[16px]">{today.customized ? 'Benim düzenim' : 'Varsayılan düzen'}</b>
          <span className="text-[12.5px] text-mute">{today.items.length} kart · {today.drawer.length} kart çekmecede</span>
          <Link href="/?duzenle=1" className="h-11 rounded-full bg-acc text-acc-ink font-extrabold text-[14px] inline-flex items-center justify-center" data-testid="studio-edit">Düzenlemeye başla</Link>
        </div>
      </section>

      <section aria-label="Ekranlar" className="card px-4 py-1 flex flex-col">
        {Object.entries(SCREENS).map(([id, s]) => (
          <div key={id} className="min-h-[60px] flex items-center justify-between gap-3">
            <span className="flex flex-col"><b className="text-[15px]">{s.title}</b><span className="text-[12.5px] text-mute">{today.customized ? 'Özelleştirildi' : 'Varsayılan'}</span></span>
            <span className="flex items-center gap-2">
              {today.customized ? <ResetButton screen={id} /> : null}
              <Link href={`${s.path}?duzenle=1`} className="h-10 px-4 rounded-full bg-surface-2 border border-line-2 text-[13px] font-bold inline-flex items-center">Düzenle</Link>
            </span>
          </div>
        ))}
        <p className="text-[12px] text-mute pb-3 leading-relaxed">Fit, Su, Yemek ve Fitness ekranları da sıradaki güncellemede düzenlenebilir olacak.</p>
      </section>

      <div className="grid grid-cols-2 gap-2.5" aria-label="Yakında">
        {SOON.map(([t, d]) => (
          <div key={t} className="card p-3.5 flex flex-col gap-1 opacity-60">
            <span className="flex items-center justify-between gap-2"><b className="text-[14px]">{t}</b></span>
            <span className="text-[12px] text-mute leading-snug">{d}</span>
            <span className="self-start mt-1 text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-surface-3 text-ink-2">YAKINDA</span>
          </div>
        ))}
      </div>
    </div>
  )
}
