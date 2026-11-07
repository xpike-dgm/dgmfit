// P-7 tarif linkinden içe aktarma (saf kısım; tests/recipe-import.test.ts):
//  - sayfadaki schema.org Recipe (JSON-LD) → ad, porsiyon, malzeme satırları
//  - Türkçe malzeme satırı → miktar + ölçü + ad + (biliniyorsa) gram
//  - adres güvenliği: yalnızca https, varsayılan port, özel/yerel IP yok (SSRF)

export interface LdRecipe { name: string; servings: number | null; ingredients: string[] }

function asArray<T>(v: T | T[] | undefined | null): T[] { return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v] }
const isRecipe = (o: Record<string, unknown>) => asArray(o['@type'] as string | string[]).some((t) => String(t).toLowerCase() === 'recipe')

/** HTML içindeki JSON-LD bloklarından ilk Recipe nesnesi. */
export function extractRecipe(html: string): LdRecipe | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (let m = re.exec(html); m; m = re.exec(html)) {
    let data: unknown
    try { data = JSON.parse(m[1].trim()) } catch { continue }
    const queue: unknown[] = asArray(data as unknown[])
    while (queue.length) {
      const o = queue.shift()
      if (!o || typeof o !== 'object') continue
      const r = o as Record<string, unknown>
      if (r['@graph']) queue.push(...asArray(r['@graph'] as unknown[]))
      if (!isRecipe(r)) continue
      const ings = asArray(r.recipeIngredient as string[] ?? r.ingredients as string[]).map((x) => decode(String(x)).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 60)
      if (!ings.length) continue
      const y = asArray(r.recipeYield as (string | number)[]).map((x) => Number(String(x).match(/\d+/)?.[0])).find((n) => n > 0 && n <= 50) ?? null
      return { name: decode(String(r.name ?? '')).trim().slice(0, 80) || 'İçe aktarılan tarif', servings: y, ingredients: ings }
    }
  }
  return null
}

function decode(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

// not: JS \b yalnızca ASCII harfleri tanır ("bardağı" sonunda çalışmaz) → sınır için ileri bakış
/** Ölçü → gram (yoğunluk: sıvı ≈ 1). `dry` kuru malzeme için su bardağı/kaşık gramları. */
const UNITS: { re: RegExp; unit: string; g: number | null; dry?: Record<string, number> }[] = [
  { re: /^(kg|kilo(gram)?)(?=[\s.,;:]|$)/i, unit: 'kg', g: 1000 },
  { re: /^(g|gr|gram)(?=[\s.,;:]|$)\.?/i, unit: 'g', g: 1 },
  { re: /^(lt|l|litre)(?=[\s.,;:]|$)/i, unit: 'l', g: 1000 },
  { re: /^ml(?=[\s.,;:]|$)/i, unit: 'ml', g: 1 },
  { re: /^su bardağı(?=[\s.,;:]|$)|^sb(?=[\s.,;:]|$)/i, unit: 'su bardağı', g: 200, dry: { un: 120, pirinç: 180, bulgur: 170, şeker: 180, mercimek: 190, nohut: 180, yulaf: 90, irmik: 160, 'toz şeker': 180 } },
  { re: /^çay bardağı(?=[\s.,;:]|$)/i, unit: 'çay bardağı', g: 100, dry: { un: 60, pirinç: 90, bulgur: 85, şeker: 90, mercimek: 95, irmik: 80 } },
  { re: /^(yemek kaşığı|yk|y\.k\.)(?=[\s.,;:]|$)/i, unit: 'yemek kaşığı', g: 15, dry: { un: 10, salça: 20, şeker: 12, yağ: 13, tereyağı: 14, yoğurt: 20 } },
  { re: /^(tatlı kaşığı|tk)(?=[\s.,;:]|$)/i, unit: 'tatlı kaşığı', g: 6, dry: { tuz: 7, şeker: 6 } },
  { re: /^(çay kaşığı|çk)(?=[\s.,;:]|$)/i, unit: 'çay kaşığı', g: 3, dry: { tuz: 4 } },
  { re: /^(kahve fincanı)(?=[\s.,;:]|$)/i, unit: 'kahve fincanı', g: 70 },
  { re: /^demet(?=[\s.,;:]|$)/i, unit: 'demet', g: 50 },
  { re: /^diş(?=[\s.,;:]|$)/i, unit: 'diş', g: 5 },
  { re: /^tutam(?=[\s.,;:]|$)/i, unit: 'tutam', g: 1 },
  { re: /^(adet|tane)(?=[\s.,;:]|$)/i, unit: 'adet', g: null },
  { re: /^(dilim)(?=[\s.,;:]|$)/i, unit: 'dilim', g: null },
  { re: /^(paket)(?=[\s.,;:]|$)/i, unit: 'paket', g: null },
]
const WORDS: [RegExp, number][] = [[/^yarım(?=[\s.,;:]|$)/i, 0.5], [/^çeyrek(?=[\s.,;:]|$)/i, 0.25], [/^bir(?=[\s.,;:]|$)/i, 1], [/^iki(?=[\s.,;:]|$)/i, 2], [/^üç(?=[\s.,;:]|$)/i, 3], [/^dört(?=[\s.,;:]|$)/i, 4], [/^beş(?=[\s.,;:]|$)/i, 5], [/^birkaç(?=[\s.,;:]|$)/i, 2]]

export interface ParsedIng { text: string; qty: number | null; unit: string | null; name: string; grams: number | null }

/** "1,5 su bardağı pirinç (yıkanmış)" → { qty: 1.5, unit: 'su bardağı', name: 'pirinç', grams: 270 } */
export function parseIngredient(text: string): ParsedIng {
  let s = text.toLocaleLowerCase('tr-TR').replace(/\(.*?\)/g, ' ').replace(/[*•·–-]\s/g, ' ').replace(/\s+/g, ' ').trim()
  let qty: number | null = null
  const frac = s.match(/^(\d+)\s+(\d)\/(\d)\b/) ?? null
  const m = frac ? null : s.match(/^(\d)\/(\d)(?!\d)|^(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?|^([½¼¾])/)
  if (frac) { qty = Number(frac[1]) + Number(frac[2]) / Number(frac[3]); s = s.slice(frac[0].length) }
  else if (m) {
    if (m[1]) qty = Number(m[1]) / Number(m[2])
    else if (m[3]) qty = m[4] ? (Number(m[3].replace(',', '.')) + Number(m[4].replace(',', '.'))) / 2 : Number(m[3].replace(',', '.'))
    else if (m[5]) qty = { '½': 0.5, '¼': 0.25, '¾': 0.75 }[m[5]]!
    s = s.slice(m[0].length)
  } else for (const [re, v] of WORDS) if (re.test(s)) { qty = v; s = s.replace(re, ''); break }
  s = s.trim().replace(/^buçuk(?=\s|$)\s*/, () => { if (qty !== null) qty += 0.5; return '' })
  let unit: string | null = null, perUnit: number | null = null, dry: Record<string, number> | undefined
  for (const u of UNITS) { const mm = s.match(u.re); if (mm) { unit = u.unit; perUnit = u.g; dry = u.dry; s = s.slice(mm[0].length).trim(); break } }
  const name = s.replace(/^(dolusu|kadar|silme|tepeleme)\s+/, '').replace(/[,.;:]+$/, '').trim()
  if (dry) for (const [k, g] of Object.entries(dry)) if (name.includes(k)) { perUnit = g; break }
  const grams = qty !== null && perUnit !== null ? Math.round(qty * perUnit) : unit === null && qty === null ? null : null
  return { text, qty, unit, name: name || text, grams }
}

/** IPv4/IPv6 adresi özel, yerel ya da ayrılmış mı (SSRF koruması). */
export function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, '')
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) {
    const [a, b] = v.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
}

/** Tarif adresi biçim denetimi (DNS denetimi sunucu tarafında ayrıca yapılır). */
export function recipeUrlOk(raw: string): URL | null {
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  if (u.protocol !== 'https:' || u.port || u.username || u.password) return null
  const h = u.hostname
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) return null
  return u
}
