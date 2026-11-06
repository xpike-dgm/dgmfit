// Faz 7-2: tek bildirim planlayıcısı — saf kural (tests/push-plan.test.ts).
// Otomatik bildirimler (su, sosyal, rapor) günde en fazla DAILY_CAP ve yalnızca uyanık saatlerde;
// kullanıcının kendi başlattığı (dinlenme sayacı, test bildirimi) her zaman gider.

export const DAILY_CAP = 8
/** urgent: kullanıcı başlattı (her zaman) · planned: kendi zamanlamasını yapan (su hatırlatması; yalnızca sınır) · normal: sınır + uyanık saat */
export type PushKind = 'urgent' | 'planned' | 'normal'

const hm = (s: string | null | undefined, d: number) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : d }

export function pushAllowed(i: { kind: PushKind; sentToday: number; nowMin: number; wake?: string | null; sleep?: string | null }): { ok: boolean; why?: string } {
  if (i.kind === 'urgent') return { ok: true }
  if (i.sentToday >= DAILY_CAP) return { ok: false, why: 'günlük üst sınır' }
  if (i.kind === 'planned') return { ok: true }
  const wake = hm(i.wake, 7 * 60 + 30), sleep = hm(i.sleep, 23 * 60 + 30)
  const awake = wake < sleep ? i.nowMin >= wake && i.nowMin < sleep : i.nowMin >= wake || i.nowMin < sleep
  return awake ? { ok: true } : { ok: false, why: 'uyku saati' }
}
