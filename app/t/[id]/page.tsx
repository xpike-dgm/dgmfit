import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { publicTemplate } from '@/lib/cards/community-data'
import { SCREENS, type ScreenId } from '@/lib/cards/registry'
import MiniPreview from '@/components/cards/MiniPreview'

export const metadata: Metadata = { title: 'DgFit tasarım şablonu', robots: { index: false } }

/** Ö3c: girişsiz önizleme (link + QR ile paylaşılır). Yalnız herkese açık şablon; kişisel veri içermez. */
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const t = await publicTemplate((await props.params).id)
  if (!t) notFound()
  const screens = (Object.keys(SCREENS) as ScreenId[]).filter((s) => s === 'today' || t.data.screens?.[s])
  return (
    <main className="max-w-md mx-auto min-h-dvh px-4 py-6 flex flex-col gap-4" data-testid="public-template">
      <header className="flex flex-col gap-1">
        <span className="text-[12px] font-bold text-mute tracking-[0.08em] uppercase">DgFit tasarım şablonu</span>
        <h1 className="text-[26px] font-extrabold leading-tight">{t.name}</h1>
        <p className="text-[13px] text-mute">@{t.owner} · ♥ {t.likes} · {t.uses} kullanım</p>
      </header>
      <section aria-label="Önizleme" className="card p-3 flex gap-3 overflow-x-auto">
        {screens.map((s) => <figure key={s} className="flex flex-col items-center gap-1 shrink-0"><MiniPreview design={t.data} screen={s} width={100} label={`${SCREENS[s].title} önizlemesi`} /><figcaption className="text-[11.5px] font-bold text-mute">{SCREENS[s].title}</figcaption></figure>)}
      </section>
      {t.description ? <p className="text-[15px] leading-relaxed">{t.description}</p> : null}
      <Link href={`/profil/ozellestirme/sablonlar/${t.id}`} className="h-14 rounded-full bg-acc text-acc-ink font-extrabold text-[16px] flex items-center justify-center" data-testid="public-open">DgFit'te aç ve kullan</Link>
      <p className="text-[12px] text-mute text-center">Şablonlar kişisel veri içermez. Kullanmak için DgFit hesabıyla giriş yapılır.</p>
    </main>
  )
}
