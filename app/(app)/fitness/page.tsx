import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { fitnessHome } from '@/lib/fitness-data'
import { addDays, shortDate } from '@/lib/time'
import { fmtNum } from '@/lib/calc'
import { PR_LABEL, CARDIO, type PrType } from '@/lib/training'
import { Band, btn, Eyebrow, hdrIcon } from '@/components/ui'
import { Chart, Clock, Dumbbell, Flame, Gear, Heart, Next, Pulse, Scale, Spark } from '@/components/icons'
import PendingSync from './PendingSync'

export const metadata = { title: 'Fitness · DgFit' }
const WD = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']

export default async function FitnessPage() {
  const u = await requireUser()
  const h = await fitnessHome(u.id)
  const weekDone = h.week.reduce((a, w) => a + w.n, 0)
  const target = h.trainingDays ?? h.program?.days.length ?? 3
  return (
    <div className="flex flex-col gap-3 px-4">
      <Band title="Fitness" sub={h.program ? h.program.name : 'Henüz program yok'}
        right={<Link href="/fitness/ayarlar" className={hdrIcon} aria-label="Salon ayarları"><Gear size={20} /></Link>}
        ring={{ value: target ? Math.min(1, weekDone / target) : 0, big: `${weekDone}/${target}`, small: 'bu hafta', label: `Bu hafta ${weekDone} / ${target} antrenman` }}
        pills={[['Hacim', `${fmtNum(h.week.reduce((a, w) => a + w.vol, 0))} kg`], ['Süre', `${fmtNum(h.week.reduce((a, w) => a + w.min, 0))} dk`], ['Kardiyo', `${fmtNum(h.cardioWeekMin)} dk`]]} />
      <PendingSync />

      {h.next && h.program ? (
        <section aria-label="Sıradaki antrenman" className="card p-5 flex flex-col gap-3" data-testid="next-workout">
          <div className="flex items-center justify-between">
            <Eyebrow>Sıradaki antrenman</Eyebrow>
            <Link href={`/fitness/programlar/${h.program.id}`} className="text-[13px] text-mute">{h.program.name}</Link>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[24px] font-extrabold leading-tight">{h.next.name}</span>
            <span className="text-sm text-mute">{h.next.focus || `${h.next.exercises.length} hareket`}</span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {h.next.exercises.slice(0, 6).map((e) => (
              <li key={e.id} className="flex justify-between text-[14px]"><span className="text-ink-2">{e.name}</span><span className="num text-mute">{e.sets} × {e.seconds ? `${e.seconds} sn` : e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}</span></li>
            ))}
            {h.next.exercises.length > 6 ? <li className="text-[13px] text-mute">+{h.next.exercises.length - 6} hareket</li> : null}
          </ul>
          {h.program.days.length > 1 ? (
            <nav aria-label="Başka bir gün seç" className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-mute">Başka bir gün yapmak istersen:</span>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5" data-testid="day-picker">
                {h.program.days.map((d) => (
                  <Link key={d.id} href={`/fitness/antrenman?gun=${d.id}`} aria-current={d.id === h.next!.id ? 'true' : undefined}
                    className="shrink-0 h-9 px-3.5 rounded-full text-[13px] font-bold inline-flex items-center bg-surface-2 aria-[current=true]:bg-acc aria-[current=true]:text-acc-ink">{d.name}</Link>
                ))}
              </div>
            </nav>
          ) : null}
          {h.next.exercises.length
            ? <Link href={`/fitness/antrenman?gun=${h.next.id}`} className={btn.primary}><Dumbbell size={20} />Antrenmana başla</Link>
            : <Link href={`/fitness/programlar/${h.program.id}`} className={btn.secondary}>Bu güne hareket ekle</Link>}
        </section>
      ) : (
        <section aria-label="Program" className="card p-5 flex flex-col gap-3">
          <Eyebrow>Başlangıç</Eyebrow>
          <p className="text-[15px] text-ink-2 leading-relaxed">Bir program seç ya da gün sayına ve ekipmanına göre otomatik oluştur. Her antrenmandan sonra DgFit bir sonraki ağırlığı önerir.</p>
          <Link href="/fitness/programlar" className={btn.primary}>Program oluştur</Link>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3">
        <Link href="/fitness/anatomi" className="card p-4 flex flex-col gap-1.5 min-h-[96px] relative overflow-hidden" data-testid="anatomy-link">
          <span className="text-[16px] font-extrabold">Kas haritası</span>
          <span className="text-[12.5px] text-mute leading-snug">Kasa dokun, onu çalıştıran hareketleri videolu gör</span>
        </Link>
        <Link href="/fitness/kaydedilenler" className="card p-4 flex flex-col gap-1.5 min-h-[96px]" data-testid="favorites-link">
          <Heart size={20} filled className="text-[#E53935]" />
          <span className="font-bold text-[14px]">Kaydedilenler</span>
        </Link>
      </div>
      <Link href="/fitness/rekor" className="card p-4 flex items-center gap-3" data-testid="pr-link">
        <span className="w-11 h-11 rounded-2xl bg-[#E53935]/12 text-[#E53935] flex items-center justify-center shrink-0"><Flame size={22} /></span>
        <span className="flex-1 min-w-0 flex flex-col"><b className="text-[15px]">Rekor denemesi</b><span className="text-[12.5px] text-mute">Isınma basamakları, plaka dizilimi ve 3 deneme</span></span>
        <Next size={18} className="text-mute shrink-0" />
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/fitness/antrenman" className="card p-4 flex flex-col gap-2 min-h-[104px]">
          <Spark size={20} className="text-acc" />
          <span className="font-bold">Serbest antrenman</span>
          <span className="text-[12px] text-mute">Programsız, hareket seçerek</span>
        </Link>
        <Link href="/fitness/kardiyo" className="card p-4 flex flex-col gap-2 min-h-[104px]">
          <Pulse size={20} className="text-water" />
          <span className="font-bold">Kardiyo ekle</span>
          <span className="text-[12px] text-mute">Koşu, bisiklet, yüzme…</span>
        </Link>
      </div>

      <nav aria-label="Fitness bölümleri" className="grid grid-cols-3 gap-2">
        <Link href="/fitness/istatistik" className="card px-3 py-3 flex flex-col items-center gap-1 text-[13px] font-bold"><Chart size={18} className="text-orange" />İstatistik</Link>
        <Link href="/fitness/olcumler" className="card px-3 py-3 flex flex-col items-center gap-1 text-[13px] font-bold"><Scale size={18} className="text-violet" />Ölçüler</Link>
        <Link href="/fitness/hareketler" className="card px-3 py-3 flex flex-col items-center gap-1 text-[13px] font-bold"><Dumbbell size={18} className="text-acc" />Hareketler</Link>
      </nav>

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

      {h.prs.length ? (
        <section aria-label="Son rekorlar" className="card p-5 flex flex-col gap-2">
          <div className="flex items-center gap-2"><Flame size={18} className="text-orange" /><Eyebrow>Son rekorlar</Eyebrow></div>
          {h.prs.map((p) => (
            <div key={p.id} className="flex justify-between text-[14px]">
              <span className="text-ink-2">{p.name} · {PR_LABEL[p.type as PrType] ?? p.type}</span>
              <span className="num font-bold">{fmtPr(p.type, p.value)}</span>
            </div>
          ))}
        </section>
      ) : null}

      <section aria-label="Son antrenmanlar" className="card p-5 flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1"><Clock size={18} className="text-mute" /><Eyebrow>Son antrenmanlar</Eyebrow></div>
        {h.recent.length ? h.recent.map((w) => (
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

      <Link href="/fitness/programlar" className={btn.secondary}>Programlarım ({h.programs.length})</Link>
    </div>
  )
}

function fmtPr(type: string, v: number) {
  if (type === 'reps') return `${v} tekrar`
  if (type === 'volume') return `${fmtNum(v)} kg`
  return `${fmtNum(v, v % 1 ? 1 : 0)} kg`
}
