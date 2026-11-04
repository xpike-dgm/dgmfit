'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { flushPending, PENDING_KEY, readJson } from './live-store'

/** Çevrimdışıyken bitirilen antrenmanları bağlantı gelince gönderir. */
export default function PendingSync() {
  const [n, setN] = useState(0)
  const router = useRouter()
  useEffect(() => {
    const count = () => setN((readJson<unknown[]>(PENDING_KEY) ?? []).length)
    const go = async () => { if (!navigator.onLine) return; const s = await flushPending(); count(); if (s) router.refresh() }
    count(); void go()
    window.addEventListener('online', go)
    return () => window.removeEventListener('online', go)
  }, [router])
  if (!n) return null
  return <p role="status" className="card px-4 py-3 text-[13px] text-orange">{n} antrenman gönderilmeyi bekliyor; bağlantı gelince otomatik kaydedilecek.</p>
}
