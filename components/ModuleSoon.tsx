import type { ReactNode } from 'react'
import { Check } from './icons'

export default function ModuleSoon({ title, icon, color, lead, phase, features }: {
  title: string; icon: ReactNode; color: string; lead: string; phase: string; features: string[]
}) {
  return (
    <div className="px-4 pt-6 flex flex-col gap-3">
      <header className="px-1 flex items-center gap-3">
        <span className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center" style={{ color }}>{icon}</span>
        <h1 className="text-[26px] font-extrabold tracking-tight">{title}</h1>
      </header>
      <section className="card p-5 flex flex-col gap-3">
        <span className="self-start h-7 px-3 rounded-full bg-coach border border-coach-line text-lime text-xs font-bold tracking-wide uppercase flex items-center">{phase}</span>
        <p className="text-[15px] leading-relaxed text-ink-2">{lead}</p>
      </section>
      <section className="card p-5">
        <h2 className="font-extrabold mb-3">Gelecek özellikler</h2>
        <ul className="flex flex-col gap-3">
          {features.map((f) => (
            <li key={f} className="flex gap-3 text-[15px] text-ink-2 leading-snug">
              <span className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center shrink-0 mt-px" style={{ color }}><Check size={13} /></span>{f}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
