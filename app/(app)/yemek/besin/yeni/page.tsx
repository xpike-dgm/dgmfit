import { requireUser } from '@/lib/auth'
import CreateFood from './CreateFood'

export const metadata = { title: 'Yeni besin' }

export default async function Page(props: { searchParams: Promise<{ ad?: string; barkod?: string; ogun?: string; gun?: string }> }) {
  await requireUser()
  const sp = await props.searchParams
  const qs = new URLSearchParams()
  if (sp.ogun) qs.set('ogun', sp.ogun)
  if (sp.gun) qs.set('gun', sp.gun)
  return <CreateFood name={(sp.ad ?? '').slice(0, 80)} barcode={(sp.barkod ?? '').replace(/\D/g, '').slice(0, 14)} back={`/yemek/ekle?${qs}`} />
}
