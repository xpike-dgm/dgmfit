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
export const Chat = (p: P) => <svg {...base(p)}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></svg>
export const Send = (p: P) => <svg {...base({ strokeWidth: 2.4, ...p })}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
export const Bug = (p: P) => <svg {...base(p)}><rect x="7" y="7" width="10" height="13" rx="5" /><path d="M9 7a3 3 0 0 1 6 0M12 11v9M3 13h4M17 13h4M4 7l3 2M20 7l-3 2M4 19l3-2M20 19l-3-2" /></svg>
export const Bulb = (p: P) => <svg {...base(p)}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></svg>
export const Flag = (p: P) => <svg {...base(p)}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
export const Help = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.3 2-2.3 3.5M12 17v.5" /></svg>
export const Shield = (p: P) => <svg {...base(p)}><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
export const Ticket = (p: P) => <svg {...base(p)}><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" /><path d="M10 6v12" strokeDasharray="2 2" /></svg>
export const Image = (p: P) => <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
export const Search = (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
export const Download = (p: P) => <svg {...base(p)}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
export const Share = (p: P) => <svg {...base(p)}><path d="M12 15V4M8 8l4-4 4 4M6 12v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7" /></svg>
export const Heart = (p: P & { filled?: boolean }) => { const { filled, ...r } = p; return <svg {...base(r)} fill={filled ? 'currentColor' : 'none'}><path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.8 4 7.2 4c2 0 3.5 1.1 4.8 2.8C13.3 5.1 14.8 4 16.8 4c3.4 0 5.6 3.2 4.4 6.6C19.5 15.4 12 20 12 20z" /></svg> }
export const Rotate = (p: P) => <svg {...base(p)}><path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5" /></svg>
export const MaleSign = (p: P) => <svg {...base(p)}><circle cx="10" cy="14" r="6" /><path d="M14.5 9.5L21 3M15 3h6v6" /></svg>
export const FemaleSign = (p: P) => <svg {...base(p)}><circle cx="12" cy="9" r="6" /><path d="M12 15v7M9 19h6" /></svg>
export const Levels = (p: P & { level?: number }) => { const { level = 2, ...r } = p; return <svg {...base(r)}><rect x="4" y="13" width="4" height="7" rx="1" fill="currentColor" /><rect x="10" y="9" width="4" height="11" rx="1" fill={level >= 2 ? 'currentColor' : 'none'} opacity={level >= 2 ? 1 : 0.35} /><rect x="16" y="5" width="4" height="15" rx="1" fill={level >= 3 ? 'currentColor' : 'none'} opacity={level >= 3 ? 1 : 0.35} /></svg> }
export const Anchor = (p: P) => <svg {...base(p)}><circle cx="12" cy="5" r="2" /><path d="M12 7v14M8 11h8M4 14a8 8 0 0 0 16 0" /></svg>
export const Stretch = (p: P) => <svg {...base(p)}><path d="M5 19L19 5M14 5h5v5M10 19H5v-5" /></svg>
export const Balance = (p: P) => <svg {...base(p)}><circle cx="7" cy="8" r="2.2" /><circle cx="17" cy="8" r="2.2" /><path d="M3 13h18M12 13l-3.5 7h7z" /></svg>
export const Single = (p: P) => <svg {...base(p)}><path d="M12 3v18M8 7h8M8 17h8" /><circle cx="12" cy="12" r="2" /></svg>
export const Play = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor" /></svg>
export const History = (p: P) => <svg {...base(p)}><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8M3 3v5h5M12 7v5l3 2" /></svg>
export const SetsIcon = (p: P) => <svg {...base(p)}><rect x="4" y="9" width="16" height="10" rx="2" /><path d="M7 6h10M9 3h6" /></svg>
export const Repeat = (p: P) => <svg {...base(p)}><path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3" /></svg>
export const Gauge = (p: P) => <svg {...base(p)}><path d="M4 17a8 8 0 1 1 16 0" /><path d="M12 17l4-5" /><path d="M4 17h16" /></svg>
export const EditSquare = (p: P) => <svg {...base(p)}><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" /><path d="M17.5 3.5l3 3L12 15H9v-3z" /></svg>
export const Bookmark = (p: P & { filled?: boolean }) => { const { filled, ...r } = p; return <svg {...base(r)} fill={filled ? 'currentColor' : 'none'}><path d="M6 3h12v18l-6-4-6 4z" /></svg> }
export const Smile = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.5h.01M15 9.5h.01" /></svg>
export const Grid = (p: P) => <svg {...base(p)}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>
