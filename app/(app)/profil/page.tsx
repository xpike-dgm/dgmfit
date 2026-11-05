import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getToday } from '@/lib/today'
import { GOALS, fmtNum, type GoalType } from '@/lib/calc'
import { THEMES, THEME_COOKIE, parseTheme } from '@/lib/theme'
import { logoutAction } from '@/app/(auth)/actions'
import { btn, Menu, TopBar } from '@/components/ui'
import { Logout } from '@/components/icons'
import { isAdmin } from '@/lib/admin'

export const metadata = { title: 'Profil' }

export default async function Page() {
  const u = await requireUser()
  const t = await getToday(u.id)
  if (!t) redirect('/kurulum')
  const g = t.goal
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value)
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/" title="Profil" sub="Hesap ve ayarlar" />
      <section className="card p-4 flex items-center gap-4">
        <span className="w-12 h-12 rounded-full bg-acc text-acc-ink num font-bold text-lg flex items-center justify-center uppercase">{u.username.slice(0, 2)}</span>
        <div className="flex flex-col min-w-0">
          <span className="text-[17px] font-extrabold truncate">{u.username}</span>
          <span className="text-[13px] text-mute truncate">{g ? `${GOALS[g.type as GoalType]?.label ?? g.type} · ${fmtNum(t.weight.trend, 1)}${g.type !== 'recomp' ? ` → ${fmtNum(g.targetWeightKg, 1)}` : ''} kg` : u.email}</span>
        </div>
      </section>
      <Menu title="Ayarlar" items={[
        { href: '/profil/hesap', label: 'Hesap ve kişisel bilgiler' },
        { href: '/profil/hedef', label: 'Hedef ve plan', value: g ? `${fmtNum(g.dailyKcal)} kcal` : undefined },
        { href: '/profil/gorunum', label: 'Görünüm', value: THEMES.find((x) => x.id === theme)?.label },
        { href: '/profil/bildirimler', label: 'Bildirimler' },
        { href: '/sosyal/ayarlar', label: 'Gizlilik ve sosyal profil' },
        { href: '/koc?ayarlar=1', label: 'AI koç' },
      ]} />
      <Menu title="Diğer" items={[
        { href: '/rapor', label: 'Haftalık raporlar' },
        { href: '/yasal/kosullar', label: 'Kullanım koşulları' },
        { href: '/yasal/kvkk', label: 'KVKK aydınlatma metni' },
        ...(isAdmin(u.username) ? [{ href: '/yonetim/ai', label: 'AI ayarları (yönetici)' }, { href: '/yonetim/moderasyon', label: 'Moderasyon (yönetici)' }] : []),
      ]} />
      <form action={logoutAction}>
        <button type="submit" className={btn.secondary + ' w-full h-12'}><Logout size={18} /> Çıkış yap</button>
      </form>
      <p className="text-center text-xs text-faint py-2">DgFit</p>
    </div>
  )
}
