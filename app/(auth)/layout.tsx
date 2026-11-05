import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { canEnter } from '@/lib/access'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser()
  if (u) redirect(!canEnter(u.status, u.admin) ? '/beklemede' : u.onboarded ? '/' : '/kurulum')
  return (
    <main className="min-h-dvh max-w-md mx-auto px-5 safe-top pb-10 flex flex-col">
      <div className="pt-6 pb-8 flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-acc text-acc-ink flex items-center justify-center num font-bold text-[15px]">Dg</span>
        <span className="num font-bold text-[18px] tracking-wide text-acc">DgFit</span>
      </div>
      {children}
    </main>
  )
}
