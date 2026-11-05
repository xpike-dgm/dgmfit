import { TopBar } from '@/components/ui'
export default function L({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh max-w-md mx-auto px-4 pb-12">
      <TopBar back="/kayit" title="DgFit" />
      <article className="mt-6 flex flex-col gap-4 text-[15px] leading-relaxed text-ink-2 [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:text-ink [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink">{children}</article>
    </main>
  )
}
