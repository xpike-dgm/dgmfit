import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { fitnessHome, recoveryFor } from '@/lib/fitness-data'
import { recoveryText } from '@/lib/recovery'
import { addDays, shortDate } from '@/lib/time'
import { fmtNum } from '@/lib/calc'
import { PR_LABEL, CARDIO, type PrType } from '@/lib/training'
import { Band, btn, Eyebrow, hdrIcon } from '@/components/ui'
import { Calendar, Chart, Clock, Dumbbell, Flame, Gear, Heart, Next, Pulse, Scale, Spark, Target } from '@/components/icons'
import PendingSync from './PendingSync'
import { isAdvanced } from '@/lib/ui-mode'
import { screenLayout } from '@/lib/cards/design-data'
import { userNodes } from '@/lib/cards/user-nodes'
import CardBoard from '@/components/cards/CardBoard'
import type { ReactNode } from 'react'

export const metadata = { title: 'Fitness · DgFit' }
const WD = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']

export default async function FitnessPage(props: { searchParams: Promise<{ gun?: string; duzenle?: string }> }) {
  const u = await requireUser()
  const sp = await props.searchParams
  const editing = sp.duzenle === '1'
  const [h, adv, rec, layout] = await Promise.all([fitnessHome(u.id), isAdvanced(u.id), recoveryFor(u.id).catch(() => null), screenLayout(u.id, 'fitness', { editing })])
  // gün sekmesi yalnızca önizlemeyi değiştirir; antrenman "Antrenmana başla" ile başlar
  const day = (sp.gun && h.program?.days.find((d) => d.id === sp.gun)) || h.next
  const shown = adv ? 6 : 3 // sade modda sıradaki antrenmanın ilk 3 hareketi
  const weekDone = h.week.reduce((a, w) => a + w.n, 0)
  const target = h.trainingDays ?? h.program?.days.length ?? 3
  const ucNodes = await userNodes(u.id, layout, editing)
  const nodes: Record<string, ReactNode> = {
    'fitness.header': <div className="flex flex-col gap-3">
      <Band title="Fitness" sub={h.program ? h.program.name : 'Henüz program yok'}
        right={<Link href="/fitness/ayarlar" className={hdrIcon} aria-label="Salon ayarları"><Gear size={20} /></Link>}
        ring={{ value: target ? Math.min(1, weekDone / target) : 0, big: `${weekDone}/${target}`, small: 'bu hafta', label: `Bu hafta ${weekDone} / ${target} antrenman` }}
        pills={[['Hacim', `${fmtNum(h.week.reduce((a, w) => a + w.vol, 0))} kg`], ['Süre', `${fmtNum(h.week.reduce((a, w) => a + w.min, 0))} dk`], ['Kardiyo', `${fmtNum(h.cardioWeekMin)} dk`]]} />
      <PendingSync />
    </div>,
    'fitness.recovery': rec && rec.level !== 'ok' ? <p className="card px-4 py-3 text-[13.5px] leading-snug border-l-4 border-orange" data-testid="recovery-card" data-level={rec.level}>{recoveryText(rec)}</p> : null,
    'fitness.next': day && h.program ? (
        <section aria-label="Sıradaki antrenman" className="card p-5 flex flex-col gap-3" data-testid="next-workout" data-day={day.id} data-selected={day.id !== h.next?.id ? 'true' : undefined}>
          <div className="flex items-center justify-between">
            <Eyebrow>{day.id === h.next?.id ? 'Sıradaki antrenman' : 'Seçili gün'}</Eyebrow>
            <Link href={`/fitness/programlar/${h.program.id}`} className="text-[13px] text-mute">{h.program.name}</Link>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[24px] font-extrabold leading-tight">{day.name}</span>
            <span className="text-sm text-mute">{day.focus || `${day.exercises.length} hareket`}</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {day.exercises.slice(0, shown).map((e) => (
              <li key={e.id} className="flex justify-between text-[14px]"><span className="text-ink-2">{e.name}</span><span className="num text-mute">{e.sets} × {e.seconds ? `${e.seconds} sn` : e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}</span></li>
            ))}
            {day.exercises.length > shown ? <li className="text-[13px] text-mute">+{day.exercises.length - shown} hareket</li> : null}
          </ul>
          {h.program.days.length > 1 ? (
            <nav aria-label="Başka bir gün seç" className="flex flex-col gap-1.5">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5" data-testid="day-picker">
                {h.program.days.map((d) => (
                  <Link key={d.id} href={d.id === h.next?.id ? '/fitness' : `/fitness?gun=${d.id}`} replace scroll={false} aria-current={d.id === day.id ? 'true' : undefined}
                    className="shrink-0 h-9 px-3.5 rounded-full text-[13px] font-bold inline-flex items-center bg-surface-2 aria-[current=true]:bg-acc aria-[current=true]:text-acc-ink">{d.name}</Link>
                ))}
              </div>
            </nav>
          ) : null}
          {day.exercises.length
            ? <Link href={`/fitness/antrenman?gun=${day.id}`} className={btn.primary}><Dumbbell size={20} />Antrenmana başla</Link>
            : <Link href={`/fitness/programlar/${h.program.id}`} className={btn.secondary}>Bu güne hareket ekle</Link>}
        </section>
      ) : (
        <section aria-label="Program" className="card p-5 flex flex-col gap-3">
          <Eyebrow>Başlangıç</Eyebrow>
          <p className="text-[15px] text-ink-2 leading-relaxed">Bir program seç ya da gün sayına ve ekipmanına göre otomatik oluştur. Her antrenmandan sonra DgFit bir sonraki ağırlığı önerir.</p>
          <Link href="/fitness/programlar" className={btn.primary}>Program oluştur</Link>
        </section>
      ),
    'fitness.tools': (
      <nav aria-label="Fitness araçları" className="grid grid-cols-3 gap-2">
        <Link href="/fitness/anatomi" className="card px-2 py-3 flex flex-col items-center gap-1.5 text-[12.5px] font-bold text-center min-h-[76px] justify-center" data-testid="anatomy-link"><Target size={20} className="text-acc" />Kas haritası</Link>
        <Link href="/fitness/antrenman" className="card px-2 py-3 flex flex-col items-center gap-1.5 text-[12.5px] font-bold text-center min-h-[76px] justify-center"><Spark size={20} className="text-acc" />Serbest antrenman</Link>
        <Link href="/fitness/kardiyo" className="card px-2 py-3 flex flex-col items-center gap-1.5 text-[12.5px] font-bold text-center min-h-[76px] justify-center"><Pulse size={20} className="text-water" />Kardiyo ekle</Link>
        <Link href="/fitness/hareketler" className="card px-2 py-3 flex flex-col items-center gap-1.5 text-[12.5px] font-bold text-center min-h-[76px] justify-center"><Dumbbell size={20} className="text-acc" />Hareketler</Link>
        <Link href="/fitness/kaydedilenler" className="card px-2 py-3 flex flex-col items-center gap-1.5 text-[12.5px] font-bold text-center min-h-[76px] justify-center" data-testid="favorites-link"><Heart size={20} filled className="text-[#E53935]" />Kaydedilenler</Link>
        <Link href="/fitness/istatistik" className="card px-2 py-3 flex flex-col items-center gap-1.5 text-[12.5px] font-bold text-center min-h-[76px] justify-center"><Chart size={20} className="text-orange" />İstatistik</Link>
        {adv ? <>
          <Link href="/fitness/rekor" className="card px-2 py-3 flex flex-col items-center gap-1.5 text-[12.5px] font-bold text-center min-h-[76px] justify-center" data-testid="pr-link"><Flame size={20} className="text-[#E53935]" />Rekor denemesi</Link>
          <Link href="/fitness/olcumler" className="card px-2 py-3 flex flex-col items-center gap-1.5 text-[12.5px] font-bold text-center min-h-[76px] justify-center"><Scale size={20} className="text-violet" />Ölçüler</Link>
          <Link href="/fitness/programlar" className="card px-2 py-3 flex flex-col items-center gap-1.5 text-[12.5px] font-bold text-center min-h-[76px] justify-center"><Calendar size={20} className="text-acc" />Programlar</Link>
        </> : null}
      </nav>
    ),
    'fitness.week': (
      <section aria-label="Bu hafta" className="card p-5 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <Eyebrow>Bu hafta</Eyebrow>
          <span className="num text-sm font-bold">{weekDone} / {target} antrenman</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(h.monday, i)
            const w = h.week.find((x) => x.day === d)
            return (
              <div key={d} className={`flex flex-col items-center gap-1 py-2 rounded-xl ${d === h.today ? 'bg-surface-2' : ''}`}>
                <span className="text-[11px] text-mute">{WD[new Date(d + 'T12:00:00Z').getUTCDay()]}</span>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center ${w ? 'bg-acc text-acc-ink' : 'border border-line'}`}>{w ? <Dumbbell size={14} /> : null}</span>
              </div>
            )
          })}
        </div>
      </section>
    ),
    'fitness.prs': h.prs.length ? (
        <section aria-label="Son rekorlar" className="card p-5 flex flex-col gap-2">
          <div className="flex items-center gap-2"><Flame size={18} className="text-orange" /><Eyebrow>Son rekorlar</Eyebrow></div>
          {h.prs.map((p) => (
            <div key={p.id} className="flex justify-between text-[14px]">
              <span className="text-ink-2">{p.name} · {PR_LABEL[p.type as PrType] ?? p.type}</span>
              <span className="num font-bold">{fmtPr(p.type, p.value)}</span>
            </div>
          ))}
        </section>
      ) : null,
    'fitness.recent': (
      <section aria-label="Son antrenmanlar" className="card p-5 flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1"><Clock size={18} className="text-mute" /><Eyebrow>Son antrenmanlar</Eyebrow></div>
        {h.recent.length ? h.recent.slice(0, adv ? 10 : 3).map((w) => (
          <Link key={w.id} href={`/fitness/antrenman/${w.id}`} className="flex items-center justify-between min-h-[52px] gap-3">
            <span className="flex flex-col">
              <span className="font-semibold">{w.name}</span>
              <span className="text-[12px] text-mute">{shortDate(w.day)} · {Math.round(w.durationSec / 60)} dk · {w.workSets} set · {fmtNum(w.volumeKg)} kg</span>
            </span>
            <Next size={18} className="text-mute" />
          </Link>
        )) : <p className="text-[13px] text-mute">Henüz antrenman yok.</p>}
        {h.cardio.map((c) => (
          <div key={c.id} className="flex items-center justify-between min-h-[44px] text-[14px]">
            <span className="text-ink-2">{CARDIO[c.type]?.label ?? c.type} · {shortDate(c.day)}</span>
            <span className="num text-mute">{Math.round(c.minutes)} dk · {c.kcalNet} kcal</span>
          </div>
        ))}
      </section>
    ),
    'fitness.programs': adv ? null : <Link href="/fitness/programlar" className={btn.secondary}>Programlarım ({h.programs.length})</Link>,
  }
  return (
    <div className="flex flex-col gap-3 px-4">
      <CardBoard screen="fitness" editing={editing} items={layout.items.map((i) => ({ id: i.id, size: i.size, stack: i.stack }))} nodes={{ ...nodes, ...ucNodes }} titles={layout.titles} mode={layout.mode}
        drawer={layout.drawer.map((d) => ({ id: d.def.id, reason: d.reason }))} notices={layout.notices} applied={layout.applied} quick={layout.quick} pinned={layout.pinned} colors={layout.colors} />
    </div>
  )
}

function fmtPr(type: string, v: number) {
  if (type === 'reps') return `${v} tekrar`
  if (type === 'volume') return `${fmtNum(v)} kg`
  return `${fmtNum(v, v % 1 ? 1 : 0)} kg`
}
