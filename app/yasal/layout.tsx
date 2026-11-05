import { TopBar } from '@/components/ui'
import { legalProse } from '@/components/legal'
export default function L({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh max-w-md mx-auto px-4 pb-12">
      <TopBar back="/kayit" title="DgFit" />
      <article className={`mt-6 ${legalProse}`}>{children}</article>
    </main>
  )
}
