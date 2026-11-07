// Ö5b: Bugün'de bandın altındaki mod kartı — odak modunun notu, Ramazan'da oruç/iftar durumu ve iftar sonrası protein.
import Link from 'next/link'
import { fasting, focusOn, postIftarProtein, ramadanOn, untilNext, type ModeState } from '@/lib/modes'

const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} sa ${m % 60 ? `${m % 60} dk` : ''}`.trim() : `${m} dk`)

export default function ModeCard({ s, day, nowMin, protein }: { s: ModeState; day: string; nowMin: number; protein: { eaten: number; target: number } }) {
  const f = focusOn(s, day)
  const r = ramadanOn(s, day)
  if (!f && !r) return null
  const fast = r && fasting(nowMin, s.sahur, s.iftar)
  const next = r ? untilNext(nowMin, s.sahur, s.iftar) : null
  const pro = r && !fast ? postIftarProtein(nowMin, s.iftar, protein.eaten, protein.target) : null
  return (
    <section aria-label="Etkin mod" className="card p-4 flex flex-col gap-2 border-l-4 border-acc" data-testid="mode-card">
      {f ? (
        <div className="flex items-start gap-2.5" data-mode={f.id}>
          <span className="text-[22px] leading-none" aria-hidden>{f.emoji}</span>
          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
            <b className="text-[14.5px]">{f.label} modu{s.focusUntil ? <span className="text-[12px] text-mute font-normal"> · {new Date(s.focusUntil + 'T12:00:00Z').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' })} tarihine kadar</span> : null}</b>
            <span className="text-[13px] text-ink-2 leading-snug" data-testid="mode-note">{f.note}</span>
          </span>
        </div>
      ) : null}
      {r ? (
        <div className={`flex flex-col gap-1 ${f ? 'border-t border-line pt-2' : ''}`} data-testid="ramadan-card">
          <span className="flex items-center justify-between gap-2"><b className="text-[14.5px]">🌙 Ramazan</b><span className="text-[12px] text-mute num">Sahur {s.sahur} · İftar {s.iftar}</span></span>
          <span className="text-[13px] text-ink-2" data-testid="ramadan-status">{fast ? `Oruçlusun · iftara ${dur(next!.min)}. Hatırlatmalar iftara kadar sessiz.` : `İftar–sahur arası · sahura ${dur(next!.min)}. Su hedefini bu pencerede tamamla.`}</span>
          {pro ? <Link href="/yemek/ekle?ogun=dinner" className="mt-1 rounded-xl bg-surface-2 px-3 py-2 text-[13px] flex items-center justify-between gap-2" data-testid="iftar-protein"><span>İftar sonrası protein: <b className="num">{pro} g</b> kaldı</span><span className="text-acc font-bold shrink-0">Ekle ›</span></Link> : null}
        </div>
      ) : null}
      <Link href="/profil/ozellestirme/modlar" className="self-start text-[12.5px] font-bold text-acc">Modu değiştir</Link>
    </section>
  )
}
