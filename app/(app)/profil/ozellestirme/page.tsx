import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { activeDesign, allScreenLayouts, userGoal } from '@/lib/cards/design-data'
import { GOAL_FRONT, normalizePrefs, resolveNav } from '@/lib/cards/prefs'
import UsePrefsForm from './UsePrefsForm'
import Suggestions from './Suggestions'
import { suggestionsFor, usageFor } from '@/lib/cards/usage-data'
import { SCREENS, cardDef, type ScreenId } from '@/lib/cards/registry'
import { TopBar } from '@/components/ui'
import ResetButton from './ResetButton'

export const metadata = { title: 'Özelleştirme' }

const SOON: [string, string][] = [
  ['Modlar', 'Odak, Ramazan, tatil'],
  ['Kendi kartlarım', 'Kart oluştur, takip ekle'],
]

/** Özelleştirme stüdyosu (Ö1): mevcut düzenin önizlemesi + ekran düzenleme. Diğer bölümler sonraki aşamalarda. */
export default async function Page() {
  const u = await requireUser()
  const [all, d, goal, usage] = await Promise.all([allScreenLayouts(u.id), activeDesign(u.id), userGoal(u.id), usageFor(u.id, 14)])
  const suggestions = suggestionsFor((Object.keys(SCREENS) as ScreenId[]).map((s) => ({ screen: s, items: all[s].items })), usage, d?.insights?.dismissed ?? [])
  const today = all.today
  const nav = resolveNav(d?.nav)
  const rulesOn = (d?.rules ?? []).filter((r) => r.on).length
  const GOAL_NAME = { lose: 'kilo verme', gain: 'kilo alma', recomp: 'koruyup kas kazanma' }
  const goalCards = goal ? Object.values(GOAL_FRONT[goal]).flat().map((id) => cardDef(id!)?.title).filter(Boolean) : []
  const row = 'min-h-[60px] flex items-center justify-between gap-3'
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
          <b className="text-[16px]">{Object.values(all).some((x) => x.customized) ? 'Benim düzenim' : 'Varsayılan düzen'}</b>
          <span className="text-[12.5px] text-mute">{today.items.length} kart · {today.drawer.length} kart çekmecede</span>
          <Link href="/?duzenle=1" className="h-11 rounded-full bg-acc text-acc-ink font-extrabold text-[14px] inline-flex items-center justify-center" data-testid="studio-edit">Düzenlemeye başla</Link>
        </div>
      </section>

      <Suggestions list={suggestions} />

      <Link href="/profil/ozellestirme/sihirbaz" className="card p-4 flex items-center gap-3 border border-acc/30" data-testid="studio-wizard">
        <span aria-hidden className="w-11 h-11 rounded-2xl bg-acc text-acc-ink flex items-center justify-center shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4M12.2 6.2l-1.4-1.4M3 21l9-9" /></svg>
        </span>
        <span className="flex flex-col flex-1"><b className="text-[15px]">Düzen sihirbazı</b><span className="text-[12.5px] text-mute">5 soruda sana göre düzen, alt bar ve kurallar</span></span>
        <span className="text-mute">›</span>
      </Link>

      <section aria-label="Ekranlar" className="card px-4 py-1 flex flex-col">
        {Object.entries(SCREENS).map(([id, s]) => (
          <div key={id} data-studio-screen={id} className="min-h-[60px] flex items-center justify-between gap-3">
            <span className="flex flex-col"><b className="text-[15px]">{s.title}</b><span className="text-[12.5px] text-mute">{all[id as ScreenId].customized ? 'Özelleştirildi' : 'Varsayılan'} · {all[id as ScreenId].items.length} kart</span></span>
            <span className="flex items-center gap-2">
              {all[id as ScreenId].customized ? <ResetButton screen={id} /> : null}
              <Link href={`${s.path}?duzenle=1`} className="h-10 px-4 rounded-full bg-surface-2 border border-line-2 text-[13px] font-bold inline-flex items-center">Düzenle</Link>
            </span>
          </div>
        ))}
        <p className="text-[12px] text-mute pb-3 leading-relaxed">Kartı basılı tutup sürükleyerek taşı, − ile kaldır, “+ Kart ekle” ile geri getir. Ekranda bir kartı sola kaydırırsan “Bugünlük gizle” ve “Üste sabitle” çıkar.</p>
      </section>

      <section aria-label="Gezinme ve kurallar" className="card px-4 py-1 flex flex-col">
        <Link href="/profil/ozellestirme/alt-bar" className={row} data-testid="studio-nav">
          <span className="flex flex-col"><b className="text-[15px]">Alt bar</b><span className="text-[12.5px] text-mute">{nav.visible.length} sekme{nav.hidden.length ? ` · ${nav.hidden.length} gizli` : ''}</span></span><span className="text-mute">›</span>
        </Link>
        <Link href="/profil/ozellestirme/renkler" className={`${row} border-t border-line`} data-testid="studio-colors">
          <span className="flex flex-col"><b className="text-[15px]">Renkler</b><span className="text-[12.5px] text-mute">{d?.modules ? `${Object.keys(d.modules).length} modül rengi değişti` : 'Modül renkleri, paletler, fotoğraftan palet'}</span></span><span className="text-mute">›</span>
        </Link>
        <Link href="/profil/ozellestirme/stil" className={`${row} border-t border-line`} data-testid="studio-style">
          <span className="flex flex-col"><b className="text-[15px]">Stil</b><span className="text-[12.5px] text-mute">Köşeler, yazı tipi, bant, birimler, erişilebilirlik</span></span><span className="text-mute">›</span>
        </Link>
        <Link href="/profil/ozellestirme/tasarimlar" className={`${row} border-t border-line`} data-testid="studio-designs">
          <span className="flex flex-col"><b className="text-[15px]">Tasarımlarım</b><span className="text-[12.5px] text-mute">Birden çok tasarım, sürümler, geri yükleme</span></span><span className="text-mute">›</span>
        </Link>
        <Link href="/profil/ozellestirme/sablonlar" className={`${row} border-t border-line`} data-testid="studio-library">
          <span className="flex flex-col"><b className="text-[15px]">Şablon kütüphanesi</b><span className="text-[12.5px] text-mute">Topluluğun tasarımlarını önizle ve kullan</span></span><span className="text-mute">›</span>
        </Link>
        <Link href="/profil/ozellestirme/yarisma" className={`${row} border-t border-line`} data-testid="studio-contest">
          <span className="flex flex-col"><b className="text-[15px]">Tasarım yarışması</b><span className="text-[12.5px] text-mute">Haftalık tema, oy ver, rozet kazan</span></span><span className="text-mute">›</span>
        </Link>
        <Link href="/profil/ozellestirme/kullanim" className={`${row} border-t border-line`} data-testid="studio-usage">
          <span className="flex flex-col"><b className="text-[15px]">Kullanım haritam</b><span className="text-[12.5px] text-mute">Hangi kartı ne kadar kullanıyorsun, düzen deneyin</span></span><span className="text-mute">›</span>
        </Link>
        <Link href="/profil/ozellestirme/kurallar" className={`${row} border-t border-line`} data-testid="studio-rules">
          <span className="flex flex-col"><b className="text-[15px]">Kurallar</b><span className="text-[12.5px] text-mute">{rulesOn ? `${rulesOn} kural açık` : 'Sabah, antrenman günü, akşam düzeni…'}</span></span><span className="text-mute">›</span>
        </Link>
        {goal && goalCards.length ? <p className="text-[12px] text-mute pb-3 pt-1 border-t border-line leading-relaxed" data-testid="goal-note">Varsayılan düzen hedefine göre ({GOAL_NAME[goal]}): {goalCards.join(', ')} öne alındı. Özelleştirdiğin ekranlarda senin düzenin geçerli.</p> : null}
      </section>

      <UsePrefsForm prefs={normalizePrefs(d?.prefs ?? {})} />

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
