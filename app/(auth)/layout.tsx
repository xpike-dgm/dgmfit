import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const u = await getUser()
  if (u) redirect(u.onboarded ? '/' : '/kurulum')
  return (
    <main className="min-h-dvh max-w-md mx-auto px-5 safe-top pb-10 flex flex-col">
      <div className="pt-6 pb-8 flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-lime text-lime-ink flex items-center justify-center num font-bold text-[15px]">Dg</span>
        <span className="num font-bold text-[18px] tracking-wide text-lime">DgFit</span>
      </div>
      {children}
    </main>
  )
}
