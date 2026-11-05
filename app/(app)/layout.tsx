import BottomNav from '@/components/BottomNav'
import ModShell from '@/components/ModShell'
import { requireUser } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return (
    <ModShell className="max-w-md mx-auto min-h-dvh pb-[110px]">
      {children}
      <BottomNav />
    </ModShell>
  )
}
