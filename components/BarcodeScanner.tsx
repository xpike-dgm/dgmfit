'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Kamera ile barkod okuma. Önce tarayıcının yerleşik BarcodeDetector'ı (Android Chrome),
 * yoksa ZXing (iOS Safari dahil) dinamik olarak yüklenir. Kamera izni yoksa elle giriş kalır.
 */
export default function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'denied' | 'unavailable'>('starting')
  const [manual, setManual] = useState('')
  const done = useRef(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let zxingStop: (() => void) | null = null
    const finish = (code: string) => {
      if (done.current) return
      done.current = true
      if ('vibrate' in navigator) navigator.vibrate?.(30)
      onCode(code)
    }
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('unavailable'); return }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      } catch { setStatus('denied'); return }
      const v = videoRef.current
      if (!v) return
      v.srcObject = stream
      await v.play().catch(() => {})
      setStatus('scanning')
      const W = window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }
      if (W.BarcodeDetector) {
        const det = new W.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
        const loop = async () => {
          if (done.current) return
          try { const r = await det.detect(v); if (r[0]?.rawValue) { finish(r[0].rawValue); return } } catch { /* kare hazır değil */ }
          raf = requestAnimationFrame(loop)
        }
        loop()
      } else {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        const controls = await reader.decodeFromVideoElement(v, (res) => { if (res) finish(res.getText()) })
        zxingStop = () => controls.stop()
      }
    })()
    return () => {
      cancelAnimationFrame(raf)
      zxingStop?.()
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onCode])

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full aspect-[4/3] rounded-[22px] overflow-hidden bg-black">
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" aria-label="Kamera görüntüsü" />
        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 rounded-2xl border-2 border-lime/80 pointer-events-none" aria-hidden />
        {status !== 'scanning' ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-2 bg-black/70">
            {status === 'starting' ? 'Kamera açılıyor…' : status === 'denied' ? 'Kamera izni verilmedi. Barkodu aşağıya yazabilirsin.' : 'Bu cihazda kamera kullanılamıyor. Barkodu aşağıya yaz.'}
          </div>
        ) : null}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const c = manual.replace(/\D/g, ''); if (c.length >= 8) onCode(c) }}>
        <label htmlFor="bc-manual" className="sr-only">Barkod numarası</label>
        <input id="bc-manual" inputMode="numeric" placeholder="Barkod numarası" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, '').slice(0, 14))}
          className="flex-1 h-12 rounded-2xl bg-surface-2 border border-line px-4 num text-ink outline-none focus:border-lime" />
        <button type="submit" disabled={manual.length < 8} className="h-12 px-5 rounded-full bg-lime text-lime-ink font-extrabold disabled:opacity-40">Ara</button>
      </form>
    </div>
  )
}
