// Tüm gün hesapları Türkiye saatine göre (Europe/Istanbul, UTC+3, yaz saati yok).
export const TZ = 'Europe/Istanbul'

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

// ───────── Y1: kişisel gün döngüsü ─────────
// Kullanıcının günü gece yarısında değil, seçtiği "gün sınırı"nda biter (varsayılan 04.00): 01.30'da yenen atıştırmalık
// dünün kaydına girer. Sunucu her istekte giriş yapan kullanıcının sınırını sağlayıcıya verir (lib/day-context.ts);
// sağlayıcı yoksa (birim testler, istemci) sınır 0 = takvim günü.
export const DAY_START_DEFAULT = 240
export const DAY_START_OPTIONS: { min: number; label: string; hint: string }[] = [
  { min: 0, label: 'Gece yarısı', hint: 'Gün 00.00\'da biter' },
  { min: 120, label: '02.00', hint: 'Gece 02.00\'ye kadar dünün devamı' },
  { min: 240, label: '04.00', hint: 'Önerilen · gece 04.00\'e kadar dünün devamı' },
  { min: 360, label: '06.00', hint: 'Geç yatanlar ve gece çalışanlar için' },
]
let offsetProvider: (() => number) | null = null
/** Sunucu tarafı: istek başına gün sınırını veren işlev (lib/day-context.ts kaydeder). */
export function setDayOffsetProvider(fn: (() => number) | null) { offsetProvider = fn }
/** Bu istekte / bağlamda geçerli gün sınırı (sağlayıcı yoksa 0). */
export function currentDayStart(): number { return offsetProvider ? offsetProvider() : 0 }
export const clampDayStart = (m: unknown) => { const n = Math.round(Number(m)); return Number.isFinite(n) ? Math.min(1439, Math.max(0, n)) : DAY_START_DEFAULT }
/** Mantıksal gün: an, gün sınırı kadar geri alınıp Türkiye takvim gününe çevrilir. */
export function logicalDay(d: Date, dayStartMin: number): string {
  return ymd.format(new Date(d.getTime() - clampDayStart(dayStartMin) * 60000))
}
/** Kullanıcının bugünü (ya da verilen anın mantıksal günü). `dayStartMin` verilmezse istek sağlayıcısından gelir. */
export function dayString(d: Date = new Date(), dayStartMin?: number): string {
  return logicalDay(d, dayStartMin ?? (offsetProvider ? offsetProvider() : 0))
}
/** Takvim günü ilerledi ama kullanıcı hâlâ dünde mi (gece penceresi)? */
export function inLateWindow(d: Date, dayStartMin: number): boolean {
  return logicalDay(d, dayStartMin) !== logicalDay(d, 0)
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function diffDays(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime()) / 86400000)
}

export function longDate(day: string): string {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(day + 'T12:00:00Z'))
}

export function shortDate(day: string): string {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(day + 'T12:00:00Z'))
}

export function greeting(d: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(d))
  if (h < 5) return 'İyi geceler'
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

/** "04.00'te", "02.00'de", "06.00'da", "19.30'da" — saatin Türkçe okunuşuna göre bulunma eki. 0 → "gece yarısında". */
export function atTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60), mm = m % 60
  if (m === 0) return 'gece yarısında'
  const n = mm || h
  const last = n % 10, tens = Math.floor(n / 10) % 10
  const SFX_ONES = ['da', 'de', 'de', 'te', 'te', 'te', 'da', 'de', 'de', 'da']
  const SFX_TENS = ['', 'da', 'de', 'da', 'ta', 'de']
  const sfx = last ? SFX_ONES[last] : SFX_TENS[tens] || 'da'
  return `${String(h).padStart(2, '0')}.${String(mm).padStart(2, '0')}'${sfx}`
}
