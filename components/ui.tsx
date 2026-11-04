import Link from 'next/link'
import type { ReactNode } from 'react'
import { Back } from './icons'

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 h-14 px-6 rounded-full bg-lime text-lime-ink font-extrabold text-[17px] active:scale-[0.98] transition disabled:opacity-40 disabled:active:scale-100',
  secondary:
    'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full border border-line-2 text-ink font-bold text-[15px] active:scale-[0.98] transition',
  ghost: 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full text-ink-2 font-bold text-[15px]',
  icon: 'inline-flex items-center justify-center w-11 h-11 rounded-full border border-line bg-surface text-ink shrink-0',
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`text-[13px] font-bold tracking-[0.08em] uppercase text-mute ${className}`}>{children}</span>
}

export function TopBar({ title, back, right }: { title?: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      {back ? (
        <Link href={back} aria-label="Geri" className={btn.icon}><Back size={20} /></Link>
      ) : <span className="w-11" />}
      {title ? <span className="text-base font-extrabold">{title}</span> : null}
      {right ?? <span className="w-11" />}
    </div>
  )
}

export function Ring({
  size = 124, stroke = 12, value, color = 'var(--color-lime)', track = 'var(--color-surface-3)', children, label,
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

export function Bar({ value, color = 'var(--color-lime)', height = 8 }: { value: number; color?: string; height?: number }) {
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
