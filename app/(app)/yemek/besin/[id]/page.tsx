import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getUserFood } from '@/lib/food-data'
import { foodUnit, isBasePortion } from '@/lib/food'
import CreateFood from '../yeni/CreateFood'

export const metadata = { title: 'Besini düzenle' }

/** G1: Besinlerim → düzenle. Değerler 100 g / 100 ml başına gösterilir. */
export default async function Page(props: { params: Promise<{ id: string }>; searchParams: Promise<{ ogun?: string; gun?: string }> }) {
  const u = await requireUser()
  const { id } = await props.params
  const sp = await props.searchParams
  const f = Number.isSafeInteger(Number(id)) ? await getUserFood(u.id, Number(id)) : null
  if (!f) notFound()
  const qs = new URLSearchParams({ sekme: 'mine' })
  if (sp.ogun) qs.set('ogun', sp.ogun)
  if (sp.gun) qs.set('gun', sp.gun)
  const serving = f.portions.find((p) => !isBasePortion(p.label)) ?? null
  const s = (x: number | undefined) => (x === undefined || x === null ? '' : String(x).replace('.', ','))
  const p = f.per100
  return (
    <CreateFood back={`/yemek/ekle?${qs}`} editId={f.id} name={f.nameTr ?? ''} barcode={f.barcode ?? ''}
      initial={{ brand: f.brand ?? '', unit: foodUnit(f.portions), servingG: serving ? s(serving.g) : '', servingLabel: serving?.label ?? '', kcal: s(p.kcal), protein: s(p.protein), carb: s(p.carb), fat: s(p.fat), fiber: s(p.fiber), sugar: s(p.sugar), satFat: s(p.satFat), sodium: s(p.sodium) }} />
  )
}
