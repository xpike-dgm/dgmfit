import { cookies } from 'next/headers'
import { requireUser } from '@/lib/auth'
import { THEME_COOKIE, parseTheme } from '@/lib/theme'
import { TopBar } from '@/components/ui'
import ThemePicker from './ThemePicker'
import AdvancedToggle from './AdvancedToggle'
import { isAdvanced } from '@/lib/ui-mode'

export const metadata = { title: 'Görünüm' }
const MODS: [string, string][] = [['today', 'Bugün'], ['plan', 'Fit'], ['water', 'Su'], ['food', 'Yemek'], ['fitness', 'Fitness'], ['social', 'Sosyal'], ['coach', 'Koç']]

export default async function Page() {
  const u = await requireUser()
  const current = parseTheme((await cookies()).get(THEME_COOKIE)?.value)
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/profil" title="Görünüm" sub="Tema bu cihazda saklanır" />
      <ThemePicker current={current} />
      <AdvancedToggle on={await isAdvanced(u.id)} />
      <section className="card p-4 flex flex-col gap-3" aria-label="Modül renkleri">
        <h2 className="text-[15px] font-extrabold">Modül renkleri</h2>
        <p className="text-[13px] text-mute leading-relaxed">Her bölümün kendi rengi var; düğmeler ve seçili öğeler bulunduğun bölümün renginde görünür.</p>
        <div className="grid grid-cols-4 gap-2">
          {MODS.map(([k, l]) => (
            <span key={k} data-mod={k} className="flex flex-col items-center gap-1.5 text-[12px] font-semibold">
              <span className="w-10 h-10 rounded-2xl band" aria-hidden /><span>{l}</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
