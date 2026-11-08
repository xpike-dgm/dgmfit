'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resetLayoutAction } from './actions'
import { ask } from '@/components/Confirm'

/** Ekranı varsayılan düzene döndürür (uygulama içi onayla). Düzen sayfasındaki ekran kutusunda küçük yuvarlak düğme. */
export default function ResetButton({ screen }: { screen: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <button type="button" disabled={pending} aria-label="Varsayılana dön" title="Varsayılana dön"
      onClick={async () => { if (await ask('Bu ekran varsayılan düzene dönsün mü?')) start(async () => { await resetLayoutAction(screen); router.refresh() }) }}
      className="w-9 h-9 rounded-full bg-surface-2 border border-line-2 text-ink-2 inline-flex items-center justify-center shrink-0 disabled:opacity-40" data-testid="studio-reset">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8" /><path d="M3 3v5h5" /></svg>
    </button>
  )
}
