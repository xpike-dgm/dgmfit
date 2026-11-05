import ExImg from '@/components/ExImg'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getExercise, imageUrl } from '@/lib/fitness-data'
import { exerciseProgress } from '@/lib/fitness-stats'
import { LEVELS } from '@/lib/progress'
import ExercisePhoto from './ExercisePhoto'
import { AG_SOURCE, FEATURE_LABEL, featureDescription, hasLicensedFile, licensedUrl } from '@/lib/licensed'
import { anatomyTexts, anatomyViews, isFavorite } from '@/lib/anatomy-data'
import { LEVEL_COLOR, activationLevel, cnsBucket, viewKey } from '@/lib/anatomy'
import { getToday } from '@/lib/today'
import BodyFigure from '@/components/BodyFigure'
import LicensedHero from './LicensedHero'
import FeatureTiles from './FeatureTiles'
import { CATEGORY, EQUIPMENT, KIND, LEVEL, MUSCLES } from '@/lib/exercise-labels'
import { e1rm, PR_LABEL, type PrType } from '@/lib/training'
import { shortDate } from '@/lib/time'
import { fmtNum } from '@/lib/calc'
import { btn, Eyebrow, TopBar } from '@/components/ui'
import { Anchor, Balance, Bolt, Dumbbell, Levels, Single, Spark, Stretch, Target } from '@/components/icons'

const FEATURE_ICON: Record<string, React.ReactNode> = { unilateral: <Single size={28} />, overload: <Target size={28} />, longMuscle: <Stretch size={28} />, balance: <Balance size={28} />, techniquel: <Spark size={28} />, power: <Bolt size={28} />, stability: <Anchor size={28} /> }

export default async function ExercisePage(props: { params: Promise<{ id: string }> }) {
  const u = await requireUser()
  const { id } = await props.params
  if (!/^\d+$/.test(id)) notFound()
  const [x, pr] = await Promise.all([getExercise(u.id, Number(id)), exerciseProgress(u.id, Number(id))])
  if (!x || !pr) notFound()
  const L = x.licensed
  const vids = L ? { right: hasLicensedFile('videos', L.video.right) ? licensedUrl('videos', L.video.right) : null, wrong: hasLicensedFile('videos', L.video.wrong) ? licensedUrl('videos', L.video.wrong) : null } : null
  const desc = L ? (L.desc.tr || L.desc.en) : ''
  const recs = x.records ? (Object.entries(x.records) as [PrType, number][]).filter(([, v]) => v > 0) : []
  const views = L ? anatomyViews() : null
  const gender = L ? ((await getToday(u.id))?.profile.sex === 'female' ? 'female' : 'male') : 'male'
  const fills = L ? Object.fromEntries(Object.entries(L.muscles).filter(([, r]) => r >= 2).map(([k, r]) => [k, LEVEL_COLOR[activationLevel(r)]])) : {}
  const levels = L ? [...new Set(Object.values(L.muscles).filter((r) => r >= 2).map(activationLevel))].sort((a, b) => b - a) : []
  const texts = L ? anatomyTexts() : null
  const fav = L ? await isFavorite(u.id, x.id) : false
  const lvlN = x.level === 'expert' ? 3 : x.level === 'intermediate' ? 2 : 1
  const tiles = L ? [
    ...(x.level ? [{ key: 'level', label: LEVEL[x.level] ?? x.level, icon: <Levels size={30} level={lvlN} />, desc: null }] : []),
    { key: 'eq', label: EQUIPMENT[x.equipment] ?? x.equipment, icon: <Dumbbell size={30} />, desc: null },
    ...L.features.map((f) => ({ key: f, label: FEATURE_LABEL[f] ?? f, icon: FEATURE_ICON[f] ?? <Spark size={28} />, desc: featureDescription(f) })),
  ] : []
  const top = L ? (
    <>
      <LicensedHero id={x.id} name={x.nameTr} trName={x.aliases?.[0] && x.aliases[0] !== x.nameTr ? x.aliases[0] : null} right={vids?.right ?? null} wrong={vids?.wrong ?? null}
        fav={fav} defaults={L.defaults ?? null} rating={L.rating ?? null} />
      <section className="card p-4 flex flex-col gap-3">
        <FeatureTiles tiles={tiles} />
        <Link href={`/fitness/antrenman?hareket=${x.id}`} className={btn.primary}><Dumbbell size={20} />Bu hareketle antrenman başlat</Link>
      </section>
      <section className="card p-5 flex flex-col gap-4" aria-label="Kas etkisi" data-testid="ex-licensed">
        {L.cns !== null ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2"><h2 className="text-[17px] font-extrabold">{texts?.cnsTitle}</h2><span className="text-[12.5px] font-bold num text-mute" data-testid="ex-cns">MSS yükü {fmtNum(L.cns)}/10</span></div>
            <div className="h-4 rounded-md border border-line-2 overflow-hidden"><div className="h-full bg-[#E53935]" style={{ width: `${L.cns * 10}%` }} /></div>
            <p className="text-[14px] text-ink-2 leading-relaxed">{texts?.cns[cnsBucket(L.cns) - 1]}</p>
          </div>
        ) : null}
        {views ? (
          <div className="rounded-2xl bg-black p-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {(['front', 'back'] as const).map((sd) => { const v = views[viewKey(gender, sd)]; return v ? <BodyFigure key={sd} view={v} fills={fills} className="w-full h-auto" label={`${x.nameTr} ${sd === 'front' ? 'ön' : 'arka'} çalışan kaslar`} /> : null })}
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[12.5px] text-white/85" data-testid="ex-legend">
              {levels.map((l) => <span key={l} className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full" style={{ background: LEVEL_COLOR[l] }} />{texts?.legend[l - 1]}</span>)}
            </div>
          </div>
        ) : null}
        {desc ? <p className="text-[14px] text-ink-2 leading-relaxed">{desc}</p> : null}
        <a href={AG_SOURCE.url} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-faint self-start" data-testid="ag-source">Kaynak: {AG_SOURCE.label}</a>
      </section>
    </>
  ) : (
    <>
      <TopBar back="/fitness/hareketler" title="Hareket" />
      <section className="card p-5 flex flex-col gap-3">
        <h1 className="text-[22px] font-extrabold leading-tight">{x.nameTr}</h1>
        {x.source !== 'user' && x.aliases?.[0] && x.aliases[0] !== x.nameTr ? <span className="text-[13px] text-mute -mt-2" data-testid="ex-tr-name">Türkçe: {x.aliases[0]}</span> : null}
        {x.photoId ? <img src={`/api/media/${x.photoId}`} alt={x.nameTr} className="w-full aspect-[4/3] object-cover rounded-2xl bg-surface-2" /> : null}
        {x.source === 'user' ? <ExercisePhoto exerciseId={x.id} has={!!x.photoId} /> : null}
        {x.images.length ? (
          <div className="grid grid-cols-2 gap-2">
            {x.images.slice(0, 2).map((im, i) => <ExImg key={im} src={imageUrl(im)} alt={`${x.nameTr} ${i === 0 ? 'başlangıç' : 'bitiş'} pozisyonu`} size={300} className="w-full aspect-square rounded-2xl" />)}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5 text-[12px]">
          {[CATEGORY[x.category], EQUIPMENT[x.equipment], x.level ? LEVEL[x.level] : null, KIND[x.kind]].filter(Boolean).map((t) => <span key={t} className="px-2.5 h-7 rounded-full bg-surface-2 flex items-center text-ink-2">{t}</span>)}
        </div>
        <p className="text-[14px]"><span className="text-mute">Birincil:</span> <b>{x.primary.map((m) => MUSCLES[m] ?? m).join(', ') || '—'}</b>{x.secondary.length ? <><br /><span className="text-mute">İkincil:</span> {x.secondary.map((m) => MUSCLES[m] ?? m).join(', ')}</> : null}</p>
        <Link href={`/fitness/antrenman?hareket=${x.id}`} className={btn.primary}><Dumbbell size={20} />Bu hareketle antrenman başlat</Link>
      </section>
    </>
  )
  return (
    <div className="flex flex-col gap-3 px-4">
      {top}
      {x.steps.length ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="Teknik">
          <Eyebrow>Teknik</Eyebrow>
          <ol className="list-decimal pl-5 flex flex-col gap-1.5 text-[14px] text-ink-2 leading-relaxed">{x.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          {x.mistakes.length ? <>
            <Eyebrow className="mt-2">Sık yapılan hatalar</Eyebrow>
            <ul className="list-disc pl-5 flex flex-col gap-1 text-[14px] text-ink-2">{x.mistakes.map((s) => <li key={s}>{s}</li>)}</ul>
          </> : null}
        </section>
      ) : L ? null : <p className="card p-5 text-[13px] text-mute">{x.source === 'user' ? 'Kendi hareketin: teknik notu yok.' : 'Bu hareketin kaynakta adım adım talimatı yok. Görseller başlangıç ve bitiş pozisyonunu gösteriyor.'}</p>}
      {pr.series.length >= 2 ? <E1rmChart series={pr.series} /> : null}
      {pr.plateau.plateau ? (
        <section className="card p-5 flex flex-col gap-2 border border-coach-line" aria-label="Plato" data-testid="plateau">
          <Eyebrow className="text-orange">Plato · {pr.plateau.weeks} haftadır ilerleme yok</Eyebrow>
          <ul className="list-disc pl-5 text-[14px] text-ink-2 flex flex-col gap-1">{pr.plateau.suggestions.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      ) : null}
      {pr.level ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="Kuvvet seviyesi" data-testid="strength-level">
          <Eyebrow>Kuvvet seviyesi (yaklaşık)</Eyebrow>
          <span className="text-[20px] font-extrabold">{pr.level.level} <span className="text-[14px] text-mute font-normal num">· e1RM {fmtNum(pr.best, 1)} kg = vücut ağırlığının {String(pr.level.ratio).replace('.', ',')} katı</span></span>
          <div className="grid grid-cols-4 gap-1 text-center">{LEVELS.map((l, i) => <span key={l} className={`rounded-lg py-1.5 text-[11px] ${pr.level!.level === l ? 'bg-acc text-acc-ink font-bold' : 'bg-surface-2 text-mute'}`}>{l}<br /><span className="num">{pr.level!.thresholds[i]} kg</span></span>)}</div>
          {pr.level.next ? <p className="text-[13px] text-ink-2">{pr.level.next.level} için tahmini maksimum ~{fmtNum(pr.level.next.kg, 1)} kg.</p> : null}
          <p className="text-[11px] text-mute">DgFit'in kaba rehberidir (e1RM / vücut ağırlığı); yayımlanmış bir standart tablosu değildir.</p>
        </section>
      ) : null}
      {pr.alternatives.length ? (
        <section className="card p-5 flex flex-col gap-1" aria-label="Alternatifler" data-testid="alternatives">
          <Eyebrow>Alternatifler (istasyon doluysa)</Eyebrow>
          {pr.alternatives.map((a) => <Link key={a.id} href={`/fitness/hareketler/${a.id}`} className="flex justify-between min-h-[44px] items-center text-[14px]"><span className="font-semibold">{a.nameTr}</span><span className="text-mute text-[12px]">{EQUIPMENT[a.equipment] ?? a.equipment}</span></Link>)}
        </section>
      ) : null}
      {recs.length ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="Rekorlar">
          <Eyebrow>Rekorların</Eyebrow>
          {recs.map(([k, v]) => <div key={k} className="flex justify-between text-[14px]"><span className="text-ink-2">{PR_LABEL[k] ?? k}</span><span className="num font-bold">{k === 'reps' ? `${v} tekrar` : `${fmtNum(v, v % 1 ? 1 : 0)} kg`}</span></div>)}
        </section>
      ) : null}
      {x.history.length ? (
        <section className="card p-5 flex flex-col gap-2" aria-label="Geçmiş">
          <Eyebrow>Son seanslar</Eyebrow>
          {[...x.history].reverse().map((h) => {
            const w = h.sets.filter((s) => s.type !== 'warmup')
            const best = Math.max(0, ...w.map((s) => e1rm(s.kg, s.reps, s.rir)))
            return <div key={h.workoutId} className="flex justify-between text-[13px] gap-2"><span className="text-mute w-16 shrink-0">{shortDate(h.day)}</span><span className="num flex-1 text-ink-2">{w.map((s) => x.kind === 'time' ? `${s.seconds ?? 0} sn` : `${fmtNum(s.kg, s.kg % 1 ? 1 : 0)}×${s.reps}`).join(' · ')}</span>{best ? <span className="num text-mute">e1RM {fmtNum(best, 1)}</span> : null}</div>
          })}
        </section>
      ) : null}
    </div>
  )
}

function E1rmChart({ series }: { series: { day: string; e1rm: number }[] }) {
  const W = 320, H = 150, L = 34, R = 10, T = 12, B = 22
  const pts = series.filter((s) => s.e1rm > 0)
  const t0 = Date.parse(pts[0].day), t1 = Math.max(t0 + 86400000, Date.parse(pts.at(-1)!.day))
  const lo = Math.floor(Math.min(...pts.map((p) => p.e1rm)) * 0.95), hi = Math.ceil(Math.max(...pts.map((p) => p.e1rm)) * 1.03)
  const x = (d: string) => L + ((Date.parse(d) - t0) / (t1 - t0)) * (W - L - R)
  const y = (v: number) => T + ((hi - v) / Math.max(1, hi - lo)) * (H - T - B)
  const best = pts.reduce((a, b) => (b.e1rm > a.e1rm ? b : a))
  return (
    <section className="card p-5 flex flex-col gap-2" aria-label="e1RM gelişimi">
      <Eyebrow>Tahmini maksimum (e1RM)</Eyebrow>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${pts.length} seans; en iyi ${fmtNum(best.e1rm, 1)} kg (${shortDate(best.day)}), son ${fmtNum(pts.at(-1)!.e1rm, 1)} kg`} data-testid="e1rm-chart">
        {[lo, (lo + hi) / 2, hi].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--color-line)" /><text x={L - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--color-mute)" className="num">{fmtNum(v, 0)}</text></g>)}
        <polyline points={pts.map((p) => `${x(p.day).toFixed(1)},${y(p.e1rm).toFixed(1)}`).join(' ')} fill="none" stroke="var(--color-acc)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p) => <circle key={p.day} cx={x(p.day)} cy={y(p.e1rm)} r={4} fill="var(--color-acc)" stroke="var(--color-surface)" strokeWidth={2}><title>{`${shortDate(p.day)}: ${fmtNum(p.e1rm, 1)} kg`}</title></circle>)}
        <text x={L} y={H - 6} fontSize={10} fill="var(--color-mute)">{shortDate(pts[0].day)}</text>
        <text x={W - R} y={H - 6} fontSize={10} fill="var(--color-mute)" textAnchor="end">{shortDate(pts.at(-1)!.day)}</text>
      </svg>
    </section>
  )
}
