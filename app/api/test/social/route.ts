import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getUser } from '@/lib/auth'
import { db, schema } from '@/lib/db'

/**
 * Yalnızca DGFIT_TEST_HOOKS=1 ile (canlıda 404). `records`: hareket anahtarı + kg → rekor kaydı (vitrin testi için).
 * `recipe`: kullanıcıya basit bir tarif besini ekler ve kimliğini döndürür.
 */
export async function POST(req: Request) {
  if (process.env.DGFIT_TEST_HOOKS !== '1') return new NextResponse(null, { status: 404 })
  const u = await getUser()
  if (!u) return NextResponse.json({ error: 'oturum yok' }, { status: 401 })
  const { records = [], recipe = false } = (await req.json().catch(() => ({}))) as { records?: { key: string; kg: number }[]; recipe?: boolean }
  for (const r of records.slice(0, 5)) {
    const [x] = await db.select({ id: schema.exercises.id }).from(schema.exercises).where(eq(schema.exercises.key, r.key)).limit(1)
    if (!x) continue
    const rec = { kg: r.kg, e1rm: Math.round(r.kg * 1.17), rm3: 0, rm5: r.kg, rm10: 0, reps: 5, volume: r.kg * 15 }
    await db.insert(schema.exerciseRecords).values({ userId: u.id, exerciseId: x.id, records: rec }).onConflictDoUpdate({ target: [schema.exerciseRecords.userId, schema.exerciseRecords.exerciseId], set: { records: rec } })
    await db.insert(schema.personalRecords).values([{ userId: u.id, exerciseId: x.id, type: 'kg', value: r.kg - 10, previous: null, createdAt: new Date(Date.now() - 14 * 86400000) }, { userId: u.id, exerciseId: x.id, type: 'kg', value: r.kg, previous: r.kg - 10 }])
  }
  let recipeId: number | null = null
  if (recipe) {
    const per100 = { kcal: 120, protein: 8, carb: 12, fat: 4 }
    const [f] = await db.insert(schema.foods).values({ source: 'user-recipe', sourceId: crypto.randomUUID(), userId: u.id, nameTr: 'Test yulaf kasesi', category: 'Kendi tarifim', per100, kcal: 120, protein: 8, carb: 12, fat: 4,
      portions: [{ label: '1 porsiyon (250 g)', g: 250 }, { label: '100 g', g: 100 }], recipe: { yield: 500, raw: 500, servings: 2, ingredients: [{ foodId: null, name: 'Yulaf ezmesi', g: 100 }, { foodId: null, name: 'Süt (yarım yağlı)', g: 400 }] }, search: 'test yulaf kasesi', approx: true }).returning({ id: schema.foods.id })
    recipeId = f.id
  }
  return NextResponse.json({ ok: true, recipeId })
}
