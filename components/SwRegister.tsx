'use client'
import { useEffect } from 'react'

export default function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }
    // iOS Safari viewport ayarını yok sayıp iki parmakla yakınlaştırır: hareketi engelle.
    const stop = (e: Event) => e.preventDefault()
    document.addEventListener('gesturestart', stop, { passive: false })
    document.addEventListener('gesturechange', stop, { passive: false })
    return () => { document.removeEventListener('gesturestart', stop); document.removeEventListener('gesturechange', stop) }
  }, [])
  return null
}
