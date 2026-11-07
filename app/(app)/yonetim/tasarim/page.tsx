import { requireAdmin } from '@/lib/admin'
import { contestPage, layoutDefaults, listAnnouncements } from '@/lib/cards/community-data'
import { SCREENS, type ScreenId } from '@/lib/cards/registry'
import { TopBar } from '@/components/ui'
import AdminDesign from './AdminDesign'

export const metadata = { title: 'Tasarım yönetimi' }

/** Ö3c: yönetim — haftalık yarışma teması, duyuru kartı, özelleştirmemiş herkes için varsayılan düzen. */
export default async function Page() {
  const u = await requireAdmin()
  const [c, ann, defs] = await Promise.all([contestPage(u.id), listAnnouncements(), layoutDefaults()])
  return (
    <div className="px-4 flex flex-col gap-3" data-testid="admin-design">
      <TopBar back="/yonetim" title="Tasarım yönetimi" sub="Yarışma, duyuru, varsayılan düzen" />
      <AdminDesign
        contest={c.current ? { theme: c.current.theme, description: c.current.description, entries: c.entries.length } : null}
        announcements={ann.map((a) => ({ id: a.id, title: a.title, active: a.active && (!a.endsAt || a.endsAt > new Date()), endsAt: a.endsAt?.toISOString() ?? null }))}
        screens={(Object.keys(SCREENS) as ScreenId[]).map((s) => ({ id: s, title: SCREENS[s].title, custom: !!defs[s], count: defs[s]?.items.length ?? 0 }))} />
    </div>
  )
}
