import 'server-only'
import { searchFoods } from '../food-data'
import { macrosFor } from '../food'
import type { Nutrients } from '../nutrition'
import type { MealResult } from './schemas'

export interface MealProposal {
  name: string; grams: number; portion: string | null; drink: string | null; confidence: 'yüksek' | 'orta' | 'düşük'
  candidates: { id: number; name: string; sub: string | null; per100: Nutrients; kcal: number; protein: number; carb: number; fat: number }[]
}

/**
 * AI'nin çıkardığı kalemleri besin veritabanıyla eşleştirir. Kalori ve makrolar veritabanındaki 100 g değerlerinden,
 * modelin tahmin ettiği gramla motor tarafından hesaplanır (model sayı uydurmaz).
 */
export async function matchMeal(userId: string, r: MealResult): Promise<MealProposal[]> {
  const out: MealProposal[] = []
  for (const it of r.items) {
    const hits = (await searchFoods(userId, it.name, 5)).filter((x) => !x.partial).slice(0, 3)
    out.push({
      name: it.name, grams: Math.round(it.grams), portion: it.portion, drink: it.drink, confidence: it.confidence,
      candidates: hits.map((h) => ({ id: h.id, name: h.name, sub: h.sub, per100: h.per100 as Nutrients, ...macrosFor(h.per100 as Nutrients, it.grams) })),
    })
  }
  return out
}
