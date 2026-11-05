'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Back } from './icons'

const KEY = 'dgfit:nav'

/** Uygulama içi gezinme izi (sekme başına): ModShell her adres değişiminde ekler. */
export function trackNav(path: string) {
  try {
    const a: string[] = JSON.parse(sessionStorage.getItem(KEY) ?? '[]')
    if (a.at(-1) !== path) a.push(path)
    sessionStorage.setItem(KEY, JSON.stringify(a.slice(-50)))
  } catch { /* yok */ }
}
function hasInAppHistory(): boolean {
  try { return (JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[]).length >= 2 } catch { return false }
}

/** Geri: uygulama içinden gelindiyse geldiği sayfaya (tarayıcı geçmişi), doğrudan açıldıysa `fallback` sayfasına. */
export default function BackButton({ fallback, className }: { fallback: string; className: string }) {
  const router = useRouter()
  return (
    <Link href={fallback} aria-label="Geri" className={className}
      onClick={(e) => { if (hasInAppHistory() && window.history.length > 1) { e.preventDefault(); router.back() } }}>
      <Back size={20} />
    </Link>
  )
}
