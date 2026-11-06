/** P-4: sekmeler arası geçişte sunucu yanıtı beklenirken iskelet (sayfa düzenine benzer kartlar). */
export default function Loading() {
  return (
    <div className="px-4 pt-5 space-y-3" aria-busy="true" data-testid="skeleton">
      <span className="sr-only">Yükleniyor…</span>
      <div className="h-7 w-40 rounded-lg bg-[var(--color-surface-2)] animate-pulse" />
      <div className="h-36 rounded-2xl bg-[var(--color-surface-2)] animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-[var(--color-surface-2)] animate-pulse" />
        <div className="h-24 rounded-2xl bg-[var(--color-surface-2)] animate-pulse" />
      </div>
      <div className="h-20 rounded-2xl bg-[var(--color-surface-2)] animate-pulse" />
      <div className="h-20 rounded-2xl bg-[var(--color-surface-2)] animate-pulse" />
    </div>
  )
}
