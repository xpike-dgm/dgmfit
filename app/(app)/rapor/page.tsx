import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { addDays, dayString, shortDate } from '@/lib/time'
import { fmtNum } from '@/lib/calc'
import { Eyebrow, TopBar } from '@/components/ui'
import { Spark } from '@/components/icons'
import { latestReportWeek, mondayOf, pastReports, weeklyReport } from '@/lib/coach-data'
import { SUPPORT, type SafetyFlag } from '@/lib/safety'

export const metadata: Metadata = { title: 'Haftalık rapor · DgFit' }
const PROVIDER: Record<string, string> = { claude: 'Claude', openai: 'OpenAI' }

export default async function Page(props: { searchParams: Promise<{ hafta?: string }> }) {
  const u = await requireUser()
  const sp = await props.searchParams
  const today = dayString(), latest = latestReportWeek(), thisWeek = mondayOf(today)
  const req = sp.hafta && /^\d{4}-\d{2}-\d{2}$/.test(sp.hafta) ? mondayOf(sp.hafta) : latest
  const ws = req > thisWeek ? thisWeek : req < addDays(thisWeek, -7 * 26) ? addDays(thisWeek, -7 * 26) : req
  const [r, past] = await Promise.all([weeklyReport(u.id, ws), pastReports(u.id)])
  const s = r.stats
  const tiles: { label: string; value: string; sub?: string }[] = [
    { label: 'Ortalama kalori', value: s.avgKcal === null ? '—' : fmtNum(s.avgKcal), sub: s.avgTarget === null ? 'kayıt yok' : `hedef ${fmtNum(s.avgTarget)} kcal` },
    { label: 'Kalori uyumu', value: s.adherencePct === null ? '—' : `%${s.adherencePct}`, sub: `${s.loggedDays}/7 gün kayıt` },
    { label: 'Protein', value: s.proteinPct === null ? '—' : `%${s.proteinPct}`, sub: 'hedefin ortalaması' },
    { label: 'Trend kilo', value: s.weightChange === null ? '—' : `${s.weightChange > 0 ? '+' : ''}${fmtNum(s.weightChange, 1)} kg`, sub: s.weightLast === null ? 'tartı yok' : `şimdi ${fmtNum(s.weightLast, 1)} kg` },
    { label: 'Su', value: `${s.waterGoalDays}/7`, sub: s.waterAvg === null ? 'kayıt yok' : `ort. ${fmtNum(s.waterAvg)} ml` },
    { label: 'Antrenman', value: String(s.workouts), sub: `${s.cardioMin} dk kardiyo${s.prs ? ` · ${s.prs} rekor` : ''}` },
  ]
  const prev = addDays(ws, -7), next = addDays(ws, 7)
  return (
    <div className="px-4 pt-4 flex flex-col gap-3">
      <TopBar back="/" title="Haftalık rapor" />
      <div className="flex items-center justify-between px-1" data-testid="report-week">
        <Link href={`/rapor?hafta=${prev}`} className="h-9 px-3 rounded-full bg-surface-2 text-[13px] font-semibold inline-flex items-center" aria-label="Önceki hafta">‹ Önceki</Link>
        <span className="font-bold">{shortDate(ws)} – {shortDate(r.weekEnd)}</span>
        {next <= thisWeek ? <Link href={`/rapor?hafta=${next}`} className="h-9 px-3 rounded-full bg-surface-2 text-[13px] font-semibold inline-flex items-center" aria-label="Sonraki hafta">Sonraki ›</Link> : <span className="w-[84px]" />}
      </div>

      {r.safetyFlags.length ? (
        <section className="rounded-[24px] border border-water/50 bg-surface px-5 py-4 flex flex-col gap-1" data-testid="report-safety">
          <span className="font-bold text-water">{SUPPORT[r.safetyFlags[0] as SafetyFlag].title}</span>
          <p className="text-[14px] text-ink-2">{SUPPORT[r.safetyFlags[0] as SafetyFlag].body}</p>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2" aria-label="İstatistikler" data-testid="report-stats">
        {tiles.map((t) => (
          <div key={t.label} className="card px-4 py-3 flex flex-col gap-0.5">
            <span className="text-[12px] text-mute">{t.label}</span>
            <span className="num text-[24px] font-bold">{t.value}</span>
            {t.sub ? <span className="text-[12px] text-mute">{t.sub}</span> : null}
          </div>
        ))}
      </section>

      {s.hardest.length || s.weekendDiff !== null ? (
        <section className="card p-4 flex flex-col gap-1.5 text-[14px]">
          <Eyebrow>Davranış</Eyebrow>
          {s.hardest.map((h) => <span key={h.day}>{h.weekday} hedefin <b className="num">{fmtNum(h.over)} kcal</b> üstünde</span>)}
          {s.weekendDiff !== null ? <span>Hafta sonu ortalaması hafta içine göre <b className="num">{s.weekendDiff > 0 ? '+' : ''}{fmtNum(s.weekendDiff)} kcal</b></span> : null}
        </section>
      ) : null}

      <section className="rounded-[28px] px-5 py-[18px] flex flex-col gap-3 bg-coach border border-coach-line" data-testid="report-summary">
        <div className="flex items-center gap-2"><Spark size={18} className="text-lime" /><span className="text-[13px] font-bold tracking-[0.08em] uppercase text-lime">Koçun yorumu</span></div>
        {!r.ready ? <p className="text-[13px] text-mute">Bu haftanın raporu Pazar 18.00'de hazır olur; şimdilik anlık sayılar görünüyor.</p> : null}
        <p className="text-[15px] leading-relaxed text-[#E4E8DC]">{r.summary}</p>
        <ul className="flex flex-col gap-2">{r.suggestions.map((x, i) => <li key={i} className="text-[14px] text-ink-2 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-lime">{x}</li>)}</ul>
        <span className="text-[11px] text-mute">{r.provider ? `Yorum: ${PROVIDER[r.provider] ?? r.provider} · sayılar DgFit motorlarından` : 'Kural tabanlı yorum · sayılar DgFit motorlarından'}</span>
        <Link href={`/koc?soru=${encodeURIComponent('Haftalık raporuma göre önümüzdeki hafta neye odaklanmalıyım?')}`} className="self-start h-10 px-4 rounded-full bg-lime text-lime-ink font-bold text-[14px] inline-flex items-center">Koça sor</Link>
      </section>

      {past.length ? (
        <section className="card p-4 flex flex-col gap-2">
          <Eyebrow>Geçmiş raporlar</Eyebrow>
          <div className="flex flex-wrap gap-2">{past.map((x) => <Link key={x.period} href={`/rapor?hafta=${x.period}`} aria-current={x.period === ws ? 'page' : undefined} className="h-9 px-3 rounded-full bg-surface-2 text-[13px] font-semibold inline-flex items-center aria-[current=page]:bg-lime aria-[current=page]:text-lime-ink">{shortDate(x.period)}</Link>)}</div>
        </section>
      ) : null}
      {latest !== ws ? null : <span className="text-[11px] text-faint text-center">En son tamamlanan hafta</span>}
    </div>
  )
}
