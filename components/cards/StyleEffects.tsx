'use client'
// Ö2b: tarayıcı tarafı stil etkileri — titreşim şiddeti/kapatma ve dokunuş sesi (navigator.vibrate üzerinden; uygulamadaki
// tüm titreşim çağrıları buradan geçer) ve akşam 20.00–06.00 arası sıcak renk katmanı.
import { useEffect, useState } from 'react'
import { hapticScale, isWarmHour, type Haptics } from '@/lib/cards/style'

let audio: AudioContext | null = null
function tick() {
  try {
    audio ??= new AudioContext()
    const o = audio.createOscillator(), g = audio.createGain()
    o.frequency.value = 880; g.gain.value = 0.04
    o.connect(g); g.connect(audio.destination)
    o.start(); o.stop(audio.currentTime + 0.03)
  } catch { /* ses yoksa sessiz */ }
}

export default function StyleEffects({ haptics, sound, warm }: { haptics: Haptics; sound: boolean; warm: boolean }) {
  useEffect(() => {
    const nav = navigator as Navigator & { __dgVib?: Navigator['vibrate'] }
    if (!('vibrate' in navigator) && !sound) return
    nav.__dgVib ??= navigator.vibrate?.bind(navigator)
    const orig = nav.__dgVib
    const k = hapticScale(haptics)
    navigator.vibrate = ((p: VibratePattern) => {
      if (sound) tick()
      if (!orig || !k) return false
      const scale = (v: number) => Math.max(1, Math.round(v * k))
      return orig(Array.isArray(p) ? p.map(scale) : scale(p as number))
    }) as Navigator['vibrate']
    document.documentElement.dataset.haptics = haptics
    return () => { if (orig) navigator.vibrate = orig }
  }, [haptics, sound])
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    if (!warm) return
    const read = () => { const d = new Date(); setNow(d.getHours() * 60 + d.getMinutes()) }
    read(); const t = setInterval(read, 60_000)
    return () => clearInterval(t)
  }, [warm])
  return warm && now !== null && isWarmHour(now) ? <div aria-hidden data-testid="warm-layer" className="fixed inset-0 pointer-events-none z-[70] bg-[#FF8A2A] mix-blend-multiply opacity-[0.07]" /> : null
}
