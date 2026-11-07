'use client'
// Ö4: kart kullanım ölçümü — kart ekranda görününce bir kez "görülme", içine dokununca "dokunma" (aynı karta 1,5 sn'de bir).
// Olaylar biriktirilir; 4 sn'de bir ya da sayfa kapanırken sendBeacon ile gönderilir. Kişisel; yalnız kullanıcının haritası için.
type Ev = { card: string; kind: 'view' | 'tap' }
let queue: Ev[] = []
let timer: ReturnType<typeof setTimeout> | null = null
const lastTap = new Map<string, number>()
let bound = false

function flush() {
  if (timer) { clearTimeout(timer); timer = null }
  if (!queue.length) return
  const body = JSON.stringify({ events: queue.splice(0, 60) })
  const blob = new Blob([body], { type: 'application/json' })
  if (!navigator.sendBeacon?.('/api/cards/usage', blob)) fetch('/api/cards/usage', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => null)
  if (queue.length) schedule()
}
function schedule() { if (!timer) timer = setTimeout(flush, 4000) }
function push(e: Ev) {
  queue.push(e)
  if (!bound) { bound = true; addEventListener('pagehide', flush); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() }) }
  schedule()
}
export function trackView(card: string) { push({ card, kind: 'view' }) }
export function trackTap(card: string) {
  const now = Date.now()
  if (now - (lastTap.get(card) ?? 0) < 1500) return
  lastTap.set(card, now); push({ card, kind: 'tap' })
}
