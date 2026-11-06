import 'server-only'
import { sendToUser } from './push'

/**
 * Kilit ekranı için dinlenme bildirimi: istemci dinlenmeyi başlatınca sunucu bitiş anında Web Push gönderir.
 * Tek süreç (instrumentation zamanlayıcısıyla aynı), kullanıcı başına tek bekleyen bildirim. Uygulama görünürse SW göstermez.
 */
const g = globalThis as unknown as { __dgfitRest?: Map<string, ReturnType<typeof setTimeout>> }
const timers = (g.__dgfitRest ??= new Map())

export function scheduleRest(userId: string, seconds: number, next: string | null, url = '/fitness/antrenman') {
  cancelRest(userId)
  const t = setTimeout(() => {
    timers.delete(userId)
    void sendToUser(userId, { title: 'Dinlenme bitti', body: next ? `Sıradaki: ${next}` : 'Sıradaki sete geç', tag: 'dgfit-rest', url }, 'urgent').catch((e) => console.error('[dgfit] dinlenme bildirimi', e))
  }, Math.round(seconds * 1000))
  timers.set(userId, t)
}
export function cancelRest(userId: string) {
  const t = timers.get(userId)
  if (t) { clearTimeout(t); timers.delete(userId) }
}
export const pendingRest = (userId: string) => timers.has(userId)
