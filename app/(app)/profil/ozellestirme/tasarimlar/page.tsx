import { requireUser } from '@/lib/auth'
import { listDesigns, listVersions } from '@/lib/cards/designs-data'
import { TopBar } from '@/components/ui'
import MiniPreview from '@/components/cards/MiniPreview'
import Designs from './Designs'

export const metadata = { title: 'Tasarımlarım' }

/** Ö3a: Tasarımlarım — birden çok tasarım, etkinleştirme, kopya, ad, silme; etkin tasarımın sürümleri ve geri yükleme. */
export default async function Page() {
  const u = await requireUser()
  const ds = await listDesigns(u.id)
  const active = ds.find((d) => d.active)
  const versions = active ? await listVersions(u.id, active.id) : []
  return (
    <div className="px-4 flex flex-col gap-3">
      <TopBar back="/profil/ozellestirme" title="Tasarımlarım" sub="Tasarımlar arasında geç, eski sürüme dön" />
      <Designs
        designs={ds.map((d) => ({ id: d.id, name: d.name, active: d.active, updatedAt: d.updatedAt.toISOString(), summary: `${d.screens} ekran · ${d.modules} renk · ${d.rules} kural`, preview: <MiniPreview design={d.design} width={64} label={`${d.name} önizlemesi`} /> }))}
        versions={versions.map((v) => ({ id: v.id, note: v.note, at: v.createdAt.toISOString() }))} />
    </div>
  )
}
