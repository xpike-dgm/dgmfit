import Link from 'next/link'
import type { ReactNode } from 'react'
import { Next } from '@/components/icons'
import { USER_STATUS } from '@/lib/access'

/** Panodaki tıklanabilir kart: başlık, büyük sayı, kısa önizleme; dokununca ilgili sayfayı açar. */
export function AdminCard({ href, icon, title, value, unit, hint, alert, children, testId }: {
  href: string; icon: ReactNode; title: string; value?: ReactNode; unit?: string; hint?: ReactNode; alert?: boolean; children?: ReactNode; testId?: string
}) {
  return (
    <Link href={href} data-testid={testId} className={`card p-4 flex flex-col gap-3 min-w-0 active:scale-[0.99] transition ${alert ? 'ring-2 ring-acc' : ''}`}>
      <div className="flex items-center gap-3">
        <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${alert ? 'bg-acc text-acc-ink' : 'bg-acc/15 text-acc'}`}>{icon}</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-extrabold leading-tight">{title}</h2>
          {hint ? <p className="text-[12.5px] text-mute leading-snug truncate">{hint}</p> : null}
        </div>
        {value !== undefined ? <span className="text-right leading-none"><b className="num text-[24px] font-bold">{value}</b>{unit ? <span className="block text-[11px] text-mute mt-1">{unit}</span> : null}</span> : null}
        <Next size={18} className="text-mute shrink-0" />
      </div>
      {children ? <div className="border-t border-line pt-2.5 flex flex-col gap-1.5">{children}</div> : null}
    </Link>
  )
}

export function PreviewRow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 text-[13px] min-w-0"><span className="truncate min-w-0">{left}</span>{right ? <span className="text-mute shrink-0 num text-[12px]">{right}</span> : null}</div>
}

const TONE: Record<string, string> = { warn: 'bg-orange/15 text-orange', good: 'bg-good/15 text-good', danger: 'bg-danger/15 text-danger' }
export function StatusPill({ status }: { status: string }) {
  const s = USER_STATUS[status as keyof typeof USER_STATUS]
  return <span className={`text-[11.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${TONE[s?.tone ?? 'warn']}`} data-testid="status-pill">{s?.label ?? status}</span>
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return <span className="rounded-full bg-surface-3 text-ink-2 num font-bold uppercase flex items-center justify-center shrink-0" style={{ width: size, height: size, fontSize: size * 0.36 }}>{name.slice(0, 2)}</span>
}

/** Filtre çipleri (bağlantı): seçili olan dolu. */
export function Chips({ items }: { items: { href: string; label: string; n?: number; on: boolean }[] }) {
  return (
    <nav className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar" aria-label="Filtre">
      {items.map((c) => (
        <Link key={c.href} href={c.href} aria-current={c.on ? 'page' : undefined} replace
          className={`h-9 px-3.5 rounded-full text-[13px] font-bold border whitespace-nowrap inline-flex items-center gap-1.5 shrink-0 ${c.on ? 'bg-acc text-acc-ink border-acc' : 'border-line-2 text-ink-2 bg-surface'}`}>
          {c.label}{c.n !== undefined ? <span className={`num text-[11.5px] ${c.on ? 'opacity-80' : 'text-mute'}`}>{c.n}</span> : null}
        </Link>
      ))}
    </nav>
  )
}

export const ago = (d: Date | null | undefined): string => {
  if (!d) return '—'
  const m = Math.round((Date.now() - d.getTime()) / 60000)
  if (m < 2) return 'şimdi'
  if (m < 60) return `${m} dk önce`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} sa önce`
  const g = Math.round(h / 24)
  if (g < 30) return `${g} gün önce`
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: '2-digit' }).format(d)
}
