import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getToday } from '@/lib/today'
import { ACTIVITY, bmi, bmiCategory, fmtNum, type Activity, type GoalType, type Sex } from '@/lib/calc'
import PlanForm from '../PlanForm'
import { TopBar } from '@/components/ui'

export const metadata = { title: 'Hesap ve kişisel bilgiler' }

export default async function Page() {
  const u = await requireUser()
  const t = await getToday(u.id)
  if (!t) redirect('/kurulum')
  const p = t.profile
  const b = bmi(t.weight.latest, p.heightCm)
  const rows: [string, string][] = [
    ['Kullanıcı adı', u.username],
    ['E-posta', u.email],
    ['Cinsiyet', p.sex === 'male' ? 'Erkek' : 'Kadın'],
    ['Yaş', `${t.age}`],
    ['Boy', `${fmtNum(p.heightCm)} cm`],
    ['Güncel kilo', `${fmtNum(t.weight.latest, 1)} kg`],
    ['VKİ', `${fmtNum(b, 1)} · ${bmiCategory(b)}`],
    ['Aktivite', ACTIVITY[p.activity as Activity]?.label ?? p.activity],
  ]
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/profil" title="Hesap ve kişisel bilgiler" />
      <section className="card px-4 py-1">
        <dl className="divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-3.5 text-[15px]"><dt className="text-mute">{k}</dt><dd className="font-semibold text-right break-all">{v}</dd></div>
          ))}
        </dl>
      </section>
      <h2 className="text-[13px] font-bold tracking-[0.06em] uppercase text-mute px-1 pt-1">Düzenle</h2>
      <PlanForm mode="body" base={{ sex: t.profile.sex as Sex, age: t.age, nowKg: Math.round(t.weight.trend * 10) / 10, heightCm: t.profile.heightCm, activity: t.profile.activity as Activity, goal: (t.goal?.type ?? t.profile.goal) as GoalType, targetWeightKg: t.goal?.targetWeightKg ?? t.profile.targetWeightKg, daysLeft: Math.max(7, t.totalDays - t.dayIndex + 1) }} />
      <p className="text-[13px] text-mute px-1 leading-relaxed">Kilonu + düğmesinden “Kilo gir” ile güncellersin; plan trend kilona göre kendini ayarlar. Boy ya da günlük hareket değişince kalori hedefin bugünden yeniden hesaplanır.</p>
    </div>
  )
}
