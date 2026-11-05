import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { workoutSummary } from '@/lib/fitness-data'
import { longDate } from '@/lib/time'
import { fmtNum } from '@/lib/calc'
import { PR_LABEL, SET_TYPES, type PrType, type SetType } from '@/lib/training'
import { MUSCLES } from '@/lib/exercise-labels'
import { Bar, btn, Eyebrow, TopBar } from '@/components/ui'
import { Flame } from '@/components/icons'
import DeleteWorkout from './DeleteWorkout'

export const metadata = { title: 'Antrenman özeti · DgFit' }

export default async function SummaryPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ yeni?: string }> }) {
  const u = await requireUser()
  const { id } = await props.params
  const { yeni } = await props.searchParams
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const s = await workoutSummary(u.id, id)
  if (!s) notFound()
  const w = s.workout
  const min = Math.round(w.durationSec / 60)
  const maxM = Math.max(1, ...s.muscles.map((m) => m[1]))
  const pv = s.previous
  const diff = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0)
  return (
    <div className="flex flex-col gap-3 px-4 pt-5">
      <TopBar back="/fitness" title="Antrenman özeti" />
      <section className="card p-5 flex flex-col gap-3 relative overflow-hidden" data-testid="summary">
        {yeni && s.prs.length ? <div aria-hidden className="pointer-events-none absolute inset-0 animate-[fadeIn_.6s_ease] bg-[radial-gradient(circle_at_50%_0%,rgba(200,241,105,0.25),transparent_60%)]" /> : null}
        <Eyebrow>{longDate(w.day)}</Eyebrow>
        <h1 className="text-[24px] font-extrabold leading-tight">{yeni ? 'Antrenman tamamlandı' : w.name}</h1>
        {yeni ? <p className="text-sm text-mute -mt-2">{w.name}</p> : null}
        <div className="grid grid-cols-2 gap-2">
          <Big label="Süre" value={`${min} dk`} />
          <Big label="Hacim" value={`${fmtNum(w.volumeKg)} kg`} />
          <Big label="Çalışma seti" value={String(w.workSets)} />
          <Big label="Kalori (net)" value={`${w.kcalNet} kcal`} sub={`brüt ${w.kcalGross}`} />
        </div>
        <p className="text-[12px] text-mute">Net kalori Fit bütçene egzersiz kredisi olarak eklendi; bugünün su hedefi antrenman süresi kadar arttı.</p>
      </section>

      {s.prs.length ? (
        <section aria-label="Kırılan rekorlar" className="card p-5 flex flex-col gap-2 border border-coach-line" data-testid="prs">
          <div className="flex items-center gap-2"><Flame size={20} className="text-orange" /><Eyebrow className="text-lime">{s.prs.length} yeni rekor</Eyebrow></div>
          {s.prs.map((p) => (
            <div key={p.id} className="flex justify-between items-center gap-2 text-[14px]">
              <span className="text-ink-2 flex-1">{p.name} · {PR_LABEL[p.type as PrType] ?? p.type} <Link href={`/sosyal/yeni?tur=pr&ref=${p.id}`} className="text-lime text-[12px] font-bold ml-1">Paylaş</Link></span>
              <span className="num font-bold">{p.type === 'reps' ? `${p.value} tekrar` : `${fmtNum(p.value, p.value % 1 ? 1 : 0)} kg`} <span className="text-mute font-normal">({p.type === 'reps' ? p.previous : fmtNum(p.previous ?? 0, (p.previous ?? 0) % 1 ? 1 : 0)})</span></span>
            </div>
          ))}
        </section>
      ) : null}

      {pv ? (
        <section aria-label="Önceki aynı gün" className="card p-5 flex flex-col gap-2">
          <Eyebrow>Önceki {w.name} ile</Eyebrow>
          <Cmp label="Hacim" cur={`${fmtNum(w.volumeKg)} kg`} pct={diff(w.volumeKg, pv.volumeKg)} />
          <Cmp label="Süre" cur={`${min} dk`} pct={diff(w.durationSec, pv.durationSec)} invert />
          <Cmp label="Set" cur={String(w.workSets)} pct={diff(w.workSets, pv.workSets)} />
        </section>
      ) : null}

      <section aria-label="Kas grubu dağılımı" className="card p-5 flex flex-col gap-2.5">
        <Eyebrow>Kas grubu dağılımı (çalışma seti)</Eyebrow>
        {s.muscles.map(([m, c]) => (
          <div key={m} className="flex items-center gap-3">
            <span className="w-28 text-[13px] text-ink-2 truncate">{MUSCLES[m] ?? m}</span>
            <div className="flex-1"><Bar value={c / maxM} color="var(--color-orange)" /></div>
            <span className="num text-[13px] w-6 text-right">{c}</span>
          </div>
        ))}
      </section>

      <section aria-label="Hareketler" className="card p-5 flex flex-col gap-3">
        <Eyebrow>Hareketler</Eyebrow>
        {s.exercises.map((e) => (
          <div key={e.exerciseId} className="flex flex-col gap-1">
            <Link href={`/fitness/hareketler/${e.exerciseId}`} className="font-bold">{e.name}</Link>
            <span className="text-[13px] text-mute num leading-relaxed">
              {e.sets.map((x, i) => (
                <span key={i}>{i ? ' · ' : ''}{x.type !== 'normal' ? `${SET_TYPES[x.type as SetType]?.short ?? ''} ` : ''}{e.kind === 'time' ? `${x.seconds ?? 0} sn` : `${fmtNum(x.kg, x.kg % 1 ? 1 : 0)}×${x.reps}${x.rir !== null ? ` @${x.rir}` : ''}`}</span>
              ))}
            </span>
          </div>
        ))}
        {w.notes ? <p className="text-[13px] text-ink-2 border-t border-line pt-3">Not: {w.notes}{w.pain ? ' · ağrı işaretlendi' : ''}</p> : w.pain ? <p className="text-[13px] text-orange">Ağrı işaretlendi: sonraki öneriler temkinli.</p> : null}
      </section>

      <p className="text-[12px] text-mute px-1">Sosyalde paylaşma Sosyal modülüyle (Faz 5) gelecek.</p>
      <Link href="/fitness" className={btn.primary}>Fitness'a dön</Link>
      <Link href={`/sosyal/yeni?tur=workout&ref=${w.id}`} className={btn.secondary + ' w-full h-12'} data-testid="share-workout">Antrenmanı paylaş</Link>
      <DeleteWorkout id={w.id} />
    </div>
  )
}

function Big({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-2xl bg-surface-2 px-3 py-2.5 flex flex-col"><span className="text-xs text-mute">{label}</span><span className="num text-[20px] font-bold">{value}</span>{sub ? <span className="text-[11px] text-mute">{sub}</span> : null}</div>
}
function Cmp({ label, cur, pct, invert }: { label: string; cur: string; pct: number; invert?: boolean }) {
  const good = invert ? pct < 0 : pct > 0
  return <div className="flex justify-between text-[14px]"><span className="text-ink-2">{label}</span><span className="num">{cur} <span className={pct === 0 ? 'text-mute' : good ? 'text-lime' : 'text-orange'}>{pct > 0 ? '+' : ''}{pct}%</span></span></div>
}
