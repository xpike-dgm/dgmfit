import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getToday } from '@/lib/today'
import { ACTIVITY, GOALS, bmi, bmiCategory, fmtNum, type Activity, type GoalType } from '@/lib/calc'
import { shortDate, addDays } from '@/lib/time'
import { logoutAction } from '@/app/(auth)/actions'
import { btn, TopBar } from '@/components/ui'
import { Logout } from '@/components/icons'
import Link from 'next/link'
import { isAdmin } from '@/lib/admin'

export const metadata = { title: 'Profil' }

export default async function Page() {
  const u = await requireUser()
  const t = await getToday(u.id)
  if (!t) redirect('/kurulum')
  const p = t.profile
  const g = t.goal
  const b = bmi(t.weight.latest, p.heightCm)
  const rows: [string, string][] = [
    ['Cinsiyet', p.sex === 'male' ? 'Erkek' : 'Kadın'],
    ['Yaş', `${t.age}`],
    ['Boy', `${fmtNum(p.heightCm)} cm`],
    ['Güncel kilo', `${fmtNum(t.weight.latest, 1)} kg`],
    ['VKİ', `${fmtNum(b, 1)} · ${bmiCategory(b)}`],
    ['Aktivite', ACTIVITY[p.activity as Activity]?.label ?? p.activity],
    ['Hedef', GOALS[p.goal as GoalType]?.label ?? p.goal],
  ]
  if (g && g.type !== 'recomp') rows.push(['Hedef kilo', `${fmtNum(g.targetWeightKg, 1)} kg · ${shortDate(addDays(g.startDate, t.totalDays - 1))}`])

  return (
    <div className="px-4 pt-4 flex flex-col gap-3">
      <TopBar back="/" title="Profil" />
      <section className="card p-5 flex items-center gap-4 mt-2">
        <span className="w-14 h-14 rounded-full bg-lime text-lime-ink num font-bold text-xl flex items-center justify-center uppercase">{u.username.slice(0, 2)}</span>
        <div className="flex flex-col min-w-0">
          <span className="text-lg font-extrabold truncate">{u.username}</span>
          <span className="text-sm text-mute truncate">{u.email}</span>
        </div>
      </section>

      {g ? (
        <section className="card p-5 flex flex-col gap-3">
          <h2 className="font-extrabold">Günlük hedeflerin</h2>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Kalori" value={`${fmtNum(g.dailyKcal)} kcal`} />
            <Stat label="Su" value={`${fmtNum(g.waterMl)} ml`} />
            <Stat label="Protein" value={`${g.proteinG} g`} />
            <Stat label="Karbonhidrat" value={`${g.carbG} g`} />
            <Stat label="Yağ" value={`${g.fatG} g`} />
            <Stat label="Harcama (TDEE)" value={`${fmtNum(g.tdee)} kcal`} />
          </div>
        </section>
      ) : null}

      <section className="card px-5 py-2">
        <dl className="divide-y divide-surface-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-3.5 text-[15px]">
              <dt className="text-mute">{k}</dt><dd className="font-semibold text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Link href="/koc" className={btn.secondary + ' w-full h-12'}>AI koç ve ayarları</Link>
      <Link href="/rapor" className={btn.secondary + ' w-full h-12'}>Haftalık raporlar</Link>
      {isAdmin(u.username) ? <Link href="/yonetim/ai" className={btn.secondary + ' w-full h-12'}>AI ayarları (yönetici)</Link> : null}
      <form action={logoutAction}>
        <button type="submit" className={btn.secondary + ' w-full h-12'}><Logout size={18} /> Çıkış yap</button>
      </form>
      <p className="text-center text-xs text-faint py-2">DgFit 0.1 · Faz 0</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-2 rounded-2xl px-3.5 py-3 flex flex-col gap-0.5">
      <span className="text-xs text-mute">{label}</span>
      <span className="num font-semibold">{value}</span>
    </div>
  )
}
