import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { listSupplements } from '@/lib/supplement-data'
import { dayString } from '@/lib/time'
import { fmtNum } from '@/lib/calc'
import { TopBar, btn } from '@/components/ui'
import { Next, Plus } from '@/components/icons'

export const metadata: Metadata = { title: 'Takviyelerim · DgFit' }

export default async function Page() {
  const u = await requireUser()
  const { items } = await listSupplements(u.id, dayString())
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="supp-list">
      <TopBar back="/yemek" title="Takviyelerim" sub="Bir kez tanımla, Yemek ekranında porsiyonu işaretle" />
      <Link href="/yemek/takviyeler/yeni" className={btn.primary}><Plus size={18} /> Yeni takviye</Link>
      {items.length ? (
        <nav className="card px-4 py-1 flex flex-col" aria-label="Takviyeler">
          {items.map((s, i) => (
            <Link key={s.id} href={`/yemek/takviyeler/${s.id}`} className={`flex items-center justify-between gap-3 min-h-[60px] py-2.5 ${i ? 'border-t border-line' : ''}`} data-testid="supp-item">
              <span className="flex flex-col min-w-0">
                <span className="text-[15px] font-bold truncate">{s.name}{s.brand ? <span className="text-mute font-semibold"> · {s.brand}</span> : null}</span>
                <span className="text-[12.5px] text-mute truncate">{s.label}{s.servingG && s.unit !== 'g' && s.unit !== 'ml' ? ` (${fmtNum(s.servingG)} g)` : ''} · {fmtNum(s.serving.kcal)} kcal · P {fmtNum(s.serving.protein, 1)} · K {fmtNum(s.serving.carb, 1)} · Y {fmtNum(s.serving.fat, 1)}{s.daily ? ` · günde ${s.daily}` : ''}</span>
              </span>
              <Next size={18} className="text-mute shrink-0" />
            </Link>
          ))}
        </nav>
      ) : (
        <section className="card p-5 flex flex-col gap-2 text-[14px] text-ink-2 leading-relaxed">
          <b className="text-ink text-[15px]">Nasıl çalışır?</b>
          <span>1. Takviyeni ekle: adı, 1 porsiyonun birimi (ölçek, kapsül…) ve etiketteki porsiyon değerleri.</span>
          <span>2. Yemek ekranındaki Takviyeler kartında her aldığında <b>+</b>’ya bas.</span>
          <span>3. Kalori ve protein günlüğüne, kafein ve vitaminler günlük özete eklenir.</span>
        </section>
      )}
    </div>
  )
}
