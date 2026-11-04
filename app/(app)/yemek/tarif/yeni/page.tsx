import { requireUser } from '@/lib/auth'
import RecipeBuilder from './RecipeBuilder'

export const metadata = { title: 'Yeni tarif' }

export default async function Page(props: { searchParams: Promise<{ ogun?: string; gun?: string }> }) {
  await requireUser()
  const sp = await props.searchParams
  const qs = new URLSearchParams()
  if (sp.ogun) qs.set('ogun', sp.ogun)
  if (sp.gun) qs.set('gun', sp.gun)
  return <RecipeBuilder back={`/yemek/ekle?${qs}`} />
}
