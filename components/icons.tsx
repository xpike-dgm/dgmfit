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
export const Bottle = (p: P) => <svg {...base(p)}><path d="M10 2h4M10.5 2v3.2c0 .5-.3 1-.7 1.3C8.7 7.3 8 8.6 8 10v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V10c0-1.4-.7-2.7-1.8-3.5-.4-.3-.7-.8-.7-1.3V2" /></svg>
export const Glass = (p: P) => <svg {...base(p)}><path d="M5 3h14l-1.6 16.2A2 2 0 0 1 15.4 21H8.6a2 2 0 0 1-2-1.8z" /><path d="M6 9h12" /></svg>
export const Thermos = (p: P) => <svg {...base(p)}><path d="M9 2h6M10 2v3M14 2v3M8 5h8v15a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" /></svg>
export const Cup = (p: P) => <svg {...base(p)}><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" /></svg>
export const Dots = (p: P) => <svg {...base(p)}><circle cx="6" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="12" r="1.6" /></svg>
export const Clock = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
export const Chart = (p: P) => <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
export const Gear = (p: P) => <svg {...base(p)}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
export const Merge = (p: P) => <svg {...base(p)}><path d="M6 3v6a6 6 0 0 0 6 6h6M18 15l-3-3M18 15l-3 3M6 21v-3" /></svg>
export const Trash = (p: P) => <svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3" /></svg>
export const Mic = (p: P) => <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></svg>
export const Target = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><path d="M12 3.5v3M12 17.5v3" /></svg>
export const Bell = (p: P) => <svg {...base(p)}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
export const Close = (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
export const Pencil = (p: P) => <svg {...base(p)}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></svg>
