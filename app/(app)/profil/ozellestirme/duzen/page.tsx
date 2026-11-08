import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { activeDesign, allScreenLayouts, userGoal } from '@/lib/cards/design-data'
import { GOAL_FRONT, normalizePrefs, resolveNav } from '@/lib/cards/prefs'
import { SCREENS, cardDef, type ScreenId } from '@/lib/cards/registry'
import StudioHeader, { SectionLabel } from '@/components/cards/StudioHeader'
import { Group, Lead, Row, ScreenThumb } from '@/components/cards/StudioUI'
import UsePrefsForm from '../UsePrefsForm'
import ResetButton from '../ResetButton'

export const metadata = { title: 'Düzen' }

const MOD: Record<ScreenId, string> = { today: 'today', fit: 'plan', water: 'water', food: 'food', fitness: 'fitness', mine: 'today' }

/** G1: Düzen — ekranlar küçük önizlemeli kutular (dokun → o ekranda düzenleme modu), gezinme ve kullanım ayarları gruplu satırlar. */
export default async function Page() {
  const u = await requireUser()
  const [all, d, goal] = await Promise.all([allScreenLayouts(u.id), activeDesign(u.id), userGoal(u.id)])
  const nav = resolveNav(d?.nav)
  const rulesOn = (d?.rules ?? []).filter((r) => r.on).length
  const GOAL_NAME = { lose: 'kilo verme', gain: 'kilo alma', recomp: 'koruyup kas kazanma' }
  const goalCards = goal ? Object.values(GOAL_FRONT[goal]).flat().map((id) => cardDef(id!)?.title).filter(Boolean) : []
  return (
    <div className="px-4 flex flex-col gap-5 pb-6" data-testid="layout-page">
      <StudioHeader back="/profil/ozellestirme" title="Düzen" />
      <Lead>Bir ekrana dokun: kartları basılı tutup sürükle, − ile kaldır, “Kart ekle” ile geri getir.</Lead>

      <div className="flex flex-col gap-2">
        <span className="px-1"><SectionLabel>Ekranların</SectionLabel></span>
        <div className="grid grid-cols-2 gap-2.5" aria-label="Ekranlar">
          {(Object.keys(SCREENS) as ScreenId[]).map((id) => {
            const s = SCREENS[id], l = all[id]
            return (
              <div key={id} data-studio-screen={id} className="card rounded-[22px] p-2.5 flex flex-col gap-2 relative">
                <Link href={`${s.path}?duzenle=1`} className="flex gap-2.5 items-stretch" aria-label={`${s.title} ekranını düzenle`} data-testid="screen-edit">
                  <ScreenThumb items={l.items} className="w-[58px] h-[96px] shrink-0" />
                  <span className="flex flex-col gap-1 min-w-0 py-0.5">
                    <b data-mod={MOD[id]} className="text-[15.5px] font-extrabold leading-tight">{s.title}</b>
                    <span className="text-[12px] text-mute leading-snug">{l.items.length} kart</span>
                    <span className={`self-start mt-auto text-[10.5px] font-extrabold px-2 py-0.5 rounded-full ${l.customized ? 'bg-acc text-acc-ink' : 'bg-surface-2 text-mute'}`} data-mod={MOD[id]}>{l.customized ? 'SENİN' : 'VARSAYILAN'}</span>
                  </span>
                </Link>
                <div className="flex items-center gap-1.5">
                  <Link href={`${s.path}?duzenle=1`} data-mod={MOD[id]} className="flex-1 h-9 rounded-full bg-acc text-acc-ink text-[12.5px] font-extrabold inline-flex items-center justify-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>Düzenle
                  </Link>
                  {l.customized ? <ResetButton screen={id} /> : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Group label="Gezinme ve kurallar">
        <Row href="/profil/ozellestirme/alt-bar" icon="nav" mod="water" title="Alt bar" sub={`${nav.visible.length} sekme${nav.hidden.length ? ` · ${nav.hidden.length} gizli` : ''} · sırala, gizle`} testId="studio-nav" />
        <Row href="/profil/ozellestirme/kurallar" icon="rule" mod="coach" title="Kurallarım" sub={rulesOn ? `${rulesOn} kural açık` : 'Sabah, antrenman günü, akşam düzeni…'} testId="studio-rules" />
        <Row href="/profil/ozellestirme/kullanim" icon="map" mod="plan" title="Kullanım haritam" sub="Hangi kartı ne kadar kullanıyorsun" testId="studio-usage" />
        <Row href="/profil/ozellestirme/sihirbaz" icon="wand" mod="food" title="Düzen sihirbazı" sub="5 soruda sana göre düzen" testId="layout-wizard" />
      </Group>

      <div id="tek-el" className="flex flex-col gap-2">
        <span className="px-1"><SectionLabel>Kullanım</SectionLabel></span>
        <UsePrefsForm prefs={normalizePrefs(d?.prefs ?? {})} />
      </div>
      {goal && goalCards.length ? <p className="text-[12px] text-mute leading-relaxed px-1" data-testid="goal-note">Varsayılan düzen hedefine göre ({GOAL_NAME[goal]}): {goalCards.join(', ')} öne alındı. Özelleştirdiğin ekranlarda senin düzenin geçerli.</p> : null}
    </div>
  )
}
