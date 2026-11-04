// Satır içi çizgi ikonları (currentColor). Dekoratiftir; anlam taşıyan yerlerde aria-label kullanılır.
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 24, strokeWidth = 2, ...rest }: P) {
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...rest,
  }
}

export const Home = (p: P) => <svg {...base(p)}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>
export const Dumbbell = (p: P) => <svg {...base(p)}><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /></svg>
export const Fork = (p: P) => <svg {...base(p)}><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 1.5-3 4-3 7h3v11" /></svg>
export const Users = (p: P) => <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.3 2.5 3.8 5.5" /></svg>
export const Plus = (p: P) => <svg {...base({ strokeWidth: 2.6, ...p })}><path d="M12 5v14M5 12h14" /></svg>
export const Drop = (p: P) => <svg {...base(p)}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></svg>
export const Flame = (p: P) => <svg {...base(p)}><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2-4.6.3 1.6 1.2 2.6 2.2 2.6C11 8.5 11 6 12 3z" /></svg>
export const Spark = (p: P) => <svg {...base(p)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></svg>
export const User = (p: P) => <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
export const Back = (p: P) => <svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>
export const Next = (p: P) => <svg {...base(p)}><path d="M9 5l7 7-7 7" /></svg>
export const Arrow = (p: P) => <svg {...base({ strokeWidth: 2.4, ...p })}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
export const Check = (p: P) => <svg {...base({ strokeWidth: 2.6, ...p })}><path d="M5 12l5 5 9-10" /></svg>
export const Info = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
export const Pulse = (p: P) => <svg {...base(p)}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
export const Trend = (p: P) => <svg {...base(p)}><path d="M3 17l5-5 4 3 8-8M15 7h5v5" /></svg>
export const Male = (p: P) => <svg {...base(p)}><circle cx="10" cy="14" r="6" /><path d="M14.5 9.5L21 3M15 3h6v6" /></svg>
export const Female = (p: P) => <svg {...base(p)}><circle cx="12" cy="9" r="6" /><path d="M12 15v7M9 19h6" /></svg>
export const Eye = (p: P) => <svg {...base(p)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
export const EyeOff = (p: P) => <svg {...base(p)}><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.1 6.1C3.5 7.9 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.9-2.1M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
export const Logout = (p: P) => <svg {...base(p)}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" /></svg>
export const Scale = (p: P) => <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M8 9a5 5 0 0 1 8 0l-3 3" /></svg>
export const Calendar = (p: P) => <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
export const Lock = (p: P) => <svg {...base(p)}><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
export const Bolt = (p: P) => <svg {...base(p)}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>
