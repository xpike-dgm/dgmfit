import Link from 'next/link'

/** AI sağlayıcısı yokken her ekranda aynı açıklama ve bir alternatif yol. */
export default function AiOff({ what, alt }: { what: string; alt?: { href: string; label: string } }) {
  return (
    <div role="note" className="rounded-2xl bg-warn-bg border border-warn-line px-4 py-3 text-[13px] leading-relaxed text-warn" data-testid="ai-off">
      <b>{what} şu an kullanılamıyor.</b> AI hizmeti bağlı değil ya da günlük hakkın doldu. Diğer özellikler normal çalışır.
      {alt ? <> <Link href={alt.href} className="font-bold underline underline-offset-2">{alt.label}</Link></> : null}
    </div>
  )
}
