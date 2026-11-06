// Faz 7-2: toparlanma ↔ antrenman önerisi — saf, testli (tests/recovery.test.ts).
// Haftalık MSS (merkezi sinir sistemi) yükü, art arda antrenman günleri, düşük yakıt (çok az yenen günler)
// ve ağrı notu birlikte okunur; ağırlık önerisi buna göre sabit tutulur ya da hafifletilir.

export type RecoveryLevel = 'ok' | 'easy' | 'deload'

export interface RecoveryInput {
  /** Haftalık MSS kademesi 1–5 (lib/cns.ts weeklyCns), yoksa null */
  cnsLevel: number | null
  /** Bugünden önce art arda antrenman yapılan gün sayısı */
  consecutiveDays: number
  /** Son 3 kapanmış günden kaç tanesinde hedefin belirgin altında (≥400 kcal) yenmiş */
  lowFuelDays: number
  /** Son seansta ağrı notu */
  painRecent: boolean
}

export function recoveryState(i: RecoveryInput): { level: RecoveryLevel; reasons: string[] } {
  const reasons: string[] = []
  const cns = i.cnsLevel ?? 0
  if (cns >= 4) reasons.push(cns >= 5 ? 'bu hafta sinir sistemi yükün çok yüksek' : 'bu hafta sinir sistemi yükün yüksek')
  if (i.consecutiveDays >= 4) reasons.push(`${i.consecutiveDays} gündür art arda antrenman yapıyorsun`)
  if (i.lowFuelDays >= 2) reasons.push(`son günlerde ${i.lowFuelDays} gün hedefinin çok altında yedin`)
  if (i.painRecent) reasons.push('son seansta ağrı notun var')
  const deload = (cns >= 5 && i.consecutiveDays >= 3) || (i.lowFuelDays >= 3 && cns >= 4) || (cns >= 5 && i.lowFuelDays >= 2)
  if (deload) return { level: 'deload', reasons }
  return { level: reasons.length ? 'easy' : 'ok', reasons }
}

export function recoveryText(r: { level: RecoveryLevel; reasons: string[] }): string | null {
  if (r.level === 'ok') return null
  const why = r.reasons.join(', ')
  return r.level === 'deload'
    ? `Toparlanma: ${why}. Bugün ağırlıkları %10 hafiflet; hafif gün sonraki ilerlemeyi hızlandırır.`
    : `Toparlanma: ${why}. Bugün ağırlığı artırma, aynı yükle tekniğe odaklan.`
}
