import 'server-only'
// P-7 tarif linki: sayfayı güvenli biçimde indirir (SSRF korumalı), malzemeleri besinlerle eşler.
import { lookup } from 'node:dns/promises'
import { extractRecipe, isPrivateAddress, parseIngredient, recipeUrlOk } from './recipe-import'
import { searchFoods, type FoodHit } from './food-data'

export interface ImportedIng { text: string; name: string; grams: number | null; food: Pick<FoodHit, 'id' | 'name' | 'sub' | 'per100' | 'kcal'> | null }
const MAX_BYTES = 2_000_000

async function safeFetch(raw: string): Promise<string> {
  let url = recipeUrlOk(raw)
  for (let hop = 0; hop < 4; hop++) {
    if (!url) throw new Error('Yalnızca https ile başlayan herkese açık tarif adresleri desteklenir')
    const addrs = await lookup(url.hostname, { all: true }).catch(() => [])
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('Bu adrese erişilemiyor')
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'DgFit tarif içe aktarma', Accept: 'text/html' } })
    if (r.status >= 300 && r.status < 400) { const loc = r.headers.get('location'); url = loc ? recipeUrlOk(new URL(loc, url).toString()) : null; continue }
    if (!r.ok) throw new Error(`Sayfa açılamadı (${r.status})`)
    if (!/text\/html|application\/xhtml/.test(r.headers.get('content-type') ?? '')) throw new Error('Bu adres bir web sayfası değil')
    const reader = r.body?.getReader()
    if (!reader) throw new Error('Sayfa boş')
    const chunks: Uint8Array[] = []; let size = 0
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_BYTES) { await reader.cancel(); break } chunks.push(value) }
    return new TextDecoder().decode(Buffer.concat(chunks))
  }
  throw new Error('Çok fazla yönlendirme')
}

export async function importRecipeFromUrl(userId: string, raw: string): Promise<{ name: string; servings: number | null; ingredients: ImportedIng[] }> {
  const html = await safeFetch(raw)
  const rec = extractRecipe(html)
  if (!rec) throw new Error('Sayfada tarif bilgisi (malzeme listesi) bulunamadı. Malzemeleri elle ekleyebilirsin.')
  const ingredients: ImportedIng[] = []
  for (const line of rec.ingredients.slice(0, 40)) {
    const p = parseIngredient(line)
    const hit = (await searchFoods(userId, p.name, 5)).find((h) => !h.partial) ?? null
    let grams = p.grams
    if (grams === null && hit && p.qty !== null) {
      // "1 adet soğan" → besinin adet/orta porsiyonu
      const por = hit.portions.find((x) => /adet|orta|tane|dilim/i.test(x.label)) ?? hit.portions.find((x) => x.label !== '100 g' && x.label !== '100 ml')
      if (por) grams = Math.round(por.g * p.qty)
    }
    ingredients.push({ text: line, name: p.name, grams, food: hit ? { id: hit.id, name: hit.name, sub: hit.sub, per100: hit.per100, kcal: hit.kcal } : null })
  }
  return { name: rec.name, servings: rec.servings, ingredients }
}
