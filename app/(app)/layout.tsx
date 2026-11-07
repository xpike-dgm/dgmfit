import BottomNav from '@/components/BottomNav'
import ModShell from '@/components/ModShell'
import { DesignPrefsProvider } from '@/components/cards/DesignPrefs'
import { requireUser } from '@/lib/auth'
import { activeDesign } from '@/lib/cards/design-data'
import { normalizePrefs, resolveNav } from '@/lib/cards/prefs'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser()
  // Özelleştirme Ö1b-2: alt bar düzeni ve kullanım tercihleri tasarımdan gelir (istek başına tek sorgu, sayfa ile paylaşılır)
  const d = await activeDesign(u.id).catch(() => null)
  const prefs = normalizePrefs(d?.prefs ?? {})
  return (
    <ModShell className="max-w-md mx-auto min-h-dvh pb-[110px]" hand={prefs.hand ?? null}>
      <DesignPrefsProvider value={prefs}>{children}</DesignPrefsProvider>
      <BottomNav tabs={resolveNav(d?.nav).visible} hand={prefs.hand ?? null} />
    </ModShell>
  )
}
