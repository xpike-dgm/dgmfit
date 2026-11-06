/** Kasa dokununca hemen gösterilir (hareket akışı sunucuda hazırlanırken). */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-30 bg-black text-white flex flex-col items-center justify-center gap-3" role="status" aria-label="Hareketler yükleniyor">
      <span className="w-10 h-10 rounded-full border-[3px] border-white/25 border-t-white animate-spin" />
      <span className="text-[13px] text-white/70">Hareketler yükleniyor…</span>
    </div>
  )
}
