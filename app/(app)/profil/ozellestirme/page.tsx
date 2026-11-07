import Link from 'next/link'
import type { ReactNode } from 'react'
import { getModes } from '@/lib/modes-data'
import { focusOn, ramadanOn } from '@/lib/modes'
import { addDays, dayString } from '@/lib/time'
import { requireUser } from '@/lib/auth'
import { activeDesign, allScreenLayouts } from '@/lib/cards/design-data'
import { listDesigns, listVersions } from '@/lib/cards/designs-data'
import { suggestionsFor, usageFor } from '@/lib/cards/usage-data'
import { SCREENS, type ScreenId } from '@/lib/cards/registry'
import StudioHeader from '@/components/cards/StudioHeader'
import Suggestions from './Suggestions'

export const metadata = { title: 'Özelleştirme' }

const I = {
  layout: <><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>,
  palette: <><circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" /><path d="M12 2a10 10 0 000 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0022 9.8C22 5.5 17.5 2 12 2z" /></>,
  moon: <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />,
  chart: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 15l3-3 3 2 4-5" /></>,
  history: <><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></>,
}

/** Tasarımdaki stüdyo kutusu: simge (modül renginde) + başlık + kısa açıklama. */
function Tile({ href, mod, icon, title, sub, testId }: { href: string; mod: string; icon: ReactNode; title: string; sub: string; testId: string }) {
  return (
    <Link href={href} data-testid={testId} className="card rounded-[20px] p-3.5 min-h-[104px] flex flex-col gap-2 active:scale-[0.98] transition">
      <span data-mod={mod} className="text-acc" aria-hidden>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </span>
      <b className="text-[15px] font-extrabold leading-tight">{title}</b>
      <span className="text-[12px] text-mute leading-snug">{sub}</span>
    </Link>
  )
}

function ago(day: string, today: string) {
  if (day >= today) return 'bugün'
  if (day === addDays(today, -1)) return 'dün'
  const n = Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000)
  return `${n} gün önce`
}

/** Özelleştirme stüdyosu (Ö6: gösterilen tasarım) — kullandığın tasarım + 6 kutu + nereden başlamak istersin. */
export default async function Page() {
  const u = await requireUser()
  const [all, d, usage, modes, designs] = await Promise.all([allScreenLayouts(u.id), activeDesign(u.id), usageFor(u.id, 14), getModes(u.id), listDesigns(u.id)])
  const today = dayString()
  const act = designs.find((x) => x.active) ?? null
  const versions = act ? (await listVersions(u.id, act.id)).length : 0
  const customized = Object.values(all).some((x) => x.customized) || !!d?.modules || !!d?.style
  const fm = focusOn(modes, today)
  const suggestions = suggestionsFor((Object.keys(SCREENS) as ScreenId[]).map((s) => ({ screen: s, items: all[s].items })), usage, d?.insights?.dismissed ?? [])
  const myCards = Object.keys(d?.userCards ?? {}).length
  const changedDay = act ? act.updatedAt.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) : null
  const preview = all.today.items.slice(0, 7)
  return (
    <div className="px-4 flex flex-col gap-3.5 pb-6" data-testid="studio">
      <StudioHeader back="/profil" title="Özelleştirme" />
      <section aria-label="Mevcut tasarım" className="card rounded-[24px] p-4 flex gap-4 items-center">
        <div aria-hidden className="w-[96px] h-[172px] shrink-0 rounded-[18px] border-2 border-line-2 bg-bg p-1.5 flex flex-col gap-1 overflow-hidden">
          {preview.map((i) => i.def.locked === 'top'
            ? <div key={i.id} data-mod={i.def.module} className="h-[34px] shrink-0 rounded-lg band" />
            : <div key={i.id} data-mod={i.def.module} className={`${i.size === 'half' ? 'w-[calc(50%-2px)]' : 'w-full'} h-[26px] shrink-0 rounded-[7px] border bg-[color-mix(in_oklab,var(--color-acc)_14%,var(--color-surface))] border-[color-mix(in_oklab,var(--color-acc)_30%,var(--color-line))]`} />)}
        </div>
        <div className="flex flex-col gap-2.5 flex-1 min-w-0">
          <span className="text-[12px] font-bold text-mute tracking-[0.06em] uppercase">Kullandığın tasarım</span>
          <b className="text-[17px] font-extrabold leading-tight">{act?.name ?? (customized ? 'Benim düzenim' : 'Varsayılan düzen')}</b>
          <span className="text-[12.5px] text-mute leading-snug">{changedDay && customized ? `Son değişiklik ${ago(changedDay, today)} · ${versions} kayıtlı sürüm` : 'Henüz değiştirmedin'}</span>
          <Link href="/?duzenle=1" data-mod="today" className="min-h-11 rounded-full bg-acc text-acc-ink font-extrabold text-[14px] inline-flex items-center justify-center gap-1.5" data-testid="studio-edit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
            Düzenlemeye başla
          </Link>
        </div>
      </section>

      <Suggestions list={suggestions} />

      <div className="grid grid-cols-2 gap-2.5">
        <Tile href="/profil/ozellestirme/duzen" mod="today" icon={I.layout} title="Düzen" sub="Kartlar, boyut, alt bar" testId="studio-layout" />
        <Tile href="/profil/ozellestirme/stil" mod="water" icon={I.palette} title="Renkler ve stil" sub={d?.modules ? `${Object.keys(d.modules).length} modül rengi değişti` : 'Palet, yazı tipi, simgeler'} testId="studio-style" />
        <Tile href="/profil/ozellestirme/modlar" mod="coach" icon={I.moon} title="Modlar" sub={[fm ? `${fm.label} açık` : null, ramadanOn(modes, today) ? 'Ramazan açık' : null].filter(Boolean).join(' · ') || 'Odak, Ramazan, tek el'} testId="studio-modes" />
        <Tile href="/profil/ozellestirme/kartlarim" mod="food" icon={I.chart} title="Kendi kartlarım" sub={myCards ? `${myCards} kendi kartın` : 'Kart oluştur, takip ekle'} testId="studio-builder" />
        <Tile href="/profil/ozellestirme/tasarimlar" mod="plan" icon={I.history} title="Tasarımlarım" sub={designs.length > 1 ? `${designs.length} tasarım · sürümler` : 'Sürümler, geri al'} testId="studio-designs" />
        <Tile href="/profil/ozellestirme/sablonlar" mod="social" icon={I.book} title="Şablon kütüphanesi" sub="Topluluğun tasarımları" testId="studio-library" />
      </div>

      {!customized ? (
        <section aria-label="İlk kez" className="rounded-[20px] p-3.5 px-4 flex flex-col gap-2.5 bg-coach border border-coach-line" data-mod="coach">
          <b className="text-[14px] font-extrabold">Nereden başlamak istersin?</b>
          <div className="flex gap-2">
            <Link href="/profil/ozellestirme/sihirbaz" className="flex-1 min-h-11 rounded-[14px] bg-acc text-acc-ink font-extrabold text-[13px] inline-flex items-center justify-center" data-testid="studio-wizard">Sihirbaz · 5 soru</Link>
            <Link href="/?duzenle=1" className="flex-1 min-h-11 rounded-[14px] border border-coach-line font-bold text-[13px] inline-flex items-center justify-center">Kendim kurarım</Link>
          </div>
        </section>
      ) : null}
    </div>
  )
}
