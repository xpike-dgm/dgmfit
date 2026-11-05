// Yeme bozukluğu ve aşırı antrenman sınırları — saf, testli (tests/coach.test.ts).
// Spesifikasyon 10 "Sınırlar" ve 13: tıbbi teşhis yok; belirtilerde nazik uyarı ve uzmana yönlendirme.
import type { DayFacts } from './weekly.ts'

export type SafetyFlag = 'low_intake' | 'no_rest' | 'high_burn_low_intake'
export interface SafetyResult { flags: SafetyFlag[]; lowDays: number; trainingDays: number; avgBurn: number }

/** Çok düşük kalori günü: anlamlı kayıt (≥2 kalem) var ve yenen < güvenli taban × 0,75 (kadın 900, erkek 1125 kcal). */
export const LOW_RATIO = 0.75
export const LOW_DAYS = 3 // son 7 günde bu kadar çok düşük gün → bayrak

/**
 * Son 7 kapanmış günün (bugün hariç, eskiden yeniye) özetinden güvenlik bayrakları.
 * - low_intake: ≥3 çok düşük kalori günü
 * - no_rest: 7 günün 7'sinde antrenman/kardiyo (dinlenme günü yok)
 * - high_burn_low_intake: günlük ortalama egzersiz ≥ 800 kcal ve kayıtlı günlerde ortalama yenen < taban
 */
export function safetyFlags(days: DayFacts[], floor: number): SafetyResult {
  const last = days.slice(-7)
  const lowDays = last.filter((d) => d.items >= 2 && d.eaten > 0 && d.eaten < floor * LOW_RATIO).length
  const trainingDays = last.filter((d) => d.workouts > 0 || d.cardioMin >= 20).length
  const avgBurn = last.length ? Math.round(last.reduce((a, d) => a + d.burned, 0) / last.length) : 0
  const logged = last.filter((d) => d.items >= 2)
  const avgEaten = logged.length ? logged.reduce((a, d) => a + d.eaten, 0) / logged.length : null
  const flags: SafetyFlag[] = []
  if (lowDays >= LOW_DAYS) flags.push('low_intake')
  if (last.length >= 7 && trainingDays >= 7) flags.push('no_rest')
  if (avgBurn >= 800 && avgEaten !== null && avgEaten < floor) flags.push('high_burn_low_intake')
  return { flags, lowDays, trainingDays, avgBurn }
}

export type RiskKind = 'crisis' | 'ed'
// Kaba Türkçe kalıplar (küçük harf, Türkçe karakterli). Yanlış pozitif zararsızdır: yalnızca destek kartı gösterilir.
const CRISIS = /(intihar|kendim[ei] (öldür|zarar)|ölmek istiyorum|yaşamak istemiyorum|canıma kıy)/
const ED = /(kus(tum|uyorum|acağım|mak istiyorum)|parmağımı boğazıma|laksatif|müshil|hiç (bir şey )?yemeyeceğim|yemeyi bıraktım|günlerdir (bir şey )?yemiyorum|aç kalacağım|kendimi aç bırak|yediğim için (kendimi )?cezalandır|yemekten sonra suçluluk|tıkınırcasına)/

/** Sohbet metninde kriz ya da yeme bozukluğu işareti (sunucu tarafı yedek kontrol; model bayrağıyla birleşir). */
export function riskyText(text: string): RiskKind | null {
  const t = text.toLocaleLowerCase('tr-TR')
  if (CRISIS.test(t)) return 'crisis'
  if (ED.test(t)) return 'ed'
  return null
}

export const SUPPORT: Record<SafetyFlag | RiskKind, { title: string; body: string }> = {
  low_intake: { title: 'Kendine nazik ol', body: 'Son günlerde birkaç kez güvenli kalori tabanının çok altında kaldın. Çok düşük kalori kas kaybı, yorgunluk ve geri tepme riskini artırır. Hedefini biraz uzatmak çoğu zaman daha sürdürülebilir. Yemekle ilişkin seni zorluyorsa bir hekim, diyetisyen ya da ruh sağlığı uzmanıyla konuşmak iyi gelebilir.' },
  no_rest: { title: 'Dinlenme de antrenmanın parçası', body: 'Son 7 günün hepsinde antrenman yaptın. Kaslar dinlenirken güçlenir; haftada en az 1 tam dinlenme günü sakatlık ve tükenme riskini azaltır.' },
  high_burn_low_intake: { title: 'Yakıt yetersiz olabilir', body: 'Bu hafta yüksek egzersiz harcamasına karşın yediğin miktar güvenli tabanın altında kaldı. Antrenman günlerinde daha fazla yemek performansı ve toparlanmayı korur. Zorlanıyorsan bir uzmana danışmanı öneririm.' },
  ed: { title: 'Yalnız değilsin', body: 'Yazdıkların yemekle ilgili zor bir dönemden geçtiğini düşündürüyor. Bu konuda bir hekim, diyetisyen ya da ruh sağlığı uzmanından destek almak gerçekten fark yaratır. DgFit sana teşhis koyamaz ama hedeflerini daha nazik bir tempoya çekmene yardım edebilir.' },
  crisis: { title: 'Şu an güvende misin?', body: 'Kendine zarar vermeyi düşünüyorsan lütfen hemen yakın birine haber ver ya da 112 Acil Çağrı Merkezi\'ni ara. Bir ruh sağlığı uzmanıyla konuşmak bu yükü hafifletebilir.' },
}
