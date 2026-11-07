'use client'
// Ö5a: kendi kartımın görünümü (kart oluşturucu). Veri sunucuda hesaplanır (lib/cards/custom-data.ts → userCardData);
// takip alanı kartında hızlı kayıt düğmeleri vardır (sayaç +/−, puan 1–5, evet/hayır, ölçüm).
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { TrackerQuick, UserCardData } from '@/lib/cards/custom-data'
import { trackerAction } from '@/app/(app)/profil/ozellestirme/actions'

const fmt = (v: number | null, unit = '') => (v === null ? '—' : `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(v)}${unit ? ` ${unit}` : ''}`)

function Spark({ series }: { series: (number | null)[] }) {
  const pts = series.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null)
  if (pts.length < 2) return <span className="text-[11.5px] text-mute">Grafik için en az 2 gün</span>
  const lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1]))
  const W = 100, H = 28, n = Math.max(1, series.length - 1)
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${((i / n) * W).toFixed(1)},${(H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4)).toFixed(1)}`).join(' ')
  return <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-7" preserveAspectRatio="none" aria-hidden><path d={d} fill="none" stroke="var(--color-acc)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function Bars({ series }: { series: (number | null)[] }) {
  const s = series.slice(-7)
  const hi = Math.max(1, ...s.map((v) => v ?? 0))
  return (
    <span className="flex items-end gap-1 h-8" aria-hidden>
      {s.map((v, i) => <span key={i} className="flex-1 rounded-t-[3px] bg-acc" style={{ height: `${Math.max(6, ((v ?? 0) / hi) * 100)}%`, opacity: v ? 1 : 0.25 }} />)}
    </span>
  )
}

function Quick({ t }: { t: TrackerQuick }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [num, setNum] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const log = (v: number) => start(async () => {
    const r = await trackerAction({ op: 'log', id: t.id, value: v }).catch(() => null)
    if (!r?.ok) setErr(r && !r.ok ? r.error : 'Kaydedilemedi'); else { setErr(null); setNum(''); router.refresh() }
  })
  const b = 'h-9 min-w-9 px-2.5 rounded-full bg-surface-2 border border-line text-[13.5px] font-bold disabled:opacity-50'
  return (
    <span className="flex flex-col gap-1" data-no-hold>
      <span className="flex flex-wrap gap-1.5">
        {t.kind === 'count' ? <>
          <button type="button" className={b} disabled={pending} onClick={() => log(-1)} aria-label="Son kaydı geri al" data-testid="uc-undo">−</button>
          <button type="button" className={`${b} bg-acc text-acc-ink border-acc`} disabled={pending} onClick={() => log(1)} data-testid="uc-plus">{t.emoji} +{t.step}</button>
        </> : t.kind === 'scale' ? [1, 2, 3, 4, 5].map((v) => (
          <button key={v} type="button" className={b} disabled={pending} onClick={() => log(v)} aria-label={`${v} puan`} data-testid={`uc-scale-${v}`}>{v}</button>
        )) : t.kind === 'yesno' ? <>
          <button type="button" className={`${b} bg-acc text-acc-ink border-acc`} disabled={pending} onClick={() => log(1)} data-testid="uc-yes">Evet</button>
          <button type="button" className={b} disabled={pending} onClick={() => log(0)} data-testid="uc-no">Hayır</button>
        </> : (
          <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const v = Number(num.replace(',', '.')); if (Number.isFinite(v) && num) log(v) }}>
            <input value={num} onChange={(e) => setNum(e.target.value)} inputMode="decimal" aria-label="Bugünün değeri" className="w-20 h-9 rounded-full px-3 bg-surface-2 border border-line text-[14px]" data-testid="uc-num" />
            <button type="submit" className={`${b} bg-acc text-acc-ink border-acc`} disabled={pending}>Kaydet</button>
          </form>
        )}
      </span>
      {err ? <span className="text-[12px] text-danger" role="alert">{err}</span> : null}
    </span>
  )
}

export default function UserCardView({ id, data }: { id: string; data: UserCardData }) {
  const box = 'card p-3.5 flex flex-col gap-2 min-w-0 border-t-4 border-acc'
  const head = <b className="text-[13px] font-extrabold truncate" data-testid="uc-title">{data.title}</b>
  if (data.kind === 'missing') return (
    <div className={box} data-testid="user-card" data-uc={id}>{head}<span className="text-[12.5px] text-mute">Bu kartın kaynağı silinmiş.</span>
      <Link href="/profil/ozellestirme/kartlarim" className="text-[12.5px] font-bold text-acc">Kartlarımı düzenle</Link></div>
  )
  if (data.kind === 'quote') return (
    <figure className={`${box} justify-center`} data-testid="user-card" data-uc={id}>
      <span className="text-[11.5px] font-bold text-mute" data-testid="uc-title">{data.title}</span>
      <blockquote className="text-[15px] font-bold leading-snug">“{data.text}”</blockquote>
    </figure>
  )
  if (data.kind === 'countdown') return (
    <div className={box} data-testid="user-card" data-uc={id}>{head}
      <span className="flex items-baseline gap-1"><b className="num text-[26px] leading-none" data-testid="uc-value">{Math.abs(data.days)}</b><span className="text-[12.5px] text-mute">{data.days > 0 ? 'gün kaldı' : data.days === 0 ? 'gün — bugün!' : 'gün geçti'}</span></span>
      <span className="text-[11.5px] text-mute num">{new Date(data.date + 'T12:00:00Z').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' })}</span>
    </div>
  )
  if (data.kind === 'photo') return (
    <figure className="card overflow-hidden relative min-h-[140px] flex" data-testid="user-card" data-uc={id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/media/${data.mediaId}`} alt={data.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      <figcaption className="relative mt-auto w-full px-3 py-2 text-white text-[13px] font-extrabold bg-gradient-to-t from-black/70 to-transparent" data-testid="uc-title">{data.title}</figcaption>
    </figure>
  )
  if (data.kind === 'records') return (
    <div className={box} data-testid="user-card" data-uc={id}>{head}
      {data.records.length ? data.records.map((r) => (
        <span key={r.name} className="flex justify-between gap-2 text-[13px]"><span className="truncate">{r.name}</span><b className="num shrink-0">{fmt(r.value, 'kg')}</b></span>
      )) : <span className="text-[12.5px] text-mute">Henüz rekor yok. İlk antrenmanından sonra burada görünür.</span>}
    </div>
  )
  const pct = data.goal && data.value !== null ? Math.min(1, data.value / data.goal) : null
  return (
    <div className={box} data-testid="user-card" data-uc={id}>
      <span className="flex items-center justify-between gap-2">{head}<span className="text-[11px] text-mute shrink-0">{data.periodLabel}</span></span>
      <span className="flex items-baseline gap-1 flex-wrap"><b className="num text-[22px] leading-none" data-testid="uc-value">{fmt(data.value)}</b><span className="text-[12px] text-mute">{data.unit}{data.goal ? ` / ${fmt(data.goal)}` : ''}</span></span>
      {data.view === 'spark' ? <Spark series={data.series} /> : data.view === 'bar' ? <Bars series={data.series} /> : pct !== null ? (
        <span className="h-1.5 rounded-full bg-surface-3 overflow-hidden" aria-hidden><span className="block h-full bg-acc rounded-full" style={{ width: `${pct * 100}%` }} /></span>
      ) : null}
      {data.tracker ? <Quick t={data.tracker} /> : null}
    </div>
  )
}
