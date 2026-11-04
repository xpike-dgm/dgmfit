import BottomNav from '@/components/BottomNav'
import { requireUser } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return (
    <div className="max-w-md mx-auto min-h-dvh pb-[120px] safe-top">
      {children}
      <BottomNav />
    </div>
  )
}
