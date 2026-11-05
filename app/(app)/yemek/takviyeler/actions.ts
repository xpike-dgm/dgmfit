'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { addDays, dayString } from '@/lib/time'
import { SUPP_UNITS, suppError, type SuppInput, type SuppUnit } from '@/lib/supplements'
import { createSupplement, deleteSupplement, logServing, unlogServing, updateSupplement } from '@/lib/supplement-data'

type R = { ok: true; id?: number } | { ok: false; error: string }
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : NaN }
const okDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= dayString() && d >= addDays(dayString(), -365)
function refresh() { revalidatePath('/yemek'); revalidatePath('/yemek/takviyeler'); revalidatePath('/') }

function parse(raw: Record<string, unknown>): SuppInput | string {
  const opt = (v: unknown) => (String(v ?? '').trim() === '' ? null : num(v))
  const unit = String(raw.unit ?? '') as SuppUnit
  const i: SuppInput = {
    name: String(raw.name ?? '').slice(0, 80), brand: String(raw.brand ?? '').trim().slice(0, 60) || null, unit: SUPP_UNITS.includes(unit) ? unit : ('' as SuppUnit),
    servingG: opt(raw.servingG), kcal: num(raw.kcal || 0), protein: num(raw.protein || 0), carb: num(raw.carb || 0), fat: num(raw.fat || 0),
    extras: (Array.isArray(raw.extras) ? raw.extras : []).slice(0, 20).map((e: { name?: unknown; amount?: unknown; unit?: unknown }) => ({ name: String(e?.name ?? '').slice(0, 40), amount: num(e?.amount), unit: String(e?.unit ?? '') })).filter((e) => e.name.trim() || e.amount),
    daily: opt(raw.daily),
  }
  return suppError(i) ?? i
}

export async function saveSupplementAction(id: number | null, raw: Record<string, unknown>): Promise<R> {
  const u = await requireUser()
  const i = parse(raw)
  if (typeof i === 'string') return { ok: false, error: i }
  if (id === null) { const nid = await createSupplement(u.id, i); refresh(); return { ok: true, id: nid } }
  if (!(await updateSupplement(u.id, id, i))) return { ok: false, error: 'Takviye bulunamadı' }
  refresh(); return { ok: true, id }
}
export async function deleteSupplementAction(id: number): Promise<R> {
  const u = await requireUser()
  if (!(await deleteSupplement(u.id, id))) return { ok: false, error: 'Takviye bulunamadı' }
  refresh(); return { ok: true }
}
export async function servingAction(id: number, day: string, delta: 1 | -1 | 0.5): Promise<R> {
  const u = await requireUser()
  if (!okDay(day)) return { ok: false, error: 'Geçersiz gün' }
  const ok = delta === -1 ? await unlogServing(u.id, id, day) : await logServing(u.id, id, day, delta)
  if (!ok) return { ok: false, error: delta === -1 ? 'Geri alınacak kayıt yok' : 'Takviye bulunamadı' }
  refresh(); return { ok: true }
}
