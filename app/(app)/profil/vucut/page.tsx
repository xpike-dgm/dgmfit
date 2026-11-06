import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { getToday } from '@/lib/today'
import { db, schema } from '@/lib/db'
import { bfCategory, estimateBodyFat, leanMass, navyBodyFat } from '@/lib/body-comp'
import { fmtNum, type Sex } from '@/lib/calc'
import { TopBar } from '@/components/ui'
import BodyFatForm from './BodyFatForm'

export const metadata = { title: 'Vücut yağ oranı' }

/** Faz 8: yağ oranı — kullanıcı girer ya da ölçülerden (ABD Donanması formülü) hesaplanır; yoksa tahmin. */
export default async function Page() {
  const u = await requireUser()
  const t = await getToday(u.id)
  if (!t) redirect('/kurulum')
  const p = t.profile
  const sex = p.sex as Sex
  const [m] = await db.select().from(schema.bodyMeasurements).where(eq(schema.bodyMeasurements.userId, u.id)).orderBy(desc(schema.bodyMeasurements.day)).limit(1)
  const kg = t.weight.trend || p.weightKg
  const navy = m?.neckCm && m?.waistCm ? navyBodyFat(sex, p.heightCm, m.neckCm, m.waistCm, m.hipsCm) : null
  const est = estimateBodyFat(sex, kg, p.heightCm, t.age)
  const bf = p.bodyFatPct ?? navy ?? est
  const source = p.bodyFatPct ? (p.bodyFatSource === 'navy' ? 'ölçülerinden hesaplandı' : 'senin girdiğin değer') : navy ? 'son ölçülerinden hesaplandı' : 'tahmin (VKİ ve yaştan) — düşük güven'
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/profil" title="Vücut yağ oranı" sub="Protein ve kalori hesapları buna göre yapılır" />
      <section className="card p-4 flex flex-col gap-1" data-testid="bodyfat-now" data-bf={bf}>
        <span className="text-[13px] text-mute">Şu anki</span>
        <span className="num text-[28px] font-bold leading-tight">%{fmtNum(bf, 1)} <span className="text-[14px] text-mute font-semibold">{bfCategory(sex, bf)}</span></span>
        <span className="text-[13px] text-ink-2">Yağsız kütle <b className="num">{fmtNum(leanMass(kg, bf), 1)} kg</b> · yağ <b className="num">{fmtNum(kg - leanMass(kg, bf), 1)} kg</b></span>
        <span className="text-[12px] text-mute">{source}</span>
      </section>
      <BodyFatForm sex={sex} heightCm={p.heightCm} last={{ neck: m?.neckCm ?? null, waist: m?.waistCm ?? p.waistCm ?? null, hips: m?.hipsCm ?? null }} />
      <p className="text-[12px] text-mute px-1 leading-relaxed">Ölçüm ipucu: boyun, gırtlağın hemen altından; bel, erkekte göbek hizasından, kadında en ince yerinden; kalça en geniş yerinden. Mezura yere paralel, deri sıkıştırılmadan. Akıllı tartı ya da DEXA sonucunu biliyorsan doğrudan yazabilirsin.</p>
    </div>
  )
}
