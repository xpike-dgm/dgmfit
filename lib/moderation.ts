// İçerik moderasyonu kuralları — saf, testli (tests/social.test.ts). Spesifikasyon 8.6 ve 10: uygunsuz görsel, taciz, zararlı diyet içeriği.
// Kural katmanı her zaman çalışır; AI katmanı (lib/ai) varsa ek karar verir. Yanlış pozitifte içerik silinmez, onaya düşer.
import { riskyText } from './safety.ts'

export type ModVerdict = 'ok' | 'review' | 'block'
export interface ModResult { verdict: ModVerdict; reasons: string[]; support: 'ed' | 'crisis' | null }

// Taciz / hakaret (kaba, kısa liste; yönetici onayına düşer, otomatik silinmez)
// \b Türkçe harfleri (ş, ğ, ı…) kelime harfi saymaz; Unicode harf sınırı kullanılır
const ABUSE = /(?<![\p{L}\d])(aptal|salak|gerizekalı|geri zekalı|şişko|domuz|yağ tulumu|iğrenç|öl git|defol|orospu|piç|siktir|amk|ananı)(?![\p{L}\d])/u
// Zararlı diyet içeriği: aşırı düşük kalori, kusma/laksatif tavsiyesi, "pro-ana" dili
const HARMFUL = /(günde\s*(\d{2,3})\s*(kcal|kalori)|laksatif|müshil|kusarak|kusmak|parmağını boğazına|aç kal(ın|arak)|thinspo|pro-?ana|pro-?mia|kilo vermek için (ilaç|hap))/
// Bağlantı/spam: tek gönderide 3'ten fazla bağlantı
const LINKS = /https?:\/\//g

export function moderateText(text: string): ModResult {
  const t = text.toLocaleLowerCase('tr-TR')
  const reasons: string[] = []
  const support = riskyText(text)
  if (support) reasons.push(support === 'crisis' ? 'kriz işareti' : 'yeme bozukluğu işareti')
  if (ABUSE.test(t)) reasons.push('hakaret/taciz')
  const m = t.match(HARMFUL)
  if (m) {
    const kcal = m[2] ? Number(m[2]) : null
    if (kcal === null || kcal < 1000) reasons.push('zararlı diyet içeriği')
  }
  if ((t.match(LINKS) ?? []).length > 3) reasons.push('çok sayıda bağlantı')
  return { verdict: reasons.length ? 'review' : 'ok', reasons, support }
}

/** Kural + AI kararını birleştirir: en sıkı karar geçerli. */
export function combine(rule: ModResult, ai: { verdict: ModVerdict; reasons: string[] } | null): ModResult {
  if (!ai) return rule
  const order: ModVerdict[] = ['ok', 'review', 'block']
  const verdict = order[Math.max(order.indexOf(rule.verdict), order.indexOf(ai.verdict))]
  return { verdict, reasons: [...new Set([...rule.reasons, ...ai.reasons])], support: rule.support }
}

/** Profil/grup/meydan okuma gibi kısa herkese açık metinler için: kural katmanı uygunsuz bulursa Türkçe hata metni, yoksa null. */
export function cleanTextError(label: string, text: string | null | undefined): string | null {
  if (!text || !text.trim()) return null
  return moderateText(text).verdict === 'ok' ? null : `${label} uygunsuz içerik barındırıyor; lütfen düzenle`
}
