'use client'
// Canlı antrenman taslağı ve gönderilemeyen antrenman kuyruğu (localStorage). Her erişim try/catch içinde.
import { saveWorkoutAction } from './actions'

export const LIVE_KEY = 'dgfit:live:v1'
export const PENDING_KEY = 'dgfit:pending-workouts:v1'
/** Sunucunun reddettiği (geçersiz) antrenmanlar: sessizce silinmez, kullanıcıya gösterilir. */
export const FAILED_KEY = 'dgfit:failed-workouts:v1'
type Payload = Parameters<typeof saveWorkoutAction>[0]

export function readJson<T>(key: string): T | null {
  try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : null } catch { return null }
}
export function writeJson(key: string, v: unknown) {
  try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)) } catch { /* depolama kapalı */ }
}
export function queuePending(p: Payload) {
  const q = readJson<Payload[]>(PENDING_KEY) ?? []
  if (!q.some((x) => x.clientId === p.clientId)) q.push(p)
  writeJson(PENDING_KEY, q)
}
/** Kuyruktakileri gönderir; client_id sayesinde iki kez kaydedilmez. Gönderilen sayısını döner. */
export async function flushPending(): Promise<number> {
  const q = readJson<Payload[]>(PENDING_KEY) ?? []
  if (!q.length) return 0
  const left: Payload[] = []
  const failed: { name: string; at: string; error: string }[] = []
  let sent = 0
  for (const p of q) {
    try { const r = await saveWorkoutAction(p); if (r.ok) sent++; else if (/geçersiz|geçerli set yok/i.test(r.error)) failed.push({ name: p.name, at: p.startedAt, error: r.error }); else left.push(p) } catch { left.push(p) }
  }
  writeJson(PENDING_KEY, left.length ? left : null)
  if (failed.length) writeJson(FAILED_KEY, [...(readJson<typeof failed>(FAILED_KEY) ?? []), ...failed].slice(-10))
  return sent
}
