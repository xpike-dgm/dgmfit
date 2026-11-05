'use client'
import { useState } from 'react'
import { Dumbbell } from './icons'

/** Hareket görseli: yüklenemezse kırık simge yerine nötr yer tutucu. */
export default function ExImg({ src, alt = '', className, size }: { src: string | null | undefined; alt?: string; className: string; size?: number }) {
  const [bad, setBad] = useState(false)
  if (!src || bad) return <span role={alt ? 'img' : undefined} aria-label={alt || undefined} className={`${className} bg-surface-2 text-faint flex items-center justify-center`}><Dumbbell size={size ? Math.round(size / 2.4) : 22} /></span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={size} height={size} loading="lazy" onError={() => setBad(true)} className={`${className} object-cover bg-surface-2`} />
}
