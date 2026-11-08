// G1: özelleştirme sayfalarının ortak parçaları (kullanıcı: "kullanışsız UI istemiyorum").
// Gruplanmış satırlar (simge kutusu + başlık + açıklama + ok), ekran küçük önizlemesi, boş durum.
// Sunucu ve istemci bileşenlerinde kullanılabilir (durum tutmaz).
import Link from 'next/link'
import type { ReactNode } from 'react'
import { SectionLabel } from './StudioHeader'

export const ICONS = {
  layout: <><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>,
  nav: <><rect x="3" y="15" width="18" height="6" rx="2.5" /><path d="M7 18h.01M12 18h.01M17 18h.01M6 4h12M6 8h12" /></>,
  rule: <><path d="M4 6h10M4 12h7M4 18h10" /><circle cx="18" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  map: <><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></>,
  wand: <><path d="M15 4V2M15 10V8M11 6h2M17 6h2M4 20L14 10" /><path d="M18 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" /></>,
  hand: <><path d="M8 13V5a2 2 0 014 0v6" /><path d="M12 11V4a2 2 0 014 0v7" /><path d="M16 9a2 2 0 014 0v5a7 7 0 01-7 7h-1a7 7 0 01-6-3.4L4 15a2 2 0 013.4-2L8 14" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chart: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 15l3-3 3 2 4-5" /></>,
  tracker: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  quote: <path d="M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6" />,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></>,
  photo: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="11" r="2" /><path d="M21 17l-5-5-8 8" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 01-8 0z" /><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M10 17h4M12 13v4M8 21h8" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  dumbbell: <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  history: <><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
} satisfies Record<string, ReactNode>
export type IconName = keyof typeof ICONS

export function Ico({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{ICONS[name]}</svg>
}

/** Modül renginde yumuşak simge kutusu. */
export function IconBox({ name, mod = 'today', size = 'md' }: { name: IconName; mod?: string; size?: 'md' | 'lg' }) {
  const s = size === 'lg' ? 'w-12 h-12 rounded-[15px]' : 'w-10 h-10 rounded-[13px]'
  return (
    <span data-mod={mod} className={`${s} shrink-0 flex items-center justify-center text-acc bg-[color-mix(in_oklab,var(--color-acc)_16%,var(--color-surface-2))]`}>
      <Ico name={name} size={size === 'lg' ? 23 : 20} />
    </span>
  )
}

/** Başlıklı grup: satırlar arasında ince çizgi. */
export function Group({ label, children, testId, footer }: { label?: string; children: ReactNode; testId?: string; footer?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="px-1"><SectionLabel>{label}</SectionLabel></span> : null}
      <section aria-label={label} className="card rounded-[22px] overflow-hidden flex flex-col divide-y divide-line" data-testid={testId}>{children}</section>
      {footer ? <p className="px-1 text-[12px] text-mute leading-relaxed">{footer}</p> : null}
    </div>
  )
}

/** Simgeli satır: bağlantı ya da düğme. */
export function Row({ href, onClick, icon, mod, title, sub, right, testId, chevron = true }: {
  href?: string; onClick?: () => void; icon?: IconName; mod?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; testId?: string; chevron?: boolean
}) {
  const body = (
    <>
      {icon ? <IconBox name={icon} mod={mod} /> : null}
      <span className="flex flex-col flex-1 min-w-0 gap-0.5 leading-tight">
        <b className="text-[15px] font-extrabold">{title}</b>
        {sub ? <span className="text-[12.5px] text-mute leading-snug">{sub}</span> : null}
      </span>
      {right ?? null}
      {chevron && (href || onClick) ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-mute shrink-0" aria-hidden><path d="M9 6l6 6-6 6" /></svg> : null}
    </>
  )
  const cls = 'min-h-[64px] px-3.5 py-2.5 flex items-center gap-3 text-left w-full active:bg-surface-2 transition'
  if (href) return <Link href={href} className={cls} data-testid={testId}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls} data-testid={testId}>{body}</button>
  return <div className={cls} data-testid={testId}>{body}</div>
}

/** Ekranın küçük önizlemesi: kartlar modül renginde bloklar (bant üstte). */
export function ScreenThumb({ items, className = '' }: { items: { id: string; size: 'full' | 'half'; def: { module: string; locked?: string | boolean } }[]; className?: string }) {
  return (
    <div aria-hidden className={`rounded-[14px] border-2 border-line-2 bg-bg p-1 flex flex-wrap content-start gap-[3px] overflow-hidden ${className}`}>
      {items.slice(0, 8).map((i) => i.def.locked === 'top'
        ? <div key={i.id} data-mod={i.def.module} className="w-full h-[26px] shrink-0 rounded-md band" />
        : <div key={i.id} data-mod={i.def.module} className={`${i.size === 'half' ? 'w-[calc(50%-1.5px)]' : 'w-full'} h-[18px] shrink-0 rounded-[5px] border bg-[color-mix(in_oklab,var(--color-acc)_16%,var(--color-surface))] border-[color-mix(in_oklab,var(--color-acc)_32%,var(--color-line))]`} />)}
    </div>
  )
}

/** Sayfa başı açıklaması (tek satır, sade). */
export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-[13.5px] text-ink-2 leading-relaxed px-1 -mt-1">{children}</p>
}

/** Açma/kapama anahtarı (görünüm). */
export const switchClass = "appearance-none w-12 h-7 rounded-full bg-surface-3 relative shrink-0 transition checked:bg-acc before:content-[''] before:absolute before:top-1 before:left-1 before:w-5 before:h-5 before:rounded-full before:bg-white before:shadow before:transition checked:before:translate-x-5 disabled:opacity-50"

/** Yumuşak seçici (segment) düğme sınıfı: aria-checked ile seçili görünür. */
export const segClass = 'min-h-10 px-3 rounded-full text-[13px] font-bold text-mute aria-checked:bg-surface aria-checked:text-ink aria-checked:shadow-sm transition'

/** Çip: aria-pressed / aria-checked ile seçili. */
export const chipClass = 'min-h-10 px-3.5 rounded-full border border-line-2 bg-surface-2 text-[13px] font-bold text-ink-2 whitespace-nowrap transition aria-pressed:bg-acc aria-pressed:text-acc-ink aria-pressed:border-acc aria-checked:bg-acc aria-checked:text-acc-ink aria-checked:border-acc'
