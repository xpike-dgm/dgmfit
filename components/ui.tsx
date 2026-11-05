import Link from 'next/link'
import type { ReactNode } from 'react'
import { Next } from './icons'
import BackButton from './BackButton'

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 h-14 px-6 rounded-full bg-acc text-acc-ink font-extrabold text-[17px] active:scale-[0.98] transition disabled:opacity-40 disabled:active:scale-100',
  secondary:
    'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full border border-line-2 text-ink font-bold text-[15px] active:scale-[0.98] transition',
  ghost: 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full text-ink-2 font-bold text-[15px]',
  icon: 'inline-flex items-center justify-center w-11 h-11 rounded-full border border-line bg-surface text-ink shrink-0',
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`text-[13px] font-bold tracking-[0.08em] uppercase text-mute ${className}`}>{children}</span>
}

/** Alt sayfa başlığı: modül renginde, geri düğmeli. Üst öğesi `px-4` olmalı (kenardan kenara taşar). */
export function TopBar({ title, sub, back, right }: { title?: ReactNode; sub?: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <header className="hdr -mx-4 px-3 pb-3 safe-top">
      <div className="flex items-center gap-2.5 min-h-11 pt-1">
        {back ? (
          <BackButton fallback={back} className={hdrIcon} />
        ) : null}
        <div className="flex-1 min-w-0">
          {title ? <h1 className="text-[18px] font-extrabold leading-tight truncate">{title}</h1> : null}
          {sub ? <p className="text-[12.5px] font-semibold opacity-85 leading-snug truncate">{sub}</p> : null}
        </div>
        {right ?? null}
      </div>
    </header>
  )
}

/** Renkli başlık/bant üzerindeki düğmeler (yazı beyaz). */
export const hdrBtn = 'h-9 px-3.5 rounded-full bg-white/20 text-white text-[13px] font-bold inline-flex items-center gap-1.5 shrink-0 active:scale-[0.97] transition'
export const hdrIcon = 'inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-white shrink-0'

/** Sekme ana sayfasının renkli özet bandı: başlık, alt başlık, halka ve üç değer. Sonraki kart bandın üstüne biner. */
export function Band({ title, sub, right, ring, visual, pills, children }: {
  title: ReactNode; sub?: ReactNode; right?: ReactNode
  /** Halka yerine gösterilecek görsel (ör. su şişesi); null ise halka çizilir */
  visual?: ReactNode
  ring?: { value: number; big: ReactNode; small: ReactNode; label: string }
  pills?: [ReactNode, ReactNode][]; children?: ReactNode
}) {
  return (
    <section className="band -mx-4 px-4 safe-top pb-12 -mb-9">
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.01em]">{title}</h1>
          {sub ? <p className="text-[13px] font-semibold opacity-90 mt-0.5">{sub}</p> : null}
        </div>
        {right}
      </div>
      {ring || pills ? (
        <div className="grid grid-cols-[92px_1fr] gap-3 items-center mt-4">
          {visual ? (
            <div className="flex flex-col items-center gap-1">{visual}{ring ? <b className="num text-[15px] font-bold leading-none">{ring.big}</b> : null}</div>
          ) : ring ? (
            <Ring size={92} stroke={9} value={ring.value} color="#fff" track="rgba(255,255,255,0.28)" label={ring.label}>
              <span className="flex flex-col items-center leading-none text-center">
                <b className="num text-[19px] font-bold">{ring.big}</b>
                <span className="text-[10px] font-semibold opacity-85 mt-1">{ring.small}</span>
              </span>
            </Ring>
          ) : <span />}
          {pills ? (
            <div className="flex flex-col gap-1.5">
              {pills.map(([k, v], i) => (
                <div key={i} className="flex justify-between gap-2 rounded-xl bg-white/[0.18] px-3 py-[7px] text-[12.5px] font-semibold">
                  <span className="opacity-95">{k}</span><b className="num font-bold whitespace-nowrap">{v}</b>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Ring({
  size = 124, stroke = 12, value, color = 'var(--color-acc)', track = 'var(--color-surface-3)', children, label,
}: { size?: number; stroke?: number; value: number; color?: string; track?: string; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0.001 ? <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(c * v).toFixed(1)} ${c.toFixed(1)}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 600ms cubic-bezier(.2,.8,.2,1)' }}
        /> : null}
      </svg>
      {children ? <div className="absolute inset-0 flex items-center justify-center">{children}</div> : null}
    </div>
  )
}

export function Bar({ value, color = 'var(--color-acc)', height = 8 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="w-full rounded-full bg-surface-3 overflow-hidden" style={{ height }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  )
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="text-[13px] font-semibold text-danger mt-1.5" role="alert">{children}</p>
}

/** Ayar menüsü: her satır kendi sayfasını açar. */
export function Menu({ items, title }: { title?: string; items: { href: string; label: ReactNode; value?: ReactNode; testId?: string }[] }) {
  return (
    <nav className="card px-4 py-1 flex flex-col" aria-label={title}>
      {title ? <h2 className="text-[13px] font-bold tracking-[0.06em] uppercase text-mute pt-3 pb-1">{title}</h2> : null}
      {items.map((it, i) => (
        <Link key={it.href} href={it.href} data-testid={it.testId} className={`flex items-center justify-between gap-3 min-h-[54px] py-2 ${i || title ? 'border-t border-line' : ''}`}>
          <span className="text-[15px] font-semibold">{it.label}</span>
          <span className="flex items-center gap-1 text-[13px] text-mute text-right">{it.value}<Next size={16} className="shrink-0" /></span>
        </Link>
      ))}
    </nav>
  )
}
