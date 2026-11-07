import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { activeDesign, allScreenLayouts, userGoal } from '@/lib/cards/design-data'
import { GOAL_FRONT, normalizePrefs, resolveNav } from '@/lib/cards/prefs'
import { SCREENS, cardDef, type ScreenId } from '@/lib/cards/registry'
import StudioHeader, { SectionLabel } from '@/components/cards/StudioHeader'
import UsePrefsForm from '../UsePrefsForm'
import ResetButton from '../ResetButton'

export const metadata = { title: 'Düzen' }

/** Ö6: Düzen (stüdyodaki "Düzen" kutusu) — ekran ekran kartlar, alt bar, kurallar, kullanım haritası, tek el. */
export default async function Page() {
  const u = await requireUser()
  const [all, d, goal] = await Promise.all([allScreenLayouts(u.id), activeDesign(u.id), userGoal(u.id)])
  const nav = resolveNav(d?.nav)
  const rulesOn = (d?.rules ?? []).filter((r) => r.on).length
  const GOAL_NAME = { lose: 'kilo verme', gain: 'kilo alma', recomp: 'koruyup kas kazanma' }
  const goalCards = goal ? Object.values(GOAL_FRONT[goal]).flat().map((id) => cardDef(id!)?.title).filter(Boolean) : []
  const row = 'min-h-[56px] flex items-center justify-between gap-3'
  return (
    <div className="px-4 flex flex-col gap-3.5 pb-6" data-testid="layout-page">
      <StudioHeader back="/profil/ozellestirme" title="Düzen" />
      <SectionLabel>Ekranlar</SectionLabel>
      <section aria-label="Ekranlar" className="card px-3.5 py-1 flex flex-col">
        {Object.entries(SCREENS).map(([id, s], i) => (
          <div key={id} data-studio-screen={id} className={`${row} ${i ? 'border-t border-line' : ''}`}>
            <span className="flex flex-col"><b className="text-[14px]">{s.title}</b><span className="text-[12px] text-mute">{all[id as ScreenId].customized ? 'Özelleştirildi' : 'Varsayılan'} · {all[id as ScreenId].items.length} kart</span></span>
            <span className="flex items-center gap-2">
              {all[id as ScreenId].customized ? <ResetButton screen={id} /> : null}
              <Link href={`${s.path}?duzenle=1`} className="h-10 px-4 rounded-full bg-surface-2 border border-line-2 text-[13px] font-bold inline-flex items-center">Düzenle</Link>
            </span>
          </div>
        ))}
      </section>
      <p className="text-[12px] text-mute leading-relaxed -mt-1.5">Kartı basılı tutup sürükleyerek taşı, − ile kaldır, “Kart ekle” ile geri getir. Ekranda bir kartı sola kaydırırsan “Bugünlük gizle” ve “Üste sabitle” çıkar.</p>

      <section aria-label="Gezinme" className="card px-3.5 py-1 flex flex-col">
        <Link href="/profil/ozellestirme/alt-bar" className={row} data-testid="studio-nav">
          <span className="flex flex-col"><b className="text-[14px]">Alt bar</b><span className="text-[12px] text-mute">{nav.visible.length} sekme{nav.hidden.length ? ` · ${nav.hidden.length} gizli` : ''}</span></span><span className="text-mute">›</span>
        </Link>
        <Link href="/profil/ozellestirme/kurallar" className={`${row} border-t border-line`} data-testid="studio-rules">
          <span className="flex flex-col"><b className="text-[14px]">Kurallarım</b><span className="text-[12px] text-mute">{rulesOn ? `${rulesOn} kural açık` : 'Sabah, antrenman günü, akşam düzeni…'}</span></span><span className="text-mute">›</span>
        </Link>
        <Link href="/profil/ozellestirme/kullanim" className={`${row} border-t border-line`} data-testid="studio-usage">
          <span className="flex flex-col"><b className="text-[14px]">Kullanım haritam</b><span className="text-[12px] text-mute">Hangi kartı ne kadar kullanıyorsun, düzen deneyin</span></span><span className="text-mute">›</span>
        </Link>
        <Link href="/profil/ozellestirme/sihirbaz" className={`${row} border-t border-line`} data-testid="layout-wizard">
          <span className="flex flex-col"><b className="text-[14px]">Düzen sihirbazı</b><span className="text-[12px] text-mute">5 soruda sana göre düzen, alt bar ve kurallar</span></span><span className="text-mute">›</span>
        </Link>
      </section>
      {goal && goalCards.length ? <p className="text-[12px] text-mute leading-relaxed" data-testid="goal-note">Varsayılan düzen hedefine göre ({GOAL_NAME[goal]}): {goalCards.join(', ')} öne alındı. Özelleştirdiğin ekranlarda senin düzenin geçerli.</p> : null}

      <div id="tek-el"><UsePrefsForm prefs={normalizePrefs(d?.prefs ?? {})} /></div>
    </div>
  )
}
