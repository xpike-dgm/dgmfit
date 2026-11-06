'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FAILED_KEY, flushPending, PENDING_KEY, readJson, writeJson } from './live-store'

/** Çevrimdışıyken bitirilen antrenmanları bağlantı gelince gönderir. */
export default function PendingSync() {
  const [n, setN] = useState(0)
  const [bad, setBad] = useState<{ name: string; at: string; error: string }[]>([])
  const router = useRouter()
  useEffect(() => {
    const count = () => { setN((readJson<unknown[]>(PENDING_KEY) ?? []).length); setBad(readJson<{ name: string; at: string; error: string }[]>(FAILED_KEY) ?? []) }
    const go = async () => { if (!navigator.onLine) return; const s = await flushPending(); count(); if (s) router.refresh() }
    count(); void go()
    window.addEventListener('online', go)
    return () => window.removeEventListener('online', go)
  }, [router])
  if (!n && !bad.length) return null
  return (
    <>
      {n ? <p role="status" className="card px-4 py-3 text-[13px] text-orange">{n} antrenman gönderilmeyi bekliyor; bağlantı gelince otomatik kaydedilecek.</p> : null}
      {bad.length ? (
        <div role="alert" className="card px-4 py-3 text-[13px] text-danger flex items-start gap-2">
          <span className="flex-1">Çevrimdışı kaydedilen {bad.length} antrenman sunucuda kabul edilmedi ({bad.map((b) => `${b.name}: ${b.error}`).join('; ')}).</span>
          <button type="button" className="text-ink-2 font-bold shrink-0" onClick={() => { writeJson(FAILED_KEY, null); setBad([]) }}>Tamam</button>
        </div>
      ) : null}
    </>
  )
}
