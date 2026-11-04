// "Az önce 300 ml su içtim" gibi Türkçe cümleleri su kaydına çevirir. Saf, testli (tests/water-speech.test.ts).
import type { DrinkId } from './water.ts'

export interface SpeechContext {
  nowMin: number
  sipMl: number
  containers: { name: string; kind: string; capacityMl: number }[]
}

export interface ParsedWater {
  ml: number
  drink: DrinkId
  /** gün içi dakika; null = şimdi */
  atMin: number | null
  label: string // kullanıcıya gösterilecek özet
}

const ONES: Record<string, number> = { sıfır: 0, bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9 }
const TENS: Record<string, number> = { on: 10, yirmi: 20, otuz: 30, kırk: 40, elli: 50, altmış: 60, yetmiş: 70, seksen: 80, doksan: 90 }

function norm(t: string) {
  return t.toLocaleLowerCase('tr-TR').replace(/[’'`]/g, "'").replace(/[!?;]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Yazıyla sayıları rakama çevirir: "üç yüz elli" → "350", "bir buçuk" → "1.5", "yarım" → "0.5" */
export function wordsToNumbers(text: string): string {
  const toks = text.split(' ')
  const out: string[] = []
  let i = 0
  while (i < toks.length) {
    const raw = toks[i]
    const t = raw.replace(/[.,]$/, '')
    const isNumWord = (w: string) => w in ONES || w in TENS || w === 'yüz' || w === 'bin'
    if (isNumWord(t)) {
      let total = 0, cur = 0, j = i
      while (j < toks.length) {
        const w = toks[j].replace(/[.,]$/, '')
        if (w in ONES) cur += ONES[w]
        else if (w in TENS) cur += TENS[w]
        else if (w === 'yüz') cur = (cur || 1) * 100
        else if (w === 'bin') { total += (cur || 1) * 1000; cur = 0 }
        else break
        j++
      }
      let v = total + cur
      if (toks[j] === 'buçuk') { v += 0.5; j++ }
      out.push(String(v))
      i = j
    } else if (t === 'yarım') { out.push('0.5'); i++ }
    else if (t === 'çeyrek') { out.push('0.25'); i++ }
    else { out.push(raw); i++ }
  }
  return out.join(' ')
}

const DRINK_WORDS: [RegExp, DrinkId][] = [
  [/maden suyu|soda/, 'mineral'],
  [/meyve suyu|portakal suyu|vişne suyu/, 'juice'],
  [/kahve|nescafe|espresso|latte/, 'coffee'],
  [/(^| )çay/, 'tea'],
  [/ayran/, 'ayran'],
]

export function parseWaterSpeech(input: string, ctx: SpeechContext): ParsedWater | null {
  let t = norm(input)
  if (!t) return null
  let drink: DrinkId = 'water'
  for (const [re, d] of DRINK_WORDS) if (re.test(t)) { drink = d; break }
  t = wordsToNumbers(t).replace(/(\d),(\d)/g, '$1.$2')

  // Zaman
  let atMin: number | null = null
  let m: RegExpMatchArray | null
  if ((m = t.match(/(\d+(?:\.\d+)?) (dakika|dk) önce/))) atMin = ctx.nowMin - Math.round(Number(m[1]))
  else if ((m = t.match(/(\d+(?:\.\d+)?) saat önce/))) atMin = ctx.nowMin - Math.round(Number(m[1]) * 60)
  else if (/yarım saat önce|0\.5 saat önce/.test(t)) atMin = ctx.nowMin - 30
  else if ((m = t.match(/saat (\d{1,2})(?:[:.](\d{2}))?(?:'?(?:de|da|te|ta))?/))) {
    let h = Number(m[1]); const min = Number(m[2] ?? 0)
    // "saat 2'de" öğleden sonra kastedilmiş olabilir: şu andan ileri değilse ve 12 eklenince geçmişte kalıyorsa
    if (h < 12 && h * 60 + min < ctx.nowMin - 6 * 60 && (h + 12) * 60 + min <= ctx.nowMin) h += 12
    if (h <= 23 && min <= 59) atMin = h * 60 + min
  }
  if (atMin !== null) { atMin = Math.max(0, atMin); if (atMin > ctx.nowMin) atMin = null }
  // zaman ifadelerindeki sayılar miktarla karışmasın
  const tq = t.replace(/\d+(?:\.\d+)? (dakika|dk|saat) önce/g, ' ').replace(/saat \d{1,2}(?:[:.]\d{2})?('?(de|da|te|ta))?/g, ' ').replace(/yarım saat önce/g, ' ')

  const cap = (kind: string, fallback: number) => ctx.containers.find((c) => c.kind === kind)?.capacityMl ?? fallback
  const named = ctx.containers.find((c) => tq.includes(c.name.toLocaleLowerCase('tr-TR')) && !['bardak', 'şişe', 'termos', 'kupa'].includes(c.name.toLocaleLowerCase('tr-TR')))
  const units: [RegExp, (n: number) => number, string][] = [
    [/(\d+(?:\.\d+)?) ?(ml|mililitre|cc)\b/, (n) => n, 'ml'],
    [/(\d+(?:\.\d+)?) ?(litre|lt|l)\b/, (n) => n * 1000, 'litre'],
    [/(\d+(?:\.\d+)?) ?çay bardağı/, (n) => n * 100, 'çay bardağı'],
    [/(\d+(?:\.\d+)?) ?(su )?bardağ?[ıi]?k?/, (n) => n * cap('glass', 200), 'bardak'],
    [/(\d+(?:\.\d+)?) ?şişe/, (n) => n * cap('bottle', 500), 'şişe'],
    [/(\d+(?:\.\d+)?) ?termos/, (n) => n * cap('thermos', 750), 'termos'],
    [/(\d+(?:\.\d+)?) ?(kupa|fincan)/, (n) => n * cap('cup', 250), 'kupa'],
    [/(\d+(?:\.\d+)?) ?yudum/, (n) => n * ctx.sipMl, 'yudum'],
  ]
  let ml = 0, unit = ''
  for (const [re, f, u] of units) {
    const mm = tq.match(re)
    if (mm) { ml = f(Number(mm[1])); unit = u; break }
  }
  if (!ml && named) {
    const mm = tq.match(/(\d+(?:\.\d+)?) /)
    ml = (mm && Number(mm[1]) <= 5 ? Number(mm[1]) : 1) * named.capacityMl
    unit = named.name
  }
  if (!ml) {
    // birimsiz: "bir bardak" yerine "bardak", "şişemi bitirdim"
    if (/şişe(mi|yi)? bitirdim|şişe/.test(tq)) { ml = cap('bottle', 500); unit = 'şişe' }
    else if (/termos/.test(tq)) { ml = cap('thermos', 750); unit = 'termos' }
    else if (/bardak/.test(tq)) { ml = /çay bardağı/.test(tq) ? 100 : cap('glass', 200); unit = 'bardak' }
    else if (/yudum/.test(tq)) { ml = ctx.sipMl; unit = 'yudum' }
    else { const mm = tq.match(/(\d{2,4})/); if (mm && Number(mm[1]) >= 30) { ml = Number(mm[1]); unit = 'ml' } }
  }
  ml = Math.round(ml)
  if (!(ml >= 5 && ml <= 3000)) return null
  const when = atMin === null ? 'şimdi' : `${String(Math.floor(atMin / 60)).padStart(2, '0')}.${String(atMin % 60).padStart(2, '0')}`
  return { ml, drink, atMin, label: `${ml} ml ${drinkLabel(drink)} · ${when}${unit && unit !== 'ml' ? ` (${unit})` : ''}` }
}

function drinkLabel(d: DrinkId) {
  return { water: 'su', mineral: 'maden suyu', tea: 'çay', coffee: 'kahve', ayran: 'ayran', juice: 'meyve suyu', other: 'içecek' }[d]
}
